'use strict';

// The page as it renders, resolved as the build resolves it (`build/page-tree.js`):
// its template's regions with the page's content, then the template's overlays and
// the page's own. Ids and form references are checked on that tree. Content that
// cannot be expanded is not walked; each authored entry that would render and
// fails is reported where it is written, so validation fails before the build does.

const { resolveTemplatePage } = require('../resolver');
const { resolveNodes } = require('../resolver/nodes');
const { appendPath } = require('../schema/validator');
const { childNodeLists } = require('../component-registry/child-nodes');
const { collectComponentUseGraph } = require('./component-graph');
const { isObject, addDiagnostic } = require('./semantic-interactions');

const list = (value) => (Array.isArray(value) ? value : []);

/** Whether `node` or anything written below it has `use: id`. */
function usesDirectly(node, id) {
  if (!isObject(node)) return false;
  if (node.use === id) return true;
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
 * The authored entries the template's regions render, each with where it is
 * written: a slot region shows the page's content for it, else its own children.
 * As `resolveRegion` chooses.
 */
function regionEntries(page, pageId, template, templateId) {
  const slots = list(page.slots);
  return list(template.regions).flatMap((region, regionIndex) => {
    if (!isObject(region)) return [];
    let slotIndex = -1;
    if (region.kind === 'slot') {
      slots.forEach((slot, index) => { if (isObject(slot) && slot.slotId === region.id) slotIndex = index; });
    }
    if (slotIndex >= 0) {
      return entriesOf(slots[slotIndex].content, `page:${pageId}`, `$.page.slots[${slotIndex}].content`, `page "${pageId}" slot "${region.id}"`);
    }
    return entriesOf(region.children, 'templates', `${appendPath('$.templates', templateId)}.regions[${regionIndex}].children`,
      `template "${templateId}" region "${region.id}" of page "${pageId}"`);
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
function expandEntry(node, components, ids) {
  const resolved = resolveTemplatePage({
    template: { regions: [{ id: ENTRY_REGION, kind: 'slot' }] },
    page: {
      slots: [{ slotId: ENTRY_REGION, content: [node] }],
      injectables: ids.map((id) => ({ injectableId: id, content: [{ [INJECTED]: id }] })),
    },
    components,
  });
  return resolved.ok ? { ok: true, injected: injectedIds(resolved.roots, []) } : resolved;
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
 */
function collectRenderedRoots({ result, pageId, page, template, components, projectComponents }) {
  const roots = [];
  let graph = null;

  // An unknown id written in the entry itself, and a cycle among the project's own
  // components, are already reported by the reference and cycle checks.
  const reportFailure = (entry, failure) => {
    if (failure.reason === 'unknown-component' && usesDirectly(entry.node, failure.componentId)) return;
    if (failure.reason === 'circular-component') {
      graph = graph || collectComponentUseGraph(projectComponents);
      if (onCycle(graph, failure.componentId)) return;
    }
    const id = typeof entry.node?.id === 'string' ? entry.node.id : '<unnamed>';
    addDiagnostic(
      result,
      failure.reason === 'circular-component' ? 'CIRCULAR_TEMPLATE_REFERENCE' : 'BROKEN_COMPONENT_REFERENCE',
      `Node "${id}" in ${entry.where} cannot be expanded: ${failure.error}`,
      entry.at,
    );
  };

  if (isObject(template)) {
    const templatePage = resolveTemplatePage({ template, page, components });
    if (templatePage.ok) {
      roots.push(...templatePage.roots);
    } else {
      // Each entry the regions render is expanded on its own. An injection is
      // expanded once a placeholder that renders reaches it, so one the page's
      // content replaces is never reported; one reached only through an entry
      // that fails waits until that entry expands.
      const injections = injectionEntries(page, pageId);
      const ids = [...injections.keys()];
      const queue = regionEntries(page, pageId, template, page.template);
      const reached = new Set();
      while (queue.length > 0) {
        const entry = queue.shift();
        const expanded = expandEntry(entry.node, components, ids);
        if (!expanded.ok) {
          reportFailure(entry, expanded);
          continue;
        }
        for (const id of expanded.injected) {
          if (reached.has(id)) continue;
          reached.add(id);
          queue.push(...injections.get(id));
        }
      }
    }
  }

  for (const { overlay, document, path, where } of overlaysOf(page, pageId, template, page.template)) {
    if (!isObject(overlay) || !Array.isArray(overlay.content)) continue;
    const resolved = resolveNodes(overlay.content, components);
    if (resolved.ok) {
      roots.push(...resolved.nodes);
      continue;
    }
    entriesOf(overlay.content, document, `${path}.content`, where).forEach((entry) => {
      const failure = resolveNodes([entry.node], components);
      if (!failure.ok) reportFailure(entry, failure);
    });
  }

  return roots;
}

module.exports = { collectRenderedRoots };
