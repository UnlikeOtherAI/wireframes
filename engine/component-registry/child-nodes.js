'use strict';

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/**
 * The node arrays below a node in authored YAML, each with the path segments that
 * lead to it: `children`, plus every named fill under `slots` when the node is a
 * `use:` instance, as `['slots', name]`. A slot placeholder's `children` are its
 * fallback, so they are included too. Walkers that report where a finding is
 * written use the segments; the rest use `childNodeLists`.
 */
function childNodeEntries(node) {
  if (!isObject(node)) return [];
  const entries = [];
  if (Array.isArray(node.children)) entries.push({ segments: ['children'], nodes: node.children });
  if (node.use != null && isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      if (Array.isArray(fill)) entries.push({ segments: ['slots', name], nodes: fill });
    }
  }
  return entries;
}

/** The same arrays without their paths. Every walker that has to see slot content goes through these. */
function childNodeLists(node) {
  return childNodeEntries(node).map((entry) => entry.nodes);
}

module.exports = { childNodeEntries, childNodeLists };
