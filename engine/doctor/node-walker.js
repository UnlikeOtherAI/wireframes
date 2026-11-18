'use strict';

/**
 * The semantic validator's tree walk and the id checks that need the whole
 * walk to finish first: duplicate node ids, submit form references, overlay
 * trigger nodes, and the depth and size limits.
 */

const {
  addDiagnostic,
  isObject,
  validateNodeContainerRules,
  validateNodeRules,
} = require('./node-rules');

const MAX_TREE_DEPTH = 100;
const MAX_NODES_PER_PAGE = 5000;

function createNodeContext(options) {
  const {
    result,
    pageId,
    routeIds,
    appState,
    pageState,
    actionIds,
    overlayIds,
    componentRoots,
    defaultGridColumns,
    validateDepthAndNodes,
  } = options;

  return {
    result,
    pageId,
    routeIds,
    appState,
    pageState,
    actionIds,
    overlayIds,
    componentRoots,
    defaultGridColumns,
    validateDepthAndNodes,
    nodeIds: new Set(),
    duplicateNodeIds: new Set(),
    pendingSubmitRefs: [],
    pendingOverlayTriggers: [],
    maxDepth: 0,
    nodeCount: 0,
    useStack: new Set(),
    conditionContext: {
      routes: routeIds,
      pageState,
      appState,
    },
  };
}

function validateNode(node, context, depth = 1) {
  if (!isObject(node)) {
    return;
  }

  const nodeId = node.id;

  context.maxDepth = Math.max(context.maxDepth, depth);
  if (context.validateDepthAndNodes) {
    context.nodeCount += 1;
  }

  if (typeof nodeId === 'string') {
    if (context.nodeIds.has(nodeId)) {
      context.duplicateNodeIds.add(nodeId);
    } else {
      context.nodeIds.add(nodeId);
    }
  }

  validateNodeRules(node, context);

  if (node.use != null) {
    const componentEntry = context.componentRoots && context.componentRoots[node.use];
    if (isObject(componentEntry) && isObject(componentEntry.root)) {
      if (!context.useStack.has(node.use)) {
        context.useStack.add(node.use);
        validateNode(componentEntry.root, context, depth + 1);
        context.useStack.delete(node.use);
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      validateNode(child, context, depth + 1);
    }
  }

  validateNodeContainerRules(node, context);
}

/** The checks that compare ids collected across a whole page walk. */
function reportPageIdChecks(context, pageId, overlayTriggerRefs) {
  const { result } = context;

  for (const formId of context.pendingSubmitRefs) {
    if (!context.nodeIds.has(formId)) {
      addDiagnostic(
        result,
        'INVALID_FORM_REFERENCE',
        `Submit interaction on page "${pageId}" references missing formId "${formId}".`,
      );
    }
  }

  for (const overlayRef of overlayTriggerRefs) {
    if (typeof overlayRef.trigger === 'string' && !context.nodeIds.has(overlayRef.trigger)) {
      addDiagnostic(
        result,
        'INVALID_OVERLAY_TRIGGER',
        `Overlay "${overlayRef.overlayId}" references missing trigger node "${overlayRef.trigger}".`,
      );
    }
  }

  if (context.nodeCount > MAX_NODES_PER_PAGE) {
    addDiagnostic(
      result,
      'MAX_NODES_PER_PAGE_EXCEEDED',
      `Page "${pageId}" has ${context.nodeCount} nodes, exceeding maxNodesPerPage ${MAX_NODES_PER_PAGE}.`,
    );
  }

  if (context.maxDepth > MAX_TREE_DEPTH) {
    addDiagnostic(
      result,
      'MAX_TREE_DEPTH_EXCEEDED',
      `Page "${pageId}" exceeds maxTreeDepth ${MAX_TREE_DEPTH} (found ${context.maxDepth}).`,
    );
  }

  for (const duplicate of context.duplicateNodeIds) {
    addDiagnostic(result, 'DUPLICATE_NODE_ID', `Page "${pageId}" has duplicate node id "${duplicate}".`);
  }
}

module.exports = {
  createNodeContext,
  reportPageIdChecks,
  validateNode,
};
