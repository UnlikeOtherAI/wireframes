'use strict';

const {
  isObject,
  escapeHtml,
  escapeAttr,
  renderSkeleton,
  renderBoundText,
  resolveAttributeValue,
  normalizeChildren,
  toSafeClass,
} = require('./render-utils');
const {
  renderImageElement,
  renderSelectOptions,
  navigationAttrs,
  stateAttrs,
  STATE_OWNERS,
} = require('./render-attrs');
const {
  normalizeItems,
  resolveSelection,
  itemProfiles,
  legacyItems,
} = require('./items');
const { scale, token } = require('./sizing-tokens');

/** Text from `text`, falling back to the `label` alias. */
function textProp(props, ...names) {
  const keys = names.length > 0 ? names : ['text', 'label'];
  for (const key of keys) {
    const value = props?.[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function str(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function num(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bound(value, ctx) {
  return renderBoundText(typeof value === 'string' ? value : String(value ?? ''), ctx.bindingContext || {});
}

/** Bound text, or a skeleton bar of `width` characters when there is nothing. */
function boundOrSkeleton(value, ctx, width = 8) {
  const raw = typeof value === 'string' && value.trim() !== '' ? value : null;
  return raw == null ? renderSkeleton(width) : bound(raw, ctx);
}

const ICON_PREFIX = { solid: 'fa-solid', regular: 'fa-regular', brands: 'fa-brands' };

/**
 * Font Awesome glyph when the font is present; a lettered box otherwise, so a
 * missing icon font never leaves a hole in the wireframe.
 */
function icon(name, options = {}) {
  const glyph = str(name);
  if (!glyph) return '';
  const prefix = ICON_PREFIX[str(options.style)] || 'fa-solid';
  const size = str(options.size);
  const px = size ? scale('icon', size) : null;
  const sizeClass = size ? ` fa-${escapeAttr(size)}` : '';
  const sizeStyle = px ? ` style="font-size:${px}px;width:${px}px"` : '';
  const letter = escapeHtml(glyph.charAt(0).toUpperCase());
  return `<i aria-hidden="true" class="wf-icon-glyph ${prefix} fa-${escapeAttr(glyph)}${sizeClass}" data-wf-glyph="${letter}"${sizeStyle}></i>`;
}

function iconSpan(name, options) {
  const markup = icon(name, options);
  return markup ? `<span class="wf-ico">${markup}</span>` : '';
}

/** A list prop whose entries may be strings or objects. Data arrays keep using it. */
function items(value, key = 'label') {
  return legacyItems(value, key);
}

const ACTION_TONES = new Set(['info', 'success', 'warning', 'danger']);
// Actions keep their button markup when disabled, so they announce it with ARIA.
const ACTION_OWNER = { aria: { disabled: 'aria-disabled' } };
const TOGGLE_ACTION_OWNER = { aria: { disabled: 'aria-disabled', pressed: 'aria-pressed' } };

/**
 * Inline button markup for `actions: []` props on headers, cards and alerts.
 * A routed action is a link unless it is disabled; a disabled action never
 * navigates. `pressed` makes it a toggle button, and `tone` colours it.
 * `tag` and `className` name the row element, so an overlay keeps its footer.
 */
function actionButtons(value, ctx, { tag = 'div', className = 'wf-actions' } = {}) {
  const list = normalizeItems(value, itemProfiles.basic);
  if (list.length === 0) return '';
  const buttons = list.map((action) => {
    const variant = str(action.variant) || 'secondary';
    const label = str(action.label);
    const glyph = iconSpan(action.icon);
    const inner = label ? `${glyph}${escapeHtml(label)}` : glyph || renderSkeleton(5);
    const disabled = action.disabled === true;
    const route = str(action.route);
    const href = !disabled && route && isObject(ctx.routeTable) && typeof ctx.routeTable[route] === 'string'
      ? ctx.routeTable[route]
      : '';
    const tone = ACTION_TONES.has(action.tone) ? ` wf-tone-${action.tone}` : '';
    const cls = `wf-act wf-button-${toSafeClass(variant)}${label ? '' : ' wf-act-icon'}${tone}`;
    const toggle = typeof action.pressed === 'boolean' || action.pressed === 'mixed';
    const state = { disabled, pressed: action.pressed };
    return href
      ? `<a class="${cls}" ${navigationAttrs({ href, routeId: route }).join(' ')}${stateAttrs(state)}>${inner}</a>`
      : `<button class="${cls}"${stateAttrs(state, { owner: toggle ? TOGGLE_ACTION_OWNER : ACTION_OWNER })}>${inner}</button>`;
  });
  return `<${tag} class="${className}">${buttons.join('')}</${tag}>`;
}

/** A `title`/`description` block shared by card, section, form and upload. */
function titleBlock(props, ctx, { titleClass = 'wf-block-title', level = null } = {}) {
  const title = str(props?.title);
  const description = str(props?.description);
  const actions = actionButtons(props?.actions, ctx);
  if (!title && !description && !actions) return '';
  const resolved = title
    ? resolveAttributeValue(title, ctx.bindingContext || {}, ctx.stateBindings, 'title')
    : '';
  const heading = resolved
    ? (level
      ? `<h${level} class="${titleClass}">${bound(resolved, ctx)}</h${level}>`
      : `<div class="${titleClass}">${bound(resolved, ctx)}</div>`)
    : '';
  const sub = description ? `<div class="wf-block-desc">${bound(description, ctx)}</div>` : '';
  const text = heading || sub ? `<div class="wf-block-text">${heading}${sub}</div>` : '';
  return `<header class="wf-block-head">${text}${actions}</header>`;
}

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed, index) {
  let hash = 2166136261;
  const source = `${seed}:${index}`;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

/** Initials for avatars: up to two letters, deterministic. */
function initials(name) {
  const parts = str(name).split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const lib = {
  isObject,
  escapeHtml,
  escapeAttr,
  renderSkeleton,
  renderBoundText,
  resolveAttributeValue,
  normalizeChildren,
  toSafeClass,
  renderImageElement,
  renderSelectOptions,
  navigationAttrs,
  stateAttrs,
  STATE_OWNERS,
  normalizeItems,
  resolveSelection,
  itemProfiles,
  textProp,
  str,
  num,
  bound,
  boundOrSkeleton,
  icon,
  iconSpan,
  items,
  actionButtons,
  titleBlock,
  seeded,
  initials,
  scale,
  token,
};

module.exports = lib;
