'use strict';

const path = require('node:path');

const { renderNode, renderNodes } = require(path.resolve(__dirname, '..', 'renderer', 'primitives'));
const { buildInteractionRuntime } = require(path.resolve(__dirname, '..', 'renderer', 'interactions'));
const {
  layoutToCss,
  shouldRenderParentSeparators,
} = require(path.resolve(__dirname, '..', 'renderer', 'layout'));
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
  const surfaceClass = isOverlay ? '' : ' wf-surface';

  const stickyAttr = (root.sticky === 'top' || root.sticky === 'bottom')
    ? ` data-sticky="${escapeAttr(root.sticky)}"`
    : '';

  return `<section class="wf-root ${kindClass}${slotClass}${surfaceClass}"${styleAttr}${stickyAttr}>
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body${bodyDividerClass}"${bodyStyle}>${content}</div>
    </section>`;
}

function buildWireframeStyles() {
  return [
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:system-ui,sans-serif}',

    // --- Mode: page background ---
    '.wf-mode-line{background:#ffffff}',
    '.wf-mode-card{background:#f3f4f6}',

    // --- Page shell ---
    // Flex column, centered at device width, min-height (not fixed height — browser scrolls it)
    '.wf-page{display:flex;flex-direction:column;margin:0 auto}',
    '.wf-mode-card .wf-page{padding:16px;gap:16px}',
    // Body row: fill remaining height, stretch all children (sidebars fill full height)
    '.wf-body-row{flex:1;display:flex;flex-direction:row;align-items:stretch;min-height:0}',
    // Body column: stack template — regions stack vertically
    '.wf-body-column{flex:1;display:flex;flex-direction:column;min-height:0}',
    '.wf-mode-card .wf-body-row,.wf-mode-card .wf-body-column{gap:16px}',

    // --- Sticky regions ---
    '.wf-root[data-sticky="top"]{position:sticky;top:0;z-index:10;flex-shrink:0}',
    '.wf-root[data-sticky="bottom"]{position:sticky;bottom:0;z-index:10;flex-shrink:0}',

    // --- Root wrappers ---
    '.wf-root{border:none;padding:0;margin:0}',
    '.wf-root-slot{flex:1;min-width:0}',
    '.wf-root-title{display:none}',
    '.wf-root-body{display:block}',
    '.wf-node-children{display:contents}',

    // --- Surface: template regions, section components ---
    // Line mode: transparent bg, single outline (outline doesn't affect box model)
    '.wf-mode-line .wf-surface{background:transparent;outline:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;border-radius:var(--wf-surface-radius,0px)}',
    // Card mode: white card with border and subtle shadow
    '.wf-mode-card .wf-surface{background:#ffffff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #e5e7eb;box-shadow:var(--wf-surface-shadow,0 1px 3px rgba(0,0,0,0.08));border-radius:var(--wf-surface-radius,4px)}',

    // --- Structural nodes ---
    // Fallback (no mode class): retain original bordered appearance for any context without a mode
    '.wf-node{background:#fff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-surface-radius,0px);padding:6px;margin:4px;min-height:22px}',

    // In both rendering modes, only explicit surfaces (wf-surface) show frames.
    // Generic container nodes are transparent layout wrappers — no border, no background.
    // This prevents frames appearing on labels, wrappers, and other non-frame containers.
    '.wf-mode-line .wf-node:not(.wf-surface){border:none;background:transparent}',
    '.wf-mode-card .wf-node:not(.wf-surface){border:none;background:transparent}',

    // Explicit surface treatment (sections + template regions) — mode-specific borders
    '.wf-mode-line .wf-node.wf-surface{border:none;background:transparent;box-shadow:none;outline:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;border-radius:var(--wf-surface-radius,0px)}',
    '.wf-mode-card .wf-node.wf-surface{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #e5e7eb;background:#ffffff;box-shadow:var(--wf-surface-shadow,0 1px 3px rgba(0,0,0,0.08));border-radius:var(--wf-surface-radius,4px)}',

    // --- Borderless primitives (no box) ---
    '.wf-heading,.wf-paragraph,.wf-text,.wf-image,.wf-icon,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-radio,.wf-toggle{border:none;background:transparent;padding:2px 0;min-height:0}',
    '.wf-icon{display:inline-flex;align-items:center;justify-content:center;color:#374151}',
    '.wf-button,.wf-checkbox,.wf-radio,.wf-toggle{width:fit-content}',
    '.wf-button i.fa-solid,.wf-button i.fa-regular,.wf-button i.fa-brands{margin-right:4px}',
    '.wf-interactive{cursor:pointer}',
    '.wf-inline-link{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.wf-button-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit}',

    // --- Buttons: mode-specific styling ---
    // Line mode: bracketed label with no box
    '.wf-mode-line .wf-button button,.wf-mode-line .wf-button .wf-button-link{background:transparent;border:none;color:#111827;padding:0;font-size:13px;cursor:pointer;font-family:inherit}',
    // Card mode: filled grey block — min-height:32px, min-width:64px per spec hit-target sizing
    '.wf-mode-card .wf-button button,.wf-mode-card .wf-button .wf-button-link{background:#e5e7eb;border:none;color:#374151;padding:6px 12px;font-size:13px;font-weight:500;border-radius:var(--wf-corner-radius,6px);cursor:pointer;font-family:inherit;min-height:32px;min-width:64px}',
    // Fallback button (no mode)
    '.wf-button button,.wf-button .wf-button-link{cursor:pointer;font-family:inherit}',

    // --- Tab bars (in-page tabs — buttons not stretched) ---
    '.wf-tab-bar{padding:0;margin:0;overflow:hidden}',
    '.wf-tab-bar-body{min-height:0}',
    '.wf-tab-bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',
    '.wf-tab-bar .wf-button,.wf-tab-bar .wf-section,.wf-tab-bar .wf-text{margin:0}',
    '.wf-mode-card .wf-tab-bar .wf-button .wf-button-link,.wf-mode-card .wf-tab-bar .wf-button button{min-width:0;border-radius:0;background:#f3f4f6}',
    '.wf-mode-line .wf-tab-bar .wf-button .wf-button-link,.wf-mode-line .wf-tab-bar .wf-button button{min-width:0}',

    // --- Bottom tab bar (iOS-style — buttons stretched, icon above text) ---
    '.wf-bottom-tab-bar{padding:0;margin:0;overflow:hidden}',
    '.wf-bottom-tab-bar-body{min-height:0}',
    '.wf-bottom-tab-bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',
    '.wf-bottom-tab-bar .wf-node-children>*{flex:1 1 0;min-width:0}',
    '.wf-bottom-tab-bar .wf-button,.wf-bottom-tab-bar .wf-section,.wf-bottom-tab-bar .wf-text{margin:0}',
    '.wf-bottom-tab-bar .wf-button,.wf-bottom-tab-bar .wf-button .wf-button-link,.wf-bottom-tab-bar .wf-button button{width:100%}',
    '.wf-mode-card .wf-bottom-tab-bar .wf-button .wf-button-link,.wf-mode-card .wf-bottom-tab-bar .wf-button button{min-width:0;border-radius:0;background:#f3f4f6}',
    '.wf-mode-line .wf-bottom-tab-bar .wf-button .wf-button-link,.wf-mode-line .wf-bottom-tab-bar .wf-button button{min-width:0}',
    '.wf-bottom-tab-bar .wf-button button,.wf-bottom-tab-bar .wf-button .wf-button-link{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;font-size:11px}',
    '.wf-bottom-tab-bar .wf-button i{margin-right:0;font-size:16px}',

    // --- Tables ---
    '.wf-table{padding:0;margin:0;overflow:hidden}',
    '.wf-table-grid{display:grid;align-items:center;min-width:0}',
    '.wf-table-header{font-size:12px;font-weight:600;border-bottom:1px solid var(--wf-divider-color,#d1d5db)}',
    '.wf-table-body{display:block}',
    '.wf-table-row{min-width:0}',
    '.wf-table-body>.wf-table-row+.wf-table-row{border-top:1px solid var(--wf-divider-color,#e5e7eb)}',
    '.wf-table-cell{padding:10px 12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wf-table-header-cell{color:#374151}',
    '.wf-table-body>.wf-table-row:nth-child(odd){background:#ffffff}',
    '.wf-table-body>.wf-table-row:nth-child(even){background:#f8fafc}',
    '.wf-mode-line .wf-table-header{background:#f9fafb}',
    '.wf-mode-line .wf-table-body>.wf-table-row:nth-child(even){background:#f9fafb}',
    '.wf-mode-card .wf-table-header{background:#f3f4f6}',
    '.wf-table-row-empty .wf-table-cell{grid-column:1 / -1;color:#6b7280}',

    // --- Inputs: mode-specific styling ---
    '.wf-mode-line .wf-input input,.wf-mode-line .wf-textarea textarea,.wf-mode-line .wf-select select{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;background:transparent;padding:4px 8px;font-family:inherit}',
    '.wf-mode-card .wf-input input,.wf-mode-card .wf-textarea textarea,.wf-mode-card .wf-select select{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #d1d5db;background:#ffffff;padding:6px 10px;border-radius:var(--wf-surface-radius,4px);font-family:inherit}',

    // --- Sections ---
    '.wf-section-title{display:none}',
    '.wf-section-body{min-height:10px}',
    '.wf-section{padding:4px}',

    // --- Other primitives ---
    '.wf-divider{border:none;border-top:1px solid #9ca3af;margin:8px 0}',
    '.wf-mode-line .wf-divider{border-top-color:#4b5563}',
    '.wf-mode-card .wf-divider{border-top-color:#e5e7eb}',
    '.wf-spacer{min-height:12px;background:transparent;border:none}',
    '.wf-heading,.wf-paragraph,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-radio,.wf-toggle,.wf-section,.wf-text{margin:4px 0}',
    '.wf-img,.wf-image img{max-width:100%;max-height:100%;display:block}',
    '.wf-image-placeholder{padding:16px;border:1px solid #9ca3af;background:linear-gradient(to top right,transparent calc(50% - 1px),#d1d5db,transparent calc(50% + 1px)),linear-gradient(to top left,transparent calc(50% - 1px),#d1d5db,transparent calc(50% + 1px));text-align:center;color:#9ca3af;min-height:80px;display:flex;align-items:center;justify-content:center}',
    '.wf-chart{border:none;background:transparent;padding:4px 0}',
    '.wf-chart-svg{width:100%;max-height:160px;display:block}',
    '.wf-chart-title{font-size:12px;color:#666;margin-bottom:4px}',
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
    '.wf-divide-x>*+*,.wf-divide-x>.wf-node-children>*+*{border-left:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-divide-y>*+*,.wf-divide-y>.wf-node-children>*+*{border-top:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-mode-line .wf-divide-x>*+*,.wf-mode-line .wf-divide-y>*+*,.wf-mode-line .wf-divide-x>.wf-node-children>*+*,.wf-mode-line .wf-divide-y>.wf-node-children>*+*{--wf-divider-color:#9ca3af}',
    '.wf-mode-card .wf-divide-x>*+*,.wf-mode-card .wf-divide-y>*+*,.wf-mode-card .wf-divide-x>.wf-node-children>*+*,.wf-mode-card .wf-divide-y>.wf-node-children>*+*{--wf-divider-color:#e5e7eb}',

    // Suppress surface borders on direct children of separator containers:
    // the divider line IS the visual separation — individual child borders would double it.
    // These rules must appear after the mode-specific surface rules (same specificity, source order wins).
    '.wf-divide-x>.wf-surface,.wf-divide-y>.wf-surface,.wf-divide-x>.wf-node-children>.wf-surface,.wf-divide-y>.wf-node-children>.wf-surface{outline:none;border:none;box-shadow:none}',
    '.wf-divide-x>.wf-node.wf-surface,.wf-divide-y>.wf-node.wf-surface,.wf-divide-x>.wf-node-children>.wf-node.wf-surface,.wf-divide-y>.wf-node-children>.wf-node.wf-surface{border:none;box-shadow:none}',
    '.wf-divide-x>.wf-surface+.wf-surface,.wf-divide-x>.wf-node.wf-surface+.wf-node.wf-surface,.wf-divide-x>.wf-node-children>.wf-surface+.wf-surface,.wf-divide-x>.wf-node-children>.wf-node.wf-surface+.wf-node.wf-surface{border-left:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-divide-y>.wf-surface+.wf-surface,.wf-divide-y>.wf-node.wf-surface+.wf-node.wf-surface,.wf-divide-y>.wf-node-children>.wf-surface+.wf-surface,.wf-divide-y>.wf-node-children>.wf-node.wf-surface+.wf-node.wf-surface{border-top:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',

    // --- Interactions / state ---
    '.wf-visible{display:flex !important;}',
    '.wf-overlay-modal.wf-visible,.wf-overlay-alert.wf-visible{align-items:center;justify-content:center}',
    '.wf-overlay-content{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;pointer-events:auto;max-height:100%;overflow:auto}',
    '.wf-selected{outline:2px solid #2563eb;outline-offset:1px;}',
    '.wf-gesture-pulse{position:relative;}',
    '.wf-gesture-pulse:after{content:"";position:absolute;inset:0;border:2px solid rgba(0,102,204,0.7);animation:wfPulse 250ms ease-out forwards;pointer-events:none;}',
    '@keyframes wfPulse{from{transform:scale(1);opacity:0.8;}to{transform:scale(1.05);opacity:0;}}',
    '.wf-runtime-toast{position:fixed;right:16px;top:16px;padding:8px 10px;border:1px solid #333;background:#fff;color:#000;z-index:600;font-family:Arial,sans-serif;font-size:12px;max-width:420px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,0.15);}',
  ].join('\n');
}

function renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType) {
  const stickyTop = roots.filter((r) => r.sticky === 'top');
  const stickyBottom = roots.filter((r) => r.sticky === 'bottom');
  const bodyRoots = roots.filter((r) => r.sticky !== 'top' && r.sticky !== 'bottom');

  const topHtml = stickyTop.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bottomHtml = stickyBottom.map((r) => renderRoot(r, renderOptions)).join('\n');
  const bodyHtml = bodyRoots.map((r) => renderRoot(r, renderOptions)).join('\n');

  const bodyClass = bodyLayoutType === 'stack' ? 'wf-body-column' : 'wf-body-row';

  return `<div class="wf-page" style="width:${viewportWidth}px;min-height:${viewportHeight}px;">
  ${topHtml}
  <div class="${bodyClass}">
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
    const pageHtml = renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType);
    shellMarkup = `<div id="wf-screenshot-shell" style="position:relative; width:${Math.max(shellWidth, viewportWidth + shellLeft)}px; height:${Math.max(shellHeight, viewportHeight + shellTop)}px;">
  <img id="wf-frame-image" src="${frame.imageData ? escapeHtml(frame.imageData) : ''}" alt="device frame" />
  <div id="wf-wireframe-shell" style="${wireframeScreenStyle}">
    ${pageHtml}
  </div>
</div>`;
  } else {
    // Browser mode: natural scroll, min-height, sticky header/footer support
    shellMarkup = renderPageShell(roots, viewportWidth, viewportHeight, renderOptions, bodyLayoutType);
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
