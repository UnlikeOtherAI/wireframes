'use strict';

/**
 * Repeat rules checked on authored, unresolved documents (design
 * `docs/done/2026-11-19-repeat-cells.md` §4.3): the cell resolves
 * (UNKNOWN_REPEAT_CELL), the node can host rows (REPEAT_INVALID_HOST), item ids
 * are unique (DUPLICATE_REPEAT_ITEM_ID), and no collection binding can clone the
 * rows (REPEAT_WITH_BINDING), including one that reaches the repeat across a
 * component boundary (`repeat-bindings.js`). The checks on rendered rows (ids,
 * form references, the budget) run on the resolved page in `rendered-roots.js`.
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
const { collectSlotPlaceholders, isSlotPlaceholder } = require('../component-registry/slot-placeholders');
const { createBindingLookup, isCollectionBinding } = require('./repeat-bindings');

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
  if (scope.bindings.root(repeat.cell)) {
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

/**
 * `bound` is the collection binding the node renders under, or null: written
 * above it in the same tree (`local`), or reached across a component boundary.
 */
function checkHost(node, at, scope, bound, report) {
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
  const own = isCollectionBinding(node.binding);
  if (bound && !bound.local) {
    report('errors', 'REPEAT_WITH_BINDING',
      `Repeat on "${node.id}" in ${scope.where} renders under the collection binding on "${bound.id}" in ${bound.where}, which would clone every row. Use one of the two: repeat for inline items, binding for a dataset.`,
      under(at, ['repeat'], true));
  } else if (own || bound) {
    report('errors', 'REPEAT_WITH_BINDING',
      `Repeat on "${node.id}" in ${scope.where} sits ${bound ? 'under' : 'on'} a collection binding, which would clone every row. Use one of the two: repeat for inline items, binding for a dataset.`,
      under(at, ['repeat'], true));
  }
  // Cloned rows clone whatever their cell renders, its own repeats included.
  const rowsBound = bound || (own ? { id: node.id, where: scope.where } : null);
  if (rowsBound && !isElementCell(repeat.cell)) checkBoundDefinition({ use: repeat.cell }, scope, rowsBound, report);
}

/** The slots an instance fills, as the resolver reads them: `children` fill `default`. */
function filledSlots(instance) {
  const names = Array.isArray(instance.children) ? ['default'] : [];
  if (isObject(instance.slots)) {
    for (const [name, nodes] of Object.entries(instance.slots)) {
      if (Array.isArray(nodes) && !names.includes(name)) names.push(name);
    }
  }
  return names.sort();
}

/** An instance's keys that override its definition's root (`resolver/index.js`). */
function overridesOf(instance) {
  const overrides = { ...instance };
  for (const key of ['use', 'props', 'slots', 'repeat']) delete overrides[key];
  return overrides;
}

/**
 * Walks what a definition renders for `instance` under a collection binding,
 * reporting its repeats where it writes them. What renders is what the resolver
 * renders: a filled slot's fallback does not, and in a definition without slots
 * instance `children` replace the root's children and its rows, so only the
 * root's own instance (`use:`) and the fills it writes for it are left.
 */
function checkBoundDefinition(instance, scope, bound, report) {
  const ref = instance.use;
  // A built-in owns no repeat, and has no file to point at.
  const definition = isObject(scope.definitions) && hasOwn(scope.definitions, ref) ? scope.definitions[ref] : null;
  if (!isObject(definition?.root)) return;
  const slotted = collectSlotPlaceholders(definition).length > 0;
  const replaced = slotted ? filledSlots(instance) : [];
  const overridden = !slotted && hasOwn(instance, 'children');
  const key = JSON.stringify([ref, bound.where, bound.id, overridden, replaced]);
  if (scope.entered.has(key)) return;
  scope.entered.add(key);

  const source = isObject(scope.sources) ? scope.sources[ref] : null;
  const at = rootPlace(ref, source);
  const inner = { ...scope, where: `component "${ref}"`, replaced: new Set(replaced) };
  const site = { id: bound.id, where: bound.where };
  if (!overridden) {
    checkTree(definition.root, at, inner, site, report);
    return;
  }
  const { root } = definition;
  if (typeof root.use !== 'string') return;
  checkBoundDefinition({ ...root, ...overridesOf(instance) }, scope, site, report);
  for (const { segments, nodes } of childNodeEntries(root)) {
    if (segments[0] !== 'slots') continue;
    nodes.forEach((child, index) => checkTree(child, under(at, [...segments, index]), inner, site, report));
  }
}

function checkTree(node, at, scope, bound, report) {
  if (!isObject(node)) return;
  // A fallback the caller replaces never renders.
  if (isSlotPlaceholder(node) && scope.replaced?.has(node.slot)) return;
  if (hasOwn(node, 'repeat')) checkHost(node, at, scope, bound, report);
  const here = bound || (isCollectionBinding(node.binding) ? { id: node.id, where: scope.where, local: true } : null);
  const use = typeof node.use === 'string' ? node.use : null;
  // A binding on or above an instance lands on its definition's root.
  if (use && here) checkBoundDefinition(node, scope, here, report);
  for (const { segments, nodes } of childNodeEntries(node)) {
    const below = here || (use ? scope.bindings.fill(node, segments) : null);
    nodes.forEach((child, index) => checkTree(child, under(at, [...segments, index]), scope, below, report));
  }
}

function checkNodes(nodes, at, scope, report) {
  list(nodes).forEach((node, index) => checkTree(node, under(at, [index]), scope, null, report));
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
  // Per registry: its binding lookups, and the bound walks already made.
  const registries = new Map();
  const scopeOf = (definitions, sources, where) => {
    if (!registries.has(definitions)) registries.set(definitions, { bindings: createBindingLookup(definitions), entered: new Set() });
    return { definitions, sources, where, ...registries.get(definitions) };
  };
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
      checkTree(definition.root, rootPlace(componentId, source), scopeOf(scope.definitions, scope.sources, `component "${componentId}"`), null, report);
    }
  }

  for (const [templateId, template] of Object.entries(isObject(templates) ? templates : {})) {
    if (!isObject(template)) continue;
    const scope = scopeOf(templateScope, isObject(templateDefinitions) ? templateSources : sources, `template "${templateId}"`);
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
    const scope = isObject(entry.definitions)
      ? scopeOf(entry.definitions, entry.sources, `page "${entry.id}"`)
      : scopeOf(definitions, sources, `page "${entry.id}"`);
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

module.exports = { checkRepeats };
