'use strict';

// The page as it renders, resolved as the build resolves it (`build/page-tree.js`):
// its template's regions with the page's content, then the template's overlays and
// the page's own. Ids and form references are checked on that tree. Content that
// cannot be expanded is not walked; each authored entry that fails is reported
// where it is written, so validation fails before the build does.

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

/**
 * The authored entries the template's regions render, each with where it is
 * written: a slot region shows the page's content for it, else its own children,
 * and page injectables fill the placeholders. As `resolveRegion` chooses.
 */
function regionEntries(page, pageId, template, templateId) {
  const entries = [];
  const add = (nodes, document, path, where) => list(nodes).forEach((node, index) => {
    entries.push({ node, at: { document, path: `${path}[${index}]` }, where });
  });
  const slots = list(page.slots);
  list(template.regions).forEach((region, regionIndex) => {
    if (!isObject(region)) return;
    let slotIndex = -1;
    if (region.kind === 'slot') {
      slots.forEach((slot, index) => { if (isObject(slot) && slot.slotId === region.id) slotIndex = index; });
    }
    if (slotIndex >= 0) {
      add(slots[slotIndex].content, `page:${pageId}`, `$.page.slots[${slotIndex}].content`, `page "${pageId}" slot "${region.id}"`);
    } else {
      add(region.children, 'templates', `${appendPath('$.templates', templateId)}.regions[${regionIndex}].children`,
        `template "${templateId}" region "${region.id}" of page "${pageId}"`);
    }
  });
  list(page.injectables).forEach((injectable, index) => {
    if (!isObject(injectable)) return;
    add(injectable.content, `page:${pageId}`, `$.page.injectables[${index}].content`, `page "${pageId}" injectable "${injectable.injectableId}"`);
  });
  return entries;
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
  const reportFailures = (entries) => {
    for (const entry of entries) {
      const failure = resolveNodes([entry.node], components);
      if (failure.ok) continue;
      if (failure.reason === 'unknown-component' && usesDirectly(entry.node, failure.componentId)) continue;
      if (failure.reason === 'circular-component') {
        graph = graph || collectComponentUseGraph(projectComponents);
        if (onCycle(graph, failure.componentId)) continue;
      }
      const id = typeof entry.node?.id === 'string' ? entry.node.id : '<unnamed>';
      addDiagnostic(
        result,
        failure.reason === 'circular-component' ? 'CIRCULAR_TEMPLATE_REFERENCE' : 'BROKEN_COMPONENT_REFERENCE',
        `Node "${id}" in ${entry.where} cannot be expanded: ${failure.error}`,
        entry.at,
      );
    }
  };

  if (isObject(template)) {
    const templatePage = resolveTemplatePage({ template, page, components });
    if (templatePage.ok) roots.push(...templatePage.roots);
    else reportFailures(regionEntries(page, pageId, template, page.template));
  }

  for (const { overlay, document, path, where } of overlaysOf(page, pageId, template, page.template)) {
    if (!isObject(overlay) || !Array.isArray(overlay.content)) continue;
    const resolved = resolveNodes(overlay.content, components);
    if (resolved.ok) {
      roots.push(...resolved.nodes);
    } else {
      reportFailures(overlay.content.map((node, index) => ({ node, at: { document, path: `${path}.content[${index}]` }, where })));
    }
  }

  return roots;
}

module.exports = { collectRenderedRoots };
