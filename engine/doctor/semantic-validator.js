'use strict';

const MAX_TREE_DEPTH = 100;
const MAX_NODES_PER_PAGE = 5000;

const STATE_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const OVERLAYS_REQUIRING_TRIGGER = new Set(['dropdown', 'popover', 'menu', 'tooltip']);
const { resolveTemplatePage } = require('../resolver');
const { resolvePrimitiveName } = require('../schema/primitive-registry');

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

const INTERACTION_REQUIRED_FIELDS = {
  navigation: ['targetRoute'],
  open_overlay: ['targetOverlay'],
  close_overlay: ['targetOverlay'],
  toggle: ['scope', 'stateKey'],
  set_state: ['scope', 'stateKey', 'value'],
  submit: ['formId'],
  action: ['actionId'],
  gesture: ['gestureType'],
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function addDiagnostic(result, code, message) {
  result.errors.push({
    code,
    message,
  });
}

function addWarning(result, code, message) {
  if (!result.warnings) {
    result.warnings = [];
  }
  result.warnings.push({ code, message });
}

function defaultGridColumnsFromManifest(manifest) {
  const value = Number(manifest?.defaultGridColumns ?? manifest?.manifest?.defaultGridColumns);
  return Number.isInteger(value) && value > 0 ? value : 12;
}

function collectRouteIds(routes) {
  const routeIds = new Set();

  if (!Array.isArray(routes)) {
    return routeIds;
  }

  for (const route of routes) {
    if (typeof route?.id === 'string' && route.id.trim() !== '') {
      routeIds.add(route.id);
    }
  }

  return routeIds;
}

function hasStateKey(state, key) {
  if (typeof key !== 'string') {
    return false;
  }

  if (!STATE_KEY_PATTERN.test(key)) {
    return false;
  }

  const parts = key.split('.');
  let current = state;

  for (const part of parts) {
    if (!isObject(current) || !hasOwn(current, part)) {
      return false;
    }
    current = current[part];
  }

  return true;
}

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

function validateCondition(condition, context) {
  if (!isObject(condition)) {
    return;
  }

  if (condition.type === 'state_equals') {
    const scope = condition.scope;
    const key = condition.key;
    const stateTree = scope === 'app' ? context.appState : context.pageState;
    if (!hasStateKey(stateTree, key)) {
      addDiagnostic(
        context.result,
        'MISSING_STATE_KEY',
        `Condition state_equals references missing ${scope} state key "${key}".`,
      );
    }
    return;
  }

  if (condition.type === 'route_match') {
    if (!context.conditionContext.routes.has(condition.routeId)) {
      addDiagnostic(
        context.result,
        'INVALID_ROUTE_REFERENCE',
        `Condition route_match references unknown route "${condition.routeId}".`,
      );
    }
    return;
  }

  if (condition.type === 'and' || condition.type === 'or') {
    if (!Array.isArray(condition.conditions)) {
      return;
    }
    for (const child of condition.conditions) {
      validateCondition(child, context);
    }
    return;
  }

  if (condition.type === 'not') {
    validateCondition(condition.condition, context);
    return;
  }
}

function validateInteraction(interaction, context, nodeId) {
  const { result, routeIds, actionIds, overlayIds, pendingSubmitRefs } = context;

  if (!isObject(interaction)) {
    return;
  }

  const requiredFields = INTERACTION_REQUIRED_FIELDS[interaction.type] || [];
  for (const field of requiredFields) {
    if (!hasOwn(interaction, field)) {
      addDiagnostic(
        result,
        'INTERACTION_MISSING_REQUIRED_FIELD',
        `Interaction type "${interaction.type}" on node "${nodeId}" is missing required field "${field}".`,
      );
      return;
    }
  }

  if (interaction.type === 'navigation') {
    if (!routeIds.has(interaction.targetRoute)) {
      addDiagnostic(
        result,
        'INVALID_TARGET_ROUTE',
        `Navigation interaction on node "${nodeId}" references unknown targetRoute "${interaction.targetRoute}".`,
      );
    }
    return;
  }

  if (interaction.type === 'open_overlay' || interaction.type === 'close_overlay') {
    if (!overlayIds.has(interaction.targetOverlay)) {
      addDiagnostic(
        result,
        'INVALID_TARGET_OVERLAY',
        `Interaction "${interaction.type}" on node "${nodeId}" references unknown overlay "${interaction.targetOverlay}".`,
      );
    }
    return;
  }

  if (interaction.type === 'toggle' || interaction.type === 'set_state') {
    const scope = interaction.scope;
    const stateTree = scope === 'app' ? context.appState : context.pageState;

    if (!hasStateKey(stateTree, interaction.stateKey)) {
      addDiagnostic(
        result,
        'MISSING_STATE_KEY',
        `${interaction.type} interaction on node "${nodeId}" references missing ${scope} state key "${interaction.stateKey}".`,
      );
    }
    return;
  }

  if (interaction.type === 'action') {
    if (!actionIds.has(interaction.actionId)) {
      addDiagnostic(
        result,
        'INVALID_ACTION_REFERENCE',
        `Action interaction on node "${nodeId}" references unknown action "${interaction.actionId}".`,
      );
    }
    return;
  }

  if (interaction.type === 'submit') {
    pendingSubmitRefs.push(interaction.formId);
    return;
  }
}

function validatePane(pane, context, nodeId) {
  if (!isObject(pane.state)) {
    return;
  }

  const scope = pane.state.scope;
  const stateTree = scope === 'app' ? context.appState : context.pageState;

  if (!hasStateKey(stateTree, pane.state.sizeKey)) {
    addDiagnostic(
      context.result,
      'MISSING_STATE_KEY',
      `Pane on node "${nodeId}" references missing ${scope} sizeKey "${pane.state.sizeKey}".`,
    );
  }

  if (!hasStateKey(stateTree, pane.state.collapsedKey)) {
    addDiagnostic(
      context.result,
      'MISSING_STATE_KEY',
      `Pane on node "${nodeId}" references missing ${scope} collapsedKey "${pane.state.collapsedKey}".`,
    );
  }
}

function validateSelection(selection, context, nodeId) {
  if (!isObject(selection)) {
    return;
  }

  const scope = selection.scope;
  const stateTree = scope === 'app' ? context.appState : context.pageState;

  if (!hasStateKey(stateTree, selection.stateKey)) {
    addDiagnostic(
      context.result,
      'MISSING_STATE_KEY',
      `Selection on node "${nodeId}" references missing ${scope} state key "${selection.stateKey}".`,
    );
  }
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
        );
      }

      if (isObject(child.size) && hasOwn(child.size, 'width')) {
        addDiagnostic(
          context.result,
          'INVALID_GRID_SPAN',
          `Node "${child.id}" in page "${context.pageId}" defines both gridItem.span and size.width.`,
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
  }

  if (typeof node.component === 'string'
    && COMPONENT_ALIASES[node.component]
    && resolvePrimitiveName(node.component) == null) {
    addWarning(
      context.result,
      'COMPONENT_ALIAS',
      `Node "${nodeId}" uses component "${node.component}" — did you mean "${COMPONENT_ALIASES[node.component]}"?`,
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
    validateCondition(node.visibility.condition, context);
  }

  if (isObject(node.condition)) {
    validateCondition(node.condition, context);
  }

  if (Array.isArray(node.interaction)) {
    for (const interaction of node.interaction) {
      if (isObject(interaction?.condition)) {
        validateCondition(interaction.condition, context);
      }
    }
  }

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

  validateChildrenGrid(node, context);
  validateTableNode(node, context);
}

function validateOverlayDefinition(overlay, context, overlaySource) {
  const { result, overlayIds, overlayTriggerRefs } = context;
  if (!isObject(overlay)) {
    return;
  }

  if (typeof overlay.id !== 'string') {
    return;
  }

  if (overlayIds.has(overlay.id)) {
    addDiagnostic(result, 'DUPLICATE_OVERLAY_ID', `Duplicate overlay id "${overlay.id}" in ${overlaySource}.`);
    return;
  }

  overlayIds.add(overlay.id);

  if (OVERLAYS_REQUIRING_TRIGGER.has(overlay.type)) {
    if (!hasOwn(overlay, 'trigger')) {
      addDiagnostic(
        result,
        'OVERLAY_MISSING_TRIGGER',
        `Overlay "${overlay.id}" of type "${overlay.type}" requires trigger.`,
      );
    }
    if (!hasOwn(overlay, 'placement')) {
      addDiagnostic(
        result,
        'OVERLAY_MISSING_PLACEMENT',
        `Overlay "${overlay.id}" of type "${overlay.type}" requires placement.`,
      );
    }

    if (hasOwn(overlay, 'trigger')) {
      overlayTriggerRefs.push({ overlayId: overlay.id, trigger: overlay.trigger });
    }
  }
}

function collectTemplateOverlays(templates, result) {
  const templateMap = new Map();

  for (const [templateId, template] of Object.entries(templates || {})) {
    const overlayIds = new Set();
    const overlayTriggerRefs = [];

    const sourceOverlays = isObject(template) && Array.isArray(template.overlays)
      ? template.overlays
      : [];

    for (const overlay of sourceOverlays) {
      validateOverlayDefinition(
        overlay,
        {
          result,
          overlayIds,
          overlayTriggerRefs,
        },
        `template "${templateId}"`,
      );
    }

    templateMap.set(templateId, {
      overlayIds,
      overlayTriggerRefs,
    });
  }

  return templateMap;
}

function collectComponentRoots(componentMap, result, routeIds, defaultGridColumns) {
  for (const [componentId, component] of Object.entries(componentMap || {})) {
    if (!isObject(component) || !isObject(component.root)) {
      continue;
    }

    const context = createNodeContext({
      result,
      pageId: `component "${componentId}"`,
      routeIds,
      appState: {},
      pageState: {},
      actionIds: new Set(),
      overlayIds: new Set(),
      componentRoots: componentMap,
      defaultGridColumns,
      validateDepthAndNodes: false,
    });

    validateNode(component.root, context, 1);

    for (const duplicate of context.duplicateNodeIds) {
      addDiagnostic(result, 'DUPLICATE_NODE_ID', `Component "${componentId}" defines duplicate node id "${duplicate}".`);
    }
  }
}

function collectRootsFromPage(pageDoc, templateDoc, componentRoots) {
  const roots = [];

  const templatePage = isObject(templateDoc) && isObject(pageDoc)
    ? resolveTemplatePage({ template: templateDoc, page: pageDoc, components: componentRoots })
    : null;

  if (templatePage && templatePage.ok && Array.isArray(templatePage.roots)) {
    roots.push(...templatePage.roots);
  }

  if (Array.isArray(pageDoc.overlays)) {
    for (const overlay of pageDoc.overlays) {
      if (isObject(overlay) && Array.isArray(overlay.content)) {
        roots.push(...overlay.content);
      }
    }
  }

  return roots;
}

function validatePageNodes(pageLoaded, templates, templateOverlayMap, routeIds, appState, componentRoots, result, defaultGridColumns) {
  const pageDoc = isObject(pageLoaded.document) ? pageLoaded.document.page : null;
  if (!isObject(pageDoc)) {
    return;
  }

  const pageId = pageLoaded.id || pageDoc.id || '<unknown>';
  const template = isObject(templates[pageDoc.template]) ? templates[pageDoc.template] : null;

  const templateOverlayInfo = isObject(template) && templateOverlayMap.get(pageDoc.template);
  const overlayIds = new Set(templateOverlayInfo ? templateOverlayInfo.overlayIds : []);
  const overlayTriggerRefs = [...(templateOverlayInfo ? templateOverlayInfo.overlayTriggerRefs : [])];

  const pageOverlays = Array.isArray(pageDoc.overlays) ? pageDoc.overlays : [];
  const pageOverlayIds = new Set();

  for (const overlay of pageOverlays) {
    const overlayValidationIds = new Set();
    validateOverlayDefinition(
      overlay,
      {
        result,
        overlayIds: overlayValidationIds,
        overlayTriggerRefs,
      },
      `page "${pageId}"`,
    );

    if (isObject(overlay) && typeof overlay.id === 'string') {
      if (overlayIds.has(overlay.id) || pageOverlayIds.has(overlay.id)) {
        addDiagnostic(result, 'DUPLICATE_OVERLAY_ID', `Duplicate overlay id "${overlay.id}" on page "${pageId}".`);
      }
      pageOverlayIds.add(overlay.id);
      overlayIds.add(overlay.id);
    }
  }

  const context = createNodeContext({
    result,
    pageId,
    routeIds,
    appState,
    pageState: isObject(pageDoc.pageState) ? pageDoc.pageState : {},
    actionIds: isObject(pageDoc.actions) ? new Set(Object.keys(pageDoc.actions)) : new Set(),
    overlayIds,
    componentRoots,
    defaultGridColumns,
    validateDepthAndNodes: true,
  });

  const roots = collectRootsFromPage(pageDoc, template, componentRoots);
  for (const root of roots) {
    validateNode(root, context, 1);
  }

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

function runSemanticValidation({
  result,
  manifest = {},
  sitemap = {},
  templates = {},
  components = {},
  pages = [],
  resolveComponentsForPage = null,
}) {
  const routeIds = collectRouteIds(sitemap.routes);
  const appState = isObject(sitemap.appState) ? sitemap.appState : {};
  const defaultGrid = defaultGridColumnsFromManifest(manifest);
  const globalComponents = isObject(components) ? components : {};

  const templateOverlayMap = collectTemplateOverlays(templates, result);
  collectComponentRoots(globalComponents, result, routeIds, defaultGrid);

  for (const pageLoaded of pages) {
    let pageComponents = globalComponents;

    if (typeof resolveComponentsForPage === 'function') {
      const resolvedComponents = resolveComponentsForPage(pageLoaded);
      if (resolvedComponents && resolvedComponents.ok === false) {
        addDiagnostic(
          result,
          'COMPONENT_IMPORT_ERROR',
          resolvedComponents.error || `Unable to resolve component imports for page "${pageLoaded?.id || '<unknown>'}".`,
        );
        continue;
      }
      if (resolvedComponents && isObject(resolvedComponents.components)) {
        pageComponents = resolvedComponents.components;
      }
    }

    validatePageNodes(pageLoaded, templates, templateOverlayMap, routeIds, appState, pageComponents, result, defaultGrid);
  }
}

module.exports = {
  runSemanticValidation,
};
