'use strict';

const {
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
  shouldRenderParentSeparators,
  toPx,
} = require('./layout');
const {
  surfaceElevationOverride,
  wireframeNodeStyleOverrides,
  readLocalImage,
} = require('./wireframe-styles');

const PRIMITIVE_COMPONENTS = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'icon',
  'button',
  'tab_bar',
  'bottom_tab_bar',
  'input',
  'textarea',
  'select',
  'checkbox',
  'toggle',
  'table',
  'section',
  'divider',
  'spacer',
]);

const BORDERLESS_PRIMITIVES = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'icon',
  'button',
  'input',
  'textarea',
  'select',
  'checkbox',
  'toggle',
  'table',
  'divider',
  'spacer',
  // section gets its border from wf-surface CSS (mode-specific); no inline border
  'section',
  'tab_bar',
  'bottom_tab_bar',
]);

const OVERLAY_TYPES = new Set([
  'modal',
  'alert',
  'dropdown',
  'popover',
  'menu',
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
  menu: 100,
  tooltip: 100,
  modal: 200,
  drawer_left: 200,
  drawer_right: 200,
  bottom_sheet: 200,
  toast: 400,
  alert: 400,
};

const OVERLAY_PLACEMENTS = new Set(['top', 'bottom', 'left', 'right', 'center']);
const PANE_SIDES = new Set(['left', 'right', 'center']);
const BINDING_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z0-9_.]+)\s*\}\}/g;

function isBoundSelectionValue(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function serializeSelectionValue(value) {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return '';
  }
}

function cloneNode(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function suffixNodeIds(node, suffix) {
  if (!isObject(node)) {
    return;
  }

  if (typeof node.id === 'string' && node.id.trim() !== '') {
    node.id = `${node.id}_${suffix}`;
  }

  const childKeys = ['children', 'content', 'nodes'];
  for (const key of childKeys) {
    if (!Array.isArray(node[key])) {
      continue;
    }
    for (const child of node[key]) {
      suffixNodeIds(child, suffix);
    }
  }
}

function resolveCollectionItems(binding, options = {}) {
  if (!isObject(binding) || typeof binding.source !== 'string' || binding.source.trim() === '') {
    return { items: [], primaryKey: null };
  }

  const sourceId = binding.source.trim();
  const sources = isObject(options.dataSources) ? options.dataSources : {};
  const sourceData = sources[sourceId];

  if (Array.isArray(sourceData)) {
    return { items: sourceData, primaryKey: null };
  }

  if (isObject(sourceData) && Array.isArray(sourceData.items)) {
    const rawPrimaryKey = typeof sourceData.primaryKey === 'string' ? sourceData.primaryKey.trim() : '';
    const primaryKey = rawPrimaryKey ? rawPrimaryKey : null;
    return { items: sourceData.items, primaryKey };
  }

  return { items: [], primaryKey: null };
}

function getBindingItemVar(binding, options = {}) {
  const configuredVar = binding && typeof binding.itemVar === 'string' ? binding.itemVar.trim() : '';
  if (configuredVar) {
    return configuredVar;
  }

  if (typeof options.itemVar === 'string' && options.itemVar.trim() !== '') {
    return options.itemVar.trim();
  }

  return 'item';
}

function renderCollectionNode(node, options = {}) {
  if (!isObject(node) || !isObject(node.binding) || typeof node.binding.source !== 'string') {
    return null;
  }

  const collection = resolveCollectionItems(node.binding, options);
  const items = Array.isArray(collection.items) ? collection.items : [];
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const cloned = cloneNode(node);
  if (!isObject(cloned) || !isObject(cloned.binding)) {
    return null;
  }

  delete cloned.binding;
  return {
    items,
    primaryKey: collection.primaryKey,
    cloned,
    bindingItemVar: getBindingItemVar(node.binding, options),
  };
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function getPathValue(source, path) {
  if (!isObject(source) || typeof path !== 'string' || path === '') {
    return undefined;
  }

  const parts = path.split('.');
  let current = source;

  for (const part of parts) {
    if (!isObject(current)) {
      return undefined;
    }
    current = current[part];
    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

function resolveTemplateToken(type, path, options = {}) {
  if (type === 'route') {
    return path === 'id' ? (options.routeId || '') : undefined;
  }
  if (type === 'props') {
    return getPathValue(options.props, path);
  }
  const itemVariable = typeof options.itemVar === 'string' && options.itemVar.trim() !== '' ? options.itemVar.trim() : 'item';
  if (type === 'item' || type === itemVariable) {
    return getPathValue(options.item, path);
  }
  return undefined;
}

function renderBoundText(value, options = {}) {
  const source = typeof value === 'string' ? value : '';
  if (source === '') {
    return '';
  }

  if (!source.includes('{{')) {
    return escapeHtml(source);
  }

  const parts = [];
  let hasBinding = false;
  let cursor = 0;
  BINDING_TOKEN.lastIndex = 0;
  let match = BINDING_TOKEN.exec(source);

  while (match) {
    hasBinding = true;
    const before = source.slice(cursor, match.index);
    if (before) {
      parts.push(escapeHtml(before));
    }

    const type = match[1];
    const path = match[2];
    if (type === 'state' || type === 'appState') {
      parts.push(`<span data-bind="${escapeAttr(`${type}.${path}`)}"></span>`);
    } else {
      const resolved = resolveTemplateToken(type, path, options);
      parts.push(escapeHtml(resolved == null ? '' : String(resolved)));
    }

    cursor = match.index + match[0].length;
    match = BINDING_TOKEN.exec(source);
  }

  const tail = source.slice(cursor);
  if (tail) {
    parts.push(escapeHtml(tail));
  }

  if (!hasBinding) {
    return escapeHtml(source);
  }

  return parts.join('');
}

function resolveAttributeValue(value, options = {}, stateBindings = null, stateProperty = '') {
  const source = typeof value === 'string' ? value : '';
  if (source === '' || !source.includes('{{')) {
    return source;
  }

  return source.replace(BINDING_TOKEN, (_match, type, path) => {
    if (type === 'state' || type === 'appState') {
      if (isObject(stateBindings) && stateProperty) {
        stateBindings[stateProperty] = `{{${type}.${path}}}`;
      }
      return '';
    }

    if (type === 'route') {
      return path === 'id' ? (options.routeId || '') : '';
    }

    const resolved = resolveTemplateToken(type, path, options);
    return resolved == null ? '' : String(resolved);
  });
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

function normalizePaneSide(value) {
  const side = typeof value === 'string' ? value.trim() : '';
  return PANE_SIDES.has(side) ? side : 'left';
}

function normalizePane(pane, parentLayoutType = 'stack') {
  if (!isObject(pane)) {
    return null;
  }

  const state = isObject(pane.state) ? pane.state : null;
  return {
    side: normalizePaneSide(pane.side),
    axis: parentLayoutType === 'row' ? 'width' : 'height',
    defaultSize: Number.isFinite(pane.defaultSize) ? pane.defaultSize : null,
    minSize: Number.isFinite(pane.minSize) ? pane.minSize : null,
    maxSize: Number.isFinite(pane.maxSize) ? pane.maxSize : null,
    collapsedSize: Number.isFinite(pane.collapsedSize) ? pane.collapsedSize : 0,
    resizable: pane.resizable === true,
    collapsible: pane.collapsible === true,
    state: isObject(state)
      && typeof state.scope === 'string' && state.scope.trim() !== ''
      && typeof state.sizeKey === 'string' && state.sizeKey.trim() !== ''
      && typeof state.collapsedKey === 'string' && state.collapsedKey.trim() !== ''
      ? {
          scope: state.scope.trim(),
          sizeKey: state.sizeKey.trim(),
          collapsedKey: state.collapsedKey.trim(),
        }
      : null,
  };
}

function paneMetaToStyle(pane) {
  if (!isObject(pane)) {
    return '';
  }

  const style = [];
  const sizeAxis = pane.axis === 'width' ? 'width' : 'height';
  const defaultSize = toPx(pane.defaultSize);

  if (pane.side === 'center') {
    style.push('flex:1 1 auto', 'min-width:0');
  } else {
    style.push('flex:0 0 auto');
  }

  if (pane.side === 'right') {
    style.push('margin-left:auto');
  }

  if (pane.resizable) {
    style.push(`resize:${sizeAxis === 'width' ? 'horizontal' : 'vertical'}`, 'overflow:auto');
  }

  if (defaultSize && pane.side !== 'center') {
    style.push(`${sizeAxis}:${defaultSize}`);
  }

  const minSize = toPx(pane.minSize);
  if (minSize) {
    style.push(`min-${sizeAxis}:${minSize}`);
  }
  const maxSize = toPx(pane.maxSize);
  if (maxSize) {
    style.push(`max-${sizeAxis}:${maxSize}`);
  }

  return style.join(';');
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

function buildNodeDataAttributes(node, stateBindings, selectionValue, paneData) {
  const entries = [];
  if (Array.isArray(node.interaction) && node.interaction.length > 0) {
    entries.push(`data-wf-interactions="${escapeAttr(JSON.stringify(node.interaction))}"`);
  }
  if (isObject(node.visibility)) {
    entries.push(`data-wf-visibility="${escapeAttr(JSON.stringify(node.visibility))}"`);
  }
  if (isObject(stateBindings)) {
    entries.push(`data-wf-state-bindings="${escapeAttr(JSON.stringify(stateBindings))}"`);
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
  if (node.selection && isBoundSelectionValue(selectionValue)) {
    entries.push(`data-selection-value="${escapeAttr(serializeSelectionValue(selectionValue))}"`);
  }
  if (node.selection && node.selection.selectable === false) {
    entries.push('data-selection-selectable="false"');
  }
  if (isObject(paneData)) {
    entries.push(`data-wf-pane="${escapeAttr(JSON.stringify(paneData))}"`);
  }
  if (typeof node.role === 'string' && node.role.trim() !== '') {
    entries.push(`data-wf-role="${escapeAttr(node.role.trim())}"`);
  }
  return entries.length > 0 ? ` ${entries.join(' ')}` : '';
}

function buildNodeClasses(node, primitive, level = null, paneSide = null) {
  const classList = ['wf-node'];
  const explicitSurface = typeof node?.surface === 'boolean' ? node.surface : null;

  if (primitive === 'heading') {
    classList.push('wf-heading');
    if (level && Number.isInteger(level) && level >= 1 && level <= 6) {
      classList.push(`wf-heading-${level}`);
    }
  } else if (primitive === 'table') {
    classList.push('wf-table');
    if (explicitSurface !== false) {
      classList.push('wf-surface');
    }
  } else if (primitive === 'section') {
    classList.push('wf-section');
    if (explicitSurface !== false) {
      classList.push('wf-surface');
    }
  } else if (primitive === 'tab_bar') {
    classList.push('wf-tab-bar', 'wf-surface');
  } else if (primitive === 'bottom_tab_bar') {
    classList.push('wf-bottom-tab-bar', 'wf-surface');
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
  if (typeof paneSide === 'string' && paneSide.trim() !== '') {
    classList.push('wf-pane', `wf-pane-${toSafeClass(paneSide)}`);
  }
  if (typeof node?.role === 'string' && node.role.trim() !== '') {
    classList.push(`wf-role-${toSafeClass(node.role.trim())}`);
  }

  if (explicitSurface === true && !classList.includes('wf-surface')) {
    classList.push('wf-surface');
  }

  return classList.join(' ');
}

function sectionBodyDividerClass(layout) {
  if (!shouldRenderParentSeparators(layout)) return '';
  const type = layout.type || 'stack';
  return type === 'row' ? ' wf-divide-x' : ' wf-divide-y';
}

function joinAttrs(nodeId, classes, style, extraAttrs = []) {
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
  if (Array.isArray(extraAttrs)) {
    for (const attr of extraAttrs) {
      if (typeof attr === 'string' && attr.trim() !== '') {
        attrs.push(attr.trim());
      }
    }
  }
  return attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
}

function primaryNavigationTarget(node, options = {}) {
  if (!Array.isArray(node?.interaction) || node.interaction.length !== 1) {
    return null;
  }

  const interaction = node.interaction[0];
  if (!isObject(interaction) || interaction.type !== 'navigation' || interaction.condition || typeof interaction.targetRoute !== 'string') {
    return null;
  }

  const routeId = interaction.targetRoute.trim();
  if (!routeId) {
    return null;
  }

  const routeTable = isObject(options.routeTable) ? options.routeTable : {};
  const href = typeof routeTable[routeId] === 'string' && routeTable[routeId].trim() !== ''
    ? routeTable[routeId].trim()
    : null;

  return href ? { routeId, href } : null;
}

function navigationAttrs(navTarget) {
  if (!navTarget) {
    return [];
  }

  return [
    `href="${escapeAttr(navTarget.href)}"`,
    `data-wf-route-target="${escapeAttr(navTarget.routeId)}"`,
  ];
}

function renderImageElement(projectPath, props, options = {}) {
  const rawSource = resolveAttributeValue(typeof props.src === 'string' ? props.src.trim() : '', options);
  const alt = resolveAttributeValue(
    typeof props.alt === 'string' ? props.alt : 'Image',
    options,
  ) || 'Image';
  const width = toPx(props.width);
  const height = toPx(props.height);

  const resolvedSource = readLocalImage(projectPath, rawSource, {
    assetUrlPrefix: options && typeof options.assetUrlPrefix === 'string' ? options.assetUrlPrefix : '',
  }) || (rawSource ? rawSource : null);
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

function renderSectionTitle(props, options = {}) {
  const titleValue = isObject(props) && Object.prototype.hasOwnProperty.call(props, 'title')
    ? props.title
    : 'Section';
  return `<div class="wf-section-title">${renderBoundText(titleValue, options)}</div>`;
}

function deriveKeyFromLabel(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeTableColumns(props) {
  if (!Array.isArray(props?.columns)) {
    return [];
  }

  return props.columns
    .map((entry, index) => {
      if (typeof entry === 'string' && entry.trim() !== '') {
        const key = entry.trim();
        return {
          key,
          label: key,
          width: '',
          index,
        };
      }

      if (!isObject(entry)) {
        return null;
      }

      let key = typeof entry.key === 'string' && entry.key.trim() !== ''
        ? entry.key.trim()
        : '';

      if (!key && typeof entry.label === 'string' && entry.label.trim() !== '') {
        key = deriveKeyFromLabel(entry.label);
      }

      if (!key) {
        return null;
      }

      const label = typeof entry.label === 'string' && entry.label.trim() !== ''
        ? entry.label.trim()
        : key;
      const width = typeof entry.width === 'number' && Number.isFinite(entry.width)
        ? `${entry.width}px`
        : typeof entry.width === 'string' && entry.width.trim() !== ''
          ? entry.width.trim()
          : '';

      return {
        key,
        label,
        width,
        index,
      };
    })
    .filter(Boolean);
}

function tableGridTemplate(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }

  return columns
    .map((column) => column.width || 'minmax(0,1fr)')
    .join(' ');
}

function resolveTableRows(node, props, options = {}) {
  const collection = resolveCollectionItems(node.binding, options);
  if (Array.isArray(collection.items) && collection.items.length > 0) {
    return collection.items;
  }

  return Array.isArray(props?.rows) ? props.rows : [];
}

function renderTableValue(value, bindingContext) {
  if (typeof value === 'string') {
    return renderBoundText(value, bindingContext);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return escapeHtml(String(value));
  }
  return '';
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

  if (type === 'dropdown' || type === 'popover' || type === 'menu' || type === 'tooltip') {
    const style = [
      'position:fixed',
      'display:none',
      'z-index:' + zIndex,
    ];
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

function overlaySizeStyle(size) {
  if (!isObject(size)) return '';
  const parts = [];
  if (size.width != null) parts.push(`width:${toPx(size.width)}`);
  if (size.height != null) parts.push(`height:${toPx(size.height)}`);
  if (size.minWidth != null) parts.push(`min-width:${toPx(size.minWidth)}`);
  if (size.maxWidth != null) parts.push(`max-width:${toPx(size.maxWidth)}`);
  if (size.minHeight != null) parts.push(`min-height:${toPx(size.minHeight)}`);
  if (size.maxHeight != null) parts.push(`max-height:${toPx(size.maxHeight)}`);
  return parts.join(';');
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
  const stateBindings = isObject(node.stateBindings) ? { ...node.stateBindings } : {};
  const dataAttrs = buildNodeDataAttributes(node, stateBindings);
  const children = renderChildren(node, options);
  const backdrop = overlayTypeNeedsBackdrop(overlayType)
    ? '<div class="wf-overlay-backdrop" aria-hidden="true" style="position:absolute;inset:0;background:rgba(0,0,0,0.3);display:none;"></div>'
    : '';

  const contentSizeStyle = overlaySizeStyle(node.size);
  const contentStyleAttr = contentSizeStyle ? ` style="${escapeAttr(contentSizeStyle)}"` : '';

  return `<div${joinAttrs(node.id, overlayClasses, overlayStyle)}${dataAttrs}>${backdrop}<div class="wf-overlay-content"${contentStyleAttr}>${children}</div></div>`;
}

function renderNode(node, options = {}) {
  if (!isObject(node)) {
    return '';
  }

  const component = node.component;
  const primitiveName = String(component || '');
  const isBorderless = BORDERLESS_PRIMITIVES.has(primitiveName);
  const props = isObject(node.props) ? node.props : {};
  const layout = isObject(node.layout) ? node.layout : {};
  const size = isObject(node.size) ? node.size : {};
  const gridItem = isObject(node.gridItem) ? node.gridItem : {};
  const defaultGridColumns = Number.isInteger(options.defaultGridColumns)
    ? options.defaultGridColumns
    : undefined;
  const nodeStyle = isObject(node.wireframeStyle) ? node.wireframeStyle : {};
  const nodeWireframeOverrides = wireframeNodeStyleOverrides(nodeStyle, options.pageStyle, options.rendering);
  const parentLayoutType = options.parentLayoutType || 'stack';
  const paneData = normalizePane(node.pane, parentLayoutType);
  const projectPath = options.projectPath || '';
  const stateBindings = isObject(node.stateBindings) ? { ...node.stateBindings } : {};
  const selectionValue = options.selectionValue;
  const bindingContext = {
    routeId: options.routeId || '',
    props,
    item: options.itemContext || {},
    itemVar: options.itemVar || 'item',
  };
  const navigationTarget = primaryNavigationTarget(node, options);

  const collectionData = primitiveName === 'table' ? null : renderCollectionNode(node, options);
  if (collectionData) {
    return collectionData.items
      .map((item, index) => {
        const clone = cloneNode(collectionData.cloned);
        if (!isObject(clone)) {
          return '';
        }
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

  const childStyle = [
    layoutToCss(layout, size, { defaultGridColumns, density: options.density }),
    layoutItemCss(gridItem),
    absoluteChildStyle(node.position, parentLayoutType),
    paneMetaToStyle(paneData),
    surfaceElevationOverride(node.elevation, options.rendering),
    // In mode contexts, CSS mode rules own all border/background — skip inline border.
    (isBorderless || options.mode) ? '' : wfNodeBorderStyle,
    nodeWireframeOverrides,
  ].filter(Boolean).join(';');

  const headingLevel = Number.isInteger(props.level) ? props.level : 3;
  const safeHeadingLevel = Math.max(1, Math.min(6, headingLevel));
  const dataAttrs = () => buildNodeDataAttributes(node, stateBindings, selectionValue, paneData);
  const isOverlayRoot = node.kind === 'overlay';
  const paneSide = paneData ? paneData.side : null;
  const primitives = {
    heading: () => {
      const classes = buildNodeClasses(node, 'heading', safeHeadingLevel, paneSide);
      const headingText = renderBoundText(
        typeof props.text === 'string' ? props.text : 'Heading',
        bindingContext,
      );
      const headingContent = navigationTarget
        ? `<a${joinAttrs(null, 'wf-inline-link', null, navigationAttrs(navigationTarget))}>${headingText}</a>`
        : headingText;
      const body = `<h${safeHeadingLevel}>${
        headingContent
      }</h${safeHeadingLevel}>`;
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}>${body}${renderChildren(node, options)}</div>`;
    },
    paragraph: () => {
      const classes = buildNodeClasses(node, 'paragraph', null, paneSide);
      const paragraphText = renderBoundText(typeof props.text === 'string' ? props.text : '', bindingContext);
      const paragraphContent = navigationTarget
        ? `<a${joinAttrs(null, 'wf-inline-link', null, navigationAttrs(navigationTarget))}>${paragraphText}</a>`
        : paragraphText;
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><p>${
        paragraphContent
      }</p>${renderChildren(node, options)}</div>`;
    },
    text: () => {
      const classes = buildNodeClasses(node, 'text', null, paneSide);
      const textContent = renderBoundText(typeof props.text === 'string' ? props.text : '', bindingContext);
      const textBody = navigationTarget
        ? `<a${joinAttrs(null, 'wf-inline-link', null, navigationAttrs(navigationTarget))}>${textContent}</a>`
        : textContent;
      return `<span${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}>${
        textBody
      }</span>${renderChildren(node, options)}`;
    },
    image: () => {
      const classes = buildNodeClasses(node, 'image', null, paneSide);
      const image = renderImageElement(projectPath, props, {
        ...bindingContext,
        assetUrlPrefix: options && typeof options.assetUrlPrefix === 'string' ? options.assetUrlPrefix : '',
      });
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}>${image}</div>`;
    },
    icon: () => {
      const classes = buildNodeClasses(node, 'icon', null, paneSide);
      const iconName = typeof props.name === 'string' ? props.name.trim() : 'circle-question';
      const iconStyle = typeof props.style === 'string' ? props.style.trim() : 'solid';
      const faPrefix = iconStyle === 'regular' ? 'fa-regular' : iconStyle === 'brands' ? 'fa-brands' : 'fa-solid';
      const sizeClass = typeof props.size === 'string' ? ` fa-${escapeAttr(props.size)}` : '';
      return `<span${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><i class="${faPrefix} fa-${escapeAttr(iconName)}${sizeClass}"></i></span>`;
    },
    button: () => {
      const classes = buildNodeClasses(node, 'button', null, paneSide);
      const hasIcon = typeof props.icon === 'string' && props.icon.trim() !== '';
      const rawLabel = typeof props.label === 'string' ? props.label : (hasIcon ? '' : 'Button');
      const buttonLabel = renderBoundText(rawLabel, bindingContext);
      const iconName = typeof props.icon === 'string' ? props.icon.trim() : '';
      const iconStyleProp = typeof props.iconStyle === 'string' ? props.iconStyle.trim() : 'solid';
      const iconPrefix = iconStyleProp === 'regular' ? 'fa-regular' : iconStyleProp === 'brands' ? 'fa-brands' : 'fa-solid';
      const iconSizeClass = typeof props.iconSize === 'string' ? ` fa-${escapeAttr(props.iconSize)}` : '';
      const iconHtml = iconName !== ''
        ? `<i class="${iconPrefix} fa-${escapeAttr(iconName)}${iconSizeClass}"></i> `
        : '';
      const renderedLabel = options.mode === 'line'
        ? `[ ${iconHtml}${buttonLabel} ]`
        : `${iconHtml}${buttonLabel}`;
      const buttonMarkup = navigationTarget
        ? `<a${joinAttrs(null, 'wf-button-link', null, navigationAttrs(navigationTarget))}>${renderedLabel}</a>`
        : `<button>${renderedLabel}</button>`;
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}>${buttonMarkup}${renderChildren(node, options)}</div>`;
    },
    tab_bar: () => {
      const classes = buildNodeClasses(node, 'tab_bar', null, paneSide);
      const tabLayout = Object.keys(layout).length > 0
        ? layout
        : {
          type: 'row',
          gap: 8,
          separatorPolicy: 'none',
          padding: 0,
          align: 'stretch',
        };
      const bodyChildren = renderChildren({
        ...node,
        layout: tabLayout,
      }, {
        ...options,
        parentLayoutType: tabLayout.type || 'row',
      });
      const bodyLayoutCss = layoutToCss(tabLayout, {}, { defaultGridColumns, density: options.density });
      const bodyDividerClass = sectionBodyDividerClass(tabLayout);
      const bodyStyleAttr = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><div class="wf-tab-bar-body${bodyDividerClass}"${bodyStyleAttr}>${bodyChildren}</div></div>`;
    },
    bottom_tab_bar: () => {
      const classes = buildNodeClasses(node, 'bottom_tab_bar', null, paneSide);
      const tabLayout = Object.keys(layout).length > 0
        ? layout
        : {
          type: 'row',
          gap: 4,
          separatorPolicy: 'none',
          padding: 0,
          align: 'stretch',
        };
      const bodyChildren = renderChildren({
        ...node,
        layout: tabLayout,
      }, {
        ...options,
        parentLayoutType: tabLayout.type || 'row',
      });
      const bodyLayoutCss = layoutToCss(tabLayout, {}, { defaultGridColumns, density: options.density });
      const bodyDividerClass = sectionBodyDividerClass(tabLayout);
      const bodyStyleAttr = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><div class="wf-bottom-tab-bar-body${bodyDividerClass}"${bodyStyleAttr}>${bodyChildren}</div></div>`;
    },
    input: () => {
      const classes = buildNodeClasses(node, 'input', null, paneSide);
      const inputType = ['text', 'password', 'email', 'number', 'search'].includes(props.inputType) ? props.inputType : 'text';
      const placeholder = resolveAttributeValue(
        typeof props.placeholder === 'string' ? props.placeholder : '',
        bindingContext,
        stateBindings,
        'placeholder',
      );
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><input type="${inputType}" placeholder="${escapeAttr(placeholder)}" /></div>`;
    },
    textarea: () => {
      const classes = buildNodeClasses(node, 'textarea', null, paneSide);
      const rows = Number.isInteger(props.rows) && props.rows > 0 ? props.rows : 3;
      const placeholder = resolveAttributeValue(
        typeof props.placeholder === 'string' ? props.placeholder : '',
        bindingContext,
        stateBindings,
        'placeholder',
      );
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><textarea placeholder="${escapeAttr(placeholder)}" rows="${rows}"></textarea>${renderChildren(node, options)}</div>`;
    },
    select: () => {
      const classes = buildNodeClasses(node, 'select', null, paneSide);
      const placeholder = resolveAttributeValue(
        typeof props.placeholder === 'string' ? props.placeholder : 'Select',
        bindingContext,
        stateBindings,
        'placeholder',
      );
      const optionsMarkup = renderSelectOptions(Array.isArray(props.options) ? props.options : []);
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><select><option value="">${escapeHtml(placeholder)}</option>${optionsMarkup}</select>${renderChildren(node, options)}</div>`;
    },
    checkbox: () => {
      const classes = buildNodeClasses(node, 'checkbox', null, paneSide);
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><label><input type="checkbox" /> ${
        renderBoundText(typeof props.label === 'string' ? props.label : 'Checkbox', bindingContext)
      }</label>${renderChildren(node, options)}</div>`;
    },
    toggle: () => {
      const classes = buildNodeClasses(node, 'toggle', null, paneSide);
      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><label><span class="wf-toggle-track"><span class="wf-toggle-thumb"></span></span> ${
        renderBoundText(typeof props.label === 'string' ? props.label : 'Toggle', bindingContext)
      }</label>${renderChildren(node, options)}</div>`;
    },
    table: () => {
      const classes = buildNodeClasses(node, 'table', null, paneSide);
      const columns = normalizeTableColumns(props);
      const rows = resolveTableRows(node, props, options);
      const itemVar = typeof node?.binding?.itemVar === 'string' && node.binding.itemVar.trim() !== ''
        ? node.binding.itemVar.trim()
        : 'item';
      const template = tableGridTemplate(columns);
      const gridStyleAttr = template ? ` style="${escapeAttr(`grid-template-columns:${template}`)}"` : '';
      const headerMarkup = columns.length > 0
        ? columns.map((column) => (
          `<div class="wf-table-cell wf-table-header-cell" data-wf-table-column="${column.index}">${
            renderBoundText(column.label, bindingContext)
          }</div>`
        )).join('')
        : '<div class="wf-table-cell wf-table-header-cell">Table</div>';
      const bodyMarkup = rows.length > 0
        ? rows.map((row, rowIndex) => {
          const rowContext = isObject(row) ? row : {};
          const rowBindingContext = {
            ...bindingContext,
            item: rowContext,
            itemVar,
          };

          return `<div class="wf-table-row wf-table-grid" data-wf-table-row="${rowIndex}"${gridStyleAttr}>${
            columns.map((column) => (
              `<div class="wf-table-cell" data-wf-table-column="${column.index}">${
                renderTableValue(getPathValue(rowContext, column.key), rowBindingContext)
              }</div>`
            )).join('')
          }</div>`;
        }).join('')
        : `<div class="wf-table-row wf-table-row-empty"${gridStyleAttr}><div class="wf-table-cell">${
          escapeHtml(typeof props.emptyText === 'string' && props.emptyText.trim() !== '' ? props.emptyText : 'No rows')
        }</div></div>`;

      return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}><div class="wf-table-header wf-table-grid"${gridStyleAttr}>${headerMarkup}</div><div class="wf-table-body">${bodyMarkup}</div></div>`;
    },
    section: () => {
      const classes = buildNodeClasses(node, 'section', null, paneSide);
      const sectionLayoutType = isObject(node.layout) ? node.layout.type || 'stack' : 'stack';
      const children = renderChildren(node, {
        ...options,
        parentLayoutType: sectionLayoutType,
      });
      const sectionTitle = renderSectionTitle(
        {
          title: resolveAttributeValue(
            typeof props.title === 'string' ? props.title : 'Section',
            bindingContext,
            stateBindings,
            'title',
          ),
        },
        bindingContext,
      );
      const sectionOuterStyle = [
        layoutToCss({}, size, { defaultGridColumns, density: options.density }),
        layoutItemCss(gridItem),
        absoluteChildStyle(node.position, parentLayoutType),
        paneMetaToStyle(paneData),
        surfaceElevationOverride(node.elevation, options.rendering),
        (isBorderless || options.mode) ? '' : wfNodeBorderStyle,
        nodeWireframeOverrides,
      ].filter(Boolean).join(';');
      const bodyLayoutCss = layoutToCss(layout, {}, { defaultGridColumns, density: options.density });
      const bodyDividerClass = sectionBodyDividerClass(layout);
      const bodyClass = `wf-section-body${bodyDividerClass}`;
      const bodyStyleAttr = bodyLayoutCss ? ` style="${escapeAttr(bodyLayoutCss)}"` : '';
      return `<div${joinAttrs(node.id, classes, sectionOuterStyle)}${dataAttrs()}>${sectionTitle}<div class="${bodyClass}"${bodyStyleAttr}>${children}</div></div>`;
    },
    divider: () => {
      const classes = buildNodeClasses(node, 'divider', null, paneSide);
      return `<hr${joinAttrs(node.id, classes, childStyle)}${dataAttrs()} />`;
    },
    spacer: () => {
      const classes = buildNodeClasses(node, 'spacer', null, paneSide);
      const size = toPx(Number.isFinite(props.size) ? Number(props.size) : Number(props.size) || 16);
      const orientation = options.parentLayoutType === 'row' ? 'width' : 'height';
      const spacerStyle = size ? `${childStyle}${childStyle ? ';' : ''}${orientation}:${size}` : childStyle;
      return `<div${joinAttrs(node.id, classes, spacerStyle)}${dataAttrs()}></div>`;
    },
  };

  if (isOverlayRoot) {
    return renderOverlay(node, options, childStyle);
  }

  if (primitiveName && PRIMITIVE_COMPONENTS.has(primitiveName)) {
    const renderPrimitive = primitives[primitiveName];
    if (renderPrimitive) {
      return renderPrimitive();
    }
  }

  const childNodes = renderChildren(node, options);
  const classes = buildNodeClasses(node, primitiveName, null, paneSide);
  return `<div${joinAttrs(node.id, classes, childStyle)}${dataAttrs()}>${childNodes}</div>`;
}

function renderNodes(nodes, options = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  return nodes
    .map((node) => renderNode(node, options))
    .join('\n');
}

module.exports = {
  renderNode,
  renderNodes,
  readLocalImage,
};
