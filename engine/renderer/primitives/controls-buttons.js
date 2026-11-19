'use strict';

const { partId, fieldState, fieldLabel, readonlyLock, fieldHelp, describedBy, optionValueAttr } = require('./controls-field');

const BUTTON_VARIANTS = new Set(['primary', 'secondary', 'ghost', 'danger', 'link']);
const TOOLBAR_SIZES = new Set(['sm', 'md', 'lg']);
// A checkable toolbar button: a <button> with role checkbox keeps native disabled.
const CHECK_BUTTON_OWNER = { native: ['disabled'], aria: { checked: 'aria-checked' } };

function isToggleState(value) {
  return typeof value === 'boolean' || value === 'mixed';
}

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
  const classes = [
    `wf-button-${variant}`,
    `wf-button-${lib.toSafeClass(size)}`,
    iconOnly ? 'wf-button-icon' : '',
    props.fab === true ? 'wf-button-fab' : '',
    props.disabled === true ? 'wf-button-disabled' : '',
  ].filter(Boolean).join(' ');

  // `pressed` (true or false) makes it a toggle button. A link only mirrors the state.
  const state = { disabled: props.disabled === true, loading: props.loading === true, pressed: props.pressed };
  const owner = isToggleState(props.pressed) ? lib.STATE_OWNERS.toggle : lib.STATE_OWNERS.button;
  const accessibleName = iconOnly ? ` aria-label="${lib.escapeAttr(label || iconName.replace(/-/g, ' '))}"` : '';
  const inner = ctx.navigationTarget && props.disabled !== true
    ? `<a class="wf-button-link"${accessibleName}${ctx.navAttrs()}${lib.stateAttrs({ ...state, disabled: false })}>${spinner}${body}</a>`
    : `<button${lib.stateAttrs(state, { owner })}${accessibleName}>${spinner}${body}</button>`;
  return { inner, className: classes };
}

function segmentButtons(node, lib, state) {
  const props = node.props || {};
  const options = lib.normalizeItems(props.options, lib.itemProfiles.choice);
  const { selected } = lib.resolveSelection(options, { value: props.value });
  const list = options.length > 0 ? options : [{ label: '' }, { label: '' }];
  return list.map((option, index) => {
    const label = lib.str(option.label);
    const on = selected[index] === true;
    const glyph = lib.iconSpan(option.icon);
    const disabled = !label || node.selection?.selectable === false || state.disabled || option.disabled === true;
    const attrs = lib.stateAttrs({ selected: on, disabled }, { owner: lib.STATE_OWNERS.tab });
    return `<button type="button" class="wf-segment${on ? ' wf-segment-on' : ''}" data-wf-choice-value="${lib.escapeAttr(JSON.stringify(label))}"${optionValueAttr(option, lib)}${attrs}${!label ? ' aria-label="Empty option"' : ''}>${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(5)}</button>`;
  }).join('');
}

/**
 * Segmented control. With any field prop (label, help, error, required,
 * disabled, readonly) it becomes a field: the label above, the segments in
 * a group that carries the field state, the help below. Otherwise it renders
 * exactly as it always did.
 */
function renderSegmented(node, ctx, lib) {
  const props = node.props || {};
  const size = lib.str(props.size) || 'md';
  const state = fieldState(props, lib);
  const buttons = segmentButtons(node, lib, state);
  const isField = lib.str(props.label) || lib.str(props.help) || Object.values(state).includes(true);
  if (!isField) return { inner: buttons, className: `wf-segmented-${lib.toSafeClass(size)}` };

  const labelId = lib.str(props.label) ? partId(node, 'label') : '';
  const name = labelId ? ` aria-labelledby="${lib.escapeAttr(labelId)}"` : '';
  const label = labelId
    ? `<span class="wf-field-label" id="${lib.escapeAttr(labelId)}">${lib.bound(props.label, ctx)}${state.required ? '<span class="wf-req">*</span>' : ''}${readonlyLock(props)}</span>`
    : '';
  return {
    inner: `${label}<div class="wf-segment-track" role="group"${name}${describedBy(props, lib, node)}${lib.stateAttrs(state)}>${buttons}</div>${fieldHelp(props, ctx, lib, node)}`,
    className: `wf-segmented-${lib.toSafeClass(size)} wf-segmented-field${state.invalid ? ' wf-field-invalid' : ''}`,
  };
}

function toolbarButton(item, lib, showLabel) {
  const label = lib.str(item.label);
  const glyph = lib.icon(item.icon, { style: item.iconStyle });
  const text = label && (showLabel || !glyph) ? `<span class="wf-toolbar-label">${lib.escapeHtml(label)}</span>` : '';
  const body = glyph || text ? `${glyph}${text}` : lib.renderSkeleton(3);
  const name = label && !text ? ` aria-label="${lib.escapeAttr(label)}"` : '';
  const disabled = item.disabled === true;
  let attrs;
  if (isToggleState(item.checked)) {
    attrs = ` role="checkbox"${lib.stateAttrs({ disabled, checked: item.checked }, { owner: CHECK_BUTTON_OWNER })}`;
  } else if (isToggleState(item.pressed)) {
    attrs = lib.stateAttrs({ disabled, pressed: item.pressed }, { owner: lib.STATE_OWNERS.toggle });
  } else {
    attrs = lib.stateAttrs({ disabled }, { owner: lib.STATE_OWNERS.button });
  }
  return `<button type="button" class="wf-toolbar-item${text ? '' : ' wf-toolbar-icon'}"${name}${attrs}>${body}</button>`;
}

function toolbarEntries(items, lib, showLabel, vertical) {
  return items.map((item) => {
    if (item.type === 'separator') {
      return `<span class="wf-toolbar-sep" role="separator" aria-orientation="${vertical ? 'horizontal' : 'vertical'}"></span>`;
    }
    if (item.type === 'heading') return '';
    if (item.type === 'group') {
      const label = lib.str(item.label);
      return `<span class="wf-toolbar-group" role="group"${label ? ` aria-label="${lib.escapeAttr(label)}"` : ''}>${
        toolbarEntries(item.items || [], lib, showLabel, vertical)}</span>`;
    }
    return toolbarButton(item, lib, showLabel);
  }).join('');
}

/** A row or column of tool buttons: pressed and checked toggles, separators and groups. */
function renderToolbar(node, ctx, lib) {
  const props = node.props || {};
  const size = TOOLBAR_SIZES.has(props.size) ? props.size : 'md';
  const vertical = props.orientation === 'stack';
  const items = lib.normalizeItems(props.items);
  const list = items.length > 0 ? items : [{ type: 'item' }, { type: 'item' }, { type: 'item' }];
  const orientation = vertical ? ' aria-orientation="vertical"' : '';
  return {
    inner: `<div class="wf-toolbar-items" role="toolbar"${orientation}>${toolbarEntries(list, lib, props.labels === true, vertical)}</div>`,
    className: `wf-toolbar-${size}${vertical ? ' wf-toolbar-stack' : ''}`,
  };
}

module.exports = {
  buttonRenderers: {
    button: renderButton,
    segmented: renderSegmented,
    toolbar: renderToolbar,
  },
};
