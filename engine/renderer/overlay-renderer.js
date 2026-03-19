'use strict';

const { toPx } = require('./layout');

const OVERLAY_TYPES = new Set([
  'modal',
  'alert',
  'dropdown',
  'popover',
  'menu',
  'drawer_left',
  'drawer_right',
  'bottom_sheet',
  'toast',
  'tooltip',
]);

const OVERLAY_BACKDROP_TYPES = new Set([
  'modal',
  'alert',
  'drawer_left',
  'drawer_right',
  'bottom_sheet',
]);

const OVERLAY_Z_INDEX = {
  dropdown: 100,
  popover: 100,
  menu: 100,
  tooltip: 100,
  modal: 200,
  drawer_left: 200,
  drawer_right: 200,
  bottom_sheet: 200,
  toast: 400,
  alert: 400,
};

const OVERLAY_PLACEMENTS = new Set(['top', 'bottom', 'left', 'right', 'center']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function overlayTypeNeedsBackdrop(type) {
  return OVERLAY_BACKDROP_TYPES.has(type);
}

function overlayTypeStyle(type, placement) {
  const normalizedPlacement = OVERLAY_PLACEMENTS.has(placement) ? placement : 'bottom';
  const zIndex = Object.prototype.hasOwnProperty.call(OVERLAY_Z_INDEX, type) ? OVERLAY_Z_INDEX[type] : 100;

  if (type === 'modal' || type === 'alert') {
    return [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'drawer_left') {
    return [
      'position:fixed',
      'top:0',
      'left:0',
      'bottom:0',
      'width:280px',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'drawer_right') {
    return [
      'position:fixed',
      'top:0',
      'right:0',
      'bottom:0',
      'width:280px',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'bottom_sheet') {
    return [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'toast') {
    const style = [
      'position:fixed',
      'left:16px',
      'min-width:220px',
      'display:none',
      `z-index:${zIndex}`,
    ];
    if (normalizedPlacement === 'bottom') {
      style.push('bottom:16px');
    } else {
      style.push('top:16px');
    }
    return style.join(';');
  }

  if (type === 'dropdown' || type === 'popover' || type === 'menu' || type === 'tooltip') {
    const style = [
      'position:fixed',
      'display:none',
      'z-index:' + zIndex,
    ];
    return style.join(';');
  }

  return ['position:fixed', 'display:none', `z-index:${zIndex}`].join(';');
}

function overlaySizeStyle(size) {
  if (!isObject(size)) return '';
  const parts = [];
  if (size.width != null) parts.push(`width:${toPx(size.width)}`);
  if (size.height != null) parts.push(`height:${toPx(size.height)}`);
  if (size.minWidth != null) parts.push(`min-width:${toPx(size.minWidth)}`);
  if (size.maxWidth != null) parts.push(`max-width:${toPx(size.maxWidth)}`);
  if (size.minHeight != null) parts.push(`min-height:${toPx(size.minHeight)}`);
  if (size.maxHeight != null) parts.push(`max-height:${toPx(size.maxHeight)}`);
  return parts.join(';');
}

/**
 * Render an overlay node.
 *
 * @param {object} node - The overlay node.
 * @param {object} options - Render options.
 * @param {string} childStyle - Pre-computed child style string.
 * @param {object} ctx - Shared rendering utilities from primitives.js:
 *   { toSafeClass, buildNodeClasses, buildNodeDataAttributes, joinAttrs, escapeAttr, renderChildren }
 */
function renderOverlay(node, options, childStyle, ctx) {
  const overlayType = typeof node.type === 'string' && OVERLAY_TYPES.has(node.type) ? node.type : 'overlay';
  const overlayPlacement = typeof node.placement === 'string' ? node.placement : '';
  const overlayClassList = [
    'wf-overlay',
    `wf-overlay-${ctx.toSafeClass(overlayType)}`,
    ...ctx.buildNodeClasses(node).split(' ').filter(Boolean),
  ];
  const overlayClasses = Array.from(new Set(overlayClassList.filter((value) => value !== 'wf-node'))).join(' ');

  const overlayStyle = [childStyle, overlayTypeStyle(overlayType, overlayPlacement)]
    .filter(Boolean)
    .join(';');
  const stateBindings = isObject(node.stateBindings) ? { ...node.stateBindings } : {};
  const dataAttrs = ctx.buildNodeDataAttributes(node, stateBindings);
  const children = ctx.renderChildren(node, options);
  const backdrop = overlayTypeNeedsBackdrop(overlayType)
    ? '<div class="wf-overlay-backdrop" aria-hidden="true" style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:none;"></div>'
    : '';

  const contentSizeStyle = overlaySizeStyle(node.size);
  const contentStyleAttr = contentSizeStyle ? ` style="${ctx.escapeAttr(contentSizeStyle)}"` : '';

  return `<div${ctx.joinAttrs(node.id, overlayClasses, overlayStyle)}${dataAttrs}>${backdrop}<div class="wf-overlay-content"${contentStyleAttr}>${children}</div></div>`;
}

module.exports = {
  OVERLAY_TYPES,
  OVERLAY_BACKDROP_TYPES,
  OVERLAY_Z_INDEX,
  OVERLAY_PLACEMENTS,
  overlayTypeNeedsBackdrop,
  overlayTypeStyle,
  overlaySizeStyle,
  renderOverlay,
};
