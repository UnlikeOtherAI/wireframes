'use strict';

const { resolveComponentDefinition } = require('./definition-lookup');

/** Bound reusable component expansion before materializing a rendered tree. */
function assertComponentExpansion(roots, definitions, maxNodes = 50000) {
  const memo = new Map();
  const visiting = new Set();
  const cost = (value, depth = 0) => {
    if (depth > 128) throw new Error('Expanded wireframe is too deeply nested');
    if (!value || typeof value !== 'object') return 1;
    let size = 1;
    if (typeof value.use === 'string') {
      const id = value.use.trim();
      if (visiting.has(id)) throw new Error('Circular wireframe component reference');
      if (!memo.has(id)) {
        const definition = resolveComponentDefinition(id, definitions);
        if (definition == null) throw new Error(`Unknown component: ${id}`);
        visiting.add(id);
        memo.set(id, cost(definition, depth + 1));
        visiting.delete(id);
      }
      size += memo.get(id);
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

module.exports = { assertComponentExpansion };
