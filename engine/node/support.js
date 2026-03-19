'use strict';

const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));
const {
  componentsFilePath,
  parseAddress,
  pageFilePath,
  resolveAddressInRoots,
  resolveTarget: resolveTargetWithMetadata,
  templatesFilePath,
} = require(path.resolve(__dirname, '..', 'addressing'));

const { PRIMITIVE_COMPONENTS } = require(path.resolve(__dirname, '..', 'schema', 'primitives'));

const WF_ID_REGEX = /^[a-z][a-z0-9_]*$/;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(raw, label) {
  if (raw == null) {
    return {
      ok: false,
      error: `${label} requires a JSON value.`,
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(raw),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON for ${label}: ${error.message}`,
    };
  }
}

function ensureObject(value, label) {
  if (!isObject(value)) {
    return {
      ok: false,
      error: `${label} must be an object.`,
    };
  }

  return { ok: true, value };
}

function collectNodeIds(nodes, set) {
  for (const node of nodes) {
    if (!isObject(node)) {
      continue;
    }

    if (typeof node.id === 'string') {
      set.add(node.id);
    }

    if (Array.isArray(node.children)) {
      collectNodeIds(node.children, set);
    }
  }
}

function uniqueNodeIdsFromRoots(roots) {
  const ids = new Set();

  for (const root of roots) {
    collectNodeIds(root.nodes, ids);
  }

  return ids;
}

function parseNodeId(nodeId) {
  if (!WF_ID_REGEX.test(nodeId || '')) {
    return { ok: false, error: `Invalid node id "${nodeId}". Use snake_case starting with a letter.` };
  }
  return { ok: true, value: nodeId };
}

function buildComponentIds(projectPath) {
  const components = loadDocumentFromFile(componentsFilePath(projectPath), {
    supportedSpecVersion: SUPPORTED_SPEC_VERSION,
  }).document?.components;
  return isObject(components) ? new Set(Object.keys(components)) : new Set();
}

function resolveComponentBinding(projectPath, componentRef) {
  if (typeof componentRef !== 'string' || componentRef.trim() === '') {
    return { ok: false, error: 'Component is required.' };
  }

  if (PRIMITIVE_COMPONENTS.has(componentRef)) {
    return { ok: true, node: { component: componentRef } };
  }

  if (buildComponentIds(projectPath).has(componentRef)) {
    return { ok: true, node: { use: componentRef } };
  }

  return { ok: false, error: `Unknown component reference "${componentRef}".` };
}

function resolveTarget(projectPath, address) {
  return resolveTargetWithMetadata(projectPath, address);
}

module.exports = {
  componentsFilePath,
  collectNodeIds,
  ensureObject,
  isObject,
  parseAddress,
  parseJson,
  parseNodeId,
  pageFilePath,
  resolveAddressInRoots,
  resolveComponentBinding,
  resolveTarget,
  templatesFilePath,
  uniqueNodeIdsFromRoots,
};
