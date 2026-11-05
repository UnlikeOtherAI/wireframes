'use strict';

const BUTTON_VARIANTS = new Set(['primary', 'secondary', 'ghost', 'danger', 'link']);
const INPUT_TYPES = new Set([
  'text', 'password', 'email', 'number', 'search', 'tel', 'url',
  'date', 'time', 'datetime', 'color', 'range', 'otp', 'stepper',
]);

const TYPE_PREFIX = { search: 'magnifying-glass', email: 'envelope', tel: 'phone', url: 'link' };
const TYPE_SUFFIX = { date: 'calendar', time: 'clock', datetime: 'calendar', password: 'eye', number: 'sort' };

function renderButton(node, ctx, lib) {
  const props = node.props || {};
  const variant = BUTTON_VARIANTS.has(props.variant) ? props.variant : 'secondary';
  const size = lib.str(props.size) || 'md';
  const label = lib.str(props.label);
  const iconName = lib.str(props.icon) || (variant === 'danger' ? 'triangle-exclamation' : '');
  const iconOnly = props.iconOnly === true || props.fab === true || (props.iconPosition === 'center' && iconName !== '') || (!label && iconName !== '');
  const glyph = iconName
    ? lib.icon(iconName, { style: props.iconStyle, size: props.iconSize || (props.fab ? 'lg' : null) })
    : '';
  const body = iconOnly
    ? glyph
    : [props.iconPosition === 'end' ? '' : glyph, label ? lib.bound(label, ctx) : lib.renderSkeleton(6),
      props.iconPosition === 'end' ? glyph : ''].filter(Boolean).join(' ');
  const spinner = props.loading === true ? '<span class="wf-spinner wf-spinner-sm"></span> ' : '';
  const disabled = props.disabled === true ? ' disabled' : '';
  const classes = [
    `wf-button-${variant}`,
    `wf-button-${lib.toSafeClass(size)}`,
    iconOnly ? 'wf-button-icon' : '',
    props.fab === true ? 'wf-button-fab' : '',
    props.disabled === true ? 'wf-button-disabled' : '',
  ].filter(Boolean).join(' ');

  const accessibleName = iconOnly ? ` aria-label="${lib.escapeAttr(label || iconName.replace(/-/g, ' '))}"` : '';
  const inner = ctx.navigationTarget && props.disabled !== true
    ? `<a class="wf-button-link"${accessibleName}${ctx.navAttrs()}>${spinner}${body}</a>`
    : `<button${disabled}${accessibleName}>${spinner}${body}</button>`;
  return { inner, className: classes };
}

function renderSegmented(node, ctx, lib) {
  const options = lib.items(node.props?.options);
  const value = lib.str(node.props?.value);
  const size = lib.str(node.props?.size) || 'md';
  const buttons = (options.length > 0 ? options : [{ label: '' }, { label: '' }]).map((option) => {
    const label = lib.str(option.label);
    const active = label !== '' && label === value ? ' wf-segment-on' : '';
    const glyph = lib.iconSpan(option.icon);
    return `<button class="wf-segment${active}">${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(5)}</button>`;
  }).join('');
  return { inner: buttons, className: `wf-segmented-${lib.toSafeClass(size)}` };
}

function fieldLabel(props, ctx, lib, inputId) {
  const label = lib.str(props?.label);
  if (!label) return '';
  const required = props.required === true ? '<span class="wf-req">*</span>' : '';
  return `<label class="wf-field-label"${inputId ? ` for="${lib.escapeAttr(inputId)}"` : ''}>${lib.bound(label, ctx)}${required}</label>`;
}

function fieldHelp(props, ctx, lib) {
  const error = lib.str(props?.error);
  if (error) return `<span class="wf-field-error">${lib.bound(error, ctx)}</span>`;
  const help = lib.str(props?.help);
  return help ? `<span class="wf-field-help">${lib.bound(help, ctx)}</span>` : '';
}

function affix(value, position, lib) {
  const text = lib.str(value);
  if (!text) return '';
  const body = /^[a-z0-9-]+$/.test(text) && text.length > 2 ? lib.icon(text) : lib.escapeHtml(text);
  return `<span class="wf-affix wf-affix-${position}">${body}</span>`;
}

function renderInput(node, ctx, lib) {
  const props = node.props || {};
  const type = INPUT_TYPES.has(props.inputType) ? props.inputType : 'text';
  const placeholder = lib.resolveAttributeValue(
    lib.str(props.placeholder), ctx.bindingContext || {}, ctx.stateBindings, 'placeholder',
  );
  const inputId = String(node.id) + '__input';
  const label = fieldLabel(props, ctx, lib, ['stepper', 'otp', 'range', 'color'].includes(type) ? null : inputId);
  const help = fieldHelp(props, ctx, lib);
  const invalid = lib.str(props.error) ? ' wf-field-invalid' : '';
  const disabled = props.disabled === true ? ' disabled' : '';

  if (type === 'stepper') {
    return { inner: renderStepperField(node, ctx, lib), className: 'wf-field' };
  }
  if (type === 'otp') {
    const count = Math.max(2, Math.min(8, lib.num(props.length, 6)));
    const boxes = Array.from({ length: count }, () => '<span class="wf-otp-box"></span>').join('');
    return { inner: `${label}<div class="wf-otp">${boxes}</div>${help}`, className: `wf-field${invalid}` };
  }
  if (type === 'range') {
    const value = Math.max(0, Math.min(100, lib.num(props.value, 40)));
    return {
      inner: `${label}<span class="wf-range"><span class="wf-range-track"><span class="wf-range-fill" style="width:${value}%"></span></span><span class="wf-range-thumb" style="left:${value}%"></span></span>${help}`,
      className: `wf-field${invalid}`,
    };
  }
  if (type === 'color') {
    return {
      inner: `${label}<span class="wf-color"><span class="wf-color-swatch"></span><input type="text" placeholder="${lib.escapeAttr(placeholder || '#6b7280')}"${disabled} /></span>${help}`,
      className: `wf-field${invalid}`,
    };
  }

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
    props.value != null ? ` value="${lib.escapeAttr(String(props.value))}"` : ''
  }${disabled} />${position !== 'start' ? decoration : ''}${suffix}</span>`;
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
  return {
    inner: `${fieldLabel(props, ctx, lib)}<textarea rows="${rows}" placeholder="${lib.escapeAttr(placeholder)}"${
      props.disabled === true ? ' disabled' : ''
    }></textarea>${fieldHelp(props, ctx, lib)}${counter}`,
    className: `wf-field${invalid}`,
  };
}

function renderSelect(node, ctx, lib) {
  const props = node.props || {};
  const placeholder = lib.resolveAttributeValue(
    lib.str(props.placeholder) || 'Select', ctx.bindingContext || {}, ctx.stateBindings, 'placeholder',
  );
  const options = lib.renderSelectOptions(Array.isArray(props.options) ? props.options : []);
  const invalid = lib.str(props.error) ? ' wf-field-invalid' : '';
  const searchGlyph = props.searchable === true
    ? `<span class="wf-affix wf-affix-start">${lib.icon('magnifying-glass')}</span>`
    : '';
  const control = `<span class="wf-control">${searchGlyph}<select${
    props.multiple === true ? ' multiple' : ''
  }${props.disabled === true ? ' disabled' : ''}><option value="">${lib.escapeHtml(placeholder)}</option>${options}</select></span>`;
  return {
    inner: `${fieldLabel(props, ctx, lib)}${control}${fieldHelp(props, ctx, lib)}`,
    className: `wf-field${invalid}${props.searchable === true ? ' wf-select-searchable' : ''}`,
  };
}

function choiceControl(kind, lib) {
  return kind === 'radio'
    ? '<span class="wf-radio-mark"></span>'
    : '<span class="wf-check-mark"></span>';
}

function renderChoice(kind) {
  return function render(node, ctx, lib) {
    const props = node.props || {};
    const label = lib.str(props.label) || (kind === 'radio' ? 'Option' : 'Checkbox');
    const description = lib.str(props.description);
    const mark = kind === 'toggle'
      ? `<span class="wf-toggle-track${props.checked === true ? ' wf-toggle-on' : ''}"><span class="wf-toggle-thumb"></span></span>`
      : choiceControl(kind, lib);
    const on = props.checked === true ? ' wf-choice-on' : '';
    const body = `<span class="wf-choice-text"><span class="wf-choice-label">${lib.bound(label, ctx)}</span>${
      description ? `<span class="wf-choice-desc">${lib.bound(description, ctx)}</span>` : ''
    }</span>`;
    return {
      inner: `<label class="wf-choice${on}${props.disabled === true ? ' wf-choice-disabled' : ''}">${mark}${body}</label>`,
    };
  };
}

function renderChoiceGroup(node, ctx, lib) {
  const props = node.props || {};
  const kind = props.kind === 'radio' ? 'radio' : 'checkbox';
  const value = lib.str(props.value);
  const options = lib.items(props.options);
  const rows = (options.length > 0 ? options : [{ label: '' }, { label: '' }]).map((option) => {
    const label = lib.str(option.label);
    const on = label !== '' && label === value ? ` wf-${kind}-on` : '';
    return `<label class="wf-choice${on}">${choiceControl(kind, lib)}<span class="wf-choice-text"><span class="wf-choice-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(8)
    }</span>${option.description ? `<span class="wf-choice-desc">${lib.escapeHtml(option.description)}</span>` : ''}</span></label>`;
  }).join('');
  return {
    inner: `${fieldLabel(props, ctx, lib)}<div class="wf-choice-list${props.inline === true ? ' wf-choice-inline' : ''}">${rows}</div>`,
    className: `wf-field wf-choice-group-${kind}`,
  };
}

function renderTagsInput(node, ctx, lib) {
  const props = node.props || {};
  const tags = lib.items(props.tags).map((tag) => (
    `<span class="wf-tag">${lib.escapeHtml(lib.str(tag.label))}<span class="wf-tag-x">×</span></span>`
  )).join('');
  const placeholder = lib.str(props.placeholder);
  return {
    inner: `${fieldLabel(props, ctx, lib)}<span class="wf-control wf-tags">${tags}<input type="text" placeholder="${lib.escapeAttr(placeholder)}" /></span>${fieldHelp(props, ctx, lib)}`,
    className: 'wf-field',
  };
}

function renderUpload(node, ctx, lib) {
  const props = node.props || {};
  const label = lib.str(props.label) || 'Drop files here';
  const hint = lib.str(props.hint);
  const files = lib.items(props.files, 'name').map((file) => (
    `<span class="wf-upload-file">${lib.icon('file')}<span>${lib.escapeHtml(lib.str(file.name) || lib.str(file.label))}</span></span>`
  )).join('');

  if (props.variant === 'button') {
    return {
      inner: `<button class="wf-act wf-button-secondary">${lib.icon('arrow-up-from-bracket')} ${lib.escapeHtml(label)}</button>${files}`,
      className: 'wf-upload-button',
    };
  }
  return {
    inner: `<span class="wf-upload-glyph">${lib.icon('cloud-arrow-up', { size: 'xl' })}</span><div class="wf-upload-label">${lib.bound(label, ctx)}</div>${
      hint ? `<div class="wf-upload-hint">${lib.bound(hint, ctx)}</div>` : ''
    }${files ? `<div class="wf-upload-files">${files}</div>` : ''}`,
  };
}

const EDITOR_TOOLS = ['bold', 'italic', 'list-ul', 'link', 'image', 'code'];

function renderEditor(node, ctx, lib) {
  const props = node.props || {};
  const rows = Math.max(2, Math.min(24, lib.num(props.rows, 6)));
  const toolbar = props.toolbar === false
    ? ''
    : `<div class="wf-editor-toolbar">${EDITOR_TOOLS.map((tool) => `<span class="wf-editor-tool">${lib.icon(tool, { size: 'sm' })}</span>`).join('')}</div>`;
  const lines = Array.from({ length: Math.min(rows, 5) }, (_, i) => (
    `<span class="wf-skeleton-row">${lib.renderSkeleton(i === 4 ? '45%' : '100%')}</span>`
  )).join('');
  return {
    inner: `${fieldLabel(props, ctx, lib)}${toolbar}<div class="wf-editor-body" style="min-height:${rows * 22}px">${lines}</div>`,
  };
}

const PICKER_ROWS = 5;

function renderPicker(node, ctx, lib) {
  const props = node.props || {};
  const options = lib.items(props.options);
  const value = lib.str(props.value);
  const selected = Math.max(0, options.findIndex((option) => lib.str(option.label) === value));
  const rows = Array.from({ length: PICKER_ROWS }, (_, i) => {
    const index = selected - 2 + i;
    const option = options[index];
    const label = option ? lib.str(option.label) : '';
    const on = i === 2 ? ' wf-picker-on' : '';
    return `<span class="wf-picker-row${on}">${label ? lib.escapeHtml(label) : ''}</span>`;
  }).join('');
  return {
    inner: `${fieldLabel(props, ctx, lib)}<div class="wf-picker-wheel">${rows}<span class="wf-picker-window"></span></div>`,
  };
}

function renderStepperField(node, ctx, lib) {
  const props = node.props || {};
  const value = props.value != null ? String(props.value) : '1';
  return `${fieldLabel(props, ctx, lib)}<span class="wf-numstepper"><button class="wf-numstepper-btn">\u2212</button>`
    + `<span class="wf-numstepper-value">${lib.escapeHtml(value)}</span>`
    + `<button class="wf-numstepper-btn">+</button></span>`;
}

module.exports = {
  controlRenderers: {
    picker: renderPicker,
    button: renderButton,
    segmented: renderSegmented,
    input: renderInput,
    textarea: renderTextarea,
    select: renderSelect,
    checkbox: renderChoice('checkbox'),
    radio: renderChoice('radio'),
    toggle: renderChoice('toggle'),
    choice_group: renderChoiceGroup,
    tags_input: renderTagsInput,
    upload: renderUpload,
    editor: renderEditor,
  },
};
