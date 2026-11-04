'use strict';

const { mergeAppearance } = require('../design-system/resolve');
const { skinPaintStyles } = require('../design-system/paint');

const { renderNode, renderNodes } = require('../renderer/primitives');
const { sourceAttrs } = require('../renderer/render-attrs');
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
const { adaptiveStyles } = require('../renderer/styles/adaptive');
const { decideFrame } = require('../renderer/frame-rules');
const { regionSizingCss, token } = require('../renderer/sizing-tokens');
const { normalizePlatform, statusBarMarkup, homeIndicatorMarkup } = require('../renderer/platform');
const { resolvePrimitiveName } = require('../schema/primitive-registry');

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
      // The overlay's own chrome — its title and footer actions.
      props: isObject(root.props) ? root.props : {},
      children: Array.isArray(root.nodes) ? root.nodes : [],
      wireframeStyle: root.wireframeStyle,
    }, {
      ...options,
      routeId: options.routeId || '',
      pageStyle: isObject(options.pageStyle) ? options.pageStyle : {},
      dataSources: options.dataSources || {},
      parentLayoutType: 'stack',
    });
  }

  const rootLabel = root.kind
    ? `${root.kind}: ${root.id || root.injectableId || root.slotId || 'root'}`
    : root.id || 'root';
  const children = Array.isArray(root.nodes) ? root.nodes : Array.isArray(root.children) ? root.children : [];
  const rootStyleBase = isObject(options.pageStyle) ? options.pageStyle : {};
  const localPageStyle = options.skin
    ? mergeAppearance(rootStyleBase, root.wireframeStyle)
    : mergeWireframeStyle(rootStyleBase, root.wireframeStyle);
  const rootLayout = isObject(root.layout) ? root.layout : {};
  const rootLayoutType = rootLayout.type || 'stack';
  const isOverlay = root.kind === 'overlay';
  const isSlot = root.kind === 'slot';
  const role = typeof root.role === 'string' && root.role.trim() !== '' ? root.role.trim() : null;

  const decision = decideFrame(root, {
    element: '',
    isRegionRoot: true,
    regionKind: root.kind,
    role,
    surfaceDepth: 0,
  });
  const rootRendersSurface = decision.frame === 'surface';

  const content = renderNodes(children, {
    ...options,
    routeId: options.routeId || '',
    pageStyle: localPageStyle,
    dataSources: options.dataSources || {},
    parentLayoutType: rootLayoutType,
    parentLayoutIsGrid: rootLayoutType === 'grid',
    parentDivides: shouldRenderParentSeparators(rootLayout),
    surfaceDepth: rootRendersSurface ? 1 : 0,
  });

  // Region proportions: the author's `size` wins; otherwise the role's token
  // supplies a width/height and stops the region collapsing to content width.
  const sizeCss = layoutToCss({ type: 'none' }, isObject(root.size) ? root.size : {}, {});
  const roleCss = regionSizingCss(role, root.size, options.viewport, options.sizing);
  const padCss = rootRendersSurface && rootLayout.padding == null
    ? `padding:${token('card.padding', options.viewport, options.sizing) || 16}px`
    : '';

  const rootStyle = [
    wireframeRootStyle(options.pageStyle, root.wireframeStyle, options.rendering),
    sizeCss,
    roleCss,
    padCss,
  ].filter(Boolean).join(';');
  const styleAttr = rootStyle ? ` style="${escapeAttr(rootStyle)}"` : '';

  // Bottom chrome runs to the foot of the region: it keeps the gutter above it
  // but not below, and it shifts a floating action button clear of itself.
  const hasTabBar = children.some((child) => (
    isObject(child) && resolvePrimitiveName(child.component) === 'bottom_tab_bar'
  ));
  const tabBarClass = hasTabBar ? ' wf-root-has-tabbar' : '';
  const bodyLayoutCss = layoutToCss(rootLayout, {}, { density: options.density });
  const bodyDividerClass = separatorClass(rootLayout);
  const bodyDivides = shouldRenderParentSeparators(rootLayout)
    ? ` data-wf-divides="${rootLayoutType === 'row' ? 'row' : 'stack'}"`
    : '';
  const bodyInline = [bodyLayoutCss, hasTabBar ? 'padding-bottom:0' : ''].filter(Boolean).join(';');
  const bodyStyle = bodyInline ? ` style="${escapeAttr(bodyInline)}"` : '';

  const kindClass = isOverlay ? 'wf-root-overlay' : 'wf-root-container';
  const slotClass = isSlot ? ' wf-root-slot' : '';
  const surfaceClass = rootRendersSurface ? ' wf-surface' : ' wf-group';
  const roleClass = role ? ` wf-role-${toSafeClass(role)}` : '';

  const stickyAttr = (root.sticky === 'top' || root.sticky === 'bottom')
    ? ` data-sticky="${escapeAttr(root.sticky)}"`
    : '';
  const frameAttr = ` data-wf-frame="${decision.frame}"${
    options.explain === true ? ` data-wf-why="${escapeAttr(`${decision.rule}:${decision.reason}`)}"` : ''
  }`;

  const rootId = typeof root.id === 'string' && root.id.trim() !== '' ? ` id="${escapeAttr(root.id.trim())}"` : '';

  return `<section${rootId}${sourceAttrs(root, options)} class="wf-root ${kindClass}${slotClass}${surfaceClass}${roleClass}${tabBarClass}"${styleAttr}${stickyAttr}${frameAttr}>
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body${bodyDividerClass}"${bodyStyle}${bodyDivides}>${content}</div>
    </section>`;
}

function renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType, bodyLayout = {}) {
  const platform = renderOptions.platform || 'web';
  const stickyTop = roots.filter((r) => r.sticky === 'top');
  const stickyBottom = roots.filter((r) => r.sticky === 'bottom');
  const bodyRoots = roots.filter((r) => r.sticky !== 'top' && r.sticky !== 'bottom');

  const topHtml = stickyTop.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bottomHtml = stickyBottom.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bodyHtml = bodyRoots.map((r) => renderRoot(r, renderOptions)).join('\n');

  const bodyClass = bodyLayoutType === 'stack' ? 'wf-body-column' : 'wf-body-row';
  const bodyLayoutCss = layoutToCss(
    isObject(bodyLayout) ? bodyLayout : {},
    {},
    { defaultGridColumns: renderOptions.defaultGridColumns, density: renderOptions.density },
  );
  const bodyStyle = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';

  return `<div class="wf-page" style="width:${viewportWidth}px;min-height:${viewportHeight}px;">
  ${renderOptions.deviceChrome === false ? '' : statusBarMarkup(platform)}
  ${topHtml}
  <div class="${bodyClass}"${bodyStyle}>
    ${bodyHtml}
  </div>
  ${bottomHtml}
  ${renderOptions.deviceChrome === false ? '' : homeIndicatorMarkup(platform)}
</div>`;
}

/** Token values the stylesheet reads, so CSS never hard-codes a platform size. */
function platformVars(renderOptions) {
  const viewport = renderOptions.viewport;
  const sizing = renderOptions.sizing;
  const vars = [
    ['--wf-control-h', token('control.height', viewport, sizing)],
    ['--wf-row-h', token('row.height', viewport, sizing)],
    ['--wf-header-h', token('header.height', viewport, sizing)],
    ['--wf-tabbar-h', token('tabbar.height', viewport, sizing)],
    ['--wf-gutter', token('page.gutter', viewport, sizing)],
    ['--wf-card-pad', token('card.padding', viewport, sizing)],
    ['--wf-chart-h', token('chart.height', viewport, sizing)],
    ['--wf-statusbar-h', token('statusbar.height', viewport, sizing)],
  ];
  return vars.filter(([, value]) => Number.isFinite(value)).map(([name, value]) => `${name}:${value}px`).join(';');
}

function renderWireframeMarkup({
  roots = [],
  pageViewport,
  pageRouteId = '',
  routeTable = {},
  appStateDefaults = {},
  pageStateDefaults = {},
  pageStyle = {},
  skin = null,
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
  sizing = {},
  explain = false,
  annotateSource = false,
  deviceChrome = true,
  adaptTo = null,
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
    annotateSource,
    deviceChrome,
    pageStyle,
    skin,
    projectPath,
    dataSources,
    defaultGridColumns,
    assetUrlPrefix,
    routeId: pageRouteId,
    routeTable,
    mode,
    density,
    rendering,
    imageResolver,
    viewport: pageViewport,
    platform: normalizePlatform(pageViewport?.platform, pageViewport?.device),
    sizing,
    explain: explain === true || rendering?.explain === true,
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

  const styles = adaptTo ? `${buildWireframeStyles()}\n${adaptiveStyles}` : buildWireframeStyles();
  const adaptClass = adaptTo ? ` wf-adapt-${escapeAttr(adaptTo)}` : '';
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
    ${styleMarkup}${skin ? '<style>' + skinPaintStyles + '</style>' : ''}
  </head>
  <body class="wf${adaptClass} wf-mode-${escapeAttr(mode)} wf-platform-${escapeAttr(renderOptions.platform)} wf-density-${escapeAttr(density)}" style="${escapeAttr(platformVars(renderOptions))}">
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
