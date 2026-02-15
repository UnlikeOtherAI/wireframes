'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_GRID_COLUMNS = 12;

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
  return String(value ?? '').replaceAll('"', '&quot;');
}

function toSafeClass(value) {
  return String(value || 'node')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function toPx(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return null;
}

function readLocalImage(projectPath, source) {
  if (typeof source !== 'string') {
    return null;
  }

  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }

  const assetPath = path.join(projectPath, 'assets', trimmed.replace(/^\/+/, ''));
  if (!fs.existsSync(assetPath)) {
    return null;
  }

  const buffer = fs.readFileSync(assetPath);
  const extension = path.extname(assetPath).toLowerCase();
  const mime = extension === '.svg'
    ? 'image/svg+xml'
    : extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.gif'
        ? 'image/gif'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/png';

  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function layoutToCss(layout = {}) {
  if (!isObject(layout)) {
    return '';
  }

  const css = [];
  const type = layout.type || 'stack';
  if (type === 'stack') {
    css.push('display:flex', 'flex-direction:column');
  } else if (type === 'row') {
    css.push('display:flex', 'flex-direction:row');
  } else if (type === 'grid') {
    css.push('display:grid', `grid-template-columns:repeat(${layout.columns || DEFAULT_GRID_COLUMNS},1fr)`);
  } else if (type === 'absolute' || type === 'overlay') {
    css.push('position:relative');
  }

  if (layout.gap != null) {
    const gap = toPx(layout.gap);
    if (gap) {
      css.push(`gap:${gap}`);
    }
  }
  if (layout.padding != null) {
    const padding = toPx(layout.padding);
    if (padding) {
      css.push(`padding:${padding}`);
    }
  }
  if (layout.align) {
    css.push(`align-items:${layout.align}`);
  }
  if (layout.justify) {
    css.push(`justify-content:${layout.justify}`);
  }
  if (layout.width != null) {
    const width = toPx(layout.width);
    if (width) {
      css.push(`width:${width}`);
    }
  }
  if (layout.height != null) {
    const height = toPx(layout.height);
    if (height) {
      css.push(`height:${height}`);
    }
  }
  if (layout.minWidth != null) {
    const minWidth = toPx(layout.minWidth);
    if (minWidth) {
      css.push(`min-width:${minWidth}`);
    }
  }
  if (layout.maxWidth != null) {
    const maxWidth = toPx(layout.maxWidth);
    if (maxWidth) {
      css.push(`max-width:${maxWidth}`);
    }
  }
  if (layout.minHeight != null) {
    const minHeight = toPx(layout.minHeight);
    if (minHeight) {
      css.push(`min-height:${minHeight}`);
    }
  }
  if (layout.maxHeight != null) {
    const maxHeight = toPx(layout.maxHeight);
    if (maxHeight) {
      css.push(`max-height:${maxHeight}`);
    }
  }
  return css.join(';');
}

function layoutItemCss(layout = {}) {
  if (!isObject(layout)) {
    return '';
  }

  const css = [];
  if (layout.span != null) {
    css.push(`grid-column:span ${layout.span}`);
  }
  if (layout.offset != null) {
    const offset = Number(layout.offset);
    if (Number.isFinite(offset)) {
      css.push(`grid-column-start:${offset + 1}`);
    }
  }
  if (layout.row != null) {
    css.push(`grid-row:${layout.row}`);
  }
  if (layout.column != null) {
    css.push(`grid-column:${layout.column}`);
  }
  if (layout.left != null) {
    const left = toPx(layout.left);
    if (left) {
      css.push(`left:${left}`);
    }
  }
  if (layout.top != null) {
    const top = toPx(layout.top);
    if (top) {
      css.push(`top:${top}`);
    }
  }
  if (layout.position) {
    css.push(`position:${layout.position}`);
  }
  return css.join(';');
}

function wireframeBorderCss(mergedStyle = {}) {
  const border = mergedStyle.border || {};
  const borderStyle = border.style || 'solid';
  const borderWidth = border.width === 'medium' ? 2 : 1;
  const width = toPx(borderWidth);
  const corner = mergedStyle.corner || {};
  const radius = Number.isFinite(corner.radius) ? `${corner.radius}px` : (corner.radius != null ? toPx(corner.radius) : '0px');
  const borderRadius = corner.style === 'sharp' ? '0px' : radius;

  return `border:${width} ${borderStyle} #333; border-radius:${borderRadius}`;
}

function mergeWireframeStyle(pageStyle, nodeStyle) {
  const page = isObject(pageStyle) ? pageStyle : {};
  const node = isObject(nodeStyle) ? nodeStyle : {};

  return {
    border: {
      style: node.border?.style || page.border?.style || 'solid',
      width: node.border?.width || page.border?.width || 'thin',
    },
    corner: {
      style: node.corner?.style || page.corner?.style || 'sharp',
      radius: node.corner?.radius != null ? node.corner.radius : page.corner?.radius,
    },
  };
}

function textForNode(component, props = {}) {
  if (component === 'heading') {
    return `${props.level ? `H${props.level}: ` : ''}${props.text || 'Heading'}`;
  }
  if (component === 'paragraph' || component === 'text') {
    return props.text || 'Text';
  }
  if (component === 'button') {
    return props.label || 'Button';
  }
  if (component === 'input' || component === 'textarea' || component === 'select') {
    return props.placeholder || `${component} field`;
  }
  if (component === 'checkbox' || component === 'toggle') {
    return props.label || component;
  }
  if (component === 'section') {
    return props.title || 'Section';
  }
  if (component === 'image') {
    return props.alt || 'Image';
  }
  if (component === 'spacer') {
    return `${component}`;
  }
  return component;
}

function renderImageNode({ pagePath, props }) {
  const rawSource = typeof props.src === 'string' ? props.src.trim() : '';
  const resolvedSource = readLocalImage(pagePath, rawSource) || (rawSource ? null : null);
  const width = toPx(props.width);
  const height = toPx(props.height);
  const imageStyle = [width ? `width:${width}` : '', height ? `height:${height}` : '']
    .filter(Boolean)
    .join(';');

  if (typeof resolvedSource === 'string' && (resolvedSource.startsWith('data:') || /^[a-z][a-z0-9+.-]*:/i.test(resolvedSource))) {
    return `<img class="wf-img" src="${escapeAttr(resolvedSource)}" alt="${escapeAttr(props.alt || 'Image')}" style="${escapeAttr(imageStyle)}" />`;
  }

  if (!resolvedSource && rawSource) {
    return `<div class="wf-image-placeholder">[${escapeHtml(props.alt || 'Image')}]</div>`;
  }

  if (typeof rawSource === 'string') {
    return `<img class="wf-img" src="${escapeAttr(rawSource)}" alt="${escapeAttr(props.alt || 'Image')}" style="${escapeAttr(imageStyle)}" />`;
  }

  return `<div class="wf-image-placeholder">[${escapeHtml(props.alt || 'Image')}]</div>`;
}

function renderTextBlock(component, props) {
  if (component === 'heading') {
    const level = Number.isInteger(props.level) ? props.level : 3;
    const safeLevel = Math.max(1, Math.min(6, level));
    return `<h${safeLevel}>${escapeHtml(props.text || 'Heading')}</h${safeLevel}>`;
  }
  if (component === 'paragraph') {
    return `<p>${escapeHtml(props.text || '')}</p>`;
  }
  return `<span>${escapeHtml(props.text || '')}</span>`;
}

function renderNodeChildren(node, options) {
  const children = Array.isArray(node.children) ? node.children : [];
  const nested = Array.isArray(node.content) ? node.content : [];
  if (children.length === 0 && nested.length === 0) {
    return '';
  }
  return `<div class="wf-children">${renderNodes([...children, ...nested], {
    ...options,
    parentLayoutType: isObject(node.layout) ? node.layout.type || 'stack' : 'stack',
  })}</div>`;
}

function renderNode(node, options) {
  if (!isObject(node)) {
    return '';
  }

  const component = typeof node.component === 'string'
    ? node.component
    : (typeof node.use === 'string' ? `use:${node.use}` : 'node');
  const props = isObject(node.props) ? node.props : {};
  const layout = isObject(node.layout) ? node.layout : {};
  const nodeStyle = isObject(node.wireframeStyle) ? node.wireframeStyle : {};
  const mergedStyle = mergeWireframeStyle(options.pageStyle, nodeStyle);

  const style = [
    layoutToCss(layout),
    layoutItemCss(layout),
    wireframeBorderCss(mergedStyle),
  ].filter(Boolean).join(';');

  const children = renderNodeChildren(node, options);
  const safeComponent = toSafeClass(component);
  const classNames = `wf-node wf-node-${safeComponent}`;

  if (component === 'image') {
    return `
      <div class="${classNames}" style="${escapeAttr(style)}">
        <div class="wf-component-title">${escapeHtml(textForNode(component, props))}</div>
        ${renderImageNode({ pagePath: options.projectPath, props })}
        ${children}
      </div>`.trim();
  }

  if (component === 'divider') {
    return `<hr class="${classNames}" style="${escapeAttr(style)}" />`;
  }

  if (component === 'spacer') {
    const size = Number(props.size);
    const dimension = Number.isFinite(size) ? `${size}px` : '16px';
    const orientation = options.parentLayoutType === 'row' ? `width:${dimension}` : `height:${dimension}`;
    return `<div class="${classNames}" style="${escapeAttr(`${style};${orientation}`)}"></div>`;
  }

  if (component === 'section') {
    return `
      <div class="${classNames}" style="${escapeAttr(style)}">
        <div class="wf-section-title">${escapeHtml(textForNode(component, props))}</div>
        ${children}
      </div>`.trim();
  }

  if (component === 'heading' || component === 'paragraph' || component === 'text') {
    return `
      <div class="${classNames}" style="${escapeAttr(style)}">
        <div class="wf-text-label">${escapeHtml(textForNode(component, props))}</div>
        <div>${renderTextBlock(component, props)}</div>
        ${children}
      </div>`.trim();
  }

  if (component === 'button' || component === 'input' || component === 'textarea' || component === 'select'
    || component === 'checkbox' || component === 'toggle') {
    return `
      <div class="${classNames}" style="${escapeAttr(style)}">
        <div class="wf-text-label">${escapeHtml(textForNode(component, props))}</div>
        ${children}
      </div>`.trim();
  }

  return `
    <div class="${classNames}" style="${escapeAttr(style)}">
      <div class="wf-text-label">${escapeHtml(textForNode(component, props))}</div>
      ${children}
    </div>`.trim();
}

function renderNodes(nodes, options) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  return nodes.map((node) => {
    const layoutType = isObject(node?.layout) ? node.layout.type || 'stack' : 'stack';
    return renderNode(node, { ...options, parentLayoutType: layoutType });
  }).join('\n');
}

function renderRoot(root, options) {
  if (!isObject(root)) {
    return '';
  }

  const rootLabel = root.kind ? `${root.kind}: ${root.id || root.injectableId || root.slotId || 'root'}` : root.id || 'root';
  const children = Array.isArray(root.nodes) ? root.nodes : [];
  const content = renderNodes(children, options);

  return `
    <section class="wf-root wf-root-${toSafeClass(root.kind || 'container')}" style="margin:8px;padding:8px;">
      <div class="wf-root-title">${escapeHtml(rootLabel)}</div>
      <div class="wf-root-body">
        ${content}
      </div>
    </section>`.trim();
}

function renderRoots(roots, options) {
  if (!Array.isArray(roots) || roots.length === 0) {
    return '';
  }

  return roots.map((root) => renderRoot(root, options)).join('\n');
}

function renderWireframeMarkup({
  roots = [],
  pageViewport,
  pageStyle = {},
  projectPath,
  frame = null,
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
  <img id="wf-frame-image" src="${escapeAttr(frame.imageData || '')}" alt="device frame" />
  <div id="wf-wireframe-shell" style="${escapeAttr(wireframeScreenStyle)}">
    <div id="wf-wireframe-content" style="${escapeAttr(`width:${viewportWidth}px;height:${viewportHeight}px;position:relative;`)}">
      ${renderRoots(roots, { pageStyle, projectPath })}
    </div>
  </div>
</div>`
    : `<div id="wf-wireframe-shell" style="${escapeAttr(pageShellStyle)}">
  ${renderRoots(roots, { pageStyle, projectPath })}
</div>`;

  const styles = [
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:Arial,sans-serif;background:#f5f7fb;padding:16px}',
    '.wf-root-title{font-size:11px;color:#444;font-weight:700;margin-bottom:6px}',
    '.wf-root-body{display:block}',
    '.wf-node{background:#fff;border:1px solid #333;padding:6px;margin:4px;min-height:22px}',
    '.wf-node-section{padding:4px}',
    '.wf-section-title{font-weight:700;font-size:12px;margin-bottom:6px}',
    '.wf-node-divider{border-top:1px solid #666}',
    '.wf-node-spacer{min-height:12px;background:transparent;border-style:dashed}',
    '.wf-text-label{font-size:11px;color:#666;margin-bottom:2px}',
    '.wf-img{max-width:100%;max-height:100%;display:block}',
    '.wf-image-placeholder{padding:16px;border:1px dashed #666;background:#fff;text-align:center;color:#666}',
    '#wf-screenshot-shell{position:relative;}',
    '#wf-frame-image{display:block;max-width:none;max-height:none;}',
    '#wf-wireframe-shell{overflow:hidden}',
  ].join('\n');

  const contentStyle = [
    'position:relative',
    frame ? 'margin:0' : '',
  ].filter(Boolean).join(';');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe ${escapeHtml(pageStyle?.title || 'capture')}</title>
    <style>${styles}</style>
  </head>
  <body>
    <div style="${escapeAttr(contentStyle)}">
      ${shellMarkup}
    </div>
  </body>
</html>`;
}

module.exports = {
  renderWireframeMarkup,
  readLocalImage,
};
