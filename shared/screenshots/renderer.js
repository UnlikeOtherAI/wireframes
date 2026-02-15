'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_GRID_COLUMNS = 12;
const PRIMITIVE_COMPONENTS = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'button',
  'input',
  'textarea',
  'select',
  'checkbox',
  'toggle',
  'section',
  'divider',
  'spacer',
]);

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
    const columns = Number.isInteger(layout.columns) && layout.columns > 0 ? layout.columns : DEFAULT_GRID_COLUMNS;
    css.push('display:grid', `grid-template-columns:repeat(${columns},1fr)`);
  } else if (type === 'absolute') {
    css.push('position:relative');
  } else if (type === 'overlay') {
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
    css.push(`grid-column:span ${Number(layout.span)}`);
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
  return css.join(';');
}

function absoluteChildStyle(position, parentLayoutType) {
  if (parentLayoutType !== 'absolute') {
    return '';
  }

  const css = [];
  if (!isObject(position)) {
    css.push('position:absolute', 'top:0px', 'left:0px');
    return css.join(';');
  }

  const entries = {
    top: position.top,
    left: position.left,
    right: position.right,
    bottom: position.bottom,
  };

  let hasPlacement = false;
  for (const [key, value] of Object.entries(entries)) {
    const px = toPx(value);
    if (px) {
      css.push(`${key}:${px}`);
      hasPlacement = true;
    }
  }

  if (!hasPlacement) {
    css.push('position:absolute', 'top:0px', 'left:0px');
  } else {
    css.push('position:absolute');
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

function nodeComponent(node) {
  if (typeof node.component === 'string') {
    return node.component;
  }
  if (typeof node.use === 'string') {
    return `use:${node.use}`;
  }
  return 'node';
}

function buildNodeDataAttributes(node) {
  const entries = [];
  if (Array.isArray(node.interaction) && node.interaction.length > 0) {
    entries.push(`data-wf-interactions="${escapeAttr(JSON.stringify(node.interaction))}"`);
  }
  if (isObject(node.visibility)) {
    entries.push(`data-wf-visibility="${escapeAttr(JSON.stringify(node.visibility))}"`);
  }
  if (isObject(node.stateBindings)) {
    entries.push(`data-wf-state-bindings="${escapeAttr(JSON.stringify(node.stateBindings))}"`);
  }
  if (node.selection && typeof node.selection.stateKey === 'string' && node.selection.stateKey.trim() !== '') {
    entries.push(`data-selection-key="${escapeAttr(node.selection.stateKey)}"`);
  }
  return entries.length > 0 ? ` ${entries.join(' ')}` : '';
}

function buildNodeClasses(node, primitive, level = null) {
  const classList = ['wf-node'];

  if (primitive === 'heading') {
    classList.push('wf-heading');
    if (level && Number.isInteger(level) && level >= 1 && level <= 6) {
      classList.push(`wf-heading-${level}`);
    }
  } else if (primitive) {
    classList.push(`wf-${toSafeClass(primitive)}`);
  } else {
    classList.push(`wf-${toSafeClass(nodeComponent(node))}`);
  }

  if (Array.isArray(node.interaction) && node.interaction.length > 0) {
    classList.push('wf-interactive');
  }
  if (node.selection && typeof node.selection === 'object') {
    classList.push('wf-selectable');
  }

  return classList.join(' ');
}

function joinAttrs(nodeId, classes, style) {
  const attrs = [];
  if (typeof nodeId === 'string' && nodeId.trim() !== '') {
    attrs.push(`id="${escapeAttr(nodeId)}"`);
  }
  if (classes && classes.length > 0) {
    attrs.push(`class="${escapeAttr(classes)}"`);
  }
  if (style) {
    attrs.push(`style="${escapeAttr(style)}"`);
  }
  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

function renderImageElement(projectPath, props) {
  const rawSource = typeof props.src === 'string' ? props.src.trim() : '';
  const alt = props.alt || 'Image';
  const width = toPx(props.width);
  const height = toPx(props.height);

  const resolvedSource = readLocalImage(projectPath, rawSource) || (rawSource ? rawSource : null);
  if (!resolvedSource) {
    return `<div class="wf-image wf-image-placeholder">${escapeHtml(alt)}</div>`;
  }

  const attributes = [
    `src="${escapeAttr(resolvedSource)}"`,
    `alt="${escapeAttr(alt)}"`,
  ];
  if (width) {
    attributes.push(`width="${escapeAttr(width)}"`);
  }
  if (height) {
    attributes.push(`height="${escapeAttr(height)}"`);
  }

  return `<img ${attributes.join(' ')} />`;
}

function renderSectionTitle(props) {
  const title = props.title || 'Section';
  return `<div class="wf-section-title">${escapeHtml(title)}</div>`;
}

function renderChildren(node, options) {
  const children = Array.isArray(node.children) ? node.children : [];
  const contentChildren = Array.isArray(node.content) ? node.content : [];
  if (children.length === 0 && contentChildren.length === 0) {
    return '';
  }

  return `<div class="wf-node-children">${renderNodes([...children, ...contentChildren], {
    ...options,
    parentLayoutType: isObject(node.layout) ? node.layout.type || 'stack' : 'stack',
  })}</div>`;
}

function renderSelectOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return '';
  }

  return options.map((entry) => {
    if (entry == null) {
      return '';
    }
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      const label = String(entry);
      const value = String(entry);
      return `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`;
    }
    if (isObject(entry)) {
      const label = String(entry.label || entry.value || '').trim();
      const value = String(entry.value ?? entry.label ?? '').trim();
      return `<option value="${escapeAttr(value)}">${escapeHtml(label || value || 'Option')}</option>`;
    }
    return '';
  }).filter(Boolean).join('');
}

function renderNode(node, options = {}) {
  if (!isObject(node)) {
    return '';
  }

  const component = node.component;
  const props = isObject(node.props) ? node.props : {};
  const layout = isObject(node.layout) ? node.layout : {};
  const nodeStyle = isObject(node.wireframeStyle) ? node.wireframeStyle : {};
  const mergedStyle = mergeWireframeStyle(options.pageStyle, nodeStyle);
  const parentLayoutType = options.parentLayoutType || 'stack';
  const projectPath = options.projectPath || '';

  const childStyle = [
    layoutToCss(layout),
    layoutItemCss(layout),
    absoluteChildStyle(node.position, parentLayoutType),
    wireframeBorderCss(mergedStyle),
  ].filter(Boolean).join(';');

  const headingLevel = Number.isInteger(props.level) ? props.level : 3;
  const safeHeadingLevel = Math.max(1, Math.min(6, headingLevel));
  const dataAttrs = buildNodeDataAttributes(node);
  const primitives = {
    heading: () => {
      const classes = buildNodeClasses(node, 'heading', safeHeadingLevel);
      const body = `<h${safeHeadingLevel}>${escapeHtml(props.text || 'Heading')}</h${safeHeadingLevel}>`;
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${body}${renderChildren(node, options)}</div>`;
    },
    paragraph: () => {
      const classes = buildNodeClasses(node, 'paragraph');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><p>${escapeHtml(props.text || '')}</p>${renderChildren(node, options)}</div>`;
    },
    text: () => {
      const classes = buildNodeClasses(node, 'text');
      return `<span${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${escapeHtml(props.text || '')}</span>${renderChildren(node, options)}`;
    },
    image: () => {
      const classes = buildNodeClasses(node, 'image');
      const image = renderImageElement(projectPath, props);
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${image}</div>`;
    },
    button: () => {
      const classes = buildNodeClasses(node, 'button');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><button>${escapeHtml(props.label || 'Button')}</button>${renderChildren(node, options)}</div>`;
    },
    input: () => {
      const classes = buildNodeClasses(node, 'input');
      const inputType = ['text', 'password', 'email', 'number', 'search'].includes(props.inputType) ? props.inputType : 'text';
      const placeholder = escapeAttr(props.placeholder || '');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><input type="${inputType}" placeholder="${placeholder}" /></div>`;
    },
    textarea: () => {
      const classes = buildNodeClasses(node, 'textarea');
      const rows = Number.isInteger(props.rows) && props.rows > 0 ? props.rows : 3;
      const placeholder = escapeAttr(props.placeholder || '');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><textarea placeholder="${placeholder}" rows="${rows}"></textarea>${renderChildren(node, options)}</div>`;
    },
    select: () => {
      const classes = buildNodeClasses(node, 'select');
      const placeholder = escapeHtml(props.placeholder || 'Select');
      const optionsMarkup = renderSelectOptions(Array.isArray(props.options) ? props.options : []);
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><select><option value="">${placeholder}</option>${optionsMarkup}</select>${renderChildren(node, options)}</div>`;
    },
    checkbox: () => {
      const classes = buildNodeClasses(node, 'checkbox');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><label><input type="checkbox" /> ${escapeHtml(props.label || 'Checkbox')}</label>${renderChildren(node, options)}</div>`;
    },
    toggle: () => {
      const classes = buildNodeClasses(node, 'toggle');
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}><label><span class="wf-toggle-track"><span class="wf-toggle-thumb"></span></span> ${escapeHtml(props.label || 'Toggle')}</label>${renderChildren(node, options)}</div>`;
    },
    section: () => {
      const classes = buildNodeClasses(node, 'section');
      const children = renderChildren(node, {
        ...options,
        parentLayoutType: isObject(node.layout) ? node.layout.type || 'stack' : 'stack',
      });
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${renderSectionTitle(props)}<div class="wf-section-body">${children}</div></div>`;
    },
    divider: () => {
      const classes = buildNodeClasses(node, 'divider');
      return `<hr${joinAttrs(node.id, classes, childStyle)}${dataAttrs} />`;
    },
    spacer: () => {
      const classes = buildNodeClasses(node, 'spacer');
      const size = toPx(Number.isFinite(props.size) ? Number(props.size) : Number(props.size) || 16);
      const orientation = options.parentLayoutType === 'row' ? 'width' : 'height';
      const spacerStyle = size ? `${childStyle}${childStyle ? ';' : ''}${orientation}:${size}` : childStyle;
      return `<div${joinAttrs(node.id, classes, spacerStyle)}${dataAttrs}></div>`;
    },
  };

  const primitiveName = String(component || '');
  if (primitiveName && PRIMITIVE_COMPONENTS.has(primitiveName)) {
    const renderPrimitive = primitives[primitiveName];
    if (renderPrimitive) {
      return renderPrimitive();
    }
  }

  const childNodes = renderChildren(node, options);
  const classes = buildNodeClasses(node, primitiveName);
  return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs}>${childNodes}</div>`;
}

function renderNodes(nodes, options = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  return nodes
    .map((node) => {
      const layoutType = isObject(node?.layout) ? node.layout.type || 'stack' : 'stack';
      return renderNode(node, { ...options, parentLayoutType: layoutType });
    })
    .join('\n');
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

function renderRoots(roots, options = {}) {
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
    '.wf-section-title{font-weight:700;font-size:12px;margin-bottom:6px}',
    '.wf-divider{border:none;border-top:1px solid #666;margin:8px 0}',
    '.wf-spacer{min-height:12px;background:transparent;border-style:dashed}',
    '.wf-heading,.wf-paragraph,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-toggle,.wf-section,.wf-text{margin:4px 0}',
    '.wf-node-section{padding:4px}',
    '.wf-section-body{min-height:10px}',
    '.wf-img,.wf-image img{max-width:100%;max-height:100%;display:block}',
    '.wf-image-placeholder{padding:16px;border:1px dashed #666;background:#fff;text-align:center;color:#666}',
    '.wf-toggle-track{display:inline-block;width:32px;height:16px;border:1px solid #666;border-radius:12px;position:relative;vertical-align:middle;margin-right:8px}',
    '.wf-toggle-thumb{position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#333}',
    '.wf-root{border:1px dashed #aaa;padding:8px}',
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
  renderNodes,
  renderNode,
};
