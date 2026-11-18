'use strict';

/**
 * Checks that look at one node at a time: interactions, conditions, panes,
 * selections, grid spans, table columns and near-miss component names.
 */

const { resolvePrimitiveName } = require('../schema/primitive-registry');

const STATE_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

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

/** Every per-node rule, in the order the walker always ran them. */
function validateNodeRules(node, context) {
  const nodeId = node.id;

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
}

/** Rules that need the node's children, run after the walker has visited them. */
function validateNodeContainerRules(node, context) {
  validateChildrenGrid(node, context);
  validateTableNode(node, context);
}

module.exports = {
  addDiagnostic,
  addWarning,
  hasOwn,
  isObject,
  validateNodeContainerRules,
  validateNodeRules,
};
