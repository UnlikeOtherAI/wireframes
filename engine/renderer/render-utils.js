'use strict';

const { toPx } = require('./layout');

const PANE_SIDES = new Set(['left', 'right', 'center']);
const BINDING_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\.([a-zA-Z0-9_.]+)\s*\}\}/g;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

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

function renderSkeleton(width) {
  const cssWidth = typeof width === 'number' && Number.isFinite(width)
    ? `${width}ch`
    : String(width || '8ch');
  return `<span class="wf-bar" style="width:${escapeAttr(cssWidth)}"></span>`;
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
      const rendered = resolved == null ? '' : String(resolved);
      parts.push(rendered === '' ? renderSkeleton(8) : escapeHtml(rendered));
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

module.exports = {
  isObject,
  isBoundSelectionValue,
  serializeSelectionValue,
  cloneNode,
  suffixNodeIds,
  resolveCollectionItems,
  getBindingItemVar,
  renderCollectionNode,
  getPathValue,
  resolveTemplateToken,
  renderSkeleton,
  renderBoundText,
  resolveAttributeValue,
  normalizeChildren,
  normalizePaneSide,
  normalizePane,
  paneMetaToStyle,
  escapeHtml,
  escapeAttr,
  toSafeClass,
  nodeComponent,
};
