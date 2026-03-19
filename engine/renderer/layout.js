'use strict';

const DEFAULT_GRID_COLUMNS = 12;
const DEFAULT_DENSITY = 'comfortable';
const DENSITY_FACTORS = {
  comfortable: 1,
  compact: 0.65,
};
const DIVIDER_POLICIES = new Set(['auto', 'gutters', 'divide', 'none']);

function toPx(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return null;
}

function resolveDensityFactor(density) {
  const key = typeof density === 'string' ? density.trim().toLowerCase() : DEFAULT_DENSITY;
  return Object.prototype.hasOwnProperty.call(DENSITY_FACTORS, key)
    ? DENSITY_FACTORS[key]
    : DENSITY_FACTORS[DEFAULT_DENSITY];
}

function scaleSpacingValue(value, factor) {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(factor) || factor === 1) {
    return value;
  }

  return Math.max(0, Math.round(value * factor));
}

function resolveSeparatorPolicy(layout = {}) {
  if (!isObject(layout)) {
    return 'none';
  }

  const gapValue = Number(layout.gap);
  if (Number.isFinite(gapValue) && gapValue > 0) {
    return 'gutters';
  }

  const separatorPolicy = typeof layout.separatorPolicy === 'string'
    ? layout.separatorPolicy.trim().toLowerCase()
    : '';
  if (DIVIDER_POLICIES.has(separatorPolicy)) {
    return separatorPolicy === 'auto' ? 'divide' : separatorPolicy;
  }

  if (layout.separators === 'between') {
    return 'divide';
  }

  return 'none';
}

function shouldRenderParentSeparators(layout = {}) {
  return resolveSeparatorPolicy(layout) === 'divide';
}

function layoutToCss(layout = {}, size = {}, options = {}) {
  if (!isObject(layout)) {
    return '';
  }

  const sizeProperties = isObject(size) ? size : {};
  const resolvedOptions = isObject(options) ? options : {};
  const defaultColumns = Number.isInteger(resolvedOptions.defaultGridColumns)
    ? resolvedOptions.defaultGridColumns
    : DEFAULT_GRID_COLUMNS;
  const densityFactor = resolveDensityFactor(resolvedOptions.density);

  const css = [];
  const type = layout.type || 'stack';

  if (type === 'stack') {
    css.push('display:flex', 'flex-direction:column');
  } else if (type === 'row') {
    css.push('display:flex', 'flex-direction:row');
  } else if (type === 'grid') {
    const columns = Number.isInteger(layout.columns) && layout.columns > 0
      ? layout.columns
      : defaultColumns;
    css.push('display:grid', `grid-template-columns:repeat(${columns},1fr)`);
  } else if (type === 'absolute') {
    css.push('position:relative');
  } else if (type === 'overlay') {
    css.push('position:relative');
  }

  if (layout.gap != null) {
    const gap = toPx(scaleSpacingValue(layout.gap, densityFactor));
    if (gap) {
      css.push(`gap:${gap}`);
    }
  }
  if (layout.padding != null) {
    const padding = toPx(scaleSpacingValue(layout.padding, densityFactor));
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
  if (layout.separatorStyle === 'dashed' || layout.separatorStyle === 'solid') {
    css.push(`--wf-divider-style:${layout.separatorStyle}`);
  }
  if (sizeProperties.width != null) {
    const width = toPx(sizeProperties.width);
    if (width) {
      css.push(`width:${width}`);
    }
  }
  if (sizeProperties.height != null) {
    const height = toPx(sizeProperties.height);
    if (height) {
      css.push(`height:${height}`);
    }
  }
  if (sizeProperties.minWidth != null) {
    const minWidth = toPx(sizeProperties.minWidth);
    if (minWidth) {
      css.push(`min-width:${minWidth}`);
    }
  }
  if (sizeProperties.maxWidth != null) {
    const maxWidth = toPx(sizeProperties.maxWidth);
    if (maxWidth) {
      css.push(`max-width:${maxWidth}`);
    }
  }
  if (sizeProperties.minHeight != null) {
    const minHeight = toPx(sizeProperties.minHeight);
    if (minHeight) {
      css.push(`min-height:${minHeight}`);
    }
  }
  if (sizeProperties.maxHeight != null) {
    const maxHeight = toPx(sizeProperties.maxHeight);
    if (maxHeight) {
      css.push(`max-height:${maxHeight}`);
    }
  }

  return css.join(';');
}

function layoutItemCss(gridItem = {}) {
  if (!isObject(gridItem)) {
    return '';
  }

  const css = [];
  if (gridItem.span != null) {
    css.push(`grid-column:span ${Number(gridItem.span)}`);
  }
  if (gridItem.offset != null) {
    const offset = Number(gridItem.offset);
    if (Number.isFinite(offset)) {
      css.push(`grid-column-start:${offset + 1}`);
    }
  }
  if (gridItem.row != null) {
    css.push(`grid-row:${gridItem.row}`);
  }
  if (gridItem.column != null) {
    css.push(`grid-column:${gridItem.column}`);
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

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  DEFAULT_GRID_COLUMNS,
  DEFAULT_DENSITY,
  DENSITY_FACTORS,
  toPx,
  resolveDensityFactor,
  resolveSeparatorPolicy,
  scaleSpacingValue,
  shouldRenderParentSeparators,
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
};
