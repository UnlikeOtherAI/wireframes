'use strict';

const { collectSlotPlaceholders } = require('../component-registry/slot-placeholders');
const { resolveComponentDefinition } = require('../component-registry/definition-lookup');
const {
  cloneDeep,
  isObject,
  mergeNodeProps,
  namespaceDescendants,
  resolveComponentPropTemplates,
} = require('./component-prep');
const { placeFills, prepareSlottedInstance } = require('./slotted-instance');
const { createExpansionBudget } = require('../component-registry/expansion');
const { expandHostRows, materializeDefinitionRows, origin } = require('./repeat-rows');

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

function resolveComponentNode(node, components, componentStack, injections, budget) {
  if (!isObject(node)) {
    return {
      ok: true,
      nodes: [cloneDeep(node)],
    };
  }

  budget.used += 1;
  if (budget.used > budget.max) {
    return {
      ok: false,
      error: `Expanded wireframe is too large: a page may expand to at most ${budget.max} nodes.`,
      reason: 'expansion-budget',
    };
  }

  if (node.injectable === true && typeof node.id === 'string') {
    return {
      ok: false,
      error: 'Component resolution cannot process injectables directly.',
    };
  }

  if (!node.use) {
    // Caller content: its rows join its children before anything below expands.
    const resolvedNode = cloneDeep(node);
    const rows = expandHostRows(resolvedNode, components, budget);
    if (!rows.ok) {
      return rows;
    }
    if (Array.isArray(resolvedNode.children)) {
      const childResult = resolveInjectableNodes(resolvedNode.children, injections, components, componentStack, budget);
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

  // `reason` and `componentId` say what failed, so validation can report it where it is written.
  const componentDoc = resolveComponentDefinition(node.use, components);
  if (!isObject(componentDoc) || !isObject(componentDoc.root)) {
    return {
      ok: false,
      error: `Unknown component reference "${node.use}".`,
      reason: 'unknown-component',
      componentId: node.use,
      ...(node.__repeat ? { repeatCell: true } : {}),
    };
  }

  if (componentStack.has(node.use)) {
    return {
      ok: false,
      error: `Circular component reference detected for "${node.use}".`,
      reason: 'circular-component',
      componentId: node.use,
    };
  }

  if (collectSlotPlaceholders(componentDoc).length > 0) {
    return resolveSlottedInstance(node, componentDoc, components, componentStack, injections, budget);
  }

  const { props, id } = node;
  const instanceOverrides = cloneDeep({ ...node });
  delete instanceOverrides.use;
  delete instanceOverrides.props;
  delete instanceOverrides.slots;
  // A use: node hosts no rows (REPEAT_INVALID_HOST), so its repeat never renders.
  delete instanceOverrides.repeat;

  const resolvedNode = {
    ...cloneDeep(componentDoc.root),
    ...instanceOverrides,
    id,
  };
  // Instance children replace the root's children, and its rows with them.
  if (Object.hasOwn(instanceOverrides, 'children')) {
    delete resolvedNode.repeat;
  }

  const mergedProps = mergeNodeProps(props, resolvedNode.props, componentDoc.propDefaults);
  if (Object.keys(mergedProps).length > 0) {
    resolvedNode.props = mergedProps;
  }

  const substitutedNode = resolveComponentPropTemplates(resolvedNode, mergedProps);
  for (const [key, value] of Object.entries(substitutedNode)) {
    resolvedNode[key] = value;
  }

  // The definition's rows are its own content: substituted above, namespaced below,
  // and stamped with where the definition writes them.
  const rows = materializeDefinitionRows(resolvedNode, components, budget, { root: componentDoc.root });
  if (!rows.ok) {
    return rows;
  }

  namespaceDescendants(resolvedNode, id, componentDoc.root.id);
  // Interactions written on the instance are the caller's, in the caller's
  // scope: only the definition's own references follow its renamed ids.
  if (Object.hasOwn(instanceOverrides, 'interaction')) {
    resolvedNode.interaction = resolveComponentPropTemplates(instanceOverrides.interaction, mergedProps);
  }

  return expandDefinitionTree(resolvedNode, node.use, components, componentStack, injections, budget);
}

/**
 * Instance `children` fill `default`; `slots` fill the rest. Fills are the
 * caller's content, so they expand in the caller's scope, before the callee
 * is on the stack: a caller-authored instance of the same component inside a
 * fill is finite nesting, not recursion.
 */
function resolveSlottedInstance(node, componentDoc, components, componentStack, injections, budget) {
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
    const expanded = resolveInjectableNodes(nodes, injections, components, componentStack, budget);
    if (!expanded.ok) {
      return expanded;
    }
    fills.set(name, expanded.nodes);
  }

  const token = Symbol('slot fills');
  // A fallback the caller replaces never renders, so its rows are not made.
  const prepared = prepareSlottedInstance(node, componentDoc, fills, token,
    (tree) => materializeDefinitionRows(tree, components, budget, { root: componentDoc.root, replaced: new Set(fills.keys()) }));
  if (!prepared.ok) {
    return prepared;
  }
  const expanded = expandDefinitionTree(prepared.node, node.use, components, componentStack, injections, budget);
  if (!expanded.ok) {
    return expanded;
  }
  return { ok: true, nodes: placeFills(expanded.nodes, fills, token) };
}

/** Expand the nested instances a prepared definition tree contains, with the definition on the stack. */
function expandDefinitionTree(resolvedNode, use, components, componentStack, injections, budget) {
  componentStack.add(use);
  if (Array.isArray(resolvedNode.children)) {
    const childResult = resolveInjectableNodes(
      resolvedNode.children,
      injections,
      components,
      componentStack,
      budget,
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
      injections,
      budget,
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

const isMarker = (node) => isObject(node) && node.injectable === true && typeof node.id === 'string';

/**
 * The page's content for one injectable marker, expanded. An injection that
 * reaches its own marker again renders nothing there instead of recursing.
 */
function inject(id, injections, components, componentStack, budget) {
  const content = injections.content.get(id);
  if (!Array.isArray(content) || content.length === 0 || injections.active.has(id)) {
    return { ok: true, nodes: [] };
  }
  injections.active.add(id);
  const injected = resolveInjectableNodes(content, injections, components, componentStack, budget);
  injections.active.delete(id);
  return injected;
}

function resolveInjectableNodes(nodes, injections, components, componentStack, budget) {
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

    if (isMarker(node)) {
      const injected = inject(node.id, injections, components, componentStack, budget);
      if (!injected.ok) {
        return injected;
      }
      output.push(...injected.nodes);
      continue;
    }

    // A resolved node comes back with its children resolved, so nothing is
    // expanded twice and the budget counts each node once.
    // A failure is located at the outermost row it passes through.
    const failed = (failure) => (node.__repeat ? { ...failure, row: origin(node) } : failure);
    const resolvedNode = resolveComponentNode(node, components, componentStack, injections, budget);
    if (!resolvedNode.ok) {
      return failed(resolvedNode);
    }
    // A component may expand to a marker; it takes its injection where it lands,
    // as a written one does.
    for (const resolved of resolvedNode.nodes) {
      if (!isMarker(resolved)) {
        output.push(resolved);
        continue;
      }
      const injected = inject(resolved.id, injections, components, componentStack, budget);
      if (!injected.ok) {
        return failed(injected);
      }
      output.push(...injected.nodes);
    }
  }

  return {
    ok: true,
    nodes: output,
  };
}

function resolveRegion(region, slotMap, injections, components, componentStack, budget) {
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

  const resolvedChildren = resolveInjectableNodes(baseChildren, injections, components, componentStack, budget);
  if (!resolvedChildren.ok) {
    return resolvedChildren;
  }
  resolved.children = resolvedChildren.nodes;

  return {
    ok: true,
    region: resolved,
  };
}

/**
 * `budget` is what the page may still expand to. One page's calls share it
 * (its regions and its overlays); a fresh one is used when none is given.
 */
function resolveTemplatePage({ template, page, budget = createExpansionBudget() }) {
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
  const injections = { content: injectableMap, active: new Set() };
  const roots = [];
  const componentStack = new Set();

  for (const region of regions) {
    const resolvedRegion = resolveRegion(region, slotMap, injections, components, componentStack, budget);
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
