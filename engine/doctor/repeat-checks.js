'use strict';

/**
 * Repeat rules checked on authored, unresolved documents (design
 * `docs/plans/2026-11-19-repeat-cells.md` §4.3): the cell resolves
 * (UNKNOWN_REPEAT_CELL), the node can host rows (REPEAT_INVALID_HOST), item ids
 * are unique (DUPLICATE_REPEAT_ITEM_ID), and no collection binding can clone the
 * rows (REPEAT_WITH_BINDING). The checks on rendered rows (ids, form
 * references, the budget) run on the resolved page in `rendered-roots.js`.
 *
 * Takes what `checkComponentSlots` takes and returns the same
 * `{ severity, code, message, at }` entries.
 */

const { appendPath } = require('../schema/validator');
const { ALIASES, primitiveNames } = require('../schema/primitive-registry');
const { nearest } = require('../schema/nearest-name');
const { builtinComponentIds } = require('../stdlib');
const { childNodeEntries } = require('../component-registry/child-nodes');
const { authoredReference, resolveComponentDefinition } = require('../component-registry/definition-lookup');
const { isElementCell, repeatHostProblem, repeatOf } = require('../component-registry/repeat');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const list = (value) => (Array.isArray(value) ? value : []);

function under(at, segments, key = false) {
  const place = { document: at.document, path: segments.reduce((current, segment) => appendPath(current, segment), at.path) };
  if (at.file) place.file = at.file;
  if (key) place.key = true;
  return place;
}

function rootPlace(componentId, source) {
  if (!isObject(source)) return { document: 'components', path: `${appendPath('$.components', componentId)}.root` };
  return { document: 'components', file: source.sourcePath, path: `${appendPath('$.components', source.localId)}.root` };
}

/** A binding whose source names a data source clones its node once per item; an expression does not. */
function isCollectionBinding(binding) {
  if (!isObject(binding) || typeof binding.source !== 'string') return false;
  const source = binding.source.trim();
  return source !== '' && !source.startsWith('{{');
}

function suggestion(cell, definitions) {
  const pool = [...primitiveNames(), ...ALIASES.keys(), ...builtinComponentIds(), ...Object.keys(definitions || {})];
  const near = nearest(cell, pool.map(authoredReference));
  return near ? ` Did you mean "${near}"?` : '';
}

function checkCell(node, repeat, at, scope, report) {
  if (isElementCell(repeat.cell)) return;
  const cell = authoredReference(repeat.cell);
  const definition = resolveComponentDefinition(repeat.cell, scope.definitions);
  if (!isObject(definition) || !isObject(definition.root)) {
    report('errors', 'UNKNOWN_REPEAT_CELL',
      `Repeat on "${node.id}" in ${scope.where} names cell "${cell}", which is neither an element nor a component.${suggestion(cell, scope.definitions)}`,
      under(at, ['repeat', 'cell']));
    return;
  }
  if (isCollectionBinding(definition.root.binding)) {
    report('errors', 'REPEAT_WITH_BINDING',
      `Repeat on "${node.id}" in ${scope.where} uses cell "${cell}", whose root has a collection binding that would clone every row. Bind the data in one place: drop the binding, or render the dataset without repeat.`,
      under(at, ['repeat'], true));
  }
}

function checkItems(node, repeat, at, scope, report) {
  const seen = new Set();
  repeat.items.forEach((item, index) => {
    if (!isObject(item) || typeof item.id !== 'string') return;
    if (seen.has(item.id)) {
      report('errors', 'DUPLICATE_REPEAT_ITEM_ID',
        `Repeat on "${node.id}" in ${scope.where} has two items with id "${item.id}". Each item id is the key of one row, so give this one its own.`,
        under(at, ['repeat', 'items', index, 'id']));
    }
    seen.add(item.id);
  });
}

function checkHost(node, at, scope, boundAbove, report) {
  const problem = repeatHostProblem(node);
  if (problem) {
    report('errors', 'REPEAT_INVALID_HOST',
      `Node "${node.id}" in ${scope.where} cannot host repeat: ${problem}. Put the repeat on a container such as stack, row, grid or card.`,
      under(at, ['repeat'], true));
  }
  const repeat = repeatOf(node);
  if (!repeat) return;
  checkCell(node, repeat, at, scope, report);
  checkItems(node, repeat, at, scope, report);
  if (isCollectionBinding(node.binding) || boundAbove) {
    report('errors', 'REPEAT_WITH_BINDING',
      `Repeat on "${node.id}" in ${scope.where} sits ${boundAbove ? 'under' : 'on'} a collection binding, which would clone every row. Use one of the two: repeat for inline items, binding for a dataset.`,
      under(at, ['repeat'], true));
  }
}

function checkTree(node, at, scope, boundAbove, report) {
  if (!isObject(node)) return;
  if (hasOwn(node, 'repeat')) checkHost(node, at, scope, boundAbove, report);
  const bound = boundAbove || isCollectionBinding(node.binding);
  for (const { segments, nodes } of childNodeEntries(node)) {
    nodes.forEach((child, index) => checkTree(child, under(at, [...segments, index]), scope, bound, report));
  }
}

function checkNodes(nodes, at, scope, report) {
  list(nodes).forEach((node, index) => checkTree(node, under(at, [index]), scope, false, report));
}

/** A region or overlay record is not a node: its repeat would never render. */
function checkRecord(record, at, what, scope, report) {
  if (!isObject(record) || !hasOwn(record, 'repeat')) return;
  report('errors', 'REPEAT_INVALID_HOST',
    `${what} "${record.id}" in ${scope.where} cannot host repeat: it is a record, not a node. Put the repeat on a node in its ${what === 'Region' ? 'children' : 'content'}.`,
    under(at, ['repeat'], true));
}

/** Same inputs as `checkComponentSlots` (see there). */
function checkRepeats({
  definitions = {}, sources, templates = {}, templateDefinitions, templateSources, pages = [],
}) {
  const diagnostics = [];
  const reported = new Set();
  const report = (severity, code, message, at) => {
    const key = JSON.stringify([severity, code, message, at.document, at.file ?? null, at.path, at.key === true]);
    if (reported.has(key)) return;
    reported.add(key);
    diagnostics.push({ severity, code, message, at });
  };

  // Every definition is checked in every scope that can see it: a cell may
  // resolve differently in each (see `checkComponentSlots`).
  const templateScope = isObject(templateDefinitions) ? templateDefinitions : definitions;
  const scopes = [
    { definitions, sources },
    { definitions: templateScope, sources: isObject(templateDefinitions) ? templateSources : sources },
    ...pages.map((entry) => ({ definitions: entry?.definitions, sources: entry?.sources })),
  ];
  for (const scope of scopes) {
    if (!isObject(scope.definitions)) continue;
    for (const [componentId, definition] of Object.entries(scope.definitions)) {
      if (!isObject(definition)) continue;
      const source = isObject(scope.sources) ? scope.sources[componentId] : null;
      checkTree(definition.root, rootPlace(componentId, source), { definitions: scope.definitions, where: `component "${componentId}"` }, false, report);
    }
  }

  for (const [templateId, template] of Object.entries(isObject(templates) ? templates : {})) {
    if (!isObject(template)) continue;
    const scope = { definitions: templateScope, where: `template "${templateId}"` };
    const at = { document: 'templates', path: appendPath('$.templates', templateId) };
    list(template.regions).forEach((region, index) => {
      checkRecord(region, under(at, ['regions', index]), 'Region', scope, report);
      if (isObject(region)) checkNodes(region.children, under(at, ['regions', index, 'children']), scope, report);
    });
    list(template.overlays).forEach((overlay, index) => {
      checkRecord(overlay, under(at, ['overlays', index]), 'Overlay', scope, report);
      if (isObject(overlay)) checkNodes(overlay.content, under(at, ['overlays', index, 'content']), scope, report);
    });
  }

  for (const entry of pages) {
    const page = isObject(entry?.page) ? entry.page : null;
    if (!page) continue;
    const scope = { definitions: isObject(entry.definitions) ? entry.definitions : definitions, where: `page "${entry.id}"` };
    const at = { document: `page:${entry.id}`, path: '$.page' };
    for (const key of ['slots', 'injectables', 'overlays']) {
      list(page[key]).forEach((container, index) => {
        if (key === 'overlays') checkRecord(container, under(at, [key, index]), 'Overlay', scope, report);
        if (isObject(container)) checkNodes(container.content, under(at, [key, index, 'content']), scope, report);
      });
    }
  }

  return diagnostics;
}

module.exports = { checkRepeats, isCollectionBinding };
