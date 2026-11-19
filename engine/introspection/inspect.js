'use strict';

const path = require('node:path');
const { resolveAddressInRoots } = require(path.resolve(__dirname, '..', 'addressing'));
const { resolveTarget } = require(path.resolve(__dirname, '..', 'addressing', 'fs-resolver'));
const { repeatRowNode } = require(path.resolve(__dirname, '..', 'component-registry', 'repeat'));
const { isObject } = require('./helpers');

function displayPath(projectPath, filePath) {
  return typeof filePath === 'string' ? path.relative(projectPath, filePath).split(path.sep).join('/') : null;
}

function inspectAddress({ projectPath, address }) {
  if (!address || typeof address !== 'string') {
    return { ok: false, error: 'Address is required.' };
  }

  const root = path.resolve(projectPath);
  const resolved = resolveTarget(root, address);
  if (!resolved.ok) {
    return resolved;
  }

  const result = resolveAddressInRoots(resolved.roots, resolved.segments, { allowContainerFinal: false });
  if (!result.ok) {
    return result;
  }

  // A repeat row is shown as the node it renders as, and as the item it is written as.
  if (result.targetType === 'repeat-item') {
    return {
      ok: true,
      origin: result.origin,
      sourceRef: result.sourceRef,
      resolvedAddress: result.resolvedAddress,
      node: repeatRowNode(result.host.id, result.cell, result.item),
      children: [],
      repeatItem: {
        host: result.host.id,
        hostAddress: result.hostAddress,
        cell: result.cell,
        item: result.item.id,
        index: result.index,
        file: displayPath(root, resolved.documentPath),
        renderedId: result.rowId,
      },
      layoutSummary: { hasLayout: false, hasChildren: false, childrenCount: 0, layout: null },
    };
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
