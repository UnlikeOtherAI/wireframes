'use strict';

const { buildPaneRuntimeCode } = require('./interactions-panes');
const { buildOverlayRuntimeCode } = require('./interactions-overlays');

function sanitizeOptions({
  routeId = '',
  routeTable = {},
  appStateDefaults = {},
  pageStateDefaults = {},
  platform = 'web',
} = {}) {
  const safeRouteTable = routeTable && typeof routeTable === 'object' && !Array.isArray(routeTable)
    ? routeTable
    : {};
  const safeAppState = appStateDefaults && typeof appStateDefaults === 'object' && !Array.isArray(appStateDefaults)
    ? appStateDefaults
    : {};
  const safePageState = pageStateDefaults && typeof pageStateDefaults === 'object' && !Array.isArray(pageStateDefaults)
    ? pageStateDefaults
    : {};
  return {
    routeId: String(routeId || '').trim(),
    routeTable: safeRouteTable,
    appStateDefaults: safeAppState,
    pageStateDefaults: safePageState,
    platform: platform || 'web',
  };
}

function buildInteractionRuntime(opts) {
  return buildInteractionRuntimeFromContextExpression(sanitizeOptions(opts));
}

function buildInteractionRuntimeFromContext(opts) {
  return buildInteractionRuntimeFromContextExpression(sanitizeOptions(opts));
}

function buildInteractionRuntimeFromWindowContext(opts) {
  const sanitized = sanitizeOptions(opts);
  sanitized.useWindowContext = true;
  return buildInteractionRuntimeFromContextExpression(sanitized);
}

function buildInteractionRuntimeFromContextExpression({
  routeId = '',
  routeTable = {},
  appStateDefaults = {},
  pageStateDefaults = {},
  platform = 'web',
  useWindowContext = false,
}) {
  const fallbackContext = JSON.stringify({
    routeId: String(routeId || '').trim(),
    routeTable,
    appStateDefaults,
    pageStateDefaults,
    platform: platform || 'web',
  });
  const rawContext = useWindowContext ? '(function () {'
    + 'var raw = typeof window !== "undefined" && window && window.WF_RUNTIME_CONTEXT ? window.WF_RUNTIME_CONTEXT : null;'
    + 'if (!raw || typeof raw !== "object" || Array.isArray(raw)) { return ' + fallbackContext + '; }'
    + 'return {'
    + `routeId: typeof raw.routeId === 'string' ? String(raw.routeId).trim() : ${JSON.stringify(String(routeId || '').trim())},`
    + `routeTable: raw.routeTable && typeof raw.routeTable === 'object' && !Array.isArray(raw.routeTable) ? raw.routeTable : ${JSON.stringify(routeTable)},`
    + `appStateDefaults: raw.appStateDefaults && typeof raw.appStateDefaults === 'object' && !Array.isArray(raw.appStateDefaults) ? raw.appStateDefaults : ${JSON.stringify(appStateDefaults)},`
    + `pageStateDefaults: raw.pageStateDefaults && typeof raw.pageStateDefaults === 'object' && !Array.isArray(raw.pageStateDefaults) ? raw.pageStateDefaults : ${JSON.stringify(pageStateDefaults)},`
    + `platform: typeof raw.platform === 'string' ? String(raw.platform) : ${JSON.stringify(platform || 'web')}`
    + '};'
    + '}())'
    : fallbackContext;

  return `(function () {
'use strict';
var WF_RUNTIME_CONTEXT = ${rawContext};
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
` + buildPaneRuntimeCode() + `
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
  var m = expr.match(/^\\{\\{\\s*(state|appState|route|event|props|item)\\.([a-zA-Z0-9_.]+)\\s*\\}\\}$/);
  if (!m) return expr;
  if (m[1] === 'state') return getAtPath(scopeState || WF_PAGE_STATE, m[2]);
  if (m[1] === 'appState') return getAtPath(WF_APP_STATE, m[2]);
  if (m[1] === 'route' && m[2] === 'id') return WF_ROUTE_ID;
  if (m[1] === 'event' && eventContext) return getAtPath(eventContext, m[2]);
  return undefined;
}
function evalCondition(condition, eventContext) {
  if (!isObj(condition) || typeof condition.type !== 'string') return false;
  if (condition.type === 'state_equals') {
    var eScope = condition.scope === 'app' || condition.scope === 'appState' ? 'appState' : 'state';
    return resolveExpr('{{' + eScope + '.' + condition.key + '}}', eventContext) === condition.equals;
  }
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
        var input = node.querySelector(name === 'disabled' ? 'button,input,select,textarea' : 'input') || node;
        var bool = !!(value === true || value === 'true');
        if (bool) input.setAttribute(name, '');
        else input.removeAttribute(name);
        input[name] = bool;
        if (name === 'disabled' && node.classList.contains('wf-button')) node.classList.toggle('wf-button-disabled', bool);
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
` + buildOverlayRuntimeCode() + `
function wfNavigate(id) {
  try {
    if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'wf:navigate', routeId: id }, '*');
      return;
    }
  } catch (_err) {}
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
      if (node.classList.contains('wf-button') && (node.hasAttribute('disabled') || node.querySelector('button:disabled'))) {
        event.preventDefault(); event.stopPropagation(); return;
      }
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
    var exprScope = (scope === 'app' || scope === 'appState') ? 'appState' : 'state';
    var current = resolveExpr('{{' + exprScope + '.' + key + '}}', null, WF_PAGE_STATE);
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
// Plain route links (nav items, tabs, breadcrumbs, button links) carry an href
// so a static build works without JavaScript. Route them through wfNavigate as
// well, so an embedded host can swap the page in memory instead of following
// the href to a file that is not there.
function bindRouteLinks() {
  if (!document || typeof document.addEventListener !== 'function') return;
  document.addEventListener('click', function (event) {
    var node = event.target;
    while (node && node !== document) {
      if (node.getAttribute && node.getAttribute('data-wf-route-target')) {
        if (node.hasAttribute('data-wf-interactions')) return;
        event.preventDefault();
        wfNavigate(node.getAttribute('data-wf-route-target'));
        return;
      }
      node = node.parentNode;
    }
  });
}
function init() {
  initState();
  initPanes();
  refresh();
  bindSelection();
  bindInteractions();
  bindRouteLinks();
}
var _wfInitDone = false;
function safeInit() { if (_wfInitDone) return; _wfInitDone = true; init(); }
safeInit();
window.addEventListener('load', safeInit);
})();`;
}

module.exports = {
  buildInteractionRuntime,
  buildInteractionRuntimeFromContext,
  buildInteractionRuntimeFromWindowContext,
};
