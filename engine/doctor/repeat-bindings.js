'use strict';

/**
 * Where a collection binding renders across component boundaries, for
 * REPEAT_WITH_BINDING (design `docs/plans/2026-11-19-repeat-cells.md` §4.3). A
 * binding clones the node it is on and everything below it, so content a caller
 * gives an instance is cloned by a binding on the definition's root (or on the
 * root it delegates to), and a fill is cloned by a binding above the
 * placeholder it fills. A binding is named by its site: `{ id, where }`.
 *
 * Bindings are judged as they render. An instance's keys override its
 * definition's root, so a `binding` the instance writes, of any kind, replaces
 * the root's, and a root that delegates through `use:` with its own `binding`
 * replaces the one its delegate's root has.
 */

const { childNodeEntries } = require('../component-registry/child-nodes');
const { authoredReference, resolveComponentDefinition } = require('../component-registry/definition-lookup');
const { isSlotPlaceholder } = require('../component-registry/slot-placeholders');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

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
 * - `fill(instance, segments)`: the binding that the child list at `segments`
 *   (`['children']` or `['slots', name]`) of the `use:` node `instance` renders
 *   under inside its definition, or null.
 */
function createBindingLookup(definitions) {
  const roots = new Map();
  const slots = new Map();

  const root = (ref) => {
    if (!roots.has(ref)) {
      roots.set(ref, null);
      const node = resolveComponentDefinition(ref, definitions)?.root;
      let site = null;
      if (isObject(node) && hasOwn(node, 'binding')) {
        if (isCollectionBinding(node.binding)) site = { id: node.id, where: `component "${authoredReference(ref)}"` };
      } else if (isObject(node) && typeof node.use === 'string') {
        site = root(node.use);
      }
      roots.set(ref, site);
    }
    return roots.get(ref);
  };

  // `overridden`: the instance writes its own `binding`, which the root renders with.
  const boundSlots = (ref, overridden) => {
    const key = JSON.stringify([ref, overridden]);
    if (!slots.has(key)) {
      const found = new Map();
      slots.set(key, found);
      const where = `component "${authoredReference(ref)}"`;
      const visit = (node, site) => {
        if (!isObject(node)) return;
        const here = site || (isCollectionBinding(node.binding) ? { id: node.id, where } : null);
        if (here && isSlotPlaceholder(node) && !found.has(node.slot)) found.set(node.slot, here);
        for (const { segments, nodes } of childNodeEntries(node)) {
          const below = here || (typeof node.use === 'string' ? fill(node, segments) : null);
          nodes.forEach((child) => visit(child, below));
        }
      };
      const top = resolveComponentDefinition(ref, definitions)?.root;
      // Only "not a collection" matters about the instance's binding here.
      visit(overridden && isObject(top) ? { ...top, binding: null } : top, null);
    }
    return slots.get(key);
  };

  const fill = (instance, segments) => {
    const overridden = hasOwn(instance, 'binding');
    return (overridden ? null : root(instance.use)) || boundSlots(instance.use, overridden).get(filledSlot(segments)) || null;
  };

  return { root, fill };
}

module.exports = { createBindingLookup, isCollectionBinding };
