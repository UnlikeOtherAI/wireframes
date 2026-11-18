'use strict';

const { fieldState, fieldLabel, fieldHelp, describedBy } = require('./controls-field');
const { rangeThumbs, displayNumber } = require('./controls-bounds');

const INPUT_TYPES = new Set([
  'text', 'password', 'email', 'number', 'search', 'tel', 'url',
  'date', 'time', 'datetime', 'color', 'range', 'otp', 'stepper',
]);

const TYPE_PREFIX = { search: 'magnifying-glass', email: 'envelope', tel: 'phone', url: 'link' };
const TYPE_SUFFIX = { date: 'calendar', time: 'clock', datetime: 'calendar', password: 'eye', number: 'sort' };

// The colour picker has no native readonly; the runtime keeps it in step with the hex field.
const PICKER_OWNER = { native: ['disabled'] };
// The hex field announces its own validity, so a field error only adds the data attribute.
const HEX_OWNER = { native: ['disabled', 'readonly', 'required'] };

function affix(value, position, lib) {
  const text = lib.str(value);
  if (!text) return '';
  const body = /^[a-z0-9-]+$/.test(text) && text.length > 2 ? lib.icon(text) : lib.escapeHtml(text);
  return `<span class="wf-affix wf-affix-${position}">${body}</span>`;
}

function renderRange(props, ctx, lib, state) {
  const thumbs = rangeThumbs(props, ctx, lib);
  const fill = thumbs.length === 2
    ? `margin-left:${thumbs[0]}%;width:${Math.round((thumbs[1] - thumbs[0]) * 10000) / 10000}%`
    : `width:${thumbs[0]}%`;
  const handles = thumbs.map((left) => `<span class="wf-range-thumb" style="left:${left}%"></span>`).join('');
  return `<span class="wf-range"${lib.stateAttrs(state)}><span class="wf-range-track"><span class="wf-range-fill" style="${fill}"></span></span>${handles}</span>`;
}

function renderStepperField(node, ctx, lib, state) {
  const props = node.props || {};
  const raw = props.value != null && !Array.isArray(props.value)
    ? lib.resolveAttributeValue(String(props.value), ctx.bindingContext || {}, null, '')
    : '1';
  const shown = displayNumber(raw, props, ctx, lib);
  const atMin = shown.bounds.authored && shown.value != null && shown.value <= shown.bounds.min;
  const atMax = shown.bounds.authored && shown.value != null && shown.value >= shown.bounds.max;
  const button = (glyph, end) => `<button class="wf-numstepper-btn"${
    lib.stateAttrs({ disabled: state.disabled || end }, { owner: lib.STATE_OWNERS.button })}>${glyph}</button>`;
  return `${fieldLabel(props, ctx, lib)}<span class="wf-numstepper"${lib.stateAttrs(state)}>${button('−', atMin)}`
    + `<span class="wf-numstepper-value">${lib.escapeHtml(shown.text)}</span>`
    + `${button('+', atMax)}</span>${fieldHelp(props, ctx, lib)}`;
}

function renderColour(node, ctx, lib, parts) {
  const { props, value, placeholder, inputId, label, help, invalid, state, describe } = parts;
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  const name = lib.str(props.label) || 'Colour';
  const picker = lib.stateAttrs({ disabled: state.disabled, readonly: state.readonly }, { owner: PICKER_OWNER });
  const hex = lib.stateAttrs(state, { owner: HEX_OWNER });
  return {
    inner: `${label}<span class="wf-color"><input type="color" data-wf-color-picker aria-label="${lib.escapeAttr(name + ' picker')}" value="${valid ? value : '#000000'}"${picker} /><input type="text" id="${lib.escapeAttr(inputId)}" data-wf-color-hex data-wf-form-key="${lib.escapeAttr(String(node.id))}" aria-label="${lib.escapeAttr(name + ' hex')}" aria-invalid="${!valid || state.invalid}" value="${lib.escapeAttr(value)}" placeholder="${lib.escapeAttr(placeholder || '#6b7280')}" spellcheck="false"${hex}${describe} /></span>${help}`,
    className: `wf-field${invalid}`,
  };
}

function renderInput(node, ctx, lib) {
  const props = node.props || {};
  const type = INPUT_TYPES.has(props.inputType) ? props.inputType : 'text';
  const placeholder = lib.resolveAttributeValue(
    lib.str(props.placeholder), ctx.bindingContext || {}, ctx.stateBindings, 'placeholder',
  );
  // An array value draws two thumbs on a range and means nothing anywhere else.
  const scalar = Array.isArray(props.value) ? null : props.value;
  const value = lib.resolveAttributeValue(scalar == null ? '' : String(scalar), ctx.bindingContext || {}, ctx.stateBindings, 'value');
  const inputId = String(node.id) + '__input';
  const label = fieldLabel(props, ctx, lib, ['stepper', 'otp', 'range'].includes(type) ? null : inputId);
  const invalid = lib.str(props.error) ? ' wf-field-invalid' : '';
  const state = fieldState(props, lib);

  if (type === 'stepper') {
    return { inner: renderStepperField(node, ctx, lib, state), className: `wf-field${invalid}` };
  }
  if (type === 'otp') {
    const count = Math.max(2, Math.min(8, lib.num(props.length, 6)));
    const boxes = Array.from({ length: count }, () => '<span class="wf-otp-box"></span>').join('');
    return { inner: `${label}<div class="wf-otp"${lib.stateAttrs(state)}>${boxes}</div>${fieldHelp(props, ctx, lib)}`, className: `wf-field${invalid}` };
  }
  if (type === 'range') {
    return { inner: `${label}${renderRange(props, ctx, lib, state)}${fieldHelp(props, ctx, lib)}`, className: `wf-field${invalid}` };
  }
  const help = fieldHelp(props, ctx, lib, node);
  const describe = describedBy(props, lib, node);
  if (type === 'color') {
    return renderColour(node, ctx, lib, { props, value, placeholder, inputId, label, help, invalid, state, describe });
  }

  const shown = type === 'number' ? displayNumber(value, props, ctx, lib) : null;
  const bounds = shown && shown.bounds.authored ? ` min="${shown.bounds.min}" max="${shown.bounds.max}"` : '';
  const step = shown && shown.step != null ? ` step="${shown.step}"` : '';
  const htmlType = ['date', 'time', 'datetime'].includes(type) ? 'text' : type;
  const iconName = lib.str(props.icon);
  const position = ['end', 'center'].includes(props.iconPosition) ? props.iconPosition : 'start';
  const prefix = affix(props.prefix || (!iconName ? TYPE_PREFIX[type] : ''), 'start', lib);
  const suffix = affix(props.suffix || (!iconName ? TYPE_SUFFIX[type] : ''), 'end', lib);
  const glyph = iconName ? lib.icon(iconName, { style: props.iconStyle }) : '';
  const centered = glyph && position === 'center';
  const decoration = glyph
    ? `<span class="wf-affix wf-affix-${position}" aria-hidden="true">${glyph}${centered ? `<span class="wf-input-placeholder">${lib.escapeHtml(placeholder)}</span>` : ''}</span>`
    : '';
  const control = `<span class="wf-control${centered ? ' wf-control-center' : ''}">${prefix}${position === 'start' ? decoration : ''}<input id="${lib.escapeAttr(inputId)}" type="${htmlType}" placeholder="${lib.escapeAttr(centered && !placeholder ? ' ' : placeholder)}"${!props.label ? ` aria-label="${lib.escapeAttr(placeholder || 'Text field')}"` : ''}${
    scalar != null ? ` value="${lib.escapeAttr(shown ? shown.text : value)}"` : ''
  }${bounds}${step}${lib.stateAttrs(state, { owner: lib.STATE_OWNERS.field })}${describe} />${position !== 'start' ? decoration : ''}${suffix}</span>`;
  return { inner: `${label}${control}${help}`, className: `wf-field${invalid}${props.variant === 'plain' ? ' wf-input-plain' : ''}` };
}

function renderTextarea(node, ctx, lib) {
  const props = node.props || {};
  const rows = Math.max(1, Math.min(20, lib.num(props.rows, 3)));
  const placeholder = lib.resolveAttributeValue(
    lib.str(props.placeholder), ctx.bindingContext || {}, ctx.stateBindings, 'placeholder',
  );
  const counter = props.maxLength != null
    ? `<span class="wf-field-count">0 / ${lib.escapeHtml(String(props.maxLength))}</span>`
    : '';
  const invalid = lib.str(props.error) ? ' wf-field-invalid' : '';
  const state = fieldState(props, lib);
  return {
    inner: `${fieldLabel(props, ctx, lib)}<textarea rows="${rows}" placeholder="${lib.escapeAttr(placeholder)}"${
      lib.stateAttrs(state, { owner: lib.STATE_OWNERS.field })
    }${describedBy(props, lib, node)}></textarea>${fieldHelp(props, ctx, lib, node)}${counter}`,
    className: `wf-field${invalid}`,
  };
}

module.exports = {
  inputRenderers: {
    input: renderInput,
    textarea: renderTextarea,
  },
};
