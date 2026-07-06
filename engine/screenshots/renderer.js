'use strict';

const { renderNode, renderNodes } = require('../renderer/primitives');
const { buildInteractionRuntime } = require('../renderer/interactions');
const {
  layoutToCss,
  shouldRenderParentSeparators,
} = require('../renderer/layout');
const {
  readLocalImage,
  mergeWireframeStyle,
  wireframeRootStyle,
} = require('../renderer/wireframe-styles');
const { buildWireframeStyles } = require('../renderer/styles');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function toSafeClass(value) {
  return String(value || 'container')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function separatorClass(layout) {
  if (!shouldRenderParentSeparators(layout)) return '';
  const type = layout.type || 'stack';
  return type === 'row' ? ' wf-divide-x' : ' wf-divide-y';
}

function renderRoot(root, options) {
  if (!isObject(root)) {
    return '';
  }

  if (root.kind === 'overlay') {
    return renderNode({
      id: root.id,
      kind: 'overlay',
      type: root.type,
      trigger: root.trigger,
      placement: root.placement,
      dismissOn: root.dismissOn,
      size: root.size,
      children: Array.isArray(root.nodes) ? root.nodes : [],
      wireframeStyle: root.wireframeStyle,
    }, {
      ...options,
      routeId: options.routeId || '',
      pageStyle: isObject(options.pageStyle) ? options.pageStyle : {},
      dataSources: options.dataSources || {},
      parentLayoutType: 'stack',
      surfaceDepth: 0,
    });
  }

  const rootLabel = root.kind
    ? `${root.kind}: ${root.id || root.injectableId || root.slotId || 'root'}`
    : root.id || 'root';
  const children = Array.isArray(root.nodes) ? root.nodes : Array.isArray(root.children) ? root.children : [];
  const rootStyleBase = isObject(options.pageStyle) ? options.pageStyle : {};
  const localPageStyle = mergeWireframeStyle(rootStyleBase, root.wireframeStyle);
  const rootLayout = isObject(root.layout) ? root.layout : {};
  const rootLayoutType = rootLayout.type || 'stack';
  const content = renderNodes(children, {
    ...options,
    routeId: options.routeId || '',
    pageStyle: localPageStyle,
    dataSources: options.dataSources || {},
    parentLayoutType: rootLayoutType,
    surfaceDepth: root.kind === 'slot' ? 0 : 1,
  });

  const rootStyle = wireframeRootStyle(options.pageStyle, root.wireframeStyle, options.rendering);
  const styleAttr = rootStyle ? ` style="${escapeAttr(rootStyle)}"` : '';

  const bodyLayoutCss = layoutToCss(rootLayout, {}, { density: options.density });
  const bodyDividerClass = separatorClass(rootLayout);
  const bodyStyle = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';

  const isOverlay = root.kind === 'overlay';
  const isSlot = root.kind === 'slot';
  const kindClass = isOverlay ? 'wf-root-overlay' : 'wf-root-container';
  const slotClass = isSlot ? ' wf-root-slot' : '';
  const surfaceClass = (isOverlay || isSlot) ? '' : ' wf-surface';

  const stickyAttr = (root.sticky === 'top' || root.sticky === 'bottom')
    ? ` data-sticky="${escapeAttr(root.sticky)}"`
    : '';

  return `<section class="wf-root ${kindClass}${slotClass}${surfaceClass}"${styleAttr}${stickyAttr}>
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body${bodyDividerClass}"${bodyStyle}>${content}</div>
    </section>`;
}

function renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType, bodyLayout = {}) {
  const stickyTop = roots.filter((r) => r.sticky === 'top');
  const stickyBottom = roots.filter((r) => r.sticky === 'bottom');
  const bodyRoots = roots.filter((r) => r.sticky !== 'top' && r.sticky !== 'bottom');

  const topHtml = stickyTop.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bottomHtml = stickyBottom.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bodyHtml = bodyRoots.map((r) => renderRoot(r, renderOptions)).join('\n');

  const bodyClass = bodyLayoutType === 'stack' ? 'wf-body-column' : 'wf-body-row';
  const bodyLayoutCss = layoutToCss(bodyLayout, {}, { density: renderOptions.density });
  const bodyStyleAttr = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';

  return `<div class="wf-page" style="width:${viewportWidth}px;min-height:${viewportHeight}px;">
  ${topHtml}
  <div class="${bodyClass}"${bodyStyleAttr}>
    ${bodyHtml}
  </div>
  ${bottomHtml}
</div>`;
}

function renderWireframeMarkup({
  roots = [],
  pageViewport,
  pageRouteId = '',
  routeTable = {},
  appStateDefaults = {},
  pageStateDefaults = {},
  pageStyle = {},
  defaultGridColumns = 12,
  projectPath,
  dataSources = {},
  frame = null,
  wireframeCssHref = null,
  fontAwesomeCssHref = null,
  runtimeContext = null,
  runtimeJsSrc = null,
  assetUrlPrefix = '',
  rendering = {},
  bodyLayoutType = 'row',
  bodyLayout = {},
  imageResolver = null,
}) {
  const mode = rendering?.mode === 'line' ? 'line' : 'card';
  const density = rendering?.density === 'compact' ? 'compact' : 'comfortable';

  const viewportWidth = Number.isFinite(pageViewport?.width) ? pageViewport.width : 1280;
  const viewportHeight = Number.isFinite(pageViewport?.height) ? pageViewport.height : 900;
  const shellTop = Number.isFinite(frame?.top) ? frame.top : 0;
  const shellLeft = Number.isFinite(frame?.left) ? frame.left : 0;
  const shellWidth = Number.isFinite(frame?.width) && frame.width > 0 ? frame.width : viewportWidth;
  const shellHeight = Number.isFinite(frame?.height) && frame.height > 0 ? frame.height : viewportHeight;

  const renderOptions = {
    pageStyle,
    projectPath,
    dataSources,
    defaultGridColumns,
    assetUrlPrefix,
    routeId: pageRouteId,
    mode,
    density,
    rendering,
    imageResolver,
  };

  let shellMarkup;
  if (frame) {
    // Screenshot / device frame: fixed viewport, overflow:hidden to clip to device bounds.
    // Use renderPageShell for correct sticky/body-row structure inside the device viewport.
    const bgColor = mode === 'card' ? '#f3f4f6' : '#ffffff';
    const wireframeScreenStyle = [
      `width:${viewportWidth}px`,
      `height:${viewportHeight}px`,
      `background:${bgColor}`,
      'overflow:hidden',
      'position:absolute',
      `left:${shellLeft}px`,
      `top:${shellTop}px`,
    ].join(';');
    const pageHtml = renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType, bodyLayout);
    shellMarkup = `<div id="wf-screenshot-shell" style="position:relative; width:${Math.max(shellWidth, viewportWidth + shellLeft)}px; height:${Math.max(shellHeight, viewportHeight + shellTop)}px;">
  <img id="wf-frame-image" src="${frame.imageData ? escapeHtml(frame.imageData) : ''}" alt="device frame" />
  <div id="wf-wireframe-shell" style="${wireframeScreenStyle}">
    ${pageHtml}
  </div>
</div>`;
  } else {
    // Browser mode: natural scroll, min-height, sticky header/footer support
    shellMarkup = renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType, bodyLayout);
  }

  const runtimeContextPayload = runtimeContext && typeof runtimeContext === 'object' && !Array.isArray(runtimeContext)
    ? runtimeContext
    : null;
  const runtimeScript = runtimeJsSrc
    ? `${runtimeContextPayload ? `<script>window.WF_RUNTIME_CONTEXT = ${JSON.stringify(runtimeContextPayload)};</script>\n` : ''}<script src="${escapeAttr(runtimeJsSrc)}"></script>`
    : `<script>${buildInteractionRuntime({
      routeId: pageRouteId,
      routeTable,
      appStateDefaults,
      pageStateDefaults,
      platform: pageViewport?.device || 'web',
    })}</script>`;

  const styles = buildWireframeStyles();
  const styleMarkup = wireframeCssHref
    ? `<link rel="stylesheet" href="${escapeAttr(wireframeCssHref)}" />`
    : `<style>${styles}</style>`;

  const faHref = typeof fontAwesomeCssHref === 'string' && fontAwesomeCssHref.trim() !== ''
    ? fontAwesomeCssHref
    : './_shared/fa/css/all.min.css';
  const fontAwesomeLink = `<link rel="stylesheet" href="${escapeAttr(faHref)}" />`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe ${escapeHtml(pageStyle?.title || 'capture')}</title>
    ${fontAwesomeLink}
    ${styleMarkup}
  </head>
  <body class="wf wf-mode-${escapeAttr(mode)}">
    ${shellMarkup}
    ${runtimeScript}
  </body>
</html>`;
}

module.exports = {
  renderWireframeMarkup,
  buildWireframeStyles,
  readLocalImage,
  renderNodes,
  renderNode,
};
