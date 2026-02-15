'use strict';

const {
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
  toPx,
} = require('./layout');
const {
  mergeWireframeStyle,
  wireframeBorderCss,
  readLocalImage,
} = require('./wireframe-styles');

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
  const size = isObject(node.size) ? node.size : {};
  const gridItem = isObject(node.gridItem) ? node.gridItem : {};
  const defaultGridColumns = Number.isInteger(options.defaultGridColumns)
    ? options.defaultGridColumns
    : undefined;
  const nodeStyle = isObject(node.wireframeStyle) ? node.wireframeStyle : {};
  const mergedStyle = mergeWireframeStyle(options.pageStyle, nodeStyle);
  const parentLayoutType = options.parentLayoutType || 'stack';
  const projectPath = options.projectPath || '';

  const childStyle = [
    layoutToCss(layout, size, { defaultGridColumns }),
    layoutItemCss(gridItem),
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

module.exports = {
  renderNode,
  renderNodes,
  readLocalImage,
};
