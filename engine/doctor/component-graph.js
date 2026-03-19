'use strict';

/**
 * Component dependency graph: build, traverse, detect cycles, and compute transitive usage.
 */

function collectComponentUseGraph(components, result, addDiagnostic) {
  const graph = Object.create(null);
  const componentIds = new Set(Object.keys(components));
  const entries = Object.entries(components);

  for (const [componentId, componentDoc] of entries) {
    const edges = [];
    const root = componentDoc?.root;
    walkUseGraph(root, edges, componentIds);
    graph[componentId] = edges;
  }

  return graph;
}

function walkUseGraph(node, edges, componentIds) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  if (typeof node.use === 'string' && componentIds.has(node.use)) {
    edges.push(node.use);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkUseGraph(child, edges, componentIds);
    }
  }
}

function collectUsedComponents(componentGraph, directUsages) {
  const used = new Set(directUsages);
  const queue = Array.from(directUsages);

  while (queue.length > 0) {
    const current = queue.shift();
    const references = componentGraph[current] || [];
    for (const reference of references) {
      if (!used.has(reference)) {
        used.add(reference);
        queue.push(reference);
      }
    }
  }

  return used;
}

function detectCircularUse(referenceGraph, result, addDiagnostic) {
  const visited = new Set();
  const stack = [];
  const inStack = new Set();

  function visit(current) {
    if (!Object.prototype.hasOwnProperty.call(referenceGraph, current)) {
      return null;
    }
    if (inStack.has(current)) {
      const start = stack.indexOf(current);
      const cycle = stack.slice(start).concat(current);
      return cycle;
    }
    if (visited.has(current)) {
      return null;
    }

    visited.add(current);
    inStack.add(current);
    stack.push(current);

    for (const edge of referenceGraph[current]) {
      const cycle = visit(edge);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    inStack.delete(current);
    return null;
  }

  for (const node of Object.keys(referenceGraph)) {
    const cycle = visit(node);
    if (cycle) {
      addDiagnostic(
        result,
        'errors',
        'CIRCULAR_TEMPLATE_REFERENCE',
        `Circular component reference detected: ${cycle.join(' -> ')}.`,
      );
      return;
    }
  }
}

module.exports = {
  collectComponentUseGraph,
  walkUseGraph,
  collectUsedComponents,
  detectCircularUse,
};
