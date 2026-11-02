'use strict';

const { toPx } = require('./layout');
const { readLocalImage } = require('./wireframe-styles');
const {
  isObject,
  isBoundSelectionValue,
  serializeSelectionValue,
  escapeHtml,
  escapeAttr,
  toSafeClass,
  nodeComponent,
  renderBoundText,
  resolveAttributeValue,
} = require('./render-utils');

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

function buildNodeClasses(node, primitive, level = null, paneSide = null, isSurface = null) {
  const classList = ['wf-node'];
  const explicitSurface = typeof node?.surface === 'boolean' ? node.surface : null;

  if (primitive === 'heading') {
    classList.push('wf-heading');
    if (level && Number.isInteger(level) && level >= 1 && level <= 6) {
      classList.push(`wf-heading-${level}`);
    }
  } else if (primitive === 'text') {
    classList.push('wf-text');
    const variant = node?.props?.variant === 'meta' ? 'meta' : 'body';
    classList.push(`wf-text-${variant}`);
  } else if (primitive === 'button') {
    classList.push('wf-button');
    const allowedVariants = new Set(['primary', 'secondary', 'ghost', 'danger']);
    const variant = allowedVariants.has(node?.props?.variant) ? node.props.variant : 'secondary';
    classList.push(`wf-button-${variant}`);
  } else if (primitive === 'table') {
    classList.push('wf-table');
    if (isSurface === true || (isSurface == null && explicitSurface !== false)) {
      classList.push('wf-surface');
    }
  } else if (primitive === 'section') {
    classList.push('wf-section');
    if (isSurface === true || (isSurface == null && explicitSurface !== false)) {
      classList.push('wf-surface');
    } else {
      classList.push('wf-group');
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
    imageResolver: options?.imageResolver,
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
  const titleValue = isObject(props) && typeof props.title === 'string' && props.title.trim() !== ''
    ? props.title
    : '';
  if (!titleValue) {
    return '';
  }
  return `<div class="wf-section-title">${renderBoundText(titleValue, options)}</div>`;
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

module.exports = {
  buildNodeDataAttributes,
  buildNodeClasses,
  joinAttrs,
  primaryNavigationTarget,
  navigationAttrs,
  renderImageElement,
  renderSectionTitle,
  renderSelectOptions,
};
