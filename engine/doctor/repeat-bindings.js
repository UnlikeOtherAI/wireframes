'use strict';

/**
 * Where a collection binding renders across component boundaries, for
 * REPEAT_WITH_BINDING (design `docs/plans/2026-11-19-repeat-cells.md` §4.3). A
 * binding clones the node it is on and everything below it, so content a caller
 * gives an instance is cloned by a binding on the definition's root (or on the
 * root it delegates to), and a fill is cloned by a binding above the
 * placeholder it fills. A binding is named by its site: `{ id, where }`.
 */

const { childNodeEntries } = require('../component-registry/child-nodes');
const { authoredReference, resolveComponentDefinition } = require('../component-registry/definition-lookup');
const { isSlotPlaceholder } = require('../component-registry/slot-placeholders');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/** A binding whose source names a data source clones its node once per item; an expression does not. */
function isCollectionBinding(binding) {
  if (!isObject(binding) || typeof binding.source !== 'string') return false;
  const source = binding.source.trim();
  return source !== '' && !source.startsWith('{{');
}

/** The slot a child list of an instance fills: `children` fill `default`. */
const filledSlot = (segments) => (segments[0] === 'slots' ? segments[1] : 'default');

/**
 * Lookups for one registry, each definition worked out once:
 * - `root(ref)`: the binding the definition's root renders with, or null;
 * - `fill(ref, segments)`: the binding that an instance's child list at
 *   `segments` (`['children']` or `['slots', name]`) renders under inside the
 *   definition, or null.
 */
function createBindingLookup(definitions) {
  const roots = new Map();
  const slots = new Map();

  const root = (ref) => {
    if (!roots.has(ref)) {
      roots.set(ref, null);
      const node = resolveComponentDefinition(ref, definitions)?.root;
      let site = null;
      if (isObject(node) && isCollectionBinding(node.binding)) site = { id: node.id, where: `component "${authoredReference(ref)}"` };
      else if (isObject(node) && typeof node.use === 'string') site = root(node.use);
      roots.set(ref, site);
    }
    return roots.get(ref);
  };

  const boundSlots = (ref) => {
    if (!slots.has(ref)) {
      const found = new Map();
      slots.set(ref, found);
      const where = `component "${authoredReference(ref)}"`;
      const visit = (node, site) => {
        if (!isObject(node)) return;
        const here = site || (isCollectionBinding(node.binding) ? { id: node.id, where } : null);
        if (here && isSlotPlaceholder(node) && !found.has(node.slot)) found.set(node.slot, here);
        for (const { segments, nodes } of childNodeEntries(node)) {
          const below = here || (typeof node.use === 'string' ? fill(node.use, segments) : null);
          nodes.forEach((child) => visit(child, below));
        }
      };
      visit(resolveComponentDefinition(ref, definitions)?.root, null);
    }
    return slots.get(ref);
  };

  const fill = (ref, segments) => root(ref) || boundSlots(ref).get(filledSlot(segments)) || null;

  return { root, fill };
}

module.exports = { createBindingLookup, isCollectionBinding };
