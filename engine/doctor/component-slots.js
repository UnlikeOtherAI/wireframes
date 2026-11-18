'use strict';

/**
 * Slot rules for reusable components (design §4.3), checked on authored,
 * unresolved documents. Works from in-memory maps only, so the CLI doctor and
 * the in-memory `validateProject` entry point share it.
 *
 * Returns `{ severity, code, message }` entries; severity is `errors` or `info`.
 */

const { childNodeLists } = require('../component-registry/child-nodes');
const {
  collectSlotPlaceholders,
  componentSlotNames,
  isSlotPlaceholder,
} = require('../component-registry/slot-placeholders');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function walk(nodes, visit) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!isObject(node)) continue;
    visit(node);
    for (const list of childNodeLists(node)) walk(list, visit);
  }
}

function slotList(names) {
  return names.length > 0 ? names.map((name) => `"${name}"`).join(', ') : 'none';
}

function checkInstance(node, definitions, where, report) {
  const definition = typeof node.use === 'string' && isObject(definitions) ? definitions[node.use] : null;
  if (!isObject(definition) || !isObject(definition.root)) return;

  const instance = `Instance "${node.id}" of component "${node.use}" in ${where}`;
  const declared = componentSlotNames(definition);
  const slots = isObject(node.slots) ? node.slots : {};

  if (declared.length === 0) {
    for (const name of Object.keys(slots)) {
      report('errors', 'UNKNOWN_COMPONENT_SLOT',
        `${instance} fills slot "${name}", but "${node.use}" declares no slots. Valid slots: none.`);
    }
    return;
  }

  const hasChildren = Array.isArray(node.children);
  if (hasChildren && hasOwn(slots, 'default')) {
    report('errors', 'DUPLICATE_DEFAULT_SLOT_FILL',
      `${instance} gives both children and slots.default. Children fill the default slot, so keep only one.`);
  }

  const filled = new Set();
  if (hasChildren) filled.add('default');
  for (const [name, fill] of Object.entries(slots)) {
    if (!declared.includes(name)) {
      report('errors', 'UNKNOWN_COMPONENT_SLOT',
        `${instance} fills slot "${name}", which "${node.use}" does not declare. Valid slots: ${slotList(declared)}.`);
    } else if (Array.isArray(fill)) {
      filled.add(name);
    }
  }
  if (hasChildren && !declared.includes('default')) {
    report('errors', 'UNKNOWN_COMPONENT_SLOT',
      `${instance} passes children, which fill slot "default", but "${node.use}" does not declare it. Valid slots: ${slotList(declared)}.`);
  }

  const seen = new Set();
  for (const placeholder of collectSlotPlaceholders(definition)) {
    const name = placeholder.slot;
    if (typeof name !== 'string' || seen.has(name)) continue;
    seen.add(name);
    if (!filled.has(name) && !Array.isArray(placeholder.children)) {
      report('info', 'EMPTY_COMPONENT_SLOT',
        `${instance} leaves slot "${name}" empty: it passes no content and the slot has no fallback. Pass [] to leave it empty on purpose.`);
    }
  }
}

function checkNode(node, definitions, where, report) {
  if (hasOwn(node, 'slots') && node.use == null) {
    report('errors', 'SLOTS_WITHOUT_USE',
      `Node "${node.id}" in ${where} has slots but no use:. Only an instance of a reusable component takes slot fills.`);
    return;
  }
  if (node.use != null) checkInstance(node, definitions, where, report);
}

/** Node arrays outside any component definition: pages, templates and overlays. */
function checkOutside(nodes, definitions, where, report) {
  walk(nodes, (node) => {
    if (isSlotPlaceholder(node)) {
      report('errors', 'SLOT_OUTSIDE_COMPONENT',
        `Slot placeholder "${node.id}" (slot "${node.slot}") in ${where} is outside a component. Placeholders belong inside a component definition; fill a slot on its instance with children or slots.`);
    }
    checkNode(node, definitions, where, report);
  });
}

function checkDefinition(componentId, definition, definitions, report) {
  if (!isObject(definition) || !isObject(definition.root)) return;
  const where = `component "${componentId}"`;
  if (isSlotPlaceholder(definition.root)) {
    report('errors', 'SLOT_OUTSIDE_COMPONENT',
      `Component "${componentId}" has a slot placeholder as its root. A placeholder goes inside the root, never in its place.`);
    return;
  }

  const counts = new Map();
  for (const placeholder of collectSlotPlaceholders(definition)) {
    counts.set(placeholder.slot, (counts.get(placeholder.slot) || 0) + 1);
  }
  for (const [name, count] of counts) {
    if (count > 1) {
      report('errors', 'DUPLICATE_COMPONENT_SLOT',
        `Component "${componentId}" declares slot "${name}" ${count} times. Each slot name may appear once in a component.`);
    }
  }

  walk([definition.root], (node) => checkNode(node, definitions, where, report));
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
  const report = (severity, code, message) => diagnostics.push({ severity, code, message });

  for (const [componentId, definition] of Object.entries(isObject(definitions) ? definitions : {})) {
    checkDefinition(componentId, definition, definitions, report);
  }

  const templateScope = isObject(templateDefinitions) ? templateDefinitions : definitions;
  for (const [templateId, template] of Object.entries(isObject(templates) ? templates : {})) {
    if (!isObject(template)) continue;
    const where = `template "${templateId}"`;
    for (const region of Array.isArray(template.regions) ? template.regions : []) {
      if (isObject(region)) checkOutside(region.children, templateScope, where, report);
    }
    for (const overlay of Array.isArray(template.overlays) ? template.overlays : []) {
      if (isObject(overlay)) checkOutside(overlay.content, templateScope, `${where} overlay "${overlay.id}"`, report);
    }
  }

  for (const entry of pages) {
    const page = isObject(entry?.page) ? entry.page : null;
    if (!page) continue;
    const scope = isObject(entry.definitions) ? entry.definitions : definitions;
    const where = `page "${entry.id}"`;
    for (const key of ['slots', 'injectables', 'overlays']) {
      for (const container of Array.isArray(page[key]) ? page[key] : []) {
        if (isObject(container)) checkOutside(container.content, scope, where, report);
      }
    }
  }

  return diagnostics;
}

module.exports = { checkComponentSlots };
