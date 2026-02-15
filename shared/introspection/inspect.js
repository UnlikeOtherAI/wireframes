'use strict';

const path = require('node:path');
const { resolveAddressInRoots, resolveTarget } = require(path.resolve(__dirname, '..', 'addressing'));
const { isObject } = require('./helpers');

function inspectAddress({ projectPath, address }) {
  if (!address || typeof address !== 'string') {
    return { ok: false, error: 'Address is required.' };
  }

  const resolved = resolveTarget(path.resolve(projectPath), address);
  if (!resolved.ok) {
    return resolved;
  }

  const result = resolveAddressInRoots(resolved.roots, resolved.segments, { allowContainerFinal: false });
  if (!result.ok) {
    return result;
  }

  if (result.targetType !== 'node') {
    return { ok: false, error: 'Resolved address does not point to a node.' };
  }

  const node = result.node;
  const children = Array.isArray(node.children) ? node.children : [];
  return {
    ok: true,
    origin: result.origin,
    sourceRef: result.sourceRef,
    resolvedAddress: result.resolvedAddress,
    node,
    children,
    layoutSummary: {
      hasLayout: isObject(node.layout),
      hasChildren: children.length > 0,
      childrenCount: children.length,
      layout: isObject(node.layout) ? node.layout : null,
    },
  };
}

module.exports = { inspectAddress };
