'use strict';

const {
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
  toPx,
} = require('./layout');
const {
  wireframeNodeStyleOverrides,
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

const OVERLAY_TYPES = new Set([
  'modal',
  'alert',
  'dropdown',
  'popover',
  'drawer_left',
  'drawer_right',
  'bottom_sheet',
  'toast',
  'tooltip',
]);

const OVERLAY_BACKDROP_TYPES = new Set([
  'modal',
  'alert',
  'drawer_left',
  'drawer_right',
  'bottom_sheet',
]);

const OVERLAY_Z_INDEX = {
  dropdown: 100,
  popover: 100,
  tooltip: 100,
  modal: 200,
  drawer_left: 200,
  drawer_right: 200,
  bottom_sheet: 200,
  toast: 400,
  alert: 400,
};

const OVERLAY_PLACEMENTS = new Set(['top', 'bottom', 'left', 'right', 'center']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeChildren(node) {
  if (!isObject(node)) {
    return [];
  }

  return [
    ...(Array.isArray(node.children) ? node.children : []),
    ...(Array.isArray(node.content) ? node.content : []),
    ...(Array.isArray(node.nodes) ? node.nodes : []),
  ];
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

const wfNodeBorderStyle = 'border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-corner-radius,0px)';

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
  if (node.kind === 'overlay' && typeof node.type === 'string' && node.type.trim() !== '') {
    entries.push(`data-wf-overlay-type="${escapeAttr(node.type)}"`);
  }
  if (node.kind === 'overlay' && typeof node.trigger === 'string' && node.trigger.trim() !== '') {
    entries.push(`data-wf-overlay-trigger="${escapeAttr(node.trigger)}"`);
  }
  if (node.kind === 'overlay' && typeof node.placement === 'string' && node.placement.trim() !== '') {
    entries.push(`data-wf-overlay-placement="${escapeAttr(node.placement)}"`);
  }
  if (node.kind === 'overlay' && Array.isArray(node.dismissOn) && node.dismissOn.length > 0) {
    entries.push(`data-wf-overlay-dismiss="${escapeAttr(JSON.stringify(node.dismissOn))}"`);
  }
  if (node.selection && typeof node.selection.stateKey === 'string' && node.selection.stateKey.trim() !== '') {
    entries.push(`data-selection-key="${escapeAttr(node.selection.stateKey)}"`);
  }
  if (node.selection && typeof node.selection.scope === 'string' && node.selection.scope.trim() !== '') {
    entries.push(`data-selection-scope="${escapeAttr(node.selection.scope)}"`);
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
  } else if (node.kind === 'overlay') {
    classList.push('wf-overlay');
    if (typeof node.type === 'string' && node.type.trim() !== '') {
      classList.push(`wf-overlay-${toSafeClass(node.type)}`);
    }
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
  const children = normalizeChildren(node);
  if (children.length === 0) {
    return '';
  }

  return `<div class="wf-node-children">${renderNodes(children, {
    ...options,
    parentLayoutType: isObject(node.layout) ? node.layout.type || 'stack' : 'stack',
  })}</div>`;
}

function overlayTypeNeedsBackdrop(type) {
  return OVERLAY_BACKDROP_TYPES.has(type);
}

function overlayTypeStyle(type, placement) {
  const normalizedPlacement = OVERLAY_PLACEMENTS.has(placement) ? placement : 'bottom';
  const zIndex = Object.prototype.hasOwnProperty.call(OVERLAY_Z_INDEX, type) ? OVERLAY_Z_INDEX[type] : 100;

  if (type === 'modal' || type === 'alert') {
    return [
      'position:fixed',
      'inset:0',
      'display:none',
      'align-items:center',
      'justify-content:center',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'drawer_left') {
    return [
      'position:fixed',
      'top:0',
      'left:0',
      'bottom:0',
      'width:280px',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'drawer_right') {
    return [
      'position:fixed',
      'top:0',
      'right:0',
      'bottom:0',
      'width:280px',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'bottom_sheet') {
    return [
      'position:fixed',
      'left:0',
      'right:0',
      'bottom:0',
      'display:none',
      'overflow:auto',
      `z-index:${zIndex}`,
    ].join(';');
  }

  if (type === 'toast') {
    const style = [
      'position:fixed',
      'left:16px',
      'min-width:220px',
      'display:none',
      `z-index:${zIndex}`,
    ];
    if (normalizedPlacement === 'bottom') {
      style.push('bottom:16px');
    } else {
      style.push('top:16px');
    }
    return style.join(';');
  }

  if (type === 'dropdown' || type === 'popover' || type === 'tooltip') {
    const style = [
      'position:absolute',
      'display:none',
      'z-index:' + zIndex,
    ];
    if (normalizedPlacement === 'top') {
      style.push('bottom:100%');
    } else if (normalizedPlacement === 'left') {
      style.push('right:100%');
    } else if (normalizedPlacement === 'right') {
      style.push('left:100%');
    } else {
      style.push('top:100%');
    }
    return style.join(';');
  }

  return ['position:fixed', 'display:none', `z-index:${zIndex}`].join(';');
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

function renderOverlay(node, options, childStyle) {
  const overlayType = typeof node.type === 'string' && OVERLAY_TYPES.has(node.type) ? node.type : 'overlay';
  const overlayPlacement = typeof node.placement === 'string' ? node.placement : '';
  const overlayClassList = [
    'wf-overlay',
    `wf-overlay-${toSafeClass(overlayType)}`,
    ...buildNodeClasses(node).split(' ').filter(Boolean),
  ];
  const overlayClasses = Array.from(new Set(overlayClassList.filter((value) => value !== 'wf-node'))).join(' ');

  const overlayStyle = [childStyle, overlayTypeStyle(overlayType, overlayPlacement)]
    .filter(Boolean)
    .join(';');
  const dataAttrs = buildNodeDataAttributes(node);
  const children = renderChildren(node, options);
  const backdrop = overlayTypeNeedsBackdrop(overlayType)
    ? '<div class="wf-overlay-backdrop" aria-hidden="true" style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:none;"></div>'
    : '';

  return `<div${joinAttrs(node.id, overlayClasses, overlayStyle)}${dataAttrs}>${backdrop}<div class="wf-overlay-content" style="position:relative;display:flex;min-width:0;min-height:0;pointer-events:auto;">${children}</div></div>`;
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
  const nodeWireframeOverrides = wireframeNodeStyleOverrides(nodeStyle, options.pageStyle);
  const parentLayoutType = options.parentLayoutType || 'stack';
  const projectPath = options.projectPath || '';

  const childStyle = [
    layoutToCss(layout, size, { defaultGridColumns }),
    layoutItemCss(gridItem),
    absoluteChildStyle(node.position, parentLayoutType),
    wfNodeBorderStyle,
    nodeWireframeOverrides,
  ].filter(Boolean).join(';');

  const headingLevel = Number.isInteger(props.level) ? props.level : 3;
  const safeHeadingLevel = Math.max(1, Math.min(6, headingLevel));
  const dataAttrs = buildNodeDataAttributes(node);
  const isOverlayRoot = node.kind === 'overlay';
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

  if (isOverlayRoot) {
    return renderOverlay(node, options, childStyle);
  }

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
