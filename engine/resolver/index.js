'use strict';

const { collectSlotPlaceholders } = require('../component-registry/slot-placeholders');
const {
  cloneDeep,
  isObject,
  mergeNodeProps,
  namespaceDescendants,
  resolveComponentPropTemplates,
} = require('./component-prep');
const { prepareSlottedInstance } = require('./slotted-instance');

function buildContentMap(list, idField) {
  const map = new Map();

  if (!Array.isArray(list)) {
    return map;
  }

  for (const entry of list) {
    if (!isObject(entry) || typeof entry[idField] !== 'string') {
      continue;
    }
    map.set(entry[idField], Array.isArray(entry.content) ? entry.content : []);
  }

  return map;
}

function resolveComponentNode(node, components, componentStack, injectableMap) {
  if (!isObject(node)) {
    return {
      ok: true,
      nodes: [cloneDeep(node)],
    };
  }

  if (node.injectable === true && typeof node.id === 'string') {
    return {
      ok: false,
      error: 'Component resolution cannot process injectables directly.',
    };
  }

  if (!node.use) {
    const resolvedNode = cloneDeep(node);
    if (Array.isArray(resolvedNode.children)) {
      const childResult = resolveInjectableNodes(resolvedNode.children, injectableMap, components, componentStack);
      if (!childResult.ok) {
        return childResult;
      }
      resolvedNode.children = childResult.nodes;
    }
    return {
      ok: true,
      nodes: [resolvedNode],
    };
  }

  if (!isObject(components)) {
    return {
      ok: false,
      error: `Component resolution requires components data for "${node.use}".`,
    };
  }

  const componentDoc = components[node.use];
  if (!isObject(componentDoc) || !isObject(componentDoc.root)) {
    return {
      ok: false,
      error: `Unknown component reference "${node.use}".`,
    };
  }

  if (componentStack.has(node.use)) {
    return {
      ok: false,
      error: `Circular component reference detected for "${node.use}".`,
    };
  }

  if (collectSlotPlaceholders(componentDoc).length > 0) {
    return resolveSlottedInstance(node, componentDoc, components, componentStack, injectableMap);
  }

  const { props, id } = node;
  const instanceOverrides = cloneDeep({ ...node });
  delete instanceOverrides.use;
  delete instanceOverrides.props;
  delete instanceOverrides.slots;

  const resolvedNode = {
    ...cloneDeep(componentDoc.root),
    ...instanceOverrides,
    id,
  };

  const mergedProps = mergeNodeProps(props, resolvedNode.props, componentDoc.propDefaults);
  if (Object.keys(mergedProps).length > 0) {
    resolvedNode.props = mergedProps;
  }

  const substitutedNode = resolveComponentPropTemplates(resolvedNode, mergedProps);
  for (const [key, value] of Object.entries(substitutedNode)) {
    resolvedNode[key] = value;
  }

  namespaceDescendants(resolvedNode, id);

  return expandDefinitionTree(resolvedNode, node.use, components, componentStack, injectableMap);
}

/**
 * Instance `children` fill `default`; `slots` fill the rest. Fills are the
 * caller's content, so they expand in the caller's scope, before the callee
 * is on the stack: a caller-authored instance of the same component inside a
 * fill is finite nesting, not recursion.
 */
function resolveSlottedInstance(node, componentDoc, components, componentStack, injectableMap) {
  const authored = [];
  if (Array.isArray(node.children)) {
    authored.push(['default', node.children]);
  }
  if (isObject(node.slots)) {
    for (const [name, nodes] of Object.entries(node.slots)) {
      if (Array.isArray(nodes) && !(name === 'default' && Array.isArray(node.children))) {
        authored.push([name, nodes]);
      }
    }
  }

  const fills = new Map();
  for (const [name, nodes] of authored) {
    const expanded = resolveInjectableNodes(nodes, injectableMap, components, componentStack);
    if (!expanded.ok) {
      return expanded;
    }
    fills.set(name, expanded.nodes);
  }

  const prepared = prepareSlottedInstance(node, componentDoc, fills);
  return expandDefinitionTree(prepared, node.use, components, componentStack, injectableMap);
}

/** Expand the nested instances a prepared definition tree contains, with the definition on the stack. */
function expandDefinitionTree(resolvedNode, use, components, componentStack, injectableMap) {
  componentStack.add(use);
  if (Array.isArray(resolvedNode.children)) {
    const childResult = resolveInjectableNodes(
      resolvedNode.children,
      injectableMap,
      components,
      componentStack,
    );
    if (!childResult.ok) {
      componentStack.delete(use);
      return childResult;
    }
    resolvedNode.children = childResult.nodes;
  }

  if (resolvedNode.use) {
    const nestedResult = resolveComponentNode(
      resolvedNode,
      components,
      componentStack,
      injectableMap,
    );
    componentStack.delete(use);
    if (!nestedResult.ok) {
      return nestedResult;
    }
    return nestedResult;
  }

  componentStack.delete(use);

  return {
    ok: true,
    nodes: [resolvedNode],
  };
}

function resolveInjectableNodes(nodes, injectableMap, components, componentStack) {
  if (!Array.isArray(nodes)) {
    return {
      ok: true,
      nodes: [],
    };
  }

  const output = [];

  for (const node of nodes) {
    if (!isObject(node)) {
      output.push(cloneDeep(node));
      continue;
    }

    if (node.injectable === true && typeof node.id === 'string') {
      const injected = injectableMap.get(node.id);
      if (Array.isArray(injected) && injected.length > 0) {
        const injectedNodes = resolveInjectableNodes(injected, injectableMap, components, componentStack);
        if (!injectedNodes.ok) {
          return injectedNodes;
        }
        output.push(...injectedNodes.nodes);
      }
      continue;
    }

    const resolvedNode = resolveComponentNode(node, components, componentStack, injectableMap);
    if (!resolvedNode.ok) {
      return resolvedNode;
    }

    for (const singleResolved of resolvedNode.nodes) {
      if (!isObject(singleResolved)) {
        output.push(singleResolved);
        continue;
      }

      if (Array.isArray(singleResolved.children)) {
        const childResolved = resolveInjectableNodes(singleResolved.children, injectableMap, components, componentStack);
        if (!childResolved.ok) {
          return childResolved;
        }
        singleResolved.children = childResolved.nodes;
      }

      output.push(singleResolved);
    }
  }

  return {
    ok: true,
    nodes: output,
  };
}

function resolveRegion(region, slotMap, injectableMap, components, componentStack) {
  if (!isObject(region) || typeof region.id !== 'string' || typeof region.kind !== 'string') {
    return {
      ok: false,
      error: 'Invalid region entry in template.',
    };
  }

  const resolved = cloneDeep(region);
  const slotContent = slotMap.get(region.id);
  const baseChildren = region.kind === 'slot'
    ? (Array.isArray(slotContent) ? slotContent : (Array.isArray(region.children) ? region.children : []))
    : (Array.isArray(region.children) ? region.children : []);

  const resolvedChildren = resolveInjectableNodes(baseChildren, injectableMap, components, componentStack);
  if (!resolvedChildren.ok) {
    return resolvedChildren;
  }
  resolved.children = resolvedChildren.nodes;

  return {
    ok: true,
    region: resolved,
  };
}

function resolveTemplatePage({ template, page }) {
  const components = isObject(arguments[0]?.components) ? arguments[0].components : null;

  if (!isObject(template)) {
    return {
      ok: false,
      error: 'Template document must be an object.',
    };
  }

  const regions = Array.isArray(template.regions) ? template.regions : [];
  const pageDoc = isObject(page) ? page : {};
  const slotMap = buildContentMap(Array.isArray(pageDoc.slots) ? pageDoc.slots : [], 'slotId');
  const injectableMap = buildContentMap(Array.isArray(pageDoc.injectables) ? pageDoc.injectables : [], 'injectableId');
  const roots = [];
  const componentStack = new Set();

  for (const region of regions) {
    const resolvedRegion = resolveRegion(region, slotMap, injectableMap, components, componentStack);
    if (!resolvedRegion.ok) {
      return resolvedRegion;
    }
    if (resolvedRegion.region) {
      roots.push(resolvedRegion.region);
    }
  }

  return {
    ok: true,
    roots,
    slots: slotMap,
    injectables: injectableMap,
  };
}

module.exports = {
  resolveTemplatePage,
};
