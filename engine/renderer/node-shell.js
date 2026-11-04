'use strict';

const { layoutToCss, layoutItemCss, absoluteChildStyle } = require('./layout');
const { surfaceElevationOverride, wireframeNodeStyleOverrides } = require('./wireframe-styles');
const { decideFrame } = require('./frame-rules');
const { token, scale } = require('./sizing-tokens');
const { buildNodeDataAttributes, joinAttrs, navigationAttrs, sourceAttrs } = require('./render-attrs');
const { isObject, toSafeClass, paneMetaToStyle } = require('./render-utils');
const { frameClass, resolvePrimitiveName } = require('../schema/primitive-registry');

// Elements that get a structural size from a token rather than from the author.
const ELEMENT_SIZING = {
  stat: (viewport, sizing) => {
    const min = token('stat.minHeight', viewport, sizing);
    return min ? `min-height:${min}px` : '';
  },
  chart: (viewport, sizing) => {
    const height = token('chart.height', viewport, sizing);
    return height ? `min-height:${height}px` : '';
  },
};

// Gap and padding defaults per element, so authors rarely set layout by hand.
const LAYOUT_DEFAULTS = {
  grid: { type: 'grid', gapToken: 'grid.gap' },
  row: { type: 'row', gapToken: 'card.gap', align: 'center' },
  stack: { type: 'stack', gapToken: 'card.gap' },
  split: { type: 'row', gapToken: 'card.gap', align: 'stretch' },
  form: { type: 'stack', gapToken: 'card.gap' },
  card: { type: 'stack', gapToken: 'card.gap' },
  section: { type: 'stack', gapToken: 'card.gap' },
  kanban: { type: 'row', gapToken: 'card.gap', align: 'stretch' },
  carousel: { type: 'row', gapToken: 'card.gap', align: 'stretch' },
};

function hasChildren(node) {
  return Array.isArray(node.children) && node.children.length > 0;
}

function elementLayout(element, node, viewport, sizing) {
  const preset = LAYOUT_DEFAULTS[element];
  const authored = isObject(node.layout) ? node.layout : {};
  if (!preset) return authored;

  const props = isObject(node.props) ? node.props : {};
  const layout = { type: preset.type, ...authored };
  if (layout.gap == null) {
    layout.gap = props.gap != null ? props.gap : (token(preset.gapToken, viewport, sizing) || 16);
  }
  if (props.padding != null && layout.padding == null) layout.padding = props.padding;
  if (props.align != null && layout.align == null) layout.align = props.align;
  else if (preset.align && layout.align == null) layout.align = preset.align;
  if (props.justify != null && layout.justify == null) layout.justify = props.justify;
  if (element === 'grid' && layout.columns == null && props.columns != null) layout.columns = props.columns;
  if (element === 'split' && props.orientation != null) layout.type = props.orientation;
  if (element === 'form' && props.columns != null) {
    layout.type = 'grid';
    layout.columns = props.columns;
  }
  return layout;
}

// In a row, content should keep its natural width and fields should share what
// is left. Without this a heading next to a search box wraps to two lines while
// the select beside it sprawls.
const ROW_INTRINSIC = new Set([
  'heading', 'text', 'badge', 'avatar', 'icon', 'button', 'rating', 'progress',
  'breadcrumb', 'pagination', 'segmented', 'checkbox', 'radio', 'toggle', 'divider',
]);
const ROW_FLEXIBLE = new Set(['input', 'select', 'textarea', 'tags_input', 'search']);

function rowFlexStyle(element, node, ctx) {
  if (ctx.parentLayoutType !== 'row') return '';
  const size = isObject(node.size) ? node.size : {};
  if (size.width != null || isObject(node.gridItem)) return '';
  if (ROW_INTRINSIC.has(element)) return 'flex:0 0 auto';
  // A field in a row grows into the space, but only so far: a zoom select
  // should not eat a toolbar. Override with size.width.
  if (ROW_FLEXIBLE.has(element)) return 'flex:1 1 auto;min-width:0;max-width:320px';
  return '';
}

// A row of controls is a toolbar and should wrap. A row that lays out panels,
// tables or sized children is structure, and must keep its columns.
const ROW_STRUCTURAL = new Set([
  'section', 'card', 'stack', 'row', 'grid', 'split', 'form', 'carousel',
  'table', 'list', 'chart', 'calendar', 'kanban', 'tree', 'accordion',
  'editor', 'upload', 'picker', 'image', 'empty_state', 'code', 'skeleton',
]);

function isToolbarRow(node) {
  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length < 2) return false;
  return children.every((child) => {
    if (!isObject(child)) return false;
    if (child.use || child.injectable) return false;
    const name = resolvePrimitiveName(String(child.component || '')) || String(child.component || '');
    // A flexible spacer is the hallmark of a toolbar, not a sized panel.
    if (name === 'spacer') return true;
    if (isObject(child.pane) || isObject(child.size) || isObject(child.gridItem)) return false;
    return name !== '' && !ROW_STRUCTURAL.has(name);
  });
}

function wrapStyle(element, node, decision, ctx) {
  const parts = [];
  const props = isObject(node.props) ? node.props : {};

  const rowFlex = rowFlexStyle(element, node, ctx);
  if (rowFlex) parts.push(rowFlex);

  // A toolbar wraps rather than running off the side of the page. A row of
  // panels must not, or a two-pane layout would stack, so this only applies
  // when every child is an intrinsic-width control.
  const layoutType = isObject(node.layout) ? node.layout.type : (element === 'row' ? 'row' : null);
  if (layoutType === 'row' && props.nowrap !== true) {
    if (props.wrap === true || isToolbarRow(node)) parts.push('flex-wrap:wrap');
  }
  if (element === 'grid' && props.minItemWidth != null) {
    const min = Number(props.minItemWidth);
    if (Number.isFinite(min)) {
      parts.push(`grid-template-columns:repeat(auto-fit,minmax(${min}px,1fr))`);
    }
  }
  // A frame needs breathing room, unless the element draws its own insets.
  const SELF_PADDED = new Set(['table', 'list', 'calendar', 'accordion', 'tree', 'code', 'carousel', 'alert', 'upload', 'editor', 'empty_state', 'stat']);
  if (decision.frame === 'surface' && !SELF_PADDED.has(element)) {
    const authoredPadding = isObject(node.layout) ? node.layout.padding : (props.padding);
    if (authoredPadding == null) {
      const padding = token('card.padding', ctx.viewport, ctx.sizing);
      if (padding) parts.push(`padding:${padding}px`);
    }
  }
  const elementSizing = ELEMENT_SIZING[element];
  if (elementSizing) {
    const css = elementSizing(ctx.viewport, ctx.sizing);
    if (css) parts.push(css);
  }
  return parts.join(';');
}

/**
 * Everything the shell needs to open and close a node: classes, inline style,
 * data attributes and the frame decision.
 */
function buildShell(node, element, ctx) {
  const layout = elementLayout(element, node, ctx.viewport, ctx.sizing);
  const size = isObject(node.size) ? node.size : {};
  const paneData = ctx.paneData;

  const decision = decideFrame(node, {
    element,
    surfaceDepth: ctx.surfaceDepth,
    parentLayoutType: ctx.parentLayoutType,
    parentIsGrid: ctx.parentIsGrid,
    parentDivides: ctx.parentDivides,
    hasPane: paneData != null,
    isOverlayChild: ctx.isOverlayChild,
    role: typeof node.role === 'string' ? node.role.trim() : undefined,
  });

  // A leaf with no authored layout has nothing to lay out; emitting flexbox for
  // it only fights the element's own CSS.
  const wantsLayout = hasChildren(node) || isObject(node.layout) || LAYOUT_DEFAULTS[element] != null;
  const layoutCss = wantsLayout
    ? layoutToCss(layout, size, { defaultGridColumns: ctx.defaultGridColumns, density: ctx.density })
    : layoutToCss({ type: 'none' }, size, { defaultGridColumns: ctx.defaultGridColumns, density: ctx.density });

  const outerOnly = [
    layoutItemCss(isObject(node.gridItem) ? node.gridItem : {}),
    absoluteChildStyle(node.position, ctx.parentLayoutType),
    paneMetaToStyle(paneData),
    surfaceElevationOverride(node.elevation, ctx.rendering),
    wrapStyle(element, node, decision, ctx),
    wireframeNodeStyleOverrides(isObject(node.wireframeStyle) ? node.wireframeStyle : {}, ctx.pageStyle, ctx.rendering),
  ].filter(Boolean).join(';');

  const style = [layoutCss, outerOnly].filter(Boolean).join(';');

  // Used when the element renders its own head block and the children need
  // their own layout box: the outer becomes a plain column.
  const gap = layout.gap != null ? Number(layout.gap) : null;
  const stackStyle = [
    `display:flex;flex-direction:column;gap:${Number.isFinite(gap) ? Math.min(gap, 16) : 12}px`,
    layoutToCss({ type: 'none' }, size, {}),
    outerOnly,
  ].filter(Boolean).join(';');

  const classes = ['wf-node', `wf-${toSafeClass(element || 'container')}`];
  if (decision.frame === 'surface') classes.push('wf-surface');
  else if (decision.frame === 'group') classes.push('wf-group');
  if (Array.isArray(node.interaction) && node.interaction.length > 0) classes.push('wf-interactive');
  if (isObject(node.selection)) classes.push('wf-selectable');
  if (paneData && typeof paneData.side === 'string') {
    classes.push('wf-pane', `wf-pane-${toSafeClass(paneData.side)}`);
  }
  if (typeof node.role === 'string' && node.role.trim() !== '') {
    classes.push(`wf-role-${toSafeClass(node.role.trim())}`);
  }

  const attrs = [`data-wf-frame="${decision.frame}"`];
  const corner = node.wireframeStyle?.corner?.style || ctx.pageStyle?.corner?.style;
  if (corner === 'pill') attrs.push('data-wf-corner="pill"');
  if (ctx.explain === true) {
    attrs.push(`data-wf-why="${decision.rule}:${decision.reason}"`);
  }
  if (ctx.parentDivides === true) attrs.push('data-wf-edge="after"');
  const source = sourceAttrs(node, ctx).trim();
  if (source) attrs.push(source);

  return { decision, layout, layoutCss, style, stackStyle, classes, attrs };
}

function openTag(tag, node, shell, extraClass, extraStyle, dataAttrs, overrideStyle) {
  const classes = extraClass ? `${shell.classes.join(' ')} ${extraClass}` : shell.classes.join(' ');
  const style = [overrideStyle || shell.style, extraStyle].filter(Boolean).join(';');
  return `<${tag}${joinAttrs(node.id, classes, style, shell.attrs)}${dataAttrs}>`;
}

module.exports = {
  buildShell,
  openTag,
  elementLayout,
  frameClass,
  resolvePrimitiveName,
  buildNodeDataAttributes,
  navigationAttrs,
  scale,
};
