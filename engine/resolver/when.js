'use strict';

// `when` keeps a node only when its value has content. A component writes
// `when: "{{props.tagline}}"` on a node, and a caller who leaves that prop
// empty gets no node, rather than a skeleton bar or an empty column. It is
// evaluated on the resolved tree, after every `{{props.x}}` token, slot and
// repeat row has been substituted, so it reads the value the caller gave.

const { childNodeLists } = require('../component-registry/child-nodes');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Empty: missing, null, false, a blank string or an empty list. Anything else has content. */
function hasContent(value) {
  if (value == null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Drop, in place, every node in `nodes` (at any depth) whose `when` is empty; strip `when` from the rest. */
function pruneByWhen(nodes) {
  if (!Array.isArray(nodes)) return nodes;
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (!isObject(node)) continue;
    if (Object.hasOwn(node, 'when')) {
      if (!hasContent(node.when)) {
        nodes.splice(index, 1);
        continue;
      }
      delete node.when;
    }
    for (const list of childNodeLists(node)) pruneByWhen(list);
  }
  return nodes;
}

module.exports = { pruneByWhen };
