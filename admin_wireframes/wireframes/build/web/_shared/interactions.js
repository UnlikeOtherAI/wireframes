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
    if (isMeasuring()) return;
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

function safeControlKey(key) {
  return typeof key === 'string' && key.length > 0 && !key.split('.').some(function (part) { return !part || ['__proto__', 'constructor', 'prototype'].indexOf(part) >= 0; });
}
// An exact state.key / appState.key expression is writable; anything else is read-only.
function exactBinding(expr) {
  var match = typeof expr === 'string' && expr.match(/^\{\{\s*(state|appState)\.([a-zA-Z0-9_.]+)\s*\}\}$/);
  if (!match || !safeControlKey(match[2])) return null;
  return { scope: match[1] === 'appState' ? 'app' : 'page', key: match[2] };
}
function controlBinding(node) {
  var bindings;
  try { bindings = JSON.parse(node.getAttribute('data-wf-state-bindings') || '{}'); } catch (_err) { return null; }
  return exactBinding(bindings.value);
}
function setDataState(el, name, value) {
  if (value === true) el.setAttribute('data-wf-' + name, '');
  else if (value === 'mixed') el.setAttribute('data-wf-' + name, 'mixed');
  else el.removeAttribute('data-wf-' + name);
}
function ariaToggle(value) { return value === 'mixed' ? 'mixed' : String(value === true); }
function choiceMark(node) {
  if (!node.classList || !(node.classList.contains('wf-checkbox') || node.classList.contains('wf-radio') || node.classList.contains('wf-toggle'))) return null;
  return node.querySelector('.wf-choice [role=checkbox],.wf-choice [role=radio],.wf-choice [role=switch]');
}
// A drawn checkbox, radio or switch: ARIA, data attribute and the classes that paint it move together.
function setChoiceChecked(mark, value) {
  mark.setAttribute('aria-checked', ariaToggle(value));
  setDataState(mark, 'checked', value);
  var row = mark.closest('.wf-choice');
  var list = mark.closest('.wf-choice-list');
  if (row) row.classList.toggle(list ? (mark.getAttribute('role') === 'radio' ? 'wf-radio-on' : 'wf-checkbox-on') : 'wf-choice-on', value === true);
  if (mark.classList.contains('wf-toggle-track')) mark.classList.toggle('wf-toggle-on', value === true);
}
function setChoiceDisabled(node, mark, value) {
  if (value) mark.setAttribute('aria-disabled', 'true'); else mark.removeAttribute('aria-disabled');
  setDataState(mark, 'disabled', value);
  var row = node.querySelector('.wf-choice');
  if (row) row.classList.toggle('wf-choice-disabled', value);
}
function isReadonly(el) { return !!(el && el.hasAttribute('data-wf-readonly')); }
function choiceButtons(node) {
  return Array.prototype.filter.call(node.querySelectorAll('[data-wf-choice-value]'), function (button) {
    return button.closest('.wf-segmented,.wf-tab_bar') === node;
  });
}
function choiceValue(button) {
  try { return JSON.parse(button.getAttribute('data-wf-choice-value')); } catch (_err) { return ''; }
}
// Labels are the binding payload; the chosen button is the choice's identity,
// so of several buttons sharing a label, the one picked stays lit.
function refreshChoices() {
  each('.wf-segmented,.wf-tab_bar', function (node) {
    if (!node._wfChoiceControl) return;
    var rawKey = node.getAttribute('data-selection-key');
    var key = safeControlKey(rawKey) ? rawKey : null;
    var scope = node.getAttribute('data-selection-scope') || 'page';
    var value = key ? getAtPath(scope === 'app' ? WF_APP_STATE : WF_PAGE_STATE, key) : node._wfChoiceValue;
    var buttons = choiceButtons(node);
    var kept = node._wfChoiceButton;
    var chosen = kept && choiceValue(kept) === value ? kept
      : buttons.filter(function (button) { return choiceValue(button) === value; })[0] || null;
    node._wfChoiceButton = chosen;
    buttons.forEach(function (button) {
      var active = button === chosen;
      button.classList.toggle(node.classList.contains('wf-segmented') ? 'wf-segment-on' : 'wf-tab-on', active);
      button.setAttribute('aria-pressed', String(active));
      setDataState(button, 'selected', active);
    });
  });
}
function validHex(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
function colourInputs(node) {
  var picker = node.querySelector('[data-wf-color-picker]');
  return picker ? { picker: picker, text: node.querySelector('[data-wf-color-hex]') } : null;
}
function numberDecimals(value) {
  var text = String(value);
  if (/e-/i.test(text)) return Math.min(20, Number(text.split(/e-/i)[1]) || 0);
  var dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}
// The limits a number field (native min, max, step) or a stepper (data-wf-*) was drawn with.
function numberLimits(el, prefix) {
  function read(name) { var raw = el.getAttribute(prefix + name); return raw == null || raw === '' ? null : Number(raw); }
  var min = read('min'), max = read('max');
  return { bounded: min != null && max != null, min: min, max: max, step: read('step') };
}
// A value shown the way controls-bounds.js displayNumber draws it: clamped
// when the author set bounds, with as many decimals as step, never snapped.
function boundedNumber(text, limits) {
  var value = text.trim() === '' ? NaN : Number(text);
  if (!isFinite(value)) return { text: text, value: null };
  if (!limits.bounded && limits.step == null) return { text: text, value: value };
  if (limits.bounded) value = Math.min(limits.max, Math.max(limits.min, value));
  var shown = limits.step == null ? String(value)
    : value.toFixed(Math.min(20, Math.max(numberDecimals(limits.step), numberDecimals(value))));
  return { text: shown, value: value };
}
function refreshStepper(stepper, value) {
  var limits = numberLimits(stepper, 'data-wf-');
  var shown = boundedNumber(value == null ? '' : String(value), limits);
  var label = stepper.querySelector('.wf-numstepper-value');
  if (label) label.textContent = shown.text;
  var ends = [shown.value != null && limits.bounded && shown.value <= limits.min, shown.value != null && limits.bounded && shown.value >= limits.max];
  var off = stepper.hasAttribute('data-wf-disabled');
  Array.prototype.forEach.call(stepper.querySelectorAll('.wf-numstepper-btn'), function (button, i) {
    button.disabled = off || ends[i] === true;
    setDataState(button, 'disabled', button.disabled);
  });
}
function optionIdentity(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : '';
}
// The selection a read-only select puts back after a change.
function keepSelection(select) {
  select._wfKeep = Array.prototype.map.call(select.options, function (option) { return option.selected; });
}
// A multiple select selects every option whose value is in the list (or is the one value), as at render time.
function selectOptions(select, value) {
  var wanted = (Array.isArray(value) ? value : [value]).map(optionIdentity).filter(Boolean);
  Array.prototype.forEach.call(select.options, function (option) {
    var id = option.value.trim();
    option.selected = id !== '' && wanted.indexOf(id) >= 0;
  });
}
function refreshFieldValue(node, value) {
  if (value === undefined) return;
  var stepper = node.querySelector('.wf-numstepper');
  if (stepper) { refreshStepper(stepper, value); return; }
  var colour = colourInputs(node);
  var field = colour ? colour.text : node.querySelector('input,textarea,select');
  if (!field) return;
  if (colour && field._wfInvalidDraft && node._wfLastBoundValue === value) return;
  node._wfLastBoundValue = value;
  if (field.tagName === 'SELECT') {
    if (field.multiple) selectOptions(field, value);
    else field.value = value == null ? '' : String(value);
    if (field.hasAttribute('data-wf-readonly')) keepSelection(field);
    return;
  }
  // What the user types into a number field stays as typed; values from state are bounded.
  if (field.type === 'number' && node._wfTyped === value) return;
  var text = value == null ? '' : String(value);
  if (field.type === 'number') text = boundedNumber(text, numberLimits(field, '')).text;
  if (field.value !== text) field.value = text;
  if (colour) {
    var valid = validHex(text);
    field._wfInvalidDraft = !valid;
    field.setAttribute('aria-invalid', String(!valid));
    if (valid && colour.picker.value.toLowerCase() !== text.toLowerCase()) colour.picker.value = text;
  }
}
function initControls() {
  each('.wf-segmented,.wf-tab_bar', function (node) {
    var buttons = choiceButtons(node);
    if (!buttons.length) return;
    node._wfChoiceControl = true;
    var active = buttons.filter(function (button) { return button.getAttribute('aria-pressed') === 'true'; })[0];
    node._wfChoiceButton = active || null;
    node._wfChoiceValue = active ? choiceValue(active) : undefined;
    var rawKey = node.getAttribute('data-selection-key');
    var key = safeControlKey(rawKey) ? rawKey : null;
    var scope = node.getAttribute('data-selection-scope') || 'page';
    if (key) {
      var state = scope === 'app' ? WF_APP_STATE : WF_PAGE_STATE;
      if (getAtPath(state, key) === undefined) {
        var saved = scope === 'app' ? storageRead(key) : undefined;
        var initial = saved === undefined ? node._wfChoiceValue : saved;
        if (initial !== undefined) setAtPath(state, key, initial);
      }
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        if (button.disabled || node.getAttribute('data-selection-selectable') === 'false' || isReadonly(button.closest('.wf-segment-track'))) return;
        node._wfChoiceButton = button;
        node._wfChoiceValue = choiceValue(button);
        if (key) setState(scope, key, node._wfChoiceValue);
        else refreshChoices();
      });
    });
  });
  each('.wf-input', function (node) {
    var colour = colourInputs(node), binding = controlBinding(node);
    if (!colour && !binding) return;
    if (binding && binding.scope === 'app' && getAtPath(WF_APP_STATE, binding.key) === undefined) {
      var stored = storageRead(binding.key);
      if (stored !== undefined) setAtPath(WF_APP_STATE, binding.key, stored);
    }
    var field = colour ? colour.text : node.querySelector('input');
    if (!field) return;
    if (binding && field.hasAttribute('value')) {
      var initialState = binding.scope === 'app' ? WF_APP_STATE : WF_PAGE_STATE;
      if (getAtPath(initialState, binding.key) === undefined) setAtPath(initialState, binding.key, field.value);
    }
    node.addEventListener('click', function (event) { event.stopPropagation(); });
    function changed(event) {
      if (field.disabled || (colour && colour.picker.disabled)) return;
      if (field.readOnly) {
        if (colour && event.target === colour.picker) colour.picker.value = validHex(field.value) ? field.value : '#000000';
        return;
      }
      if (colour) {
        if (event.target === colour.picker) field.value = colour.picker.value;
        var valid = validHex(field.value);
        field._wfInvalidDraft = !valid;
        field.setAttribute('aria-invalid', String(!valid));
        if (!valid) return;
        if (colour.picker.value.toLowerCase() !== field.value.toLowerCase()) colour.picker.value = field.value;
      }
      if (binding) { node._wfTyped = field.value; setState(binding.scope, binding.key, field.value); }
    }
    field.addEventListener('input', changed);
    field.addEventListener('change', changed);
    if (colour) {
      colour.picker.addEventListener('input', changed);
      colour.picker.addEventListener('change', changed);
    }
  });
  initToggles();
}
// Toggle buttons and toolbar items flip pressed (or checked) with their ARIA.
function initToggles() {
  each('.wf-button button[aria-pressed],.wf-toolbar button[aria-pressed],.wf-toolbar button[role=checkbox]', function (button) {
    button.addEventListener('click', function () {
      if (button.disabled || isReadonly(button)) return;
      var name = button.getAttribute('role') === 'checkbox' ? 'checked' : 'pressed';
      var next = button.getAttribute('aria-' + name) !== 'true';
      button.setAttribute('aria-' + name, String(next));
      setDataState(button, name, next);
    });
  });
  each('.wf-checkbox,.wf-radio,.wf-toggle', function (node) {
    var mark = choiceMark(node);
    if (!mark) return;
    var bindings;
    try { bindings = JSON.parse(node.getAttribute('data-wf-state-bindings') || '{}'); } catch (_err) { bindings = {}; }
    var bound = isObj(bindings) && typeof bindings.checked === 'string';
    var writable = bound ? exactBinding(bindings.checked) : null;
    var authored = node.hasAttribute('data-wf-interactions');
    // A bound mixed checkbox stays mixed until its state moves off the value it mounted with.
    if (bound && mark.getAttribute('aria-checked') === 'mixed') node._wfMixedAt = { value: resolveExpr(bindings.checked, null, WF_PAGE_STATE) };
    node.addEventListener('click', function () {
      if (mark.getAttribute('aria-disabled') === 'true' || isReadonly(mark)) return;
      var next = mark.getAttribute('role') === 'radio' ? true : mark.getAttribute('aria-checked') !== 'true';
      node._wfMixedAt = null;
      // A bound checkbox follows its state; an authored interaction owns that state.
      if (bound) { if (writable && !authored) setState(writable.scope, writable.key, next); else refresh(); return; }
      setChoiceChecked(mark, next);
    });
  });
  each('.wf-choice-list[role=radiogroup],.wf-choice-list[role=group]', function (group) {
    var radio = group.getAttribute('role') === 'radiogroup';
    Array.prototype.forEach.call(group.querySelectorAll('.wf-choice'), function (row) {
      var mark = row.querySelector('[role=checkbox],[role=radio]');
      if (!mark) return;
      row.addEventListener('click', function () {
        if (isReadonly(group) || group.hasAttribute('data-wf-disabled') || mark.hasAttribute('data-wf-disabled') || isReadonly(mark)) return;
        if (!radio) { setChoiceChecked(mark, mark.getAttribute('aria-checked') !== 'true'); return; }
        Array.prototype.forEach.call(group.querySelectorAll('[role=radio]'), function (other) { setChoiceChecked(other, other === mark); });
      });
    });
  });
  // A read-only select keeps its value: any change the user makes is put back.
  each('select[data-wf-readonly]', function (select) {
    function keep() { keepSelection(select); }
    keep();
    select.addEventListener('focus', keep);
    select.addEventListener('pointerdown', keep);
    select.addEventListener('keydown', keep);
    select.addEventListener('change', function (event) {
      var kept = select._wfKeep || [];
      Array.prototype.forEach.call(select.options, function (option, i) { option.selected = !!kept[i]; });
      event.stopImmediatePropagation();
    });
  });
}
var WF_DRAWN_FIELDS = '.wf-node.wf-checkbox,.wf-node.wf-radio,.wf-node.wf-toggle,.wf-node.wf-segmented,.wf-node.wf-choice_group,.wf-node.wf-picker';
function submittedOption(el, label) { return el.hasAttribute('data-wf-value') ? el.getAttribute('data-wf-value') : label; }
// What a drawn control submits, read from the state it shows: a boolean (or
// "mixed") for a mark, the chosen option's value (else its label) for a
// choice, a list for a checkbox group. Disabled controls submit nothing.
function drawnFieldValue(node) {
  var mark = choiceMark(node);
  if (mark) {
    if (mark.hasAttribute('data-wf-disabled')) return undefined;
    var checked = mark.getAttribute('aria-checked');
    return checked === 'mixed' ? 'mixed' : checked === 'true';
  }
  if (node.classList.contains('wf-segmented')) {
    if (node.querySelector('.wf-segment-track[data-wf-disabled]')) return undefined;
    var on = choiceButtons(node).filter(function (button) { return button.getAttribute('aria-pressed') === 'true'; })[0];
    return on ? submittedOption(on, String(choiceValue(on))) : '';
  }
  if (node.classList.contains('wf-choice_group')) {
    var list = node.querySelector('.wf-choice-list');
    if (!list || list.hasAttribute('data-wf-disabled')) return undefined;
    var picked = Array.prototype.filter.call(list.querySelectorAll('[role=radio],[role=checkbox]'), function (option) {
      return option.getAttribute('aria-checked') === 'true';
    }).map(function (option) {
      var label = option.closest('.wf-choice').querySelector('.wf-choice-label');
      return submittedOption(option, label ? label.textContent : '');
    });
    return list.getAttribute('role') === 'radiogroup' ? (picked[0] || '') : picked;
  }
  var wheel = node.querySelector('.wf-picker-wheel');
  if (!wheel || wheel.hasAttribute('data-wf-disabled')) return undefined;
  var row = wheel.querySelector('.wf-picker-on[data-wf-selected]');
  return row ? submittedOption(row, row.textContent) : '';
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
      else if (name === 'value') refreshFieldValue(node, value);
      else if (name === 'placeholder') {
        var target = node.querySelector('[data-wf-color-hex],input:not([data-wf-color-picker]),textarea,select');
        if (target) target.setAttribute('placeholder', value == null ? '' : String(value));
      } else if (name === 'checked' || name === 'disabled') {
        var bool = !!(value === true || value === 'true');
        var mark = choiceMark(node);
        if (mark) {
          if (name === 'disabled') setChoiceDisabled(node, mark, bool);
          else if (!node._wfMixedAt || node._wfMixedAt.value !== value) { node._wfMixedAt = null; setChoiceChecked(mark, bool); }
          continue;
        }
        var input = node.querySelector(name === 'disabled' ? 'button,input,select,textarea' : 'input') || node;
        if (bool) input.setAttribute(name, '');
        else input.removeAttribute(name);
        input[name] = bool;
        if (name === 'disabled' && input !== node) setDataState(input, 'disabled', bool);
        if (name === 'disabled' && colourInputs(node)) {
          colourInputs(node).picker.disabled = bool; colourInputs(node).text.disabled = bool;
          setDataState(colourInputs(node).picker, 'disabled', bool); setDataState(colourInputs(node).text, 'disabled', bool);
        }
        if (name === 'disabled' && node.classList.contains('wf-button')) node.classList.toggle('wf-button-disabled', bool);
      } else if (name === 'visibility') {
        setHidden(node, !value);
      } else if (name.slice(0, 6) === 'style.') {
        node.style[name.slice(6)] = value == null ? '' : String(value);
      } else {
        try { node[name] = value; } catch (_err) {}
      }
    }
  });
  refreshChoices();
  refreshVisibility();
  refreshSelection();
  refreshPanes();
}

function setHidden(node, hidden) {
  if (hidden) node.setAttribute('data-wf-hidden', '');
  else node.removeAttribute('data-wf-hidden');
}
function refreshVisibility() {
  each('[data-wf-visibility]', function (node) {
    var raw = node.getAttribute('data-wf-visibility') || '{}';
    try {
      var c = JSON.parse(raw);
      setHidden(node, !evalCondition(c.condition || c, null));
    } catch (_err) { setHidden(node, false); }
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
  // Match the trigger's width before measuring, or the clamp below works from a
  // stale width and the popup can still overflow the viewport.
  if (type === 'menu' || type === 'dropdown') {
    node.style.minWidth = Math.max(Math.round(triggerRect.width), 160) + 'px';
  }
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
  var close = node.querySelector(':scope > .wf-overlay-content > .wf-overlay-head > .wf-overlay-close');
  if (close && !node._wfCloseHandler) {
    node._wfCloseHandler = function (event) { event.preventDefault(); closeOverlay(overlayId); };
    close.addEventListener('click', node._wfCloseHandler);
  }
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
      if (event.key === 'Escape' && !isMeasuring()) closeOverlay(overlayId);
    };
    document.addEventListener('keydown', node._wfEscHandler);
  }
  if (list.indexOf('outside') >= 0 && !node._wfOutsideHandler) {
    node._wfOutsideHandler = function (event) {
      if (isMeasuring()) return;
      var trigger = overlayTriggerNode(node);
      var target = event && event.target ? event.target : null;
      if (!target) return;
      var content = node.querySelector(':scope > .wf-overlay-content') || node;
      if (content.contains(target)) return;
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
  var close = node ? node.querySelector(':scope > .wf-overlay-content > .wf-overlay-head > .wf-overlay-close') : null;
  if (node._wfCloseHandler && close) {
    close.removeEventListener('click', node._wfCloseHandler);
    node._wfCloseHandler = null;
  }
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
  clearOverlayTimeout(overlayId);
}
// Timed dismissals by overlay id. Measuring pauses them, and they resume with
// the time they had left when it ends.
var WF_OVERLAY_TIMEOUTS = {};
function startOverlayTimeout(id) {
  var pending = WF_OVERLAY_TIMEOUTS[id];
  pending.due = Date.now() + pending.left;
  pending.handle = setTimeout(function () { closeOverlay(id); }, pending.left);
}
function clearOverlayTimeout(id) {
  var pending = WF_OVERLAY_TIMEOUTS[id];
  if (!pending) return;
  clearTimeout(pending.handle);
  delete WF_OVERLAY_TIMEOUTS[id];
}
function pauseOverlayTimeouts(paused) {
  Object.keys(WF_OVERLAY_TIMEOUTS).forEach(function (id) {
    var pending = WF_OVERLAY_TIMEOUTS[id];
    if (paused && pending.handle) {
      clearTimeout(pending.handle);
      pending.handle = null;
      pending.left = Math.max(0, pending.due - Date.now());
    } else if (!paused && !pending.handle) {
      startOverlayTimeout(id);
    }
  });
}
function openOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  var dismiss = overlayDismissList(node);
  setOverlayVisible(node, true);
  positionAnchoredOverlay(node);
  clearOverlayTimeout(id);
  if (dismiss.indexOf('timeout') >= 0) {
    WF_OVERLAY_TIMEOUTS[id] = { left: 3000, due: 0, handle: null };
    if (!isMeasuring()) startOverlayTimeout(id);
  }
  bindOverlayDismiss(node, id, dismiss);
}
function closeOverlay(id) {
  var node = document.getElementById(id);
  if (!node) { console.warn('Missing overlay:', id); return; }
  setOverlayVisible(node, false);
  unbindOverlayDismiss(node, id);
}
var WF_MEASURE = { on: false, layer: null, marks: null, hover: null, pin: null, press: null, x: 0, y: 0, hasPoint: false, touch: false };
var WF_MEASURE_INK = '#c2185b';
var WF_MEASURE_HALO = 'rgba(255,255,255,.9)';
var WF_MEASURE_TARGETS = '.wf-node[id],.wf-root[id],.wf-overlay[id]';
var WF_MEASURE_STOPPED = ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'touchstart', 'touchend'];
var WF_MEASURE_MARK = 'position:absolute;margin:0;padding:0;border:0;box-sizing:border-box;';
var WF_MEASURE_CHIP = 'font:600 11px/16px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;'
  + 'letter-spacing:0;text-transform:none;white-space:nowrap;color:#ffffff;background:' + WF_MEASURE_INK + ';'
  + 'padding:0 5px;border-radius:4px;box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';transform:translate(-50%,-50%);';
var WF_MEASURE_PAD_FILL = 'background:repeating-linear-gradient(135deg,rgba(21,128,61,.42) 0 1px,rgba(21,128,61,.1) 1px 5px);';
var WF_MEASURE_GAP_FILL = 'background:repeating-linear-gradient(45deg,rgba(194,24,91,.45) 0 1px,rgba(194,24,91,.1) 1px 5px);';

function isMeasuring() { return WF_MEASURE.on; }
function measureViewport() {
  var root = document.documentElement;
  return { w: root.clientWidth || window.innerWidth, h: root.clientHeight || window.innerHeight };
}
function measurePx(value) {
  var n = parseFloat(value);
  return isFinite(n) && n > 0 ? n : 0;
}
function measureFormat(value) {
  return String(Math.round(Math.abs(value) * 10) / 10);
}
// The visible box of a target: an overlay shell is measured by its content.
// Hidden, zero-size and fragmented (multi-line inline) boxes are skipped.
function measureBox(shell) {
  if (!shell || !shell.isConnected) return null;
  var el = shell.classList.contains('wf-overlay') ? shell.querySelector(':scope > .wf-overlay-content') : shell;
  if (!el) return null;
  var rects = el.getClientRects();
  if (rects.length !== 1) return null;
  var r = rects[0];
  if (!(r.width > 0 && r.height > 0)) return null;
  if (window.getComputedStyle(el).visibility !== 'visible') return null;
  return { el: el, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}
function measureContains(box, x, y) {
  return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
function measureParentTarget(node) {
  var parent = node.parentElement;
  return parent && parent.closest ? parent.closest(WF_MEASURE_TARGETS) : null;
}
// Hit-testing rather than event targets, so disabled controls and content
// behind a modal backdrop can be measured.
function measureTargetAt(x, y) {
  var hits = document.elementsFromPoint(x, y);
  for (var i = 0; i < hits.length; i++) {
    var shell = hits[i].closest ? hits[i].closest(WF_MEASURE_TARGETS) : null;
    while (shell) {
      var box = measureBox(shell);
      if (box && (!shell.classList.contains('wf-overlay') || measureContains(box, x, y))) return shell;
      shell = measureParentTarget(shell);
    }
  }
  return null;
}
function measureMark(left, top, width, height, css) {
  var mark = document.createElement('div');
  mark.style.cssText = WF_MEASURE_MARK + 'left:' + left + 'px;top:' + top + 'px;width:' + width + 'px;height:' + height + 'px;' + (css || '');
  WF_MEASURE.marks.appendChild(mark);
  return mark;
}
function measureChip(cx, cy, value, kind) {
  var view = measureViewport();
  var chip = document.createElement('div');
  chip.style.cssText = WF_MEASURE_MARK + 'left:' + clamp(cx, 22, Math.max(22, view.w - 22)) + 'px;top:'
    + clamp(cy, 10, Math.max(10, view.h - 10)) + 'px;' + WF_MEASURE_CHIP;
  chip.setAttribute('data-wf-measure-label', kind);
  chip.textContent = measureFormat(value);
  WF_MEASURE.marks.appendChild(chip);
}
function measureVisibleMid(start, end, limit) {
  return (Math.max(start, 0) + Math.min(end, limit)) / 2;
}
// A dimension line: a hairline with end ticks and a centred label chip.
function measureHLine(left, right, y, kind, value) {
  var ink = 'background:' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';';
  measureMark(left, y, right - left, 1, ink);
  measureMark(left, y - 4, 1, 9, ink);
  measureMark(right - 1, y - 4, 1, 9, ink);
  measureChip(measureVisibleMid(left, right, measureViewport().w), y, value, kind);
}
function measureVLine(top, bottom, x, kind, value) {
  var ink = 'background:' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';';
  measureMark(x, top, 1, bottom - top, ink);
  measureMark(x - 4, top, 9, 1, ink);
  measureMark(x - 4, bottom - 1, 9, 1, ink);
  measureChip(x, measureVisibleMid(top, bottom, measureViewport().h), value, kind);
}
function measureGuideH(left, right, y) {
  if (right - left < 1) return;
  measureMark(left, y, right - left, 0, 'border-top:1px dashed ' + WF_MEASURE_INK + ';');
}
function measureGuideV(top, bottom, x) {
  if (bottom - top < 1) return;
  measureMark(x, top, 0, bottom - top, 'border-left:1px dashed ' + WF_MEASURE_INK + ';');
}
function measureOutline(box, width, kind) {
  var mark = measureMark(box.left, box.top, box.width, box.height,
    'border:' + width + 'px solid ' + WF_MEASURE_INK + ';box-shadow:0 0 0 1px ' + WF_MEASURE_HALO + ';');
  mark.setAttribute('data-wf-measure-box', kind);
}
// Width above (below, then inside, when there is no room) and height beside.
function measureDimensions(box) {
  var view = measureViewport();
  var y = box.top - 8;
  if (y < 12) y = box.bottom + 8;
  if (y > view.h - 12) y = clamp(Math.max(box.top, 0) + 12, 12, view.h - 12);
  measureHLine(box.left, box.right, Math.round(y), 'width', box.width);
  var x = box.right + 8;
  if (x > view.w - 30) x = box.left - 8;
  if (x < 30) x = clamp(Math.min(box.right, view.w) - 48, 30, view.w - 30);
  measureVLine(box.top, box.bottom, Math.round(x), 'height', box.height);
}
function measureBand(left, top, width, height, fill, kind, value) {
  var view = measureViewport();
  if (width < 1 || height < 1 || left >= view.w || top >= view.h || left + width <= 0 || top + height <= 0) return;
  measureMark(left, top, width, height, fill).setAttribute('data-wf-measure-band', kind);
  measureChip(measureVisibleMid(left, left + width, view.w), measureVisibleMid(top, top + height, view.h), value, kind);
}
function measureChildBoxes(shell) {
  var boxes = [];
  var nodes = shell.querySelectorAll('.wf-node[id]');
  for (var i = 0; i < nodes.length; i++) {
    if (measureParentTarget(nodes[i]) !== shell) continue;
    var box = measureBox(nodes[i]);
    if (box) boxes.push(box);
  }
  return boxes;
}
function measureRows(boxes) {
  var sorted = boxes.slice().sort(function (a, b) { return a.top - b.top || a.left - b.left; });
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var row = rows[rows.length - 1];
    if (row && sorted[i].top < row.bottom - 0.5) {
      row.items.push(sorted[i]);
      row.top = Math.min(row.top, sorted[i].top);
      row.bottom = Math.max(row.bottom, sorted[i].bottom);
    } else {
      rows.push({ items: [sorted[i]], top: sorted[i].top, bottom: sorted[i].bottom });
    }
  }
  return rows;
}
// Padding bands and child gaps, read from computed styles, for layout
// containers only. A gap band is drawn where the space between neighbours
// holds the computed gap.
function measureLayoutBands(shell, box) {
  if (!shell.classList.contains('wf-stack') && !shell.classList.contains('wf-row') && !shell.classList.contains('wf-grid')) return;
  var cs = window.getComputedStyle(box.el);
  var left = box.left + measurePx(cs.borderLeftWidth), right = box.right - measurePx(cs.borderRightWidth);
  var top = box.top + measurePx(cs.borderTopWidth), bottom = box.bottom - measurePx(cs.borderBottomWidth);
  var pt = measurePx(cs.paddingTop), pr = measurePx(cs.paddingRight), pb = measurePx(cs.paddingBottom), pl = measurePx(cs.paddingLeft);
  measureBand(left, top, right - left, pt, WF_MEASURE_PAD_FILL, 'padding-top', pt);
  measureBand(left, bottom - pb, right - left, pb, WF_MEASURE_PAD_FILL, 'padding-bottom', pb);
  measureBand(left, top + pt, pl, bottom - top - pt - pb, WF_MEASURE_PAD_FILL, 'padding-left', pl);
  measureBand(right - pr, top + pt, pr, bottom - top - pt - pb, WF_MEASURE_PAD_FILL, 'padding-right', pr);
  var rowGap = measurePx(cs.rowGap), columnGap = measurePx(cs.columnGap);
  var rows = measureRows(measureChildBoxes(shell));
  for (var r = 0; r < rows.length; r++) {
    var next = rows[r + 1];
    var space = next ? next.top - rows[r].bottom : 0;
    if (next && rowGap > 0 && space >= rowGap - 0.5) {
      measureBand(left + pl, rows[r].bottom + (space - rowGap) / 2, right - pr - left - pl, rowGap, WF_MEASURE_GAP_FILL, 'gap-row', rowGap);
    }
    var items = rows[r].items.slice().sort(function (a, b) { return a.left - b.left; });
    for (var c = 0; c + 1 < items.length; c++) {
      var across = items[c + 1].left - items[c].right;
      if (columnGap > 0 && across >= columnGap - 0.5) {
        measureBand(items[c].right + (across - columnGap) / 2, rows[r].top, columnGap, rows[r].bottom - rows[r].top, WF_MEASURE_GAP_FILL, 'gap-column', columnGap);
      }
    }
  }
}
// Distances from the pinned box to another box on one axis: the gap between
// facing edges when they are apart, otherwise the insets between matching edges.
function measureAxis(pin, other, horizontal) {
  var start = horizontal ? 'left' : 'top', end = horizontal ? 'right' : 'bottom';
  var crossStart = horizontal ? 'top' : 'left', crossEnd = horizontal ? 'bottom' : 'right';
  var lo = Math.max(pin[crossStart], other[crossStart]), hi = Math.min(pin[crossEnd], other[crossEnd]);
  var at = Math.round(hi > lo ? (lo + hi) / 2 : (other[crossStart] + other[crossEnd]) / 2);
  var line = horizontal ? measureHLine : measureVLine;
  var guide = horizontal ? measureGuideV : measureGuideH;
  function edgeGuide(edge) {
    if (at < pin[crossStart]) guide(at, pin[crossStart], edge);
    else if (at > pin[crossEnd]) guide(pin[crossEnd], at, edge);
  }
  if (other[start] >= pin[end]) {
    line(pin[end], other[start], at, horizontal ? 'gap-x' : 'gap-y', other[start] - pin[end]);
    edgeGuide(Math.round(pin[end]));
    return;
  }
  if (pin[start] >= other[end]) {
    line(other[end], pin[start], at, horizontal ? 'gap-x' : 'gap-y', pin[start] - other[end]);
    edgeGuide(Math.round(pin[start]));
    return;
  }
  if (Math.abs(other[start] - pin[start]) >= 0.5) {
    line(Math.min(pin[start], other[start]), Math.max(pin[start], other[start]), at, 'inset-' + start, other[start] - pin[start]);
  }
  if (Math.abs(pin[end] - other[end]) >= 0.5) {
    line(Math.min(pin[end], other[end]), Math.max(pin[end], other[end]), at, 'inset-' + end, pin[end] - other[end]);
  }
}
function measureDraw() {
  if (!WF_MEASURE.marks) return;
  WF_MEASURE.marks.textContent = '';
  var pin = measureBox(WF_MEASURE.pin);
  if (!pin) WF_MEASURE.pin = null;
  var hover = WF_MEASURE.hover && WF_MEASURE.hover !== WF_MEASURE.pin ? measureBox(WF_MEASURE.hover) : null;
  if (pin && hover) {
    measureOutline(pin, 2, 'pin');
    measureOutline(hover, 1, 'hover');
    measureAxis(pin, hover, true);
    measureAxis(pin, hover, false);
    return;
  }
  var box = hover || pin;
  if (!box) return;
  measureOutline(box, pin ? 2 : 1, pin ? 'pin' : 'hover');
  measureLayoutBands(hover ? WF_MEASURE.hover : WF_MEASURE.pin, box);
  measureDimensions(box);
}
function measureRefresh() {
  if (WF_MEASURE.hasPoint) WF_MEASURE.hover = measureTargetAt(WF_MEASURE.x, WF_MEASURE.y);
  measureDraw();
}
function measureEditable(el) {
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].indexOf(String(el.type).toLowerCase()) < 0;
}
// Only a standalone page owns the m key; an embedded page follows its host.
function measureToggleKey(event) {
  return window.parent === window && (event.key === 'm' || event.key === 'M')
    && !event.ctrlKey && !event.metaKey && !event.altKey && !measureEditable(event.target);
}
function measureKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    if (WF_MEASURE.pin) { WF_MEASURE.pin = null; measureDraw(); }
    return;
  }
  if (measureToggleKey(event)) { event.preventDefault(); setMeasure(false); return; }
  if (measureEditable(event.target) && event.key !== 'Tab') event.preventDefault();
}
// Mouse: a click pins, and clicking the pin again releases it. Touch has no
// hover, so after the first tap pins, tapping another target measures to it.
function measurePick(x, y) {
  var target = measureTargetAt(x, y);
  if (WF_MEASURE.touch && WF_MEASURE.pin && target !== WF_MEASURE.pin) {
    WF_MEASURE.hover = target;
  } else {
    WF_MEASURE.pin = target && target !== WF_MEASURE.pin ? target : null;
    WF_MEASURE.hover = WF_MEASURE.touch && !WF_MEASURE.pin ? null : target;
  }
  measureDraw();
  try { if (!document.hasFocus()) window.focus(); } catch (_err) {}
}
// A press picks on pointerup rather than click: disabled controls receive
// pointer events but no click. Drags and scrolls are not picks: moving more
// than 8px from the press, or a pointercancel, drops it even if it comes back.
function measureNear(press, event) {
  return Math.abs(event.clientX - press.x) <= 8 && Math.abs(event.clientY - press.y) <= 8;
}
function measurePress(event) {
  if (event.type === 'pointerdown') {
    WF_MEASURE.touch = event.pointerType === 'touch';
    WF_MEASURE.press = event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
    return;
  }
  var press = WF_MEASURE.press;
  WF_MEASURE.press = null;
  if (press && press.id === event.pointerId && measureNear(press, event)) measurePick(event.clientX, event.clientY);
}
function measureCancel(event) {
  if (WF_MEASURE.press && WF_MEASURE.press.id === event.pointerId) WF_MEASURE.press = null;
}
function measureCapture(event) {
  if (!WF_MEASURE.on) return;
  event.stopImmediatePropagation();
  if (event.type === 'keydown') measureKey(event);
  else if (event.type === 'pointerdown' || event.type === 'pointerup') measurePress(event);
  else if (event.type === 'mousedown' || event.type === 'click') event.preventDefault();
}
function measureMove(event) {
  var press = WF_MEASURE.press;
  if (press && press.id === event.pointerId && !measureNear(press, event)) WF_MEASURE.press = null;
  if (event.pointerType === 'touch') return;
  WF_MEASURE.touch = false;
  WF_MEASURE.x = event.clientX;
  WF_MEASURE.y = event.clientY;
  WF_MEASURE.hasPoint = true;
  measureRefresh();
}
function measureLeave(event) {
  if (event.relatedTarget) return;
  WF_MEASURE.hasPoint = false;
  WF_MEASURE.hover = null;
  measureDraw();
}
function measureListeners(add) {
  var method = add ? 'addEventListener' : 'removeEventListener';
  for (var i = 0; i < WF_MEASURE_STOPPED.length; i++) {
    window[method](WF_MEASURE_STOPPED[i], measureCapture, { capture: true, passive: WF_MEASURE_STOPPED[i].indexOf('touch') === 0 });
  }
  window[method]('pointermove', measureMove, { capture: true, passive: true });
  window[method]('pointercancel', measureCancel, true);
  window[method]('mouseout', measureLeave, true);
  window[method]('scroll', measureRefresh, { capture: true, passive: true });
  window[method]('resize', measureRefresh);
}
function setMeasure(on) {
  if (on === WF_MEASURE.on || !document.body) return;
  WF_MEASURE.on = on;
  pauseOverlayTimeouts(on);
  if (!on) {
    measureListeners(false);
    if (WF_MEASURE.layer && WF_MEASURE.layer.parentNode) WF_MEASURE.layer.parentNode.removeChild(WF_MEASURE.layer);
    WF_MEASURE.layer = WF_MEASURE.marks = WF_MEASURE.hover = WF_MEASURE.pin = WF_MEASURE.press = null;
    WF_MEASURE.hasPoint = false;
    return;
  }
  var layer = document.createElement('div');
  layer.setAttribute('data-wf-measure', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;margin:0;padding:0;border:0;background:none;'
    + 'z-index:2147483647;pointer-events:none;overflow:hidden;contain:strict';
  var cursor = document.createElement('style');
  cursor.textContent = '*{cursor:crosshair!important}';
  var marks = document.createElement('div');
  layer.appendChild(cursor);
  layer.appendChild(marks);
  document.body.appendChild(layer);
  WF_MEASURE.layer = layer;
  WF_MEASURE.marks = marks;
  measureListeners(true);
  measureDraw();
}
function measureMessage(event) {
  if (window.parent === window || event.source !== window.parent) return;
  var data = event.data;
  if (!data || data.type !== 'wf:measure' || typeof data.on !== 'boolean') return;
  setMeasure(data.on);
}
function measureToggleListener(event) {
  if (!WF_MEASURE.on && !event.defaultPrevented && !event.repeat && measureToggleKey(event)) setMeasure(true);
}
function initMeasure() {
  window.addEventListener('message', measureMessage);
  if (window.parent === window) window.addEventListener('keydown', measureToggleListener);
}
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
  var fields = root.querySelectorAll('input,textarea,select,' + WF_DRAWN_FIELDS);
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    // Drawn controls go under their node id, in document order with native fields.
    if (field.matches(WF_DRAWN_FIELDS)) {
      var drawn = drawnFieldValue(field);
      if (drawn !== undefined && field.id) output[field.id] = drawn;
      continue;
    }
    // As in HTML: a disabled field is not submitted; a read-only one is.
    if (field.hasAttribute('data-wf-color-picker') || field.disabled) continue;
    var cursor = field;
    var key = field.getAttribute('data-wf-form-key');
    while (!key && cursor && cursor !== root) {
      if (cursor.getAttribute && cursor.getAttribute('id')) { key = cursor.getAttribute('id'); break; }
      cursor = cursor.parentNode;
    }
    if (!key) continue;
    if (field.type === 'checkbox') output[key] = !!field.checked;
    else if (field.tagName === 'SELECT' && field.multiple) output[key] = Array.prototype.map.call(field.selectedOptions, function (option) { return option.value; });
    else output[key] = field.value;
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
        if (isMeasuring() || (event.key !== 'Enter' && event.key !== ' ')) return;
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
    if (isMeasuring()) return;
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
    if (node._wfChoiceControl) return;
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
    if (node._wfChoiceControl) return;
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
// The form element renders a real HTML form, so its buttons and Enter in a
// field submit it natively and reload the page. A prototype submits through its
// own submit interactions only. Forms the host page owns are left alone.
function blockNativeSubmit() {
  if (!document || typeof document.addEventListener !== 'function') return;
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (form && form.classList && form.classList.contains('wf-form')) event.preventDefault();
  }, true);
}
function init() {
  initMeasure();
  initState();
  initControls();
  initPanes();
  refresh();
  blockNativeSubmit();
  bindSelection();
  bindInteractions();
  bindRouteLinks();
}
var _wfInitDone = false;
function safeInit() { if (_wfInitDone) return; _wfInitDone = true; init(); }
safeInit();
window.addEventListener('load', safeInit);
})();