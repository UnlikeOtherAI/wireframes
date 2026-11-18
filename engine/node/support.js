'use strict';

const path = require('node:path');
const {
  parseAddress,
  resolveAddressInRoots,
} = require(path.resolve(__dirname, '..', 'addressing'));
const {
  componentsFilePath,
  pageFilePath,
  resolveTarget: resolveTargetWithMetadata,
  templatesFilePath,
} = require(path.resolve(__dirname, '..', 'addressing', 'fs-resolver'));

const { PRIMITIVE_COMPONENTS } = require(path.resolve(__dirname, '..', 'schema', 'primitives'));
const { childNodeLists } = require(path.resolve(__dirname, '..', 'component-registry', 'child-nodes'));
const { resolveAuthoredComponent } = require(path.resolve(__dirname, '..', 'component-registry', 'definition-lookup'));
const { loadProjectComponentRegistry } = require(path.resolve(__dirname, '..', 'component-registry'));

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

    for (const list of childNodeLists(node)) {
      collectNodeIds(list, set);
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

function resolveComponentBinding(projectPath, componentRef) {
  if (typeof componentRef !== 'string' || componentRef.trim() === '') {
    return { ok: false, error: 'Component is required.' };
  }

  if (PRIMITIVE_COMPONENTS.has(componentRef)) {
    return { ok: true, node: { component: componentRef } };
  }

  // The same lookup a `use:` gets: the project's own components first, then the built-ins.
  const loaded = loadProjectComponentRegistry(projectPath);
  if (!loaded.ok) {
    return { ok: false, error: `Unable to load project components: ${loaded.error}` };
  }
  if (resolveAuthoredComponent(componentRef, loaded.registry.components)) {
    return { ok: true, node: { use: componentRef } };
  }

  return { ok: false, error: `Unknown component reference "${componentRef}".` };
}

// Every caller of this one writes the document it resolves, so a read-only
// target stops here with the way to make it editable: a built-in std pattern
// the project does not define, or a component defined outside the project.
function resolveTarget(projectPath, address) {
  const target = resolveTargetWithMetadata(projectPath, address);
  return target.ok && target.readOnly ? { ok: false, error: target.readOnly } : target;
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
