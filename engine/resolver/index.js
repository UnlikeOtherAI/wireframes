'use strict';

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

function namespaceNodeIds(nodes, namespace) {
  if (!Array.isArray(nodes) || typeof namespace !== 'string' || !namespace.trim()) {
    return new Map();
  }

  const idMap = new Map();

  function visit(node) {
    if (!isObject(node)) {
      return;
    }

    if (typeof node.id === 'string' && node.id.trim() !== '') {
      const oldId = node.id;
      const newId = `${namespace}__${oldId}`;
      node.id = newId;
      idMap.set(oldId, newId);
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return idMap;
}

function rewriteScopedNodeReferences(nodes, idMap) {
  if (!Array.isArray(nodes) || !(idMap instanceof Map) || idMap.size === 0) {
    return;
  }

  function visit(node) {
    if (!isObject(node)) {
      return;
    }

    if (Array.isArray(node.interaction)) {
      for (const interaction of node.interaction) {
        if (!isObject(interaction)) {
          continue;
        }
        if (typeof interaction.formId === 'string' && idMap.has(interaction.formId)) {
          interaction.formId = idMap.get(interaction.formId);
        }
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        visit(child);
      }
    }
  }

  for (const node of nodes) {
    visit(node);
  }
}

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

function mergeComponentProps(instanceProps, defaults) {
  const defaultProps = isObject(defaults) ? defaults : {};
  const resolvedProps = isObject(instanceProps) ? instanceProps : {};

  return {
    ...defaultProps,
    ...resolvedProps,
  };
}

function mergeNodeProps(instanceProps, rootProps, defaults) {
  return {
    ...mergeComponentProps(defaults, {}),
    ...mergeComponentProps(rootProps, {}),
    ...mergeComponentProps(instanceProps, {}),
  };
}

function resolveNodes(nodes, components, componentStack, injectableMap) {
  if (!Array.isArray(nodes)) {
    return {
      ok: true,
      nodes: [],
    };
  }

  const output = [];

  for (const node of nodes) {
    const resolved = resolveComponentNode(node, components, componentStack, injectableMap);
    if (!resolved.ok) {
      return resolved;
    }

    for (const resolvedNode of resolved.nodes) {
      output.push(resolvedNode);
    }
  }

  return {
    ok: true,
    nodes: output,
  };
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

  const { use, props, id } = node;
  const instanceOverrides = cloneDeep({ ...node });
  delete instanceOverrides.use;
  delete instanceOverrides.props;

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

  if (Array.isArray(resolvedNode.children) && typeof id === 'string' && id.trim() !== '') {
    const idMap = namespaceNodeIds(resolvedNode.children, id);
    rewriteScopedNodeReferences(resolvedNode.children, idMap);
  }

  componentStack.add(node.use);
  if (Array.isArray(resolvedNode.children)) {
    const childResult = resolveInjectableNodes(
      resolvedNode.children,
      injectableMap,
      components,
      componentStack,
    );
    if (!childResult.ok) {
      componentStack.delete(node.use);
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
    componentStack.delete(node.use);
    if (!nestedResult.ok) {
      return nestedResult;
    }
    return nestedResult;
  }

  componentStack.delete(node.use);

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
