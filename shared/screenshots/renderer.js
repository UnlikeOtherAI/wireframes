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

function renderRoot(root, options) {
  if (!isObject(root)) {
    return '';
  }

  const rootLabel = root.kind ? `${root.kind}: ${root.id || root.injectableId || root.slotId || 'root'}` : root.id || 'root';
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
  const rootStyle = [
    'margin:8px;padding:8px',
    wireframeRootStyle(options.pageStyle, root.wireframeStyle),
  ].filter(Boolean).join(';');
  const bodyLayoutCss = layoutToCss(rootLayout, {});
  const bodyStyle = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';

  return `
    <section class="wf-root wf-root-${toSafeClass(root.kind || 'container')}" style="${rootStyle}">
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body"${bodyStyle}>
        ${content}
      </div>
    </section>`.trim();
}

function renderRoots(roots, options = {}) {
  if (!Array.isArray(roots) || roots.length === 0) {
    return '';
  }

  return roots.map((root) => renderRoot(root, options)).join('\n');
}

function buildWireframeStyles() {
  return [
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;padding:16px}',
    '.wf-root-title{display:none}',
    '.wf-root-body{display:block}',
    '.wf-node-children{display:contents}',
    '.wf-node{background:#fff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-corner-radius,0px);padding:6px;margin:4px;min-height:22px}',
    '.wf-heading,.wf-paragraph,.wf-text,.wf-image,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-toggle{border:none;background:transparent;padding:2px 0;min-height:0}',
    '.wf-button,.wf-checkbox,.wf-toggle{width:fit-content}',
    '.wf-section-title{display:none}',
    '.wf-divider{border:none;border-top:1px solid #666;margin:8px 0}',
    '.wf-spacer{min-height:12px;background:transparent;border:none}',
    '.wf-heading,.wf-paragraph,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-toggle,.wf-section,.wf-text{margin:4px 0}',
    '.wf-node-section{padding:4px}',
    '.wf-section-body{min-height:10px}',
    '.wf-img,.wf-image img{max-width:100%;max-height:100%;display:block}',
    '.wf-image-placeholder{padding:16px;border:1px dashed #666;background:#fff;text-align:center;color:#666}',
    '.wf-toggle-track{display:inline-block;width:32px;height:16px;border:1px solid #666;border-radius:12px;position:relative;vertical-align:middle;margin-right:8px}',
    '.wf-toggle-thumb{position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#333}',
    '.wf-root{border:none;padding:0;margin:0}',
    '.wf-pane-left,.wf-pane-center,.wf-pane-right{display:block}',
    '.wf-pane-right{margin-left:auto}',
    '.wf-pane-center{flex:1 1 auto;min-width:0}',
    '.wf-pane[data-wf-pane-collapsed=\"true\"]{overflow:hidden}',
    '#wf-screenshot-shell{position:relative;}',
    '#wf-frame-image{display:block;max-width:none;max-height:none;}',
    '#wf-wireframe-shell{overflow:hidden}',
    '.wf-visible{display:block !important;}',
    '.wf-selected{outline:2px solid #0000ff;outline-offset:1px;}',
    '.wf-gesture-pulse{position:relative;}',
    '.wf-gesture-pulse:after{content:\"\";position:absolute;inset:0;border:2px solid rgba(0,102,204,0.7);animation:wfPulse 250ms ease-out forwards;pointer-events:none;}',
    '@keyframes wfPulse{from{transform:scale(1);opacity:0.8;}to{transform:scale(1.05);opacity:0;}}',
    '.wf-runtime-toast{position:fixed;right:16px;top:16px;padding:8px 10px;border:1px solid #333;background:#fff;color:#000;z-index:600;font-family:Arial,sans-serif;font-size:12px;max-width:420px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,0.15);}',
  ].join('\n');
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
}) {
  const viewportWidth = Number.isFinite(pageViewport?.width) ? pageViewport.width : 1280;
  const viewportHeight = Number.isFinite(pageViewport?.height) ? pageViewport.height : 900;
  const shellTop = Number.isFinite(frame?.top) ? frame.top : 0;
  const shellLeft = Number.isFinite(frame?.left) ? frame.left : 0;
  const shellWidth = Number.isFinite(frame?.width) && frame.width > 0 ? frame.width : viewportWidth;
  const shellHeight = Number.isFinite(frame?.height) && frame.height > 0 ? frame.height : viewportHeight;

  const wireframeScreenStyle = [
    `width:${viewportWidth}px`,
    `height:${viewportHeight}px`,
    'background:#fff',
    'overflow:auto',
    'position:absolute',
    `left:${shellLeft}px`,
    `top:${shellTop}px`,
  ].join(';');

  const pageShellStyle = frame
    ? 'position:relative;'
    : `width:${viewportWidth}px;height:${viewportHeight}px;overflow:auto;`;

  const shellMarkup = frame
    ? `<div id="wf-screenshot-shell" style="position:relative; width:${Math.max(shellWidth, viewportWidth + shellLeft)}px; height:${Math.max(shellHeight, viewportHeight + shellTop)}px;">
  <img id="wf-frame-image" src="${frame.imageData ? escapeHtml(frame.imageData) : ''}" alt="device frame" />
  <div id="wf-wireframe-shell" style="${wireframeScreenStyle}">
    <div id="wf-wireframe-content" style="${`width:${viewportWidth}px;height:${viewportHeight}px;position:relative;`}">
    ${renderRoots(roots, {
      pageStyle,
      projectPath,
      dataSources,
      defaultGridColumns,
      assetUrlPrefix,
      routeId: pageRouteId,
    })}
  </div>
    </div>
  </div>`
    : `<div id="wf-wireframe-shell" style="${pageShellStyle}">
  ${renderRoots(roots, {
    pageStyle,
    projectPath,
    dataSources,
    defaultGridColumns,
    assetUrlPrefix,
    routeId: pageRouteId,
  })}
</div>`;

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
  const styleMarkup = wireframeCssHref ? `<link rel="stylesheet" href="${escapeAttr(wireframeCssHref)}" />` : `<style>${styles}</style>`;

  const contentStyle = [
    'position:relative',
    frame ? 'margin:0' : '',
  ].filter(Boolean).join(';');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe ${escapeHtml(pageStyle?.title || 'capture')}</title>
    ${styleMarkup}
  </head>
  <body>
    <div style="${contentStyle}">
      ${shellMarkup}
    </div>
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
