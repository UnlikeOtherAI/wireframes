'use strict';

// The page as it renders, resolved as the build resolves it (`build/page-tree.js`):
// its template's regions with the page's content, then the template's overlays and
// the page's own, all sharing one expansion budget. Ids, form references and row
// lint are checked on that tree. Content that cannot be expanded is not walked;
// each authored entry that would render and fails is reported where it is written,
// so validation fails before the build does, and the entries around it are still
// checked. A page over the budget is reported once, and nothing after it is
// expanded.

const { resolveTemplatePage } = require('../resolver');
const { resolveNodes } = require('../resolver/nodes');
const { cloneDeep } = require('../resolver/component-prep');
const { appendPath } = require('../schema/validator');
const { childNodeLists } = require('../component-registry/child-nodes');
const { createExpansionBudget } = require('../component-registry/expansion');
const { repeatCellReference } = require('../component-registry/repeat');
const { collectComponentUseGraph } = require('./component-graph');
const { isObject, addDiagnostic } = require('./semantic-interactions');
const { placeOf, repeatPlaceOf, stampRenderedInputs } = require('./row-places');

const list = (value) => (Array.isArray(value) ? value : []);

/** Whether `node` or anything written below it has `use: id`, or `id` as its repeat cell. */
function usesDirectly(node, id) {
  if (!isObject(node)) return false;
  if (node.use === id || repeatCellReference(node) === id) return true;
  return childNodeLists(node).some((nodes) => nodes.some((child) => usesDirectly(child, id)));
}

/** Whether `id` reaches itself in the component graph. */
function onCycle(graph, id) {
  const seen = new Set();
  const queue = [...(graph[id] || [])];
  while (queue.length > 0) {
    const next = queue.shift();
    if (next === id) return true;
    if (!seen.has(next)) {
      seen.add(next);
      queue.push(...(graph[next] || []));
    }
  }
  return false;
}

// An injection stands in for itself as one node with this key while an entry is
// expanded, so a failure belongs to the entry and the result shows which
// placeholders it renders.
const INJECTED = '__wfInjected';
const ENTRY_REGION = '__entry__';

function entriesOf(nodes, document, path, where) {
  return list(nodes).map((node, index) => ({ node, at: { document, path: `${path}[${index}]` }, where }));
}

/**
 * Each of the template's regions with the authored entries it renders, each with
 * where it is written: a slot region shows the page's content for it, else its
 * own children. As `resolveRegion` chooses.
 */
function regionEntries(page, pageId, template, templateId) {
  const slots = list(page.slots);
  return list(template.regions).flatMap((region, regionIndex) => {
    if (!isObject(region)) return [];
    let slotIndex = -1;
    if (region.kind === 'slot') {
      slots.forEach((slot, index) => { if (isObject(slot) && slot.slotId === region.id) slotIndex = index; });
    }
    const entries = slotIndex >= 0
      ? entriesOf(slots[slotIndex].content, `page:${pageId}`, `$.page.slots[${slotIndex}].content`, `page "${pageId}" slot "${region.id}"`)
      : entriesOf(region.children, 'templates', `${appendPath('$.templates', templateId)}.regions[${regionIndex}].children`,
        `template "${templateId}" region "${region.id}" of page "${pageId}"`);
    return [{ region, entries }];
  });
}

/** Injectable id to the entries its injection renders; the last injection of an id is the one used. */
function injectionEntries(page, pageId) {
  const byId = new Map();
  list(page.injectables).forEach((injectable, index) => {
    if (!isObject(injectable) || typeof injectable.injectableId !== 'string') return;
    byId.set(injectable.injectableId, entriesOf(injectable.content, `page:${pageId}`, `$.page.injectables[${index}].content`,
      `page "${pageId}" injectable "${injectable.injectableId}"`));
  });
  return byId;
}

function injectedIds(value, found) {
  if (Array.isArray(value)) {
    value.forEach((entry) => injectedIds(entry, found));
  } else if (isObject(value)) {
    if (typeof value[INJECTED] === 'string') found.push(value[INJECTED]);
    else Object.values(value).forEach((entry) => injectedIds(entry, found));
  }
  return found;
}

/** Expands one entry as a region does, with each of `ids` injected as its marker. */
function expandEntry(node, components, ids, budget) {
  const resolved = resolveTemplatePage({
    template: { regions: [{ id: ENTRY_REGION, kind: 'slot' }] },
    page: {
      slots: [{ slotId: ENTRY_REGION, content: [node] }],
      injectables: ids.map((id) => ({ injectableId: id, content: [{ [INJECTED]: id }] })),
    },
    components,
    budget,
  });
  return resolved.ok ? { ok: true, nodes: resolved.roots[0].children } : resolved;
}

/**
 * `value` with each injection's expanded entries where it stands in for itself.
 * One that reaches itself again renders nothing there, as `inject` in the
 * resolver does.
 */
function placeInjections(value, expandedById, active = new Set()) {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const id = isObject(entry) ? entry[INJECTED] : undefined;
      if (typeof id !== 'string') return [placeInjections(entry, expandedById, active)];
      if (active.has(id)) return [];
      active.add(id);
      const placed = placeInjections(cloneDeep(expandedById.get(id) || []), expandedById, active);
      active.delete(id);
      return placed;
    });
  }
  if (isObject(value)) {
    for (const key of Object.keys(value)) value[key] = placeInjections(value[key], expandedById, active);
  }
  return value;
}

/** The regions rebuilt from the entries that expanded, each injection in its place. */
function assembleRegions(regions, injections) {
  const expanded = (entries) => entries.flatMap((entry) => entry.nodes || []);
  const byId = new Map([...injections].map(([id, entries]) => [id, expanded(entries)]));
  return regions.map(({ region, entries }) => ({ ...cloneDeep(region), children: placeInjections(expanded(entries), byId) }));
}

/** The template's overlays, then the page's, each with where it is written. */
function overlaysOf(page, pageId, template, templateId) {
  const templatePath = appendPath('$.templates', templateId);
  return [
    ...list(template?.overlays).map((overlay, index) => ({
      overlay, document: 'templates', path: `${templatePath}.overlays[${index}]`,
      where: `template "${templateId}" overlay "${overlay?.id}" of page "${pageId}"`,
    })),
    ...list(page.overlays).map((overlay, index) => ({
      overlay, document: `page:${pageId}`, path: `$.page.overlays[${index}]`, where: `page "${pageId}" overlay "${overlay?.id}"`,
    })),
  ];
}

/**
 * @param {object} input
 * @param {object} input.result
 * @param {string} input.pageId
 * @param {object} input.page                the page payload
 * @param {object|null} input.template       its template, when it has one
 * @param {object} input.components          what the page resolves against
 * @param {object} input.projectComponents   the project's own components, whose cycles the cycle check reports
 * @param {object} [input.sources]           where each of `components` is written, `{ sourcePath, localId }`
 *
 * The roots are resolved from stamped copies, so a repeat row carries where its
 * item is written (`row-places.js`). Returns `{ roots, complete }`; `complete` is
 * false when something failed to expand, so an id missing from `roots` may only
 * be in what failed.
 */
function collectRenderedRoots({ result, pageId, page: authoredPage, template: authoredTemplate, components: authoredComponents, projectComponents, sources }) {
  const { page, template, components } = stampRenderedInputs({
    pageId, page: authoredPage, template: authoredTemplate, templateId: authoredPage.template, components: authoredComponents,
  });
  const roots = [];
  let complete = true;
  let graph = null;
  // The page's regions and overlays share one budget, as they do when it builds.
  let budget = createExpansionBudget();
  const pageAt = { document: `page:${pageId}`, path: '$.page' };

  // A fan-out is reported at the outermost repeat it passes through. An unknown
  // id written in the entry itself, an unknown repeat cell, and a cycle among the
  // project's own components are already reported by the reference, repeat and
  // cycle checks. Anything else that fails inside a row is located at the
  // outermost row's item.
  const reportFailure = (entry, failure) => {
    complete = false;
    if (failure.reason === 'expansion-budget') {
      addDiagnostic(result, 'MAX_NODES_PER_PAGE_EXCEEDED', `Page "${pageId}" cannot be expanded: ${failure.error}`, pageAt);
      return;
    }
    if (failure.reason === 'repeat-budget') {
      const at = failure.row ? repeatPlaceOf(failure.row, sources) : placeOf(failure.host, sources, ['repeat']);
      addDiagnostic(result, 'REPEAT_BUDGET_EXCEEDED', failure.error, at ? { ...at, key: true } : (entry?.at || pageAt));
      return;
    }
    if (failure.reason === 'unknown-component' && (failure.repeatCell || usesDirectly(entry.node, failure.componentId))) return;
    if (failure.reason === 'circular-component') {
      graph = graph || collectComponentUseGraph(projectComponents);
      if (onCycle(graph, failure.componentId)) return;
    }
    if (failure.row) {
      const { host, item } = failure.row.__repeat;
      addDiagnostic(result, 'REPEAT_ROW_FAILED', `Item "${item}" of the repeat on "${host}" cannot be expanded: ${failure.error}`,
        placeOf(failure.row, sources) || entry.at);
      return;
    }
    const id = typeof entry.node?.id === 'string' ? entry.node.id : '<unnamed>';
    addDiagnostic(
      result,
      failure.reason === 'circular-component' ? 'CIRCULAR_TEMPLATE_REFERENCE' : 'BROKEN_COMPONENT_REFERENCE',
      `Node "${id}" in ${entry.where} cannot be expanded: ${failure.error}`,
      entry.at,
    );
  };
  const overBudget = (failure) => failure.reason === 'expansion-budget' || failure.reason === 'repeat-budget';
  // One entry against the shared budget. A failure is reported, and one that is
  // not the budget spends none of it. Returns null once the page is over the
  // budget: nothing more is expanded.
  const expandOne = (entry, expand) => {
    const before = budget.used;
    const expanded = expand();
    if (expanded.ok) return expanded;
    reportFailure(entry, expanded);
    if (overBudget(expanded)) return null;
    budget.used = before;
    return expanded;
  };

  if (isObject(template)) {
    const templatePage = resolveTemplatePage({ template, page, components, budget });
    if (templatePage.ok) {
      roots.push(...templatePage.roots);
    } else if (overBudget(templatePage)) {
      reportFailure(null, templatePage);
      return { roots, complete };
    } else {
      // Each entry the regions render is expanded on its own, against a fresh
      // budget they share, and the regions are rebuilt from the entries that
      // expand. An injection is expanded once a placeholder that renders reaches
      // it, so one the page's content replaces is never reported; one reached
      // only through an entry that fails waits until that entry expands.
      budget = createExpansionBudget();
      const injections = injectionEntries(page, pageId);
      const ids = [...injections.keys()];
      const regions = regionEntries(page, pageId, template, page.template);
      const queue = regions.flatMap(({ entries }) => entries);
      const reached = new Set();
      let over = false;
      while (queue.length > 0 && !over) {
        const entry = queue.shift();
        const expanded = expandOne(entry, () => expandEntry(entry.node, components, ids, budget));
        over = expanded === null;
        if (over || !expanded.ok) continue;
        entry.nodes = expanded.nodes;
        for (const id of injectedIds(expanded.nodes, [])) {
          if (reached.has(id)) continue;
          reached.add(id);
          queue.push(...injections.get(id));
        }
      }
      roots.push(...assembleRegions(regions, injections));
      if (over) return { roots, complete };
    }
  }

  for (const { overlay, document, path, where } of overlaysOf(page, pageId, template, page.template)) {
    if (!isObject(overlay) || !Array.isArray(overlay.content)) continue;
    const before = budget.used;
    const resolved = resolveNodes(overlay.content, components, budget);
    if (resolved.ok) {
      roots.push(...resolved.nodes);
      continue;
    }
    if (overBudget(resolved)) {
      reportFailure(null, resolved);
      break;
    }
    budget.used = before;
    for (const entry of entriesOf(overlay.content, document, `${path}.content`, where)) {
      const expanded = expandOne(entry, () => resolveNodes([entry.node], components, budget));
      if (expanded === null) return { roots, complete };
      if (expanded.ok) roots.push(...expanded.nodes);
    }
  }

  return { roots, complete };
}

module.exports = { collectRenderedRoots };
