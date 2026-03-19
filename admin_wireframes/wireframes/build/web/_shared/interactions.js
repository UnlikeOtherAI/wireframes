(function () {
'use strict';
var WF_RUNTIME_CONTEXT = (function () {var raw = typeof window !== "undefined" && window && window.WF_RUNTIME_CONTEXT ? window.WF_RUNTIME_CONTEXT : null;if (!raw || typeof raw !== "object" || Array.isArray(raw)) { return {"routeId":"","routeTable":{},"appStateDefaults":{},"pageStateDefaults":{},"platform":"web"}; }return {routeId: typeof raw.routeId === 'string' ? String(raw.routeId).trim() : "",routeTable: raw.routeTable && typeof raw.routeTable === 'object' && !Array.isArray(raw.routeTable) ? raw.routeTable : {},appStateDefaults: raw.appStateDefaults && typeof raw.appStateDefaults === 'object' && !Array.isArray(raw.appStateDefaults) ? raw.appStateDefaults : {},pageStateDefaults: raw.pageStateDefaults && typeof raw.pageStateDefaults === 'object' && !Array.isArray(raw.pageStateDefaults) ? raw.pageStateDefaults : {},platform: typeof raw.platform === 'string' ? String(raw.platform) : "web"};}());
var WF_ROUTE_ID = String(WF_RUNTIME_CONTEXT.routeId || '');
var WF_ROUTES = (WF_RUNTIME_CONTEXT.routeTable && typeof WF_RUNTIME_CONTEXT.routeTable === 'object' && !Array.isArray(WF_RUNTIME_CONTEXT.routeTable))
  ? WF_RUNTIME_CONTEXT.routeTable
  : {};
var WF_APP_STATE_DEFAULTS = (WF_RUNTIME_CONTEXT.appStateDefaults && typeof WF_RUNTIME_CONTEXT.appStateDefaults === 'object' && !Array.isArray(WF_RUNTIME_CONTEXT.appStateDefaults))
  ? WF_RUNTIME_CONTEXT.appStateDefaults
  : {};
var WF_PAGE_STATE_DEFAULTS = (WF_RUNTIME_CONTEXT.pageStateDefaults && typeof WF_RUNTIME_CONTEXT.pageStateDefaults === 'object' && !Array.isArray(WF_RUNTIME_CONTEXT.pageStateDefaults))
  ? WF_RUNTIME_CONTEXT.pageStateDefaults
  : {};
var WF_PLATFORM = String(WF_RUNTIME_CONTEXT.platform || 'web');
var WF_APP_PREFIX = 'wf_app_';
var WF_PAGE_STATE = {};
var WF_APP_STATE = {};
function safeSessionStorage() {
  try {
    return typeof window !== 'undefined' && window && window.sessionStorage ? window.sessionStorage : null;
  } catch (_err) {
    return null;
  }
}
var WF_SESSION_STORAGE = safeSessionStorage();
var WF_HAS_SESSION = !!WF_SESSION_STORAGE;
var WF_PANES = [];

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function clone(v) { return isObj(v) ? JSON.parse(JSON.stringify(v)) : v; }
function keysOf(v) { return isObj(v) ? Object.keys(v) : []; }
function eachLeaf(obj, visit, prefix) {
  var keys = keysOf(obj).sort();
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var next = prefix ? prefix + '.' + key : key;
    var value = obj[key];
    if (isObj(value)) eachLeaf(value, visit, next);
    else visit(next, value);
  }
}
function paneState(scope, key) {
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
}
function getAtPath(obj, path) {
  if (!isObj(obj) || typeof path !== 'string' || path === '') return undefined;
  var parts = path.split('.');
  var cursor = obj;
  for (var i = 0; i < parts.length; i++) {
    cursor = cursor && cursor[parts[i]];
    if (cursor === undefined) return undefined;
  }
  return cursor;
}
function setAtPath(obj, path, value) {
  if (!isObj(obj) || typeof path !== 'string' || path === '') return;
  var parts = path.split('.');
  var cursor = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (!isObj(cursor[parts[i]])) cursor[parts[i]] = {};
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
}
function appStorageKey(path) { return WF_APP_PREFIX + String(path).replace(/[^a-z0-9_]/gi, '_'); }
function storageRead(path, fallback) {
  if (!WF_HAS_SESSION) return fallback;
  try {
    var raw = WF_SESSION_STORAGE.getItem(appStorageKey(path));
    return raw === null ? fallback : JSON.parse(raw);
  } catch (_err) { return fallback; }
}
function storageWrite(path, value) {
  if (!WF_HAS_SESSION) return;
  try { WF_SESSION_STORAGE.setItem(appStorageKey(path), JSON.stringify(value)); } catch (_err) {}
}
function resolveExpr(expr, eventContext, scopeState) {
  if (typeof expr !== 'string') return expr;
  var m = expr.match(/^\{\{\s*(state|appState|route|event|props|item)\.([a-zA-Z0-9_.]+)\s*\}\}$/);
  if (!m) return expr;
  if (m[1] === 'state') return getAtPath(scopeState || WF_PAGE_STATE, m[2]);
  if (m[1] === 'appState') return getAtPath(WF_APP_STATE, m[2]);
  if (m[1] === 'route' && m[2] === 'id') return WF_ROUTE_ID;
  if (m[1] === 'event' && eventContext) return getAtPath(eventContext, m[2]);
  return undefined;
}
function evalCondition(condition, eventContext) {
  if (!isObj(condition) || typeof condition.type !== 'string') return false;
  if (condition.type === 'state_equals') return resolveExpr('{{' + condition.scope + '.' + condition.key + '}}', eventContext) === condition.equals;
  if (condition.type === 'route_match') return String(condition.routeId || '') === String(WF_ROUTE_ID || '');
  if (condition.type === 'compare') {
    var left = resolveExpr(condition.left, eventContext, WF_PAGE_STATE);
    var right = resolveExpr(condition.right, eventContext, WF_PAGE_STATE);
    var op = condition.op;
    if (op === 'eq') return left === right;
    if (op === 'ne') return left !== right;
    if (left == null || right == null) return false;
    if (op === 'gt') return left > right;
    if (op === 'gte') return left >= right;
    if (op === 'lt') return left < right;
    if (op === 'lte') return left <= right;
    return false;
  }
  if (condition.type === 'and') {
    if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) return false;
    for (var i = 0; i < condition.conditions.length; i++) if (!evalCondition(condition.conditions[i], eventContext)) return false;
    return true;
  }
  if (condition.type === 'or') {
    if (!Array.isArray(condition.conditions) || condition.conditions.length === 0) return false;
    for (var j = 0; j < condition.conditions.length; j++) if (evalCondition(condition.conditions[j], eventContext)) return true;
    return false;
  }
  if (condition.type === 'not') return !evalCondition(condition.condition, eventContext);
  return false;
}
function initState() {
  WF_PAGE_STATE = clone(WF_PAGE_STATE_DEFAULTS || {});
  WF_APP_STATE = clone(WF_APP_STATE_DEFAULTS || {});
  eachLeaf(WF_APP_STATE_DEFAULTS || {}, function(path, value) {
    var stored = storageRead(path);
    if (stored !== undefined) setAtPath(WF_APP_STATE, path, stored);
  }, '');
}
function each(selector, fn) {
  var nodes = document.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; i++) fn(nodes[i], i);
}
function setState(scope, key, value) {
  if (typeof key !== 'string' || !key.trim()) return;
  if (scope === 'app') { setAtPath(WF_APP_STATE, key, value); storageWrite(key, value); }
  else setAtPath(WF_PAGE_STATE, key, value);
  refresh();
}

function selectionValueForNode(node) {
  var raw = node.getAttribute('data-selection-value');
  if (raw == null || raw === '') return node.getAttribute('id') || '';
  try {
    return JSON.parse(raw);
  } catch (_err) {
    return raw;
  }
}

function toggleState(scope, key) {
  var targetScope = scope === 'app' ? 'app' : 'page';
  var current = targetScope === 'app'
    ? getAtPath(WF_APP_STATE, key)
    : getAtPath(WF_PAGE_STATE, key);
  var toggled = !(current === true || current === 1 || current === 'true');
  setState(targetScope, key, toggled);
}
function showToast(message) {
  var t = document.createElement('div');
  t.className = 'wf-runtime-toast';
  t.textContent = String(message);
  document.body.appendChild(t);
  setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
}
function refresh() {
  each('[data-bind]', function (node) {
    var expr = node.getAttribute('data-bind');
    if (expr) node.textContent = String(resolveExpr('{{' + expr + '}}', null, WF_PAGE_STATE) || '');
  });
  each('[data-wf-state-bindings]', function (node) {
    var bindings;
    try { bindings = JSON.parse(node.getAttribute('data-wf-state-bindings') || '{}'); } catch (_err) { return; }
    if (!isObj(bindings)) return;
    var names = Object.keys(bindings);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      var value = resolveExpr(bindings[name], null, WF_PAGE_STATE);
      if (name === 'text' || name === 'label') node.textContent = value == null ? '' : String(value);
      else if (name === 'placeholder') {
        var target = node.querySelector('input,textarea,select');
        if (target) target.setAttribute('placeholder', value == null ? '' : String(value));
      } else if (name === 'checked' || name === 'disabled') {
        var input = node.querySelector('input') || node;
        var bool = !!(value === true || value === 'true');
        if (bool) input.setAttribute(name, '');
        else input.removeAttribute(name);
        input[name] = bool;
      } else if (name === 'visibility') {
        node.style.display = value ? '' : 'none';
      } else if (name.slice(0, 6) === 'style.') {
        node.style[name.slice(6)] = value == null ? '' : String(value);
      } else {
        try { node[name] = value; } catch (_err) {}
      }
    }
  });
  refreshVisibility();
  refreshSelection();
  refreshPanes();
}
function refreshVisibility() {
  each('[data-wf-visibility]', function (node) {
    var raw = node.getAttribute('data-wf-visibility') || '{}';
    try {
      var c = JSON.parse(raw);
      node.style.display = evalCondition(c.condition || c, null) ? '' : 'none';
    } catch (_err) { node.style.display = ''; }
  });
}
function overlayDismissList(node) {
  if (!node) return [];
  try {
    var d = JSON.parse(node.getAttribute('data-wf-overlay-dismiss') || '[]');
    return Array.isArray(d) ? d : [];
  } catch (_err) { return []; }
}
function overlayType(node) {
  return node && node.getAttribute ? String(node.getAttribute('data-wf-overlay-type') || '') : '';
}
function overlayPlacement(node) {
  return node && node.getAttribute ? String(node.getAttribute('data-wf-overlay-placement') || '') : '';
}
function overlayTriggerNode(node) {
  if (!node || !node.getAttribute) return null;
  var triggerId = String(node.getAttribute('data-wf-overlay-trigger') || '');
  return triggerId ? document.getElementById(triggerId) : null;
}
function isAnchoredOverlayType(type) {
  return type === 'dropdown' || type === 'popover' || type === 'menu' || type === 'tooltip';
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function positionAnchoredOverlay(node) {
  if (!node) return;
  var type = overlayType(node);
  if (!isAnchoredOverlayType(type)) return;
  var trigger = overlayTriggerNode(node);
  if (!trigger) return;

  var prevVisibility = node.style.visibility;
  node.style.visibility = 'hidden';
  node.style.left = '0px';
  node.style.top = '0px';
  node.style.right = 'auto';
  node.style.bottom = 'auto';

  var triggerRect = trigger.getBoundingClientRect();
  var overlayRect = node.getBoundingClientRect();
  var width = overlayRect.width || 0;
  var height = overlayRect.height || 0;
  var gap = 8;
  var placement = overlayPlacement(node) || 'bottom';
  var left = triggerRect.left;
  var top = triggerRect.bottom + gap;

  if (placement === 'top') {
    top = triggerRect.top - height - gap;
    if (top < gap) top = triggerRect.bottom + gap;
  } else if (placement === 'left') {
    left = triggerRect.left - width - gap;
    top = triggerRect.top;
    if (left < gap) left = triggerRect.right + gap;
  } else if (placement === 'right') {
    left = triggerRect.right + gap;
    top = triggerRect.top;
    if (left + width > window.innerWidth - gap) left = triggerRect.left - width - gap;
  } else if (placement === 'center') {
    left = triggerRect.left + ((triggerRect.width - width) / 2);
    top = triggerRect.top + ((triggerRect.height - height) / 2);
  } else {
    top = triggerRect.bottom + gap;
    left = triggerRect.left;
    if (top + height > window.innerHeight - gap) top = triggerRect.top - height - gap;
  }

  left = clamp(left, gap, Math.max(gap, window.innerWidth - width - gap));
  top = clamp(top, gap, Math.max(gap, window.innerHeight - height - gap));

  node.style.left = Math.round(left) + 'px';
  node.style.top = Math.round(top) + 'px';
  if (type === 'menu' || type === 'dropdown') {
    node.style.minWidth = Math.max(Math.round(triggerRect.width), 160) + 'px';
  }
  node.style.visibility = prevVisibility || '';
}
function setOverlayVisible(node, show) {
  if (!node) return;
  node.classList.toggle('wf-visible', !!show);
  var backdrop = node.querySelector('.wf-overlay-backdrop');
  if (backdrop) {
    backdrop.style.display = show ? 'block' : 'none';
    backdrop.style.pointerEvents = show ? 'auto' : 'none';
  }
}
function bindOverlayDismiss(node, overlayId, list) {
  if (list.indexOf('backdrop') >= 0) {
    var backdrop = node.querySelector('.wf-overlay-backdrop');
    if (backdrop && !node._wfBackdropHandler) {
      node._wfBackdropHandler = function (event) {
        event.stopPropagation();
        closeOverlay(overlayId);
      };
      backdrop.addEventListener('click', node._wfBackdropHandler);
    }
  }
  if (list.indexOf('escape') >= 0 && !node._wfEscHandler) {
    node._wfEscHandler = function (event) {
      if (event.key === 'Escape') closeOverlay(overlayId);
    };
    document.addEventListener('keydown', node._wfEscHandler);
  }
  if (list.indexOf('outside') >= 0 && !node._wfOutsideHandler) {
    node._wfOutsideHandler = function (event) {
      var trigger = overlayTriggerNode(node);
      var target = event && event.target ? event.target : null;
      if (!target) return;
      if (node.contains(target)) return;
      if (trigger && trigger.contains && trigger.contains(target)) return;
      closeOverlay(overlayId);
    };
    document.addEventListener('mousedown', node._wfOutsideHandler);
  }
  if (isAnchoredOverlayType(overlayType(node)) && !node._wfPositionHandler) {
    node._wfPositionHandler = function () {
      if (node.classList.contains('wf-visible')) positionAnchoredOverlay(node);
    };
    window.addEventListener('resize', node._wfPositionHandler);
    window.addEventListener('scroll', node._wfPositionHandler, true);
  }
}
function unbindOverlayDismiss(node, overlayId) {
  var backdrop = node ? node.querySelector('.wf-overlay-backdrop') : null;
  if (node._wfBackdropHandler && backdrop) {
    backdrop.removeEventListener('click', node._wfBackdropHandler);
    node._wfBackdropHandler = null;
  }
  if (node._wfEscHandler) {
    document.removeEventListener('keydown', node._wfEscHandler);
    node._wfEscHandler = null;
  }
  if (node._wfOutsideHandler) {
    document.removeEventListener('mousedown', node._wfOutsideHandler);
    node._wfOutsideHandler = null;
  }
  if (node._wfPositionHandler) {
    window.removeEventListener('resize', node._wfPositionHandler);
    window.removeEventListener('scroll', node._wfPositionHandler, true);
    node._wfPositionHandler = null;
  }
  if (node._wfDismissTimer) {
    clearTimeout(node._wfDismissTimer);
    node._wfDismissTimer = null;
  }
}
function openOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  var dismiss = overlayDismissList(node);
  setOverlayVisible(node, true);
  positionAnchoredOverlay(node);
  if (dismiss.indexOf('timeout') >= 0) {
    node._wfDismissTimer = setTimeout(function () { closeOverlay(id); }, 3000);
  }
  bindOverlayDismiss(node, id, dismiss);
}
function closeOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  setOverlayVisible(node, false);
  unbindOverlayDismiss(node, id);
}
function wfNavigate(id) {
  var target = WF_ROUTES[id];
  if (!target) { console.warn('Missing target route:', id); return; }
  window.location.href = target;
}
function formValues(formId) {
  var root = document.getElementById(formId);
  if (!root) return null;
  var output = {};
  var fields = root.querySelectorAll('input,textarea,select');
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var cursor = field;
    var key = null;
    while (cursor && cursor !== root) {
      if (cursor.getAttribute && cursor.getAttribute('id')) { key = cursor.getAttribute('id'); break; }
      cursor = cursor.parentNode;
    }
    if (key) output[key] = field.type === 'checkbox' ? !!field.checked : field.value;
  }
  return output;
}
function eventContext(event) {
  var t = event && event.target ? event.target : null;
  return { value: t && t.value !== undefined ? t.value : '', checked: !!(t && t.checked), targetId: t && t.getAttribute ? t.getAttribute('id') : '' };
}
function runInteraction(interaction, node, event) {
  if (!isObj(interaction) || typeof interaction.type !== 'string') return;
  if (interaction.condition && !evalCondition(interaction.condition, eventContext(event))) return;
  if (interaction.type === 'navigation') {
    if (!interaction.targetRoute) { console.warn('Missing targetRoute'); return; }
    wfNavigate(interaction.targetRoute); return;
  }
  if (interaction.type === 'open_overlay') {
    if (!interaction.targetOverlay) { console.warn('Missing targetOverlay'); return; }
    openOverlay(interaction.targetOverlay); return;
  }
  if (interaction.type === 'close_overlay') {
    if (!interaction.targetOverlay) { console.warn('Missing targetOverlay'); return; }
    closeOverlay(interaction.targetOverlay); return;
  }
  if (interaction.type === 'toggle') {
    toggleState(interaction.scope || 'page', interaction.stateKey); return;
  }
  if (interaction.type === 'set_state') {
    setState(interaction.scope || 'page', interaction.stateKey, resolveExpr(interaction.value, eventContext(event), WF_PAGE_STATE));
    return;
  }
  if (interaction.type === 'submit') {
    if (!interaction.formId) { console.warn('Missing formId'); showToast('Error: submit interaction missing formId'); return; }
    var payload = formValues(interaction.formId);
    if (!payload) { console.warn('Missing form:', interaction.formId); showToast('Error: form not found'); return; }
    showToast('Form submitted: ' + JSON.stringify(payload)); return;
  }
  if (interaction.type === 'action') {
    if (!interaction.actionId) { console.warn('Missing actionId'); showToast('Error: missing actionId'); return; }
    showToast('Action: ' + interaction.actionId + ' triggered');
    return;
  }
  if (interaction.type === 'gesture') {
    showToast('Gesture ' + interaction.gestureType + ' captured');
  }
}
function bindInteractions() {
  each('[data-wf-interactions]', function (node) {
    if (node._wfInteractionBound) return;
    var parsed;
    try { parsed = JSON.parse(node.getAttribute('data-wf-interactions') || '[]'); } catch (_err) { return; }
    if (!Array.isArray(parsed) || parsed.length === 0) return;
    node._wfInteractionBound = true;

    var nonGestures = [];
    var gestures = [];
    for (var i = 0; i < parsed.length; i++) {
      if (parsed[i] && parsed[i].type === 'gesture') gestures.push(parsed[i]);
      else nonGestures.push(parsed[i]);
    }
    node.addEventListener('click', function (event) {
      for (var j = 0; j < nonGestures.length; j++) runInteraction(nonGestures[j], node, event);
    });
    var tagName = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : '';
    var hasNativeTarget = tagName === 'a' || tagName === 'button' || tagName === 'input' || tagName === 'select' || tagName === 'textarea';
    if (!hasNativeTarget) {
      try {
        hasNativeTarget = !!node.querySelector('a,button,input,select,textarea');
      } catch (_err) {}
    }
    if (!hasNativeTarget) {
      if (node.getAttribute && !node.getAttribute('tabindex')) node.setAttribute('tabindex', '0');
      if (node.getAttribute && !node.getAttribute('role')) node.setAttribute('role', 'button');
      node.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.preventDefault) event.preventDefault();
        for (var k = 0; k < nonGestures.length; k++) runInteraction(nonGestures[k], node, event);
      });
    }
    bindGestures(node, gestures);
  });
}
function bindGestures(node, gestureInteractions) {
  if (WF_PLATFORM !== 'mobile' && WF_PLATFORM !== 'tablet') return;
  if (!gestureInteractions.length) return;
  var start = null, timer = null, pinch = null;
  var lastTap = 0, lastX = 0, lastY = 0;
  function trigger(type, event) {
    node.classList.add('wf-gesture-pulse');
    setTimeout(function () { node.classList.remove('wf-gesture-pulse'); }, 250);
    for (var i = 0; i < gestureInteractions.length; i++) if (gestureInteractions[i].gestureType === type) runInteraction(gestureInteractions[i], node, event);
  }
  node.addEventListener('touchstart', function (event) {
    var t = event.touches[0];
    start = t ? { x: t.clientX, y: t.clientY, time: Date.now() } : null;
    if (event.touches.length === 2) {
      var a = event.touches[0], b = event.touches[1];
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      pinch = Math.sqrt(dx * dx + dy * dy);
    }
    timer = setTimeout(function () { timer = null; trigger('long_press', event); }, 500);
  }, { passive: true });
  node.addEventListener('touchmove', function (event) {
    if (!start) return;
    if (event.touches.length === 2 && pinch !== null) {
      var a = event.touches[0], b = event.touches[1];
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      var next = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(next - pinch) > 30) { trigger('pinch', event); pinch = null; }
    }
  }, { passive: true });
  node.addEventListener('touchend', function (event) {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!start || !event.changedTouches.length) return;
    var e = event.changedTouches[0];
    var dx = e.clientX - start.x, dy = e.clientY - start.y;
    var adx = Math.abs(dx), ady = Math.abs(dy);
    if (adx > 50 && adx > ady) trigger(dx < 0 ? 'swipe_left' : 'swipe_right', event);
    else if (ady > 50 && ady >= adx) trigger(dy < 0 ? 'swipe_up' : 'swipe_down', event);
    var now = Date.now();
    if (now - lastTap < 300 && Math.abs(e.clientX - lastX) < 25 && Math.abs(e.clientY - lastY) < 25) trigger('double_tap', event);
    lastTap = now; lastX = e.clientX; lastY = e.clientY;
    start = null; pinch = null;
  }, { passive: true });
  node.addEventListener('touchcancel', function () {
    if (timer) { clearTimeout(timer); timer = null; }
    start = null; pinch = null;
  });
}
function refreshSelection() {
  each('.wf-selectable[data-selection-key]', function (node) {
    var scope = node.getAttribute('data-selection-scope') || 'page';
    var key = node.getAttribute('data-selection-key') || '';
    var current = resolveExpr('{{' + scope + '.' + key + '}}', null, WF_PAGE_STATE);
    var expected = selectionValueForNode(node);
    if (current === expected) node.classList.add('wf-selected');
    else node.classList.remove('wf-selected');
  });
}
function bindSelection() {
  each('.wf-selectable[data-selection-key]', function (node) {
    if (node._wfSelectionBound) return;
    node._wfSelectionBound = true;
    node.addEventListener('click', function () {
      if (node.getAttribute('data-selection-selectable') === 'false') return;
      var scope = node.getAttribute('data-selection-scope') || 'page';
      var key = node.getAttribute('data-selection-key') || '';
      if (key) setState(scope, key, selectionValueForNode(node));
    });
  });
}
function init() {
  initState();
  initPanes();
  refresh();
  bindSelection();
  bindInteractions();
}
init();
window.addEventListener('load', init);
})();