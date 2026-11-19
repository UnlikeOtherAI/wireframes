'use strict';

const { resolveComponentDefinition } = require('./definition-lookup');
const { childNodeLists } = require('./child-nodes');
const { isElementCell, keyedItems, repeatOf } = require('./repeat');
const { collectSlotPlaceholders, isSlotPlaceholder } = require('./slot-placeholders');

// The most nodes one page may expand to. The resolver charges every node it
// materializes against it, and checks a repeat's whole fan-out before it
// allocates the first row.
const MAX_EXPANDED_NODES = 50000;

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/**
 * Bound reusable component expansion before materializing a rendered tree.
 * Counts every value a tree expands to, with each component instance and each
 * row of a component cell counted at its definition's full size.
 */
function assertComponentExpansion(roots, definitions, maxNodes = MAX_EXPANDED_NODES) {
  const memo = new Map();
  const visiting = new Set();
  const definitionCost = (id, depth) => {
    if (visiting.has(id)) throw new Error('Circular wireframe component reference');
    if (!memo.has(id)) {
      const definition = resolveComponentDefinition(id, definitions);
      if (definition == null) throw new Error(`Unknown component: ${id}`);
      visiting.add(id);
      memo.set(id, cost(definition, depth + 1));
      visiting.delete(id);
    }
    return memo.get(id);
  };
  const cost = (value, depth = 0) => {
    if (depth > 128) throw new Error('Expanded wireframe is too deeply nested');
    if (!value || typeof value !== 'object') return 1;
    let size = 1;
    if (typeof value.use === 'string') size += definitionCost(value.use.trim(), depth);
    const repeat = repeatOf(value);
    if (repeat) {
      // A row adds its id, its cell and its props to the item it is made from.
      const row = 3 + (isElementCell(repeat.cell) ? 0 : definitionCost(repeat.cell, depth));
      size += keyedItems(repeat.items).length * row;
      if (size > maxNodes) throw new Error('Expanded wireframe is too large');
    }
    for (const child of Object.values(value)) {
      size += cost(child, depth + 1);
      if (size > maxNodes) throw new Error('Expanded wireframe is too large');
    }
    return size;
  };
  const total = roots.reduce((sum, root) => sum + cost(root), 0);
  if (total > maxNodes) throw new Error('Expanded wireframe is too large');
  return total;
}

/** What one page's expansion may still materialize. */
function createExpansionBudget(max = MAX_EXPANDED_NODES) {
  return { max, used: 0, memo: new Map(), visiting: new Set() };
}

const NONE = new Set();

/** The slots an instance fills itself: `children` fill `default`, and `[]` counts. */
function filledSlots(instance) {
  const filled = new Set(Array.isArray(instance.children) ? ['default'] : []);
  for (const [name, fill] of Object.entries(isObject(instance.slots) ? instance.slots : {})) {
    if (Array.isArray(fill)) filled.add(name);
  }
  return filled;
}

/**
 * How many nodes a definition expands to, nested instances and rows included,
 * without what the instance's own content replaces: the fallback of each slot
 * it fills, or, without slots, the root's children and rows. Unknown and
 * circular references count nothing here; the resolver reports them.
 */
function definitionNodeCount(id, definitions, budget, filled = NONE) {
  if (budget.visiting.has(id)) return 0;
  const key = filled.size > 0 ? JSON.stringify([id, ...[...filled].sort()]) : id;
  if (!budget.memo.has(key)) {
    const definition = resolveComponentDefinition(id, definitions);
    budget.visiting.add(id);
    let count = 0;
    if (isObject(definition) && collectSlotPlaceholders(definition).length > 0) {
      count = nodeCount(definition.root, definitions, budget, filled);
    } else if (isObject(definition)) {
      const root = filled.has('default') ? { ...definition.root, children: [], repeat: undefined } : definition.root;
      count = nodeCount(root, definitions, budget);
    }
    budget.visiting.delete(id);
    budget.memo.set(key, count);
  }
  return budget.memo.get(key);
}

/** How many nodes a host's rows expand to. */
function repeatNodeCount(node, definitions, budget) {
  const repeat = repeatOf(node);
  if (!repeat) return 0;
  const row = 1 + (isElementCell(repeat.cell) ? 0 : definitionNodeCount(repeat.cell, definitions, budget));
  return keyedItems(repeat.items).length * row;
}

/** `replaced` names the slots of the definition being counted whose fallbacks never render. */
function nodeCount(node, definitions, budget, replaced = NONE) {
  if (!isObject(node) || (isSlotPlaceholder(node) && replaced.has(node.slot))) return 0;
  let count = 1 + repeatNodeCount(node, definitions, budget);
  if (typeof node.use === 'string') count += definitionNodeCount(node.use, definitions, budget, filledSlots(node));
  for (const list of childNodeLists(node)) {
    for (const child of list) count += nodeCount(child, definitions, budget, replaced);
  }
  return count;
}

module.exports = {
  MAX_EXPANDED_NODES,
  assertComponentExpansion,
  createExpansionBudget,
  repeatNodeCount,
};
