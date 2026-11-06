'use strict';

// This fragment shares the existing interaction runtime's state and refresh cycle.
function buildControlRuntimeCode() {
  return String.raw`
function safeControlKey(key) {
  return typeof key === 'string' && key.length > 0 && !key.split('.').some(function (part) { return !part || ['__proto__', 'constructor', 'prototype'].indexOf(part) >= 0; });
}
function controlBinding(node) {
  var bindings;
  try { bindings = JSON.parse(node.getAttribute('data-wf-state-bindings') || '{}'); } catch (_err) { return null; }
  var match = typeof bindings.value === 'string' && bindings.value.match(/^\{\{\s*(state|appState)\.([a-zA-Z0-9_.]+)\s*\}\}$/);
  if (!match || !safeControlKey(match[2])) return null;
  return { scope: match[1] === 'appState' ? 'app' : 'page', key: match[2] };
}
function choiceButtons(node) {
  return Array.prototype.filter.call(node.querySelectorAll('[data-wf-choice-value]'), function (button) {
    return button.closest('.wf-segmented,.wf-tab_bar') === node;
  });
}
function choiceValue(button) {
  try { return JSON.parse(button.getAttribute('data-wf-choice-value')); } catch (_err) { return ''; }
}
function refreshChoices() {
  each('.wf-segmented,.wf-tab_bar', function (node) {
    if (!node._wfChoiceControl) return;
    var rawKey = node.getAttribute('data-selection-key');
    var key = safeControlKey(rawKey) ? rawKey : null;
    var scope = node.getAttribute('data-selection-scope') || 'page';
    var value = key ? getAtPath(scope === 'app' ? WF_APP_STATE : WF_PAGE_STATE, key) : node._wfChoiceValue;
    var matched = false;
    choiceButtons(node).forEach(function (button) {
      var active = !matched && choiceValue(button) === value;
      if (active) matched = true;
      button.classList.toggle(node.classList.contains('wf-segmented') ? 'wf-segment-on' : 'wf-tab-on', active);
      button.setAttribute('aria-pressed', String(active));
    });
  });
}
function validHex(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value); }
function colourInputs(node) {
  var picker = node.querySelector('[data-wf-color-picker]');
  return picker ? { picker: picker, text: node.querySelector('[data-wf-color-hex]') } : null;
}
function refreshFieldValue(node, value) {
  if (value === undefined) return;
  var colour = colourInputs(node);
  var field = colour ? colour.text : node.querySelector('input,textarea,select');
  if (!field) return;
  if (colour && field._wfInvalidDraft && node._wfLastBoundValue === value) return;
  node._wfLastBoundValue = value;
  var text = value == null ? '' : String(value);
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
        if (button.disabled || node.getAttribute('data-selection-selectable') === 'false') return;
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
      if (colour) {
        if (event.target === colour.picker) field.value = colour.picker.value;
        var valid = validHex(field.value);
        field._wfInvalidDraft = !valid;
        field.setAttribute('aria-invalid', String(!valid));
        if (!valid) return;
        if (colour.picker.value.toLowerCase() !== field.value.toLowerCase()) colour.picker.value = field.value;
      }
      if (binding) setState(binding.scope, binding.key, field.value);
    }
    field.addEventListener('input', changed);
    field.addEventListener('change', changed);
    if (colour) {
      colour.picker.addEventListener('input', changed);
      colour.picker.addEventListener('change', changed);
    }
  });
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
        var input = node.querySelector(name === 'disabled' ? 'button,input,select,textarea' : 'input') || node;
        var bool = !!(value === true || value === 'true');
        if (bool) input.setAttribute(name, '');
        else input.removeAttribute(name);
        input[name] = bool;
        if (name === 'disabled' && colourInputs(node)) {
          colourInputs(node).picker.disabled = bool; colourInputs(node).text.disabled = bool;
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
`;
}
module.exports = { buildControlRuntimeCode };
