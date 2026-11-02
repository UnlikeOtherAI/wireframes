'use strict';

const { frameClass } = require('../schema/primitive-registry');

// The one place that decides whether a node draws a visible box.
//
//   surface  a framed container (card, panel, modal, region)
//   group    a layout wrapper: spacing and alignment only, never a border
//   control  element-owned chrome (inputs, buttons) that nesting never changes
//   content  bare content (text, icons, images)
//   edge     a single divider edge (tab bars, app bars, rules), never a box
//
// Only `surface` draws a container frame and only `surface` increases depth.

const CONTAINER_ROLES = new Set(['header', 'app_bar', 'sidebar', 'nav', 'footer', 'toolbar', 'tabbar', 'aside']);

const CONTROL_ELEMENTS = new Set([
  'button', 'segmented', 'input', 'textarea', 'select',
  'checkbox', 'radio', 'toggle', 'choice_group', 'tags_input',
]);

// `C` elements that own internal strokes, so they must never double-frame
// inside a surface even though they are framed at the top level.
const SELF_STROKED = new Set(['table', 'list', 'tree', 'accordion', 'kanban']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function decide(frame, rule, reason) {
  return { frame, rule, reason };
}

function unframedKind(element) {
  if (CONTROL_ELEMENTS.has(element)) return 'control';
  if (element === 'stack' || element === 'row' || element === 'grid' || element === 'split' || element === 'form') {
    return 'group';
  }
  return 'content';
}

/**
 * @param {object} node   the resolved node
 * @param {object} ctx    { element, isRegionRoot, regionKind, role, surfaceDepth,
 *                          parentLayoutType, parentIsGrid, parentDivides,
 *                          hasPane, isOverlayRoot, isOverlayChild }
 * @returns {{frame: string, rule: number, reason: string}}
 */
function decideFrame(node, ctx = {}) {
  const element = typeof ctx.element === 'string' ? ctx.element : '';
  const depth = Number.isInteger(ctx.surfaceDepth) && ctx.surfaceDepth > 0 ? ctx.surfaceDepth : 0;

  // 1. The author said so.
  if (node && node.surface === true) return decide('surface', 1, 'explicit:true');
  if (node && node.surface === false) return decide('group', 1, 'explicit:false');

  // 2. The author drew a border, so they want a box.
  if (isObject(node?.wireframeStyle) && isObject(node.wireframeStyle.border)) {
    return decide('surface', 2, 'explicit:style');
  }

  // 3. The element type settles it, unless the registry says `C`.
  const klass = ctx.isRegionRoot ? null : frameClass(element);
  if (klass === 'S') return decide('surface', 3, `element:${element}`);
  if (klass === 'E') return decide('edge', 3, `element:${element}`);
  if (klass === 'N') return decide(unframedKind(element), 3, `element:${element}`);

  // 4. Overlay chrome owns the frame; its content must not double-box.
  if (ctx.isOverlayRoot === true) return decide('surface', 4, 'overlay-root');
  if (ctx.isOverlayChild === true && depth > 0) return decide('group', 4, 'overlay-chrome');

  // 5. Template regions.
  if (ctx.isRegionRoot === true) {
    if (ctx.regionKind === 'slot') return decide('group', 5, 'region:slot');
    const role = typeof ctx.role === 'string' && ctx.role.trim() !== '' ? ctx.role.trim() : null;
    if (role && !CONTAINER_ROLES.has(role) && role !== 'main' && role !== 'content') {
      return decide('surface', 5, `region:${role}`);
    }
    if (role === 'main' || role === 'content') return decide('group', 5, `region:${role}`);
    return decide('surface', 5, role ? `region:${role}` : 'region:persistent');
  }

  // 6. A pane is a panel.
  if (ctx.hasPane === true) return decide('surface', 6, 'pane');

  // 7. A divided parent draws the strokes, so children must not.
  if (ctx.parentDivides === true) return decide('group', 7, 'divided-child');

  // 8. Tiles are tiles, at any depth.
  if (ctx.parentIsGrid === true) return decide('surface', 8, 'grid-tile');

  // 9. Inside a frame nothing auto-frames. Use `card` to be explicit.
  if (depth > 0) {
    return SELF_STROKED.has(element)
      ? decide('group', 9, 'nested:self-stroked')
      : decide('group', 9, 'nested');
  }

  // 10. At the top of a page: rows align, they do not contain.
  if (element === 'section' || element === '') {
    const layoutType = isObject(node?.layout) ? node.layout.type : undefined;
    const hasTitle = typeof node?.props?.title === 'string' && node.props.title.trim() !== '';
    if (layoutType === 'row' && !hasTitle) return decide('group', 10, 'row-group');
    if (ctx.role === 'toolbar') return decide('group', 10, 'role:toolbar');
  }

  return decide('surface', 10, 'top-level');
}

/** Explanation text for `wf why` and `data-wf-why`. */
const RULE_TEXT = {
  1: 'the node sets `surface:` explicitly',
  2: 'the node sets a border in `wireframeStyle`',
  3: 'the element type always renders this way',
  4: 'overlay chrome owns the frame',
  5: 'template region kind and role',
  6: 'the node is a pane',
  7: 'the parent draws separators between its children',
  8: 'the parent is a grid, so children are tiles',
  9: 'already inside a framed container',
  10: 'top level of the page',
};

function explainFrame(decision) {
  if (!isObject(decision)) return '';
  return RULE_TEXT[decision.rule] || decision.reason || '';
}

module.exports = {
  decideFrame,
  explainFrame,
  CONTAINER_ROLES,
};
