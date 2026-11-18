'use strict';

// This fragment shares the existing interaction runtime's state and refresh cycle.
function buildControlRuntimeCode() {
  return String.raw`
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
`;
}
module.exports = { buildControlRuntimeCode };
