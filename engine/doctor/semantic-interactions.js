'use strict';

// What a node does and refers to: interactions, conditions, panes, selections and
// overlay definitions. `node-walker.js` walks the tree and calls these.

const STATE_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

const OVERLAYS_REQUIRING_TRIGGER = new Set(['dropdown', 'popover', 'menu', 'tooltip']);

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

/**
 * `at` says where the finding is. Only a result that sets `locations` keeps it, so what
 * the disk commands and the API print is unchanged.
 */
function addDiagnostic(result, code, message, at) {
  result.errors.push(at && result.locations ? { code, message, at } : { code, message });
}

function addWarning(result, code, message, at) {
  if (!result.warnings) {
    result.warnings = [];
  }
  result.warnings.push(at && result.locations ? { code, message, at } : { code, message });
}

/**
 * The node a finding is about, in the document being walked. `within` is the path of
 * the component definition being walked, when it is one.
 */
function atNode(context, nodeId) {
  if (!context.document || typeof nodeId !== 'string') return undefined;
  return context.within ? { document: context.document, node: nodeId, within: context.within } : { document: context.document, node: nodeId };
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

function validateCondition(condition, context, nodeId) {
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
        atNode(context, nodeId),
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
        atNode(context, nodeId),
      );
    }
    return;
  }

  if (condition.type === 'and' || condition.type === 'or') {
    if (!Array.isArray(condition.conditions)) {
      return;
    }
    for (const child of condition.conditions) {
      validateCondition(child, context, nodeId);
    }
    return;
  }

  if (condition.type === 'not') {
    validateCondition(condition.condition, context, nodeId);
  }
}

function validateInteraction(interaction, context, nodeId) {
  const { result, routeIds, actionIds, overlayIds, pendingSubmitRefs } = context;
  const at = atNode(context, nodeId);

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
        at,
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
        at,
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
        at,
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
        at,
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
        at,
      );
    }
    return;
  }

  if (interaction.type === 'submit') {
    pendingSubmitRefs.push({ formId: interaction.formId, nodeId });
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
      atNode(context, nodeId),
    );
  }

  if (!hasStateKey(stateTree, pane.state.collapsedKey)) {
    addDiagnostic(
      context.result,
      'MISSING_STATE_KEY',
      `Pane on node "${nodeId}" references missing ${scope} collapsedKey "${pane.state.collapsedKey}".`,
      atNode(context, nodeId),
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
      atNode(context, nodeId),
    );
  }
}

function validateOverlayDefinition(overlay, context, overlaySource) {
  const { result, overlayIds, overlayTriggerRefs } = context;
  if (!isObject(overlay)) {
    return;
  }

  if (typeof overlay.id !== 'string') {
    return;
  }

  const at = atNode(context, overlay.id);

  if (overlayIds.has(overlay.id)) {
    addDiagnostic(result, 'DUPLICATE_OVERLAY_ID', `Duplicate overlay id "${overlay.id}" in ${overlaySource}.`, at);
    return;
  }

  overlayIds.add(overlay.id);

  if (OVERLAYS_REQUIRING_TRIGGER.has(overlay.type)) {
    if (!hasOwn(overlay, 'trigger')) {
      addDiagnostic(
        result,
        'OVERLAY_MISSING_TRIGGER',
        `Overlay "${overlay.id}" of type "${overlay.type}" requires trigger.`,
        at,
      );
    }
    if (!hasOwn(overlay, 'placement')) {
      addDiagnostic(
        result,
        'OVERLAY_MISSING_PLACEMENT',
        `Overlay "${overlay.id}" of type "${overlay.type}" requires placement.`,
        at,
      );
    }

    if (hasOwn(overlay, 'trigger')) {
      overlayTriggerRefs.push({ overlayId: overlay.id, trigger: overlay.trigger, at });
    }
  }
}

module.exports = {
  isObject,
  hasOwn,
  addDiagnostic,
  addWarning,
  atNode,
  validateCondition,
  validateInteraction,
  validatePane,
  validateSelection,
  validateOverlayDefinition,
};
