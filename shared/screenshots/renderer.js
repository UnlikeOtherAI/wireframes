'use strict';

const path = require('node:path');

const { renderNode, renderNodes } = require(path.resolve(__dirname, '..', 'renderer', 'primitives'));
const { buildInteractionRuntime } = require(path.resolve(__dirname, '..', 'renderer', 'interactions'));
const { layoutToCss } = require(path.resolve(__dirname, '..', 'renderer', 'layout'));
const {
  readLocalImage,
  mergeWireframeStyle,
  wireframeRootStyle,
} = require(path.resolve(__dirname, '..', 'renderer', 'wireframe-styles'));

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
  if (!isObject(layout) || layout.separators !== 'between') return '';
  const type = layout.type || 'stack';
  return type === 'row' ? ' wf-divide-x' : ' wf-divide-y';
}

function renderRoot(root, options) {
  if (!isObject(root)) {
    return '';
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
  });

  const rootStyle = wireframeRootStyle(options.pageStyle, root.wireframeStyle);
  const styleAttr = rootStyle ? ` style="${escapeAttr(rootStyle)}"` : '';

  const bodyLayoutCss = layoutToCss(rootLayout, {});
  const bodyDividerClass = separatorClass(rootLayout);
  const bodyStyle = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';

  const isOverlay = root.kind === 'overlay';
  const kindClass = isOverlay ? 'wf-root-overlay' : 'wf-root-container';
  const surfaceClass = isOverlay ? '' : ' wf-surface';

  const stickyAttr = (root.sticky === 'top' || root.sticky === 'bottom')
    ? ` data-sticky="${escapeAttr(root.sticky)}"`
    : '';

  return `<section class="wf-root ${kindClass}${surfaceClass}"${styleAttr}${stickyAttr}>
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body${bodyDividerClass}"${bodyStyle}>${content}</div>
    </section>`;
}

function buildWireframeStyles() {
  return [
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:Arial,sans-serif}',

    // --- Mode: page background ---
    '.wf-mode-line{background:#ffffff}',
    '.wf-mode-card{background:#f3f4f6}',

    // --- Page shell ---
    // Flex column, centered at device width, min-height (not fixed height — browser scrolls it)
    '.wf-page{display:flex;flex-direction:column;margin:0 auto}',
    // Body row: fill remaining height, stretch all children (sidebars fill full height)
    '.wf-body-row{flex:1;display:flex;flex-direction:row;align-items:stretch;min-height:0}',

    // --- Sticky regions ---
    '.wf-root[data-sticky="top"]{position:sticky;top:0;z-index:10;flex-shrink:0}',
    '.wf-root[data-sticky="bottom"]{position:sticky;bottom:0;z-index:10;flex-shrink:0}',

    // --- Root wrappers ---
    '.wf-root{border:none;padding:0;margin:0}',
    '.wf-root-title{display:none}',
    '.wf-root-body{display:block}',
    '.wf-node-children{display:contents}',

    // --- Surface: template regions, section components ---
    // Line mode: transparent bg, single outline (outline doesn't affect box model)
    '.wf-mode-line .wf-surface{background:transparent;outline:1px solid #4b5563}',
    // Card mode: white card with border and subtle shadow
    '.wf-mode-card .wf-surface{background:#ffffff;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.08)}',

    // --- Structural nodes (non-borderless) ---
    // Fallback (no mode class): original behaviour
    '.wf-node{background:#fff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-corner-radius,0px);padding:6px;margin:4px;min-height:22px}',
    // Line mode: transparent bg, dark stroke
    '.wf-mode-line .wf-node{background:transparent;border-color:#4b5563}',
    // Card mode: white bg, light stroke
    '.wf-mode-card .wf-node{background:#ffffff;border-color:#d1d5db}',

    // --- Borderless primitives (no box) ---
    '.wf-heading,.wf-paragraph,.wf-text,.wf-image,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-toggle{border:none;background:transparent;padding:2px 0;min-height:0}',
    '.wf-button,.wf-checkbox,.wf-toggle{width:fit-content}',

    // --- Buttons: mode-specific styling ---
    // Line mode: bordered label (schematic)
    '.wf-mode-line .wf-button button{background:transparent;border:1px solid #4b5563;color:#111827;padding:4px 10px;font-size:13px;border-radius:2px;cursor:default;font-family:inherit}',
    // Card mode: filled grey block
    '.wf-mode-card .wf-button button{background:#e5e7eb;border:none;color:#374151;padding:6px 12px;font-size:13px;font-weight:500;border-radius:var(--wf-corner-radius,6px);cursor:default;font-family:inherit;min-height:32px}',
    // Fallback button (no mode)
    '.wf-button button{cursor:default;font-family:inherit}',

    // --- Inputs: mode-specific styling ---
    '.wf-mode-line .wf-input input,.wf-mode-line .wf-textarea textarea,.wf-mode-line .wf-select select{border:1px solid #4b5563;background:transparent;padding:4px 8px;font-family:inherit}',
    '.wf-mode-card .wf-input input,.wf-mode-card .wf-textarea textarea,.wf-mode-card .wf-select select{border:1px solid #d1d5db;background:#ffffff;padding:6px 10px;border-radius:4px;font-family:inherit}',

    // --- Sections ---
    '.wf-section-title{display:none}',
    '.wf-section-body{min-height:10px}',
    '.wf-node-section{padding:4px}',

    // --- Other primitives ---
    '.wf-divider{border:none;border-top:1px solid #9ca3af;margin:8px 0}',
    '.wf-mode-line .wf-divider{border-top-color:#4b5563}',
    '.wf-mode-card .wf-divider{border-top-color:#e5e7eb}',
    '.wf-spacer{min-height:12px;background:transparent;border:none}',
    '.wf-heading,.wf-paragraph,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-toggle,.wf-section,.wf-text{margin:4px 0}',
    '.wf-img,.wf-image img{max-width:100%;max-height:100%;display:block}',
    '.wf-image-placeholder{padding:16px;border:1px dashed #9ca3af;background:#f9fafb;text-align:center;color:#9ca3af}',
    '.wf-toggle-track{display:inline-block;width:32px;height:16px;border:1px solid #666;border-radius:12px;position:relative;vertical-align:middle;margin-right:8px}',
    '.wf-toggle-thumb{position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#333}',

    // --- Panes ---
    '.wf-pane-left,.wf-pane-center,.wf-pane-right{display:block}',
    '.wf-pane-right{margin-left:auto}',
    '.wf-pane-center{flex:1 1 auto;min-width:0}',
    '.wf-pane[data-wf-pane-collapsed="true"]{overflow:hidden}',

    // --- Screenshot shell ---
    '#wf-screenshot-shell{position:relative;}',
    '#wf-frame-image{display:block;max-width:none;max-height:none;}',
    '#wf-wireframe-shell{overflow:hidden}',

    // --- Separators between siblings (layout.separators: between) ---
    '.wf-divide-x>*+*{border-left:1px solid var(--wf-divider-color,#9ca3af)}',
    '.wf-divide-y>*+*{border-top:1px solid var(--wf-divider-color,#9ca3af)}',
    '.wf-mode-line .wf-divide-x>*+*,.wf-mode-line .wf-divide-y>*+*{--wf-divider-color:#9ca3af}',
    '.wf-mode-card .wf-divide-x>*+*,.wf-mode-card .wf-divide-y>*+*{--wf-divider-color:#e5e7eb}',

    // --- Interactions / state ---
    '.wf-visible{display:block !important;}',
    '.wf-selected{outline:2px solid #2563eb;outline-offset:1px;}',
    '.wf-gesture-pulse{position:relative;}',
    '.wf-gesture-pulse:after{content:"";position:absolute;inset:0;border:2px solid rgba(0,102,204,0.7);animation:wfPulse 250ms ease-out forwards;pointer-events:none;}',
    '@keyframes wfPulse{from{transform:scale(1);opacity:0.8;}to{transform:scale(1.05);opacity:0;}}',
    '.wf-runtime-toast{position:fixed;right:16px;top:16px;padding:8px 10px;border:1px solid #333;background:#fff;color:#000;z-index:600;font-family:Arial,sans-serif;font-size:12px;max-width:420px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,0.15);}',
  ].join('\n');
}

function renderPageShell(roots, viewportWidth, viewportHeight, renderOptions) {
  const stickyTop = roots.filter((r) => r.sticky === 'top');
  const stickyBottom = roots.filter((r) => r.sticky === 'bottom');
  const bodyRoots = roots.filter((r) => r.sticky !== 'top' && r.sticky !== 'bottom');

  const topHtml = stickyTop.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bottomHtml = stickyBottom.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bodyHtml = bodyRoots.map((r) => renderRoot(r, renderOptions)).join('\n');

  return `<div class="wf-page" style="width:${viewportWidth}px;min-height:${viewportHeight}px;">
  ${topHtml}
  <div class="wf-body-row">
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
  runtimeContext = null,
  runtimeJsSrc = null,
  assetUrlPrefix = '',
  rendering = {},
}) {
  const mode = rendering?.mode === 'card' ? 'card' : 'line';

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
  };

  let shellMarkup;
  if (frame) {
    // Screenshot / device frame: fixed viewport, overflow:auto for Playwright capture
    const wireframeScreenStyle = [
      `width:${viewportWidth}px`,
      `height:${viewportHeight}px`,
      'background:#fff',
      'overflow:auto',
      'position:absolute',
      `left:${shellLeft}px`,
      `top:${shellTop}px`,
    ].join(';');
    const contentStyle = `width:${viewportWidth}px;height:${viewportHeight}px;position:relative;`;
    const rootsHtml = roots.map((r) => renderRoot(r, renderOptions)).join('\n');
    shellMarkup = `<div id="wf-screenshot-shell" style="position:relative; width:${Math.max(shellWidth, viewportWidth + shellLeft)}px; height:${Math.max(shellHeight, viewportHeight + shellTop)}px;">
  <img id="wf-frame-image" src="${frame.imageData ? escapeHtml(frame.imageData) : ''}" alt="device frame" />
  <div id="wf-wireframe-shell" style="${wireframeScreenStyle}">
    <div id="wf-wireframe-content" style="${contentStyle}">${rootsHtml}</div>
  </div>
</div>`;
  } else {
    // Browser mode: natural scroll, min-height, sticky header/footer support
    shellMarkup = renderPageShell(roots, viewportWidth, viewportHeight, renderOptions);
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

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe ${escapeHtml(pageStyle?.title || 'capture')}</title>
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
