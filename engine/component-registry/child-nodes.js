'use strict';

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/**
 * The node arrays that sit below a node in authored YAML: its `children`, plus
 * every named fill under `slots` when the node is a `use:` instance. A slot
 * placeholder's `children` are its fallback, so they are included too.
 * Every walker that has to see slot content goes through this one function.
 */
function childNodeLists(node) {
  if (!isObject(node)) return [];
  const lists = [];
  if (Array.isArray(node.children)) lists.push(node.children);
  if (node.use != null && isObject(node.slots)) {
    for (const fill of Object.values(node.slots)) {
      if (Array.isArray(fill)) lists.push(fill);
    }
  }
  return lists;
}

module.exports = { childNodeLists };
