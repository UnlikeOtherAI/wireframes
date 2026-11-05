'use strict';

const { getPrimitive, resolvePrimitiveName } = require('../schema/primitive-registry');
const { isObject, manifestData } = require('./validate');

// Public renderers may be called without document validation. Only literal
// appearance values may reach CSS, including page and node-local overrides.
function safeAppearance(layer) {
  if (!isObject(layer)) return {};
  const result = {};
  const border = layer.border;
  if (isObject(border)) {
    result.border = {};
    if (['solid', 'dashed'].includes(border.style)) result.border.style = border.style;
    if (['thin', 'medium'].includes(border.width)) result.border.width = border.width;
  }
  const corner = layer.corner;
  if (isObject(corner)) {
    result.corner = {};
    if (['sharp', 'rounded', 'pill'].includes(corner.style)) result.corner.style = corner.style;
    if (Number.isFinite(corner.radius) && corner.radius >= 0) result.corner.radius = corner.radius;
  }
  if (isObject(layer.colors)) {
    result.colors = {};
    for (const field of ['text', 'background', 'border', 'accent']) {
      const value = layer.colors[field];
      if (typeof value === 'string' && (/^#[0-9a-f]{6}$/i.test(value)
        || (field === 'background' && value === 'transparent'))) result.colors[field] = value;
    }
  }
  return result;
}

function mergeAppearance(...layers) {
  const result = {};
  for (const layer of layers) {
    const safe = safeAppearance(layer);
    for (const key of ['border', 'corner', 'colors']) {
      if (safe[key]) result[key] = { ...result[key], ...safe[key] };
    }
  }
  return result;
}

function activeSkin(manifest) {
  const system = manifest?.designSystem;
  const id = system?.activeSkin ?? 'wireframe';
  return id !== 'wireframe' && Object.prototype.hasOwnProperty.call(system?.skins || {}, id) ? system.skins[id] : null;
}

/** Preserve the exact legacy page-style choice outside a named skin. */
function pageAppearance(manifest, pageStyle) {
  const skin = activeSkin(manifest);
  return {
    skin,
    pageStyle: skin
      ? mergeAppearance(manifest.defaultWireframeStyle, skin.defaults, pageStyle)
      : (pageStyle || manifest.defaultWireframeStyle || {}),
  };
}

function documentAppearance(documentMap, pageStyle) {
  return pageAppearance(manifestData(documentMap), pageStyle);
}

function standardRole(node) {
  const resolved = resolvePrimitiveName(node?.component);
  const entry = getPrimitive(resolved || '');
  const component = entry?.name || '';
  const variants = entry?.props?.variant?.enum || [];
  const variant = variants.includes(node?.props?.variant) ? node.props.variant : entry?.defaultVariant;
  return { component, variant: variant || null, role: variant ? `${component}.${variant}` : component };
}

function resolveAppearance(node, options = {}) {
  if (!options.skin) return null;
  const { component, variant, role } = standardRole(node);
  const baseRole = options.skin.roles?.[component];
  const variantRole = variant ? options.skin.roles?.[role] : null;
  const result = mergeAppearance(options.skin.defaults, options.pageStyle, baseRole, variantRole, node.wireframeStyle);
  result.colors = { ...result.colors };
  if (getPrimitive(component)?.shellBackground) {
    result.shellBackground = mergeAppearance(baseRole, variantRole, node.wireframeStyle).colors?.background;
  }
  const props = node.props || {};
  // Severity belongs to state, not a generic company palette.
  const severity = (component === 'button' && variant === 'danger')
    || (component === 'alert' && variant !== 'neutral');
  if (severity) {
    for (const field of ['text', 'border', 'accent']) {
      if (variantRole?.colors?.[field] === undefined) delete result.colors[field];
    }
    if (component === 'button' && variantRole?.colors?.background === undefined) delete result.colors.background;
  }
  if (props.tone && ['info', 'success', 'warning', 'danger'].includes(props.tone)) {
    delete result.colors.text;
    delete result.colors.border;
    delete result.colors.accent;
  }
  if (props.error) delete result.colors.border;
  result.role = role;
  return result;
}

module.exports = { mergeAppearance, activeSkin, pageAppearance, documentAppearance, standardRole, resolveAppearance };
