'use strict';

const {
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
  shouldRenderParentSeparators,
} = require('./layout');
const {
  surfaceElevationOverride,
  wireframeNodeStyleOverrides,
  readLocalImage,
} = require('./wireframe-styles');
const { PRIMITIVE_COMPONENTS } = require('../schema/primitives');
const { renderOverlay } = require('./overlay-renderer');
const { renderChart } = require('./chart-renderer');
const { renderTable } = require('./table-renderer');
const { PRIMITIVE_RENDERERS } = require('./node-primitives');
const {
  isObject,
  isBoundSelectionValue,
  cloneNode,
  suffixNodeIds,
  renderCollectionNode,
  normalizeChildren,
  normalizePane,
  paneMetaToStyle,
  renderBoundText,
  resolveAttributeValue,
  resolveCollectionItems,
  getPathValue,
  escapeHtml,
  escapeAttr,
  renderSkeleton,
  toSafeClass,
} = require('./render-utils');
const {
  buildNodeDataAttributes,
  buildNodeClasses,
  joinAttrs,
  primaryNavigationTarget,
  navigationAttrs,
  renderImageElement,
  renderSectionTitle,
  renderSelectOptions,
} = require('./render-attrs');

const BORDERLESS_PRIMITIVES = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'icon',
  'button',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'toggle',
  'chart',
  'table',
  'divider',
  'spacer',
  // section gets its border from wf-surface CSS (mode-specific); no inline border
  'section',
  'tab_bar',
  'bottom_tab_bar',
]);

const wfNodeBorderStyle = 'border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-corner-radius,0px)';

function surfaceDepth(options = {}) {
  return Number.isInteger(options.surfaceDepth) && options.surfaceDepth > 0 ? options.surfaceDepth : 0;
}

function shouldRenderSurface(node, primitiveName, options = {}) {
  if (!['section', 'table'].includes(primitiveName)) {
    return typeof node?.surface === 'boolean' ? node.surface : null;
  }
  if (node?.surface === true) {
    return true;
  }
  if (node?.surface === false) {
    return false;
  }
  return surfaceDepth(options) === 0 || options.parentLayoutIsGrid === true;
}

function countsAsSurfaceForDepth(primitiveName, isSurface, paneData) {
  if (primitiveName === 'tab_bar' || primitiveName === 'bottom_tab_bar') {
    return false;
  }
  return isSurface === true || paneData != null;
}

function sectionBodyDividerClass(layout) {
  if (!shouldRenderParentSeparators(layout)) return '';
  const type = layout.type || 'stack';
  return type === 'row' ? ' wf-divide-x' : ' wf-divide-y';
}

function renderChildren(node, options) {
  const children = normalizeChildren(node);
  if (children.length === 0) {
    return '';
  }

  const layoutType = isObject(node.layout) ? node.layout.type || 'stack' : 'stack';
  return `<div class="wf-node-children">${renderNodes(children, {
    ...options,
    parentLayoutType: layoutType,
    parentLayoutIsGrid: layoutType === 'grid',
  })}</div>`;
}

// Shared functions passed to extracted renderers so they can use shared utilities
// without circular dependencies.
const sharedFns = {
  toSafeClass,
  buildNodeClasses,
  buildNodeDataAttributes,
  joinAttrs,
  escapeAttr,
  escapeHtml,
  renderChildren,
  renderBoundText,
  renderSkeleton,
  getPathValue,
  resolveCollectionItems,
  resolveAttributeValue,
  navigationAttrs,
  renderImageElement,
  renderSectionTitle,
  renderSelectOptions,
  paneMetaToStyle,
  isObject,
};

function renderNode(node, options = {}) {
  if (!isObject(node)) {
    return '';
  }

  const component = node.component;
  const primitiveName = String(component || '');
  const isBorderless = BORDERLESS_PRIMITIVES.has(primitiveName);
  const props = isObject(node.props) ? node.props : {};
  const layout = isObject(node.layout) ? node.layout : {};
  const size = isObject(node.size) ? node.size : {};
  const gridItem = isObject(node.gridItem) ? node.gridItem : {};
  const defaultGridColumns = Number.isInteger(options.defaultGridColumns)
    ? options.defaultGridColumns
    : undefined;
  const nodeStyle = isObject(node.wireframeStyle) ? node.wireframeStyle : {};
  const nodeWireframeOverrides = wireframeNodeStyleOverrides(nodeStyle, options.pageStyle, options.rendering);
  const parentLayoutType = options.parentLayoutType || 'stack';
  const paneData = normalizePane(node.pane, parentLayoutType);
  const projectPath = options.projectPath || '';
  const stateBindings = isObject(node.stateBindings) ? { ...node.stateBindings } : {};
  const selectionValue = options.selectionValue;
  const bindingContext = {
    routeId: options.routeId || '',
    props,
    item: options.itemContext || {},
    itemVar: options.itemVar || 'item',
  };
  const navigationTarget = primaryNavigationTarget(node, options);

  const collectionData = primitiveName === 'table' ? null : renderCollectionNode(node, options);
  if (collectionData) {
    return collectionData.items
      .map((item, index) => {
        const clone = cloneNode(collectionData.cloned);
        if (!isObject(clone)) {
          return '';
        }
        suffixNodeIds(clone, String(index));
        const primaryKey = collectionData.primaryKey;
        const nextSelectionValue = isBoundSelectionValue(isObject(item) ? item[primaryKey] : undefined)
          ? item[primaryKey]
          : options.selectionValue;
        return renderNode(clone, {
          ...options,
          selectionValue: nextSelectionValue,
          itemContext: isObject(item) ? item : {},
          itemVar: collectionData.bindingItemVar,
        });
      })
      .join('\n');
  }

  const childStyle = [
    layoutToCss(layout, size, { defaultGridColumns, density: options.density }),
    layoutItemCss(gridItem),
    absoluteChildStyle(node.position, parentLayoutType),
    paneMetaToStyle(paneData),
    surfaceElevationOverride(node.elevation, options.rendering),
    // In mode contexts, CSS mode rules own all border/background — skip inline border.
    (isBorderless || options.mode) ? '' : wfNodeBorderStyle,
    nodeWireframeOverrides,
  ].filter(Boolean).join(';');

  const isOverlayRoot = node.kind === 'overlay';
  const paneSide = paneData ? paneData.side : null;
  const isSurface = shouldRenderSurface(node, primitiveName, options);
  const childOptions = {
    ...options,
    surfaceDepth: surfaceDepth(options) + (countsAsSurfaceForDepth(primitiveName, isSurface, paneData) ? 1 : 0),
  };

  if (isOverlayRoot) {
    return renderOverlay(node, { ...options, surfaceDepth: 0 }, childStyle, sharedFns);
  }

  if (primitiveName && PRIMITIVE_COMPONENTS.has(primitiveName)) {
    // Delegate to chart/table extracted renderers
    if (primitiveName === 'chart') {
      const extraCtx = { bindingContext, paneSide, stateBindings, selectionValue, paneData };
      return renderChart(node, props, childStyle, options, sharedFns, extraCtx);
    }
    if (primitiveName === 'table') {
      const extraCtx = { bindingContext, paneSide, stateBindings, selectionValue, paneData, isSurface };
      return renderTable(node, props, childStyle, options, sharedFns, extraCtx);
    }

    // Delegate to node-primitives extracted renderers
    const primitiveRenderer = PRIMITIVE_RENDERERS[primitiveName];
    if (primitiveRenderer) {
      const headingLevel = Number.isInteger(props.level) ? props.level : 3;
      const safeHeadingLevel = Math.max(1, Math.min(6, headingLevel));
      const ctx = {
        node, props, layout, size, gridItem, defaultGridColumns, options,
        childOptions,
        childStyle, paneSide, stateBindings, selectionValue, paneData,
        bindingContext, navigationTarget, safeHeadingLevel, projectPath,
        parentLayoutType, isBorderless, nodeWireframeOverrides, wfNodeBorderStyle,
        isSurface,
      };
      return primitiveRenderer(ctx, sharedFns);
    }
  }

  const childNodes = renderChildren(node, childOptions);
  const dataAttrs = buildNodeDataAttributes(node, stateBindings, selectionValue, paneData);
  const classes = buildNodeClasses(node, primitiveName, null, paneSide, isSurface);
  return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${childNodes}</div>`;
}

function renderNodes(nodes, options = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  return nodes
    .map((node) => renderNode(node, options))
    .join('\n');
}

module.exports = {
  renderNode,
  renderNodes,
  readLocalImage,
};
