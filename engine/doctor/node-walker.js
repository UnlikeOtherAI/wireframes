'use strict';

/**
 * The semantic validator's tree walk, the rules that look at a node's own
 * shape (grid spans, table columns, near-miss component names), and the id
 * checks that need the whole walk to finish first: duplicate node ids, submit
 * form references, overlay trigger nodes, and the depth and size limits.
 * What a node refers to is checked in `semantic-interactions.js`.
 */

const { childNodeLists } = require('../component-registry/child-nodes');
const { resolveComponentDefinition } = require('../component-registry/definition-lookup');
const { resolvePrimitiveName } = require('../schema/primitive-registry');
const { placeOf } = require('./row-places');
const {
  isObject,
  hasOwn,
  addDiagnostic,
  addWarning,
  atNode,
  validateCondition,
  validateInteraction,
  validatePane,
  validateSelection,
} = require('./semantic-interactions');

const MAX_TREE_DEPTH = 100;
const MAX_NODES_PER_PAGE = 5000;

// Nudges for names that are not primitives. The registry owns the real aliases
// (which resolve silently); these are only the near-misses worth a warning.
const COMPONENT_ALIASES = {
  container: 'stack',
  box: 'card',
  panel: 'card',
  label: 'text',
  textfield: 'input',
  separator: 'divider',
  hr: 'divider',
  bottom_tabs: 'bottom_tab_bar',
  nav_bar: 'bottom_tab_bar',
  sidebar: 'nav',
  listview: 'list',
  datagrid: 'table',
  dropdown: 'select',
  modal: 'overlay (kind: overlay, type: modal)',
  tooltip: 'overlay (kind: overlay, type: tooltip)',
};

function createNodeContext(options) {
  const {
    result,
    document,
    within,
    pageId,
    routeIds,
    appState,
    pageState,
    actionIds,
    overlayIds,
    componentRoots,
    componentSources,
    defaultGridColumns,
    validateDepthAndNodes,
  } = options;

  return {
    result,
    // The document map's label for what is being walked, so a finding can be found in its text,
    // and the path of the component definition being walked, when it is one.
    document,
    within,
    pageId,
    routeIds,
    appState,
    pageState,
    actionIds,
    overlayIds,
    componentRoots,
    componentSources,
    defaultGridColumns,
    validateDepthAndNodes,
    // Rendered repeat rows by id, to where their item is written: a row's id is
    // written nowhere, so a finding about it is located at the item.
    rowPlaces: new Map(),
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

function validateChildrenGrid(node, context) {
  if (!isObject(node.layout) || node.layout.type !== 'grid' || !Array.isArray(node.children)) {
    return;
  }

  const columns = Number.isInteger(node.layout.columns) ? node.layout.columns : context.defaultGridColumns;

  for (const child of node.children) {
    if (!isObject(child)) {
      continue;
    }

    if (isObject(child.gridItem) && Number.isInteger(child.gridItem.span)) {
      if (columns != null && child.gridItem.span > columns) {
        addDiagnostic(
          context.result,
          'INVALID_GRID_SPAN',
          `Node "${child.id}" in page "${context.pageId}" has span ${child.gridItem.span} greater than grid columns ${columns}.`,
          atNode(context, child.id),
        );
      }

      if (isObject(child.size) && hasOwn(child.size, 'width')) {
        addDiagnostic(
          context.result,
          'INVALID_GRID_SPAN',
          `Node "${child.id}" in page "${context.pageId}" defines both gridItem.span and size.width.`,
          atNode(context, child.id),
        );
      }
    }

  }
}

function validateTableNode(node, context) {
  if (node?.component !== 'table') {
    return;
  }

  const props = isObject(node.props) ? node.props : {};
  const columns = Array.isArray(props.columns) ? props.columns : [];
  if (columns.length === 0) {
    addDiagnostic(
      context.result,
      'TABLE_MISSING_COLUMNS',
      `Table node "${node.id}" in page "${context.pageId}" must define at least one column.`,
      atNode(context, node.id),
    );
    return;
  }

  const invalidColumn = columns.find((column) => {
    if (typeof column === 'string') {
      return column.trim() === '';
    }
    if (!isObject(column)) {
      return true;
    }
    const hasKey = typeof column.key === 'string' && column.key.trim() !== '';
    const hasLabel = typeof column.label === 'string' && column.label.trim() !== '';
    return !hasKey && !hasLabel;
  });

  if (invalidColumn !== undefined) {
    addDiagnostic(
      context.result,
      'TABLE_INVALID_COLUMN',
      `Table node "${node.id}" in page "${context.pageId}" has a column without a valid key or label. Provide at least one — key will auto-derive from label if omitted.`,
      atNode(context, node.id),
    );
  }
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
    const rowAt = node.__repeat ? placeOf(node, context.componentSources, ['id']) : undefined;
    if (rowAt) context.rowPlaces.set(nodeId, rowAt);
  }

  if (typeof node.component === 'string'
    && COMPONENT_ALIASES[node.component]
    && resolvePrimitiveName(node.component) == null) {
    addWarning(
      context.result,
      'COMPONENT_ALIAS',
      `Node "${nodeId}" uses component "${node.component}" — did you mean "${COMPONENT_ALIASES[node.component]}"?`,
      atNode(context, nodeId),
    );
  }

  if (Array.isArray(node.interaction)) {
    for (const interaction of node.interaction) {
      validateInteraction(interaction, context, nodeId);
    }
  }

  if (isObject(node.selection)) {
    validateSelection(node.selection, context, nodeId);
  }

  if (isObject(node.pane)) {
    validatePane(node.pane, context, nodeId);
  }

  if (isObject(node.visibility)) {
    validateCondition(node.visibility.condition, context, nodeId);
  }

  if (isObject(node.condition)) {
    validateCondition(node.condition, context, nodeId);
  }

  if (Array.isArray(node.interaction)) {
    for (const interaction of node.interaction) {
      if (isObject(interaction?.condition)) {
        validateCondition(interaction.condition, context, nodeId);
      }
    }
  }

  if (node.use != null) {
    const componentEntry = resolveComponentDefinition(node.use, context.componentRoots);
    if (isObject(componentEntry) && isObject(componentEntry.root)) {
      if (!context.useStack.has(node.use)) {
        // A nested definition's ids are namespaced under this instance when it
        // renders, so they never collide with the caller's ids. Walk it in its
        // own id scope; its own duplicates are reported by its own pass.
        const callerIds = context.nodeIds;
        const callerDuplicates = context.duplicateNodeIds;
        context.nodeIds = new Set();
        context.duplicateNodeIds = new Set();
        context.useStack.add(node.use);
        validateNode(componentEntry.root, context, depth + 1);
        context.useStack.delete(node.use);
        context.nodeIds = callerIds;
        context.duplicateNodeIds = callerDuplicates;
      }
    }
  }

  for (const list of childNodeLists(node)) {
    for (const child of list) {
      validateNode(child, context, depth + 1);
    }
  }

  validateChildrenGrid(node, context);
  validateTableNode(node, context);
}

/**
 * The checks that compare ids collected across a whole page walk. When part of
 * the page could not be expanded (`complete: false`), an id it lacks may be in
 * that part, so a missing reference is not reported.
 */
function reportPageIdChecks(context, pageId, overlayTriggerRefs, { complete = true } = {}) {
  const { result, document } = context;

  for (const { formId, nodeId } of complete ? context.pendingSubmitRefs : []) {
    if (!context.nodeIds.has(formId)) {
      addDiagnostic(
        result,
        'INVALID_FORM_REFERENCE',
        `Submit interaction on page "${pageId}" references missing formId "${formId}".`,
        atNode(context, nodeId),
      );
    }
  }

  for (const overlayRef of complete ? overlayTriggerRefs : []) {
    if (typeof overlayRef.trigger === 'string' && !context.nodeIds.has(overlayRef.trigger)) {
      addDiagnostic(
        result,
        'INVALID_OVERLAY_TRIGGER',
        `Overlay "${overlayRef.overlayId}" references missing trigger node "${overlayRef.trigger}".`,
        overlayRef.at,
      );
    }
  }

  if (context.nodeCount > MAX_NODES_PER_PAGE) {
    addDiagnostic(
      result,
      'MAX_NODES_PER_PAGE_EXCEEDED',
      `Page "${pageId}" has ${context.nodeCount} nodes, exceeding maxNodesPerPage ${MAX_NODES_PER_PAGE}.`,
      { document, path: '$.page' },
    );
  }

  if (context.maxDepth > MAX_TREE_DEPTH) {
    addDiagnostic(
      result,
      'MAX_TREE_DEPTH_EXCEEDED',
      `Page "${pageId}" exceeds maxTreeDepth ${MAX_TREE_DEPTH} (found ${context.maxDepth}).`,
      { document, path: '$.page' },
    );
  }

  for (const duplicate of context.duplicateNodeIds) {
    const at = context.rowPlaces.get(duplicate) || atNode(context, duplicate);
    addDiagnostic(result, 'DUPLICATE_NODE_ID', `Page "${pageId}" has duplicate node id "${duplicate}".`, at);
  }
}

module.exports = {
  createNodeContext,
  reportPageIdChecks,
  validateNode,
};
