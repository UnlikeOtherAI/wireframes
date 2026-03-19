'use strict';

/**
 * Returns the pane-related runtime code string for the interaction runtime.
 * This is a fragment of the client-side JS IIFE — it relies on variables
 * and helpers (isObj, isFinite, getAtPath, setState, WF_APP_STATE,
 * WF_PAGE_STATE, WF_PANES) declared in the surrounding scope.
 */
function buildPaneRuntimeCode() {
  return `function paneState(scope, key) {
  if (typeof key !== 'string' || !key.trim()) return undefined;
  var state = scope === 'app' ? WF_APP_STATE : WF_PAGE_STATE;
  return getAtPath(state, key);
}
function paneStateAt(scope, key) {
  var value = paneState(scope, key);
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') {
    var parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
function clampPaneSize(value, minSize, maxSize) {
  if (!isFinite(value)) return value;
  if (isFinite(minSize) && value < minSize) return minSize;
  if (isFinite(maxSize) && value > maxSize) return maxSize;
  return value;
}
function applyPaneState(node, config, setPersistenceMarker) {
  if (!node || !isObj(config)) return;
  var axis = config.axis === 'height' ? 'height' : 'width';
  var stateSet = false;
  var size = undefined;
  if (config.state && isObj(config.state)) {
    var collapsed = paneState(config.state.scope, config.state.collapsedKey);
    var collapsedBoolean = !!(collapsed === true || collapsed === 1 || collapsed === 'true');
    stateSet = true;
    node.setAttribute('data-wf-pane-collapsed', collapsedBoolean ? 'true' : 'false');
    if (collapsedBoolean && isFinite(config.collapsedSize)) {
      size = config.collapsedSize;
    } else if (!collapsedBoolean && config.state.sizeKey) {
      size = paneStateAt(config.state.scope, config.state.sizeKey);
      if (!isFinite(size) && isFinite(config.defaultSize)) {
        size = config.defaultSize;
      }
    }
  }

  if (!stateSet && isFinite(config.defaultSize)) {
    size = config.defaultSize;
  }

  if (config.collapsible === true && !stateSet && isFinite(config.collapsedSize)) {
    node.setAttribute('data-wf-pane-collapsed', 'false');
  }
  if (isFinite(size) && axis === 'width') {
    if (config.state && config.collapsedSize === size) node.style.width = Math.max(0, Math.round(size)) + 'px';
    else node.style.width = clampPaneSize(Math.round(size), config.minSize, config.maxSize) + 'px';
  } else if (isFinite(size) && axis === 'height') {
    if (config.state && config.collapsedSize === size) node.style.height = Math.max(0, Math.round(size)) + 'px';
    else node.style.height = clampPaneSize(Math.round(size), config.minSize, config.maxSize) + 'px';
  }
  if (setPersistenceMarker && isFinite(size)) {
    if (config.state && config.collapsedSize === size) {
      node._wfPanePersistedSize = Math.max(0, Math.round(size));
    } else {
      node._wfPanePersistedSize = clampPaneSize(Math.round(size), config.minSize, config.maxSize);
    }
  }
}
function refreshPanes() {
  if (!WF_PANES.length) return;
  for (var i = 0; i < WF_PANES.length; i++) {
    applyPaneState(WF_PANES[i].node, WF_PANES[i].config, false);
  }
}
function parsePane(node) {
  if (!node) return null;
  var raw = node.getAttribute('data-wf-pane');
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    return isObj(parsed) ? parsed : null;
  } catch (_err) {
    return null;
  }
}
function bindPaneResizePersistence(entry) {
  if (!entry || !entry.config || !entry.config.state || !entry.config.state.sizeKey) return;
  if (typeof ResizeObserver === 'undefined') return;
  if (entry._wfPaneObserver) return;
  var axis = entry.config.axis === 'height' ? 'height' : 'width';
  var scope = entry.config.state.scope;
  var key = entry.config.state.sizeKey;
  entry._wfPaneObserver = new ResizeObserver(function (entries) {
    var candidate = entries && entries[0];
    if (!candidate || !candidate.contentRect) return;
    var value = axis === 'height' ? candidate.contentRect.height : candidate.contentRect.width;
    if (!isFinite(value)) return;
    var nextSize = clampPaneSize(Math.round(value), entry.config.minSize, entry.config.maxSize);
    if (entry._wfPanePersistedSize === nextSize) return;
    entry._wfPanePersistedSize = nextSize;
    setState(scope, key, nextSize);
  });
  entry._wfPaneObserver.observe(entry.node);
}
function initPanes() {
  var nodes = document.querySelectorAll('[data-wf-pane]');
  WF_PANES = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var config = parsePane(node);
    if (!isObj(config)) continue;
    WF_PANES.push({ node: node, config: config, _wfPanePersistedSize: undefined });
    bindPaneResizePersistence(WF_PANES[WF_PANES.length - 1]);
    applyPaneState(node, config, true);
  }
}`;
}

module.exports = { buildPaneRuntimeCode };
