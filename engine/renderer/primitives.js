'use strict';

const { shouldRenderParentSeparators } = require('./layout');
const { readLocalImage } = require('./wireframe-styles');
const { PRIMITIVE_COMPONENTS } = require('../schema/primitives');
const { resolvePrimitiveName } = require('../schema/primitive-registry');
const { renderOverlay } = require('./overlay-renderer');
const { PRIMITIVE_RENDERERS } = require('./primitives/index');
const { buildShell, openTag } = require('./node-shell');
const lib = require('./render-lib');
const {
  isObject,
  isBoundSelectionValue,
  cloneNode,
  suffixNodeIds,
  renderCollectionNode,
  normalizeChildren,
  normalizePane,
  getPathValue,
  resolveCollectionItems,
  escapeAttr,
  nodeComponent,
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

// Elements whose own children are laid out by the element, not the shell.
const SELF_LAID_OUT = new Set([
  'tab_bar', 'bottom_tab_bar', 'nav', 'menu', 'breadcrumb', 'pagination',
  'stepper', 'app_bar', 'page_header', 'table', 'list', 'chart', 'calendar',
  'kanban', 'tree', 'accordion', 'alert', 'stat', 'empty_state', 'upload', 'editor',
]);

function surfaceDepthOf(options) {
  return Number.isInteger(options.surfaceDepth) && options.surfaceDepth > 0 ? options.surfaceDepth : 0;
}

/**
 * Children wrapper. `display:contents` by default, so children take part in the
 * node's own layout. When the element also renders a head block, the wrapper
 * becomes a real box carrying the layout, so the head is not laid out as a
 * sibling of the children (a grid head would otherwise become a grid cell).
 */
function renderChildren(node, options, layout, bodyStyle) {
  const children = normalizeChildren(node);
  if (children.length === 0) {
    return '';
  }
  const resolved = isObject(layout) ? layout : (isObject(node.layout) ? node.layout : {});
  const layoutType = resolved.type || 'stack';
  const style = bodyStyle ? ` style="${escapeAttr(bodyStyle)}"` : '';
  return `<div class="wf-node-children"${style}>${renderNodes(children, {
    ...options,
    parentLayoutType: layoutType,
    parentLayoutIsGrid: layoutType === 'grid',
    parentDivides: shouldRenderParentSeparators(resolved),
  })}</div>`;
}

// Kept for the overlay renderer and any caller still on the old helper bag.
const sharedFns = {
  buildNodeClasses,
  buildNodeDataAttributes,
  joinAttrs,
  escapeAttr,
  escapeHtml: lib.escapeHtml,
  renderChildren: (node, options) => renderChildren(node, options),
  renderBoundText: lib.renderBoundText,
  renderSkeleton: lib.renderSkeleton,
  getPathValue,
  resolveCollectionItems,
  resolveAttributeValue: lib.resolveAttributeValue,
  navigationAttrs,
  renderImageElement,
  renderSectionTitle,
  renderSelectOptions,
  paneMetaToStyle: require('./render-utils').paneMetaToStyle,
  isObject,
  toSafeClass: lib.toSafeClass,
};

function renderNode(node, options = {}) {
  if (!isObject(node)) {
    return '';
  }

  const rawComponent = String(node.component || '');
  const element = resolvePrimitiveName(rawComponent) || rawComponent;
  const props = isObject(node.props) ? node.props : {};
  const parentLayoutType = options.parentLayoutType || 'stack';
  const paneData = normalizePane(node.pane, parentLayoutType);

  // Collections clone the node per item before anything else is decided.
  const collectionData = element === 'table' ? null : renderCollectionNode(node, options);
  if (collectionData) {
    return collectionData.items
      .map((item, index) => {
        const clone = cloneNode(collectionData.cloned);
        if (!isObject(clone)) return '';
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

  if (node.kind === 'overlay') {
    return renderOverlay(node, { ...options, surfaceDepth: 0 }, '', sharedFns);
  }

  const shellCtx = {
    surfaceDepth: surfaceDepthOf(options),
    parentLayoutType,
    parentIsGrid: options.parentLayoutIsGrid === true,
    parentDivides: options.parentDivides === true,
    isOverlayChild: options.isOverlayChild === true,
    paneData,
    defaultGridColumns: Number.isInteger(options.defaultGridColumns) ? options.defaultGridColumns : undefined,
    density: options.density,
    rendering: options.rendering,
    pageStyle: options.pageStyle,
    viewport: options.viewport,
    sizing: options.sizing,
    explain: options.explain === true,
  };

  const shell = buildShell(node, element, shellCtx);
  const stateBindings = isObject(node.stateBindings) ? { ...node.stateBindings } : {};
  const dataAttrs = buildNodeDataAttributes(node, stateBindings, options.selectionValue, paneData);
  const navigationTarget = primaryNavigationTarget(node, options);

  const childOptions = {
    ...options,
    isOverlayChild: false,
    surfaceDepth: shellCtx.surfaceDepth + (shell.decision.frame === 'surface' ? 1 : 0),
  };

  const renderCtx = {
    bindingContext: {
      routeId: options.routeId || '',
      props,
      item: options.itemContext || {},
      itemVar: options.itemVar || 'item',
    },
    stateBindings,
    routeTable: isObject(options.routeTable) ? options.routeTable : {},
    projectPath: options.projectPath || '',
    imageOptions: {
      assetUrlPrefix: typeof options.assetUrlPrefix === 'string' ? options.assetUrlPrefix : '',
      imageResolver: options.imageResolver,
    },
    parentLayoutType,
    navigationTarget,
    navAttrs: () => (navigationTarget ? ` ${navigationAttrs(navigationTarget).join(' ')}` : ''),
    link: (body) => (navigationTarget
      ? `<a class="wf-inline-link"${navigationTarget ? ` ${navigationAttrs(navigationTarget).join(' ')}` : ''}>${body}</a>`
      : body),
    tableRows: (tableNode, tableProps) => {
      const collection = resolveCollectionItems(tableNode.binding, options);
      if (Array.isArray(collection.items) && collection.items.length > 0) return collection.items;
      return Array.isArray(tableProps?.rows) ? tableProps.rows : [];
    },
    cellValue: (row, key) => {
      if (Array.isArray(row)) return row[Number(key)] ?? null;
      return getPathValue(isObject(row) ? row : {}, key);
    },
  };

  const renderer = PRIMITIVE_COMPONENTS.has(element) ? PRIMITIVE_RENDERERS[element] : null;
  const result = renderer ? renderer(node, renderCtx, lib) : { inner: '', useChildren: true };
  const normalized = typeof result === 'string' ? { inner: result } : (result || {});

  const tag = normalized.tag || 'div';
  const wantsChildren = normalized.useChildren === true || !renderer;
  const hasOwnMarkup = (normalized.inner || '') !== '' || (normalized.after || '') !== '';
  const splitBody = hasOwnMarkup && wantsChildren;

  const children = wantsChildren || !SELF_LAID_OUT.has(element)
    ? renderChildren(node, childOptions, shell.layout, splitBody ? shell.layoutCss : null)
    : '';

  const outerStyle = splitBody ? shell.stackStyle : null;
  const open = openTag(tag, node, shell, normalized.className, normalized.style, dataAttrs, outerStyle);
  return `${open}${normalized.inner || ''}${children}${normalized.after || ''}</${tag}>`;
}

function renderNodes(nodes, options = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }
  return nodes.map((node) => renderNode(node, options)).join('\n');
}

module.exports = {
  renderNode,
  renderNodes,
  readLocalImage,
  nodeComponent,
};
