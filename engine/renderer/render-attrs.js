'use strict';

const { toPx } = require('./layout');
const { standardRole } = require('../design-system/resolve');
const { readLocalImage } = require('./wireframe-styles');
const { normalizeItems, resolveSelection, itemProfiles } = require('./items');
const {
  isObject,
  isBoundSelectionValue,
  serializeSelectionValue,
  escapeHtml,
  escapeAttr,
  toSafeClass,
  nodeComponent,
  renderBoundText,
  resolveAttributeValue,
} = require('./render-utils');

function buildNodeDataAttributes(node, stateBindings, selectionValue, paneData) {
  const entries = [];
  if (node.sticky === 'top' || node.sticky === 'bottom') entries.push(`data-sticky="${node.sticky}"`);
  if (Array.isArray(node.interaction) && node.interaction.length > 0) {
    entries.push(`data-wf-interactions="${escapeAttr(JSON.stringify(node.interaction))}"`);
  }
  if (isObject(node.visibility)) {
    entries.push(`data-wf-visibility="${escapeAttr(JSON.stringify(node.visibility))}"`);
  }
  if (isObject(stateBindings)) {
    entries.push(`data-wf-state-bindings="${escapeAttr(JSON.stringify(stateBindings))}"`);
  }
  if (node.kind === 'overlay' && typeof node.type === 'string' && node.type.trim() !== '') {
    entries.push(`data-wf-overlay-type="${escapeAttr(node.type)}"`);
  }
  if (node.kind === 'overlay' && typeof node.trigger === 'string' && node.trigger.trim() !== '') {
    entries.push(`data-wf-overlay-trigger="${escapeAttr(node.trigger)}"`);
  }
  if (node.kind === 'overlay' && typeof node.placement === 'string' && node.placement.trim() !== '') {
    entries.push(`data-wf-overlay-placement="${escapeAttr(node.placement)}"`);
  }
  if (node.kind === 'overlay' && Array.isArray(node.dismissOn) && node.dismissOn.length > 0) {
    entries.push(`data-wf-overlay-dismiss="${escapeAttr(JSON.stringify(node.dismissOn))}"`);
  }
  if (node.selection && typeof node.selection.stateKey === 'string' && node.selection.stateKey.trim() !== '') {
    entries.push(`data-selection-key="${escapeAttr(node.selection.stateKey)}"`);
  }
  if (node.selection && typeof node.selection.scope === 'string' && node.selection.scope.trim() !== '') {
    entries.push(`data-selection-scope="${escapeAttr(node.selection.scope)}"`);
  }
  if (node.selection && isBoundSelectionValue(selectionValue)) {
    entries.push(`data-selection-value="${escapeAttr(serializeSelectionValue(selectionValue))}"`);
  }
  if (node.selection && node.selection.selectable === false) {
    entries.push('data-selection-selectable="false"');
  }
  if (isObject(paneData)) {
    entries.push(`data-wf-pane="${escapeAttr(JSON.stringify(paneData))}"`);
  }
  if (typeof node.role === 'string' && node.role.trim() !== '') {
    entries.push(`data-wf-role="${escapeAttr(node.role.trim())}"`);
  }
  return entries.length > 0 ? ` ${entries.join(' ')}` : '';
}

function buildNodeClasses(node, primitive, level = null, paneSide = null, isSurface = null) {
  const classList = ['wf-node'];
  const explicitSurface = typeof node?.surface === 'boolean' ? node.surface : null;

  if (primitive === 'heading') {
    classList.push('wf-heading');
    if (level && Number.isInteger(level) && level >= 1 && level <= 6) {
      classList.push(`wf-heading-${level}`);
    }
  } else if (primitive === 'text') {
    classList.push('wf-text');
    const variant = node?.props?.variant === 'meta' ? 'meta' : 'body';
    classList.push(`wf-text-${variant}`);
  } else if (primitive === 'button') {
    classList.push('wf-button');
    const allowedVariants = new Set(['primary', 'secondary', 'ghost', 'danger']);
    const variant = allowedVariants.has(node?.props?.variant) ? node.props.variant : 'secondary';
    classList.push(`wf-button-${variant}`);
  } else if (primitive === 'table') {
    classList.push('wf-table');
    if (isSurface === true || (isSurface == null && explicitSurface !== false)) {
      classList.push('wf-surface');
    }
  } else if (primitive === 'section') {
    classList.push('wf-section');
    if (isSurface === true || (isSurface == null && explicitSurface !== false)) {
      classList.push('wf-surface');
    } else {
      classList.push('wf-group');
    }
  } else if (primitive === 'tab_bar') {
    classList.push('wf-tab-bar', 'wf-surface');
  } else if (primitive === 'bottom_tab_bar') {
    classList.push('wf-bottom-tab-bar', 'wf-surface');
  } else if (primitive) {
    classList.push(`wf-${toSafeClass(primitive)}`);
  } else if (node.kind === 'overlay') {
    classList.push('wf-overlay');
    if (typeof node.type === 'string' && node.type.trim() !== '') {
      classList.push(`wf-overlay-${toSafeClass(node.type)}`);
    }
  } else {
    classList.push(`wf-${toSafeClass(nodeComponent(node))}`);
  }

  if (Array.isArray(node.interaction) && node.interaction.length > 0) {
    classList.push('wf-interactive');
  }
  if (node.selection && typeof node.selection === 'object') {
    classList.push('wf-selectable');
  }
  if (typeof paneSide === 'string' && paneSide.trim() !== '') {
    classList.push('wf-pane', `wf-pane-${toSafeClass(paneSide)}`);
  }
  if (typeof node?.role === 'string' && node.role.trim() !== '') {
    classList.push(`wf-role-${toSafeClass(node.role.trim())}`);
  }

  if (explicitSurface === true && !classList.includes('wf-surface')) {
    classList.push('wf-surface');
  }

  return classList.join(' ');
}

/** Where a rendered node came from. Empty unless the render asked for it. */
function sourceAttrs(node, options) {
  if (options?.annotateSource !== true || !isObject(node)) return '';
  const entries = [];
  const role = standardRole(node);
  if (role.component) entries.push('data-wf-component="' + escapeAttr(role.component) + '"');
  if (role.variant) entries.push('data-wf-variant="' + escapeAttr(role.variant) + '"');
  if (typeof node.__source === 'string') entries.push(`data-wf-source="${escapeAttr(node.__source)}"`);
  if (typeof node.__definition === 'string') entries.push(`data-wf-definition="${escapeAttr(node.__definition)}"`);
  if (Number.isInteger(options.rowIndex)) entries.push(`data-wf-row="${options.rowIndex}"`);
  return entries.length > 0 ? ` ${entries.join(' ')}` : '';
}

function joinAttrs(nodeId, classes, style, extraAttrs = []) {
  const attrs = [];
  if (typeof nodeId === 'string' && nodeId.trim() !== '') {
    attrs.push(`id="${escapeAttr(nodeId)}"`);
  }
  if (classes && classes.length > 0) {
    attrs.push(`class="${escapeAttr(classes)}"`);
  }
  if (style) {
    attrs.push(`style="${escapeAttr(style)}"`);
  }
  if (Array.isArray(extraAttrs)) {
    for (const attr of extraAttrs) {
      if (typeof attr === 'string' && attr.trim() !== '') {
        attrs.push(attr.trim());
      }
    }
  }
  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

function primaryNavigationTarget(node, options = {}) {
  const interactions = Array.isArray(node?.interaction) ? node.interaction : [];
  const route = node?.component === 'button' && typeof node.props?.route === 'string' ? node.props.route : '';
  if (interactions.length !== 1 && !(interactions.length === 0 && route)) return null;
  const interaction = interactions[0] || { type: 'navigation', targetRoute: route };
  if (!isObject(interaction) || interaction.type !== 'navigation' || interaction.condition || typeof interaction.targetRoute !== 'string') {
    return null;
  }

  const routeId = interaction.targetRoute.trim();
  if (!routeId) {
    return null;
  }

  const routeTable = isObject(options.routeTable) ? options.routeTable : {};
  const href = typeof routeTable[routeId] === 'string' && routeTable[routeId].trim() !== ''
    ? routeTable[routeId].trim()
    : null;

  return href ? { routeId, href } : null;
}

function navigationAttrs(navTarget) {
  if (!navTarget) {
    return [];
  }

  return [
    `href="${escapeAttr(navTarget.href)}"`,
    `data-wf-route-target="${escapeAttr(navTarget.routeId)}"`,
  ];
}

// Every state an element can show, in the order its attributes are written.
const STATES = ['disabled', 'readonly', 'required', 'invalid', 'loading', 'pressed', 'checked', 'selected', 'current', 'expanded'];
// A widget that supports one of these is toggleable, so its ARIA says "false" when off.
const TOGGLE_STATES = new Set(['pressed', 'checked', 'selected', 'expanded']);
const MIXED_STATES = new Set(['pressed', 'checked']);
const NATIVE_STATES = new Set(['disabled', 'readonly', 'required']);

/**
 * Who owns a state decides how it is announced. `native` lists states written
 * as bare HTML attributes; `aria` maps a state to the ARIA attribute the
 * owner's role supports; `current` is the `aria-current` token.
 */
const STATE_OWNERS = Object.freeze({
  // A <button> that does not toggle.
  button: { native: ['disabled'], aria: { loading: 'aria-busy' } },
  // A <button> that toggles: pressed buttons, toolbar toggles.
  toggle: { native: ['disabled'], aria: { pressed: 'aria-pressed', loading: 'aria-busy' } },
  // Existing tab and segment buttons announce selection as aria-pressed.
  tab: { native: ['disabled'], aria: { selected: 'aria-pressed' } },
  // <input> and <textarea>.
  field: { native: ['disabled', 'readonly', 'required'], aria: { invalid: 'aria-invalid' } },
  // <select> has no native readonly.
  select: { native: ['disabled', 'required'], aria: { readonly: 'aria-readonly', invalid: 'aria-invalid' } },
  // An element with role checkbox, radio or switch.
  check: {
    aria: {
      checked: 'aria-checked',
      disabled: 'aria-disabled',
      readonly: 'aria-readonly',
      required: 'aria-required',
      invalid: 'aria-invalid',
    },
  },
  // A navigation link.
  link: { aria: { current: 'aria-current', disabled: 'aria-disabled' }, current: 'page' },
  // A display-only list row: menu, command and menubar entries.
  item: { aria: { current: 'aria-current', disabled: 'aria-disabled' }, current: 'true' },
  // A tree row or accordion head that opens and closes.
  disclosure: { aria: { expanded: 'aria-expanded', disabled: 'aria-disabled' } },
});

function stateValue(name, raw) {
  if (raw === true) return 'true';
  if (raw === 'mixed' && MIXED_STATES.has(name)) return 'mixed';
  return null;
}

/**
 * State attributes for the element that owns the state. Every state that is
 * on gets a presence-only `data-wf-<state>` (`="mixed"` when mixed); the
 * owner decides which native and ARIA attributes go with it.
 */
function stateAttrs(state, { owner = {} } = {}) {
  const values = isObject(state) ? state : {};
  const native = new Set(Array.isArray(owner.native) ? owner.native : []);
  const aria = isObject(owner.aria) ? owner.aria : {};
  const nativeAttrs = [];
  const ariaAttrs = [];
  const dataAttrs = [];
  const written = new Set();
  for (const name of STATES) {
    const on = stateValue(name, values[name]);
    if (on) dataAttrs.push(on === 'mixed' ? `data-wf-${name}="mixed"` : `data-wf-${name}`);
    if (native.has(name) && NATIVE_STATES.has(name)) {
      if (on) nativeAttrs.push(name);
      continue;
    }
    const attr = aria[name];
    if (typeof attr !== 'string' || written.has(attr)) continue;
    const token = name === 'current' && on === 'true' && typeof owner.current === 'string' ? owner.current : on;
    if (on) ariaAttrs.push(`${attr}="${escapeAttr(token)}"`);
    else if (TOGGLE_STATES.has(name)) ariaAttrs.push(`${attr}="false"`);
    else continue;
    written.add(attr);
  }
  const attrs = [...nativeAttrs, ...ariaAttrs, ...dataAttrs];
  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

function renderImageElement(projectPath, props, options = {}) {
  const rawSource = resolveAttributeValue(typeof props.src === 'string' ? props.src.trim() : '', options);
  const alt = resolveAttributeValue(
    typeof props.alt === 'string' ? props.alt : 'Image',
    options,
  ) || 'Image';
  const width = toPx(props.width);
  const height = toPx(props.height);

  const resolvedSource = readLocalImage(projectPath, rawSource, {
    assetUrlPrefix: options && typeof options.assetUrlPrefix === 'string' ? options.assetUrlPrefix : '',
    imageResolver: options?.imageResolver,
  }) || (rawSource ? rawSource : null);
  if (!resolvedSource) {
    return `<div class="wf-image wf-image-placeholder">${escapeHtml(alt)}</div>`;
  }

  const attributes = [
    `src="${escapeAttr(resolvedSource)}"`,
    `alt="${escapeAttr(alt)}"`,
  ];
  if (width) {
    attributes.push(`width="${escapeAttr(width)}"`);
  }
  if (height) {
    attributes.push(`height="${escapeAttr(height)}"`);
  }

  return `<img ${attributes.join(' ')} />`;
}

function renderSectionTitle(props, options = {}) {
  const titleValue = isObject(props) && typeof props.title === 'string' && props.title.trim() !== ''
    ? props.title
    : '';
  if (!titleValue) {
    return '';
  }
  return `<div class="wf-section-title">${renderBoundText(titleValue, options)}</div>`;
}

/**
 * `<option>` markup for `select.options`, read through the item model's
 * `select` profile. A scalar (booleans included) is written as given; an
 * object trims its label and value and falls back to "Option". `value` (a
 * list with `multiple`) and item `selected` mark the initial selection; a
 * `group` is an `<optgroup>` and a `separator` an `<hr>`.
 */
function renderSelectOptions(options, { value, multiple = false } = {}) {
  const rows = (Array.isArray(options) ? options : []).map((entry) => {
    const [item] = normalizeItems([entry], itemProfiles.select);
    return item ? { item, scalar: !isObject(entry) } : null;
  }).filter(Boolean);
  if (rows.length === 0) return '';
  const { selected } = resolveSelection(rows.map((row) => row.item), { value, multiple });

  return rows.map(({ item, scalar }, index) => {
    if (item.type === 'separator') return '<hr>';
    if (item.type === 'heading' || item.type === 'group') {
      const nested = item.type === 'group' ? renderSelectOptions(item.items, { value, multiple }) : '';
      return `<optgroup label="${escapeAttr(String(item.label ?? '').trim())}">${nested}</optgroup>`;
    }
    const label = scalar ? item.label : String(item.label || item.value || '').trim();
    const optionValue = scalar ? item.value : String(item.value ?? item.label ?? '').trim();
    const attrs = `${selected[index] ? ' selected' : ''}${item.disabled === true ? ' disabled' : ''}`;
    return `<option value="${escapeAttr(optionValue)}"${attrs}>${escapeHtml(scalar ? label : label || optionValue || 'Option')}</option>`;
  }).join('');
}

module.exports = {
  buildNodeDataAttributes,
  buildNodeClasses,
  joinAttrs,
  sourceAttrs,
  primaryNavigationTarget,
  navigationAttrs,
  stateAttrs,
  STATE_OWNERS,
  renderImageElement,
  renderSectionTitle,
  renderSelectOptions,
};
