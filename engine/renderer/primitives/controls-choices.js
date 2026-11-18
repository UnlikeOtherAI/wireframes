'use strict';

const { partId, fieldState, fieldLabel, fieldHelp, describedBy, optionValueAttr } = require('./controls-field');

const MARK_ROLE = { checkbox: 'checkbox', radio: 'radio', toggle: 'switch' };
// A radio announces checked and disabled; read-only belongs to its group.
const RADIO_OWNER = { aria: { checked: 'aria-checked', disabled: 'aria-disabled' } };
// A choice list: a radiogroup supports the field states, a plain group only disabled.
const RADIOGROUP_OWNER = {
  aria: { disabled: 'aria-disabled', readonly: 'aria-readonly', required: 'aria-required', invalid: 'aria-invalid' },
};
const GROUP_OWNER = { aria: { disabled: 'aria-disabled' } };
const PICKER_ROWS = 5;

function markOwner(kind, lib) {
  return kind === 'radio' ? RADIO_OWNER : lib.STATE_OWNERS.check;
}

/**
 * The initial selection. Templates resolve like an input value: a
 * `{{state.x}}` value also binds the select, so the runtime keeps it in step.
 */
function selectValue(raw, ctx, lib) {
  const resolve = (entry, binding) => (typeof entry === 'string'
    ? lib.resolveAttributeValue(entry, ctx.bindingContext || {}, binding ? ctx.stateBindings : null, binding ? 'value' : '')
    : entry);
  return Array.isArray(raw) ? raw.map((entry) => resolve(entry, false)) : resolve(raw, true);
}

function renderSelect(node, ctx, lib) {
  const props = node.props || {};
  const placeholder = lib.resolveAttributeValue(
    lib.str(props.placeholder) || 'Select', ctx.bindingContext || {}, ctx.stateBindings, 'placeholder',
  );
  const value = selectValue(props.value, ctx, lib);
  const options = lib.renderSelectOptions(Array.isArray(props.options) ? props.options : [], {
    value,
    multiple: props.multiple === true,
    bound: typeof ctx.stateBindings?.value === 'string',
  });
  const invalid = lib.str(props.error) ? ' wf-field-invalid' : '';
  const searchGlyph = props.searchable === true
    ? `<span class="wf-affix wf-affix-start">${lib.icon('magnifying-glass')}</span>`
    : '';
  const state = lib.stateAttrs(fieldState(props, lib), { owner: lib.STATE_OWNERS.select });
  const control = `<span class="wf-control">${searchGlyph}<select${
    props.multiple === true ? ' multiple' : ''
  }${state}${describedBy(props, lib, node)}><option value="">${lib.escapeHtml(placeholder)}</option>${options}</select></span>`;
  return {
    inner: `${fieldLabel(props, ctx, lib)}${control}${fieldHelp(props, ctx, lib, node)}`,
    className: `wf-field${invalid}${props.searchable === true ? ' wf-select-searchable' : ''}`,
  };
}

function choiceMark(kind, attrs = '') {
  return kind === 'radio'
    ? `<span class="wf-radio-mark"${attrs}></span>`
    : `<span class="wf-check-mark"${attrs}></span>`;
}

/**
 * A single checkbox, radio or toggle. Its label stays inline and `help` is
 * an alias of the inline `description` (help wins); an error goes below the
 * row. The drawn mark owns the role and the state.
 */
function renderChoice(kind) {
  return function render(node, ctx, lib) {
    const props = node.props || {};
    const label = lib.str(props.label) || (kind === 'radio' ? 'Option' : 'Checkbox');
    const description = lib.str(props.help) || lib.str(props.description);
    const state = fieldState(props, lib);
    const mixed = kind === 'checkbox' && props.indeterminate === true;
    const checked = mixed ? 'mixed' : props.checked === true;
    const labelId = partId(node, 'label');
    const ids = description ? [partId(node, 'help')] : [];
    if (state.invalid) ids.push(partId(node, 'error'));
    const attrs = ` role="${MARK_ROLE[kind]}" aria-labelledby="${lib.escapeAttr(labelId)}"${
      ids.length > 0 ? ` aria-describedby="${lib.escapeAttr(ids.join(' '))}"` : ''
    }${lib.stateAttrs({ ...state, checked }, { owner: markOwner(kind, lib) })}`;
    const mark = kind === 'toggle'
      ? `<span class="wf-toggle-track${checked === true ? ' wf-toggle-on' : ''}"${attrs}><span class="wf-toggle-thumb"></span></span>`
      : choiceMark(kind, attrs);
    const on = checked === true ? ' wf-choice-on' : '';
    const required = state.required ? '<span class="wf-req">*</span>' : '';
    const body = `<span class="wf-choice-text"><span class="wf-choice-label" id="${lib.escapeAttr(labelId)}">${lib.bound(label, ctx)}${required}</span>${
      description ? `<span class="wf-choice-desc" id="${lib.escapeAttr(partId(node, 'help'))}">${lib.bound(description, ctx)}</span>` : ''
    }</span>`;
    const error = state.invalid
      ? `<span class="wf-field-error" id="${lib.escapeAttr(partId(node, 'error'))}">${lib.bound(props.error, ctx)}</span>`
      : '';
    return {
      inner: `<label class="wf-choice${on}${props.disabled === true ? ' wf-choice-disabled' : ''}">${mark}${body}</label>${error}`,
      ...(state.invalid ? { className: 'wf-field-invalid' } : {}),
    };
  };
}

function renderChoiceGroup(node, ctx, lib) {
  const props = node.props || {};
  const kind = props.kind === 'radio' ? 'radio' : 'checkbox';
  const state = fieldState(props, lib);
  const options = lib.normalizeItems(props.options, lib.itemProfiles.choice);
  const { selected } = lib.resolveSelection(options, { value: props.value, multiple: kind === 'checkbox' });
  const list = options.length > 0 ? options : [{ label: '' }, { label: '' }];
  const rows = list.map((option, index) => {
    const label = lib.str(option.label);
    const on = selected[index] === true;
    const checked = kind === 'checkbox' && option.checked === 'mixed' ? 'mixed' : on;
    const rowState = {
      checked,
      disabled: state.disabled || option.disabled === true,
      readonly: kind === 'checkbox' && state.readonly,
    };
    const mark = choiceMark(kind, ` role="${kind}"${optionValueAttr(option, lib)}${lib.stateAttrs(rowState, { owner: markOwner(kind, lib) })}`);
    return `<label class="wf-choice${on ? ` wf-${kind}-on` : ''}">${mark}<span class="wf-choice-text"><span class="wf-choice-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(8)
    }</span>${option.description ? `<span class="wf-choice-desc">${lib.escapeHtml(option.description)}</span>` : ''}</span></label>`;
  }).join('');
  const labelId = lib.str(props.label) ? partId(node, 'label') : '';
  const group = ` role="${kind === 'radio' ? 'radiogroup' : 'group'}"${
    labelId ? ` aria-labelledby="${lib.escapeAttr(labelId)}"` : ''
  }${describedBy(props, lib, node)}${lib.stateAttrs(state, { owner: kind === 'radio' ? RADIOGROUP_OWNER : GROUP_OWNER })}`;
  return {
    inner: `${fieldLabel(props, ctx, lib, null, labelId)}<div class="wf-choice-list${props.inline === true ? ' wf-choice-inline' : ''}"${group}>${rows}</div>${fieldHelp(props, ctx, lib, node)}`,
    className: `wf-field wf-choice-group-${kind}${state.invalid ? ' wf-field-invalid' : ''}`,
  };
}

/**
 * The wheel centres the selected option. With nothing selected it keeps its
 * legacy rule: the first row whose label is the value's text, which for an
 * absent value is the first blank row, otherwise the first row. A row
 * marked `selected: false` is skipped by that rule.
 */
function pickerCentre(options, lib, value) {
  const { selected, source } = lib.resolveSelection(options, { value });
  if (source) return selected.indexOf(true);
  const text = lib.str(value);
  const eligible = (option) => option.selected !== false;
  const match = options.findIndex((option) => eligible(option) && lib.str(option.label) === text);
  return match >= 0 ? match : Math.max(0, options.findIndex(eligible));
}

function renderPicker(node, ctx, lib) {
  const props = node.props || {};
  const options = lib.normalizeItems(props.options, lib.itemProfiles.choice);
  const centre = pickerCentre(options, lib, props.value);
  const rows = Array.from({ length: PICKER_ROWS }, (_, i) => {
    const option = options[centre - 2 + i];
    const label = option ? lib.str(option.label) : '';
    const on = i === 2 ? ' wf-picker-on' : '';
    const current = i === 2 && option ? lib.stateAttrs({ selected: true }) : '';
    return `<span class="wf-picker-row${on}"${option ? optionValueAttr(option, lib) : ''}${current}>${label ? lib.escapeHtml(label) : ''}</span>`;
  }).join('');
  const state = lib.stateAttrs(fieldState(props, lib));
  return {
    inner: `${fieldLabel(props, ctx, lib)}<div class="wf-picker-wheel"${state}>${rows}<span class="wf-picker-window"></span></div>${fieldHelp(props, ctx, lib)}`,
    ...(props.error ? { className: 'wf-field-invalid' } : {}),
  };
}

module.exports = {
  choiceRenderers: {
    select: renderSelect,
    checkbox: renderChoice('checkbox'),
    radio: renderChoice('radio'),
    toggle: renderChoice('toggle'),
    choice_group: renderChoiceGroup,
    picker: renderPicker,
  },
};
