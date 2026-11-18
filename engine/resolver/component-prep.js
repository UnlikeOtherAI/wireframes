'use strict';

/**
 * Preparing a component definition in its own scope: `{{props.x}}`
 * substitution, prop merging, and namespacing of ids and scoped references
 * under the instance id.
 */

const { childNodeLists } = require('../component-registry/child-nodes');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

const PROP_TOKEN_PATTERN = /\{\{\s*props\.([a-zA-Z0-9_.]+)\s*\}\}/g;

function cloneDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDeep(entry));
  }

  if (!isObject(value)) {
    return value;
  }

  const clone = {};
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneDeep(item);
  }

  return clone;
}

function getPathValue(source, path) {
  if (!isObject(source) || typeof path !== 'string' || path.trim() === '') {
    return undefined;
  }

  const parts = path.split('.');
  let current = source;

  for (const part of parts) {
    if (!isObject(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

function resolveComponentPropString(value, props) {
  if (typeof value !== 'string' || !value.includes('{{')) {
    return value;
  }

  const exactMatch = value.match(/^\{\{\s*props\.([a-zA-Z0-9_.]+)\s*\}\}$/);
  if (exactMatch) {
    const exactValue = getPathValue(props, exactMatch[1]);
    return exactValue === undefined ? '' : cloneDeep(exactValue);
  }

  return value.replace(PROP_TOKEN_PATTERN, (_match, propPath) => {
    const resolved = getPathValue(props, propPath);
    return resolved === undefined || resolved == null ? '' : String(resolved);
  });
}

function resolveComponentPropTemplates(value, props) {
  if (Array.isArray(value)) {
    return value.map((entry) => resolveComponentPropTemplates(entry, props));
  }

  if (isObject(value)) {
    const resolved = {};
    for (const [key, item] of Object.entries(value)) {
      resolved[key] = resolveComponentPropTemplates(item, props);
    }
    return resolved;
  }

  return resolveComponentPropString(value, props);
}

function visitNodes(nodes, visit) {
  for (const node of nodes) {
    if (!isObject(node)) {
      continue;
    }
    visit(node);
    for (const list of childNodeLists(node)) {
      visitNodes(list, visit);
    }
  }
}

function namespaceNodeIds(nodes, namespace) {
  if (!Array.isArray(nodes) || typeof namespace !== 'string' || !namespace.trim()) {
    return new Map();
  }

  const idMap = new Map();
  visitNodes(nodes, (node) => {
    if (typeof node.id === 'string' && node.id.trim() !== '') {
      const oldId = node.id;
      const newId = `${namespace}__${oldId}`;
      node.id = newId;
      idMap.set(oldId, newId);
    }
  });

  return idMap;
}

function rewriteInteractionReferences(node, idMap) {
  if (!Array.isArray(node.interaction)) {
    return;
  }
  for (const interaction of node.interaction) {
    if (isObject(interaction) && typeof interaction.formId === 'string' && idMap.has(interaction.formId)) {
      interaction.formId = idMap.get(interaction.formId);
    }
  }
}

/**
 * Namespace every id below `root` under `namespace`, and point scoped
 * references (submit form ids) on the root and inside its subtree at the
 * renamed ids. The root keeps its id: it takes the instance id, so a reference
 * to the definition's own root id (`authoredRootId`) follows it there.
 */
function namespaceDescendants(root, namespace, authoredRootId) {
  if (typeof namespace !== 'string' || namespace.trim() === '') {
    return;
  }
  const lists = childNodeLists(root);
  const idMap = new Map();
  if (typeof authoredRootId === 'string' && authoredRootId.trim() !== '' && typeof root.id === 'string') {
    idMap.set(authoredRootId, root.id);
  }
  for (const list of lists) {
    for (const [oldId, newId] of namespaceNodeIds(list, namespace)) {
      idMap.set(oldId, newId);
    }
  }
  if (idMap.size === 0) {
    return;
  }
  rewriteInteractionReferences(root, idMap);
  for (const list of lists) {
    visitNodes(list, (node) => rewriteInteractionReferences(node, idMap));
  }
}

function mergeComponentProps(instanceProps, defaults) {
  const defaultProps = isObject(defaults) ? defaults : {};
  const resolvedProps = isObject(instanceProps) ? instanceProps : {};

  return {
    ...defaultProps,
    ...resolvedProps,
  };
}

// A root prop written as its own token (`title: "{{props.title}}"`) only says
// the value comes from the caller, so it must not shadow propDefaults.
function isSelfReference(key, value) {
  const match = typeof value === 'string' ? value.match(/^\{\{\s*props\.([a-zA-Z0-9_.]+)\s*\}\}$/) : null;
  return match != null && match[1] === key;
}

function mergeNodeProps(instanceProps, rootProps, defaults) {
  const ownRootProps = Object.fromEntries(Object.entries(mergeComponentProps(rootProps, {}))
    .filter(([key, value]) => !isSelfReference(key, value)));
  return {
    ...mergeComponentProps(defaults, {}),
    ...ownRootProps,
    ...mergeComponentProps(instanceProps, {}),
  };
}

module.exports = {
  cloneDeep,
  isObject,
  mergeNodeProps,
  namespaceDescendants,
  resolveComponentPropTemplates,
};
