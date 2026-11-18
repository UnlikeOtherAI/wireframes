'use strict';

/**
 * Slot rules for reusable components (design §4.3), checked on authored,
 * unresolved documents. Works from in-memory maps only, so the CLI doctor, the
 * source linter and the in-memory `validateProject` entry point share it.
 *
 * Returns `{ severity, code, message, at }` entries; severity is `errors` or
 * `info`. `at` is `{ document, path, key? }`, where the finding is written.
 */

const { appendPath } = require('../schema/validator');
const { childNodeEntries } = require('../component-registry/child-nodes');
const { resolveComponentDefinition } = require('../component-registry/definition-lookup');
const {
  collectSlotPlaceholders,
  componentSlotNames,
  isSlotPlaceholder,
} = require('../component-registry/slot-placeholders');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function under(at, segments, key = false) {
  const path = segments.reduce((current, segment) => appendPath(current, segment), at.path);
  return key ? { document: at.document, path, key: true } : { document: at.document, path };
}

/** Visits every node below `nodes`, slot fills included, with where each is written. */
function walk(nodes, at, visit) {
  if (!Array.isArray(nodes)) return;
  nodes.forEach((node, index) => {
    if (!isObject(node)) return;
    const nodeAt = under(at, [index]);
    visit(node, nodeAt);
    for (const { segments, nodes: list } of childNodeEntries(node)) walk(list, under(nodeAt, segments), visit);
  });
}

function slotList(names) {
  return names.length > 0 ? names.map((name) => `"${name}"`).join(', ') : 'none';
}

function checkInstance(node, at, definitions, where, report) {
  const definition = resolveComponentDefinition(node.use, definitions);
  if (!isObject(definition) || !isObject(definition.root)) return;

  const instance = `Instance "${node.id}" of component "${node.use}" in ${where}`;
  const declared = componentSlotNames(definition);
  const slots = isObject(node.slots) ? node.slots : {};
  const fillAt = (name) => under(at, ['slots', name], true);

  if (declared.length === 0) {
    for (const name of Object.keys(slots)) {
      report('errors', 'UNKNOWN_COMPONENT_SLOT',
        `${instance} fills slot "${name}", but "${node.use}" declares no slots. Valid slots: none.`, fillAt(name));
    }
    return;
  }

  const hasChildren = Array.isArray(node.children);
  if (hasChildren && hasOwn(slots, 'default')) {
    report('errors', 'DUPLICATE_DEFAULT_SLOT_FILL',
      `${instance} gives both children and slots.default. Children fill the default slot, so keep only one.`, fillAt('default'));
  }

  const filled = new Set();
  if (hasChildren) filled.add('default');
  for (const [name, fill] of Object.entries(slots)) {
    if (!declared.includes(name)) {
      report('errors', 'UNKNOWN_COMPONENT_SLOT',
        `${instance} fills slot "${name}", which "${node.use}" does not declare. Valid slots: ${slotList(declared)}.`, fillAt(name));
    } else if (Array.isArray(fill)) {
      filled.add(name);
    }
  }
  if (hasChildren && !declared.includes('default')) {
    report('errors', 'UNKNOWN_COMPONENT_SLOT',
      `${instance} passes children, which fill slot "default", but "${node.use}" does not declare it. Valid slots: ${slotList(declared)}.`,
      under(at, ['children'], true));
  }

  const seen = new Set();
  for (const placeholder of collectSlotPlaceholders(definition)) {
    const name = placeholder.slot;
    if (typeof name !== 'string' || seen.has(name)) continue;
    seen.add(name);
    if (!filled.has(name) && !Array.isArray(placeholder.children)) {
      report('info', 'EMPTY_COMPONENT_SLOT',
        `${instance} leaves slot "${name}" empty: it passes no content and the slot has no fallback. Pass [] to leave it empty on purpose.`,
        under(at, ['id']));
    }
  }
}

function checkNode(node, at, definitions, where, report) {
  if (hasOwn(node, 'slots') && node.use == null) {
    report('errors', 'SLOTS_WITHOUT_USE',
      `Node "${node.id}" in ${where} has slots but no use:. Only an instance of a reusable component takes slot fills.`,
      under(at, ['slots'], true));
    return;
  }
  if (node.use != null) checkInstance(node, at, definitions, where, report);
}

/** Node arrays outside any component definition: pages, templates and overlays. */
function checkOutside(nodes, at, definitions, where, report) {
  walk(nodes, at, (node, nodeAt) => {
    if (isSlotPlaceholder(node)) {
      report('errors', 'SLOT_OUTSIDE_COMPONENT',
        `Slot placeholder "${node.id}" (slot "${node.slot}") in ${where} is outside a component. Placeholders belong inside a component definition; fill a slot on its instance with children or slots.`,
        under(nodeAt, ['slot'], true));
    }
    checkNode(node, nodeAt, definitions, where, report);
  });
}

function checkDefinition(componentId, definition, definitions, report) {
  if (!isObject(definition) || !isObject(definition.root)) return;
  const where = `component "${componentId}"`;
  const rootAt = { document: 'components', path: `${appendPath('$.components', componentId)}.root` };
  if (isSlotPlaceholder(definition.root)) {
    report('errors', 'SLOT_OUTSIDE_COMPONENT',
      `Component "${componentId}" has a slot placeholder as its root. A placeholder goes inside the root, never in its place.`,
      under(rootAt, ['slot'], true));
    return;
  }

  // Where each slot name is declared, in document order.
  const byName = new Map();
  const walkRoot = (visit) => {
    for (const { segments, nodes } of childNodeEntries(definition.root)) walk(nodes, under(rootAt, segments), visit);
  };
  walkRoot((node, at) => {
    if (!isSlotPlaceholder(node)) return;
    if (!byName.has(node.slot)) byName.set(node.slot, []);
    byName.get(node.slot).push(at);
  });
  for (const [name, places] of byName) {
    if (places.length > 1) {
      // Underlined where the name was repeated, not where it was first declared.
      report('errors', 'DUPLICATE_COMPONENT_SLOT',
        `Component "${componentId}" declares slot "${name}" ${places.length} times. Each slot name may appear once in a component.`,
        under(places[1], ['slot']));
    }
  }

  checkNode(definition.root, rootAt, definitions, where, report);
  walkRoot((node, at) => checkNode(node, at, definitions, where, report));
}

/**
 * @param {object} input
 * @param {object} input.definitions Component id to definition, ids qualified by import alias.
 * @param {object} [input.templates] Template id to template.
 * @param {object} [input.templateDefinitions] Definitions visible to templates; defaults to `definitions`.
 * @param {Array<{id: string, page: object, definitions?: object}>} [input.pages] Page payloads, each with the
 *   definitions it can see; defaults to `definitions`.
 */
function checkComponentSlots({ definitions = {}, templates = {}, templateDefinitions, pages = [] }) {
  const diagnostics = [];
  const report = (severity, code, message, at) => diagnostics.push({ severity, code, message, at });

  for (const [componentId, definition] of Object.entries(isObject(definitions) ? definitions : {})) {
    checkDefinition(componentId, definition, definitions, report);
  }

  const templateScope = isObject(templateDefinitions) ? templateDefinitions : definitions;
  for (const [templateId, template] of Object.entries(isObject(templates) ? templates : {})) {
    if (!isObject(template)) continue;
    const where = `template "${templateId}"`;
    const at = { document: 'templates', path: appendPath('$.templates', templateId) };
    (Array.isArray(template.regions) ? template.regions : []).forEach((region, index) => {
      if (isObject(region)) checkOutside(region.children, under(at, ['regions', index, 'children']), templateScope, where, report);
    });
    (Array.isArray(template.overlays) ? template.overlays : []).forEach((overlay, index) => {
      if (isObject(overlay)) {
        checkOutside(overlay.content, under(at, ['overlays', index, 'content']), templateScope, `${where} overlay "${overlay.id}"`, report);
      }
    });
  }

  for (const entry of pages) {
    const page = isObject(entry?.page) ? entry.page : null;
    if (!page) continue;
    const scope = isObject(entry.definitions) ? entry.definitions : definitions;
    const where = `page "${entry.id}"`;
    const at = { document: `page:${entry.id}`, path: '$.page' };
    for (const key of ['slots', 'injectables', 'overlays']) {
      (Array.isArray(page[key]) ? page[key] : []).forEach((container, index) => {
        if (isObject(container)) checkOutside(container.content, under(at, [key, index, 'content']), scope, where, report);
      });
    }
  }

  return diagnostics;
}

module.exports = { checkComponentSlots };
