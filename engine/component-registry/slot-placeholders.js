'use strict';

const { childNodeLists } = require('./child-nodes');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/** A slot placeholder is the only node shape that carries a `slot` key. */
function isSlotPlaceholder(node) {
  return isObject(node) && Object.prototype.hasOwnProperty.call(node, 'slot');
}

/**
 * Every placeholder inside a component definition, in document order. The root
 * itself is never a placeholder for this purpose: a placeholder root is an
 * error, and such a component keeps the plain override path.
 */
function collectSlotPlaceholders(definition) {
  const root = isObject(definition) ? definition.root : null;
  const found = [];
  if (!isObject(root) || isSlotPlaceholder(root)) return found;
  const visit = (node) => {
    if (!isObject(node)) return;
    if (isSlotPlaceholder(node)) found.push(node);
    for (const list of childNodeLists(node)) {
      for (const child of list) visit(child);
    }
  };
  visit(root);
  return found;
}

/** Slot names a definition declares, unique, in document order. */
function componentSlotNames(definition) {
  const names = [];
  for (const placeholder of collectSlotPlaceholders(definition)) {
    if (typeof placeholder.slot === 'string' && !names.includes(placeholder.slot)) names.push(placeholder.slot);
  }
  return names;
}

module.exports = { collectSlotPlaceholders, componentSlotNames, isSlotPlaceholder };
