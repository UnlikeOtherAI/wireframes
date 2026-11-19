'use strict';

const { token } = require('./sizing-tokens');

// The span system's width. A grid only uses it when a child is placed with
// `gridItem` or the manifest sets `defaultGridColumns`.
const DEFAULT_GRID_COLUMNS = 12;
const GRID_PLACEMENT = ['span', 'offset', 'row', 'column'];
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

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** `manifest.defaultGridColumns` when the author set it, else null: unset is not 12. */
function resolveDefaultGridColumns(manifest) {
  return positiveInteger(Number(isObject(manifest) ? manifest.defaultGridColumns : undefined));
}

function isPlacedGridChild(child) {
  return isObject(child) && isObject(child.gridItem) && GRID_PLACEMENT.some((key) => child.gridItem[key] != null);
}

function autoFitTracks(min) {
  return `repeat(auto-fit,minmax(min(${min}px,100%),1fr))`;
}

/**
 * The one decision for a grid's tracks, shared by every host and by adaptive
 * mode (docs/done/2026-11-19-render-polish.md §9.1):
 *  1. a child placed with `gridItem` keeps the column system, even adapted;
 *  2. `minItemWidth` gives tiles of at least that width;
 *  3. adaptive mode gives tiles at the shown device's `grid.minItemWidth`;
 *  4. explicit `columns`, then an explicit manifest default;
 *  5. otherwise tiles at the page device's `grid.minItemWidth`.
 * Tracks never grow around their content, and a tile minimum never exceeds
 * the container.
 */
function gridTemplateColumns(layout = {}, options = {}) {
  const columns = positiveInteger(layout.columns);
  const fallback = positiveInteger(options.defaultGridColumns);
  const children = Array.isArray(options.children) ? options.children : [];
  if (children.some(isPlacedGridChild)) {
    return `repeat(${columns || fallback || DEFAULT_GRID_COLUMNS},minmax(0,1fr))`;
  }
  const authoredMin = options.minItemWidth == null ? NaN : Number(options.minItemWidth);
  if (Number.isFinite(authoredMin) && authoredMin > 0) return autoFitTracks(authoredMin);
  const tileMin = token('grid.minItemWidth', options.viewport, options.sizing);
  if (options.adaptive === true) return autoFitTracks(tileMin);
  if (columns || fallback) return `repeat(${columns || fallback},minmax(0,1fr))`;
  return autoFitTracks(tileMin);
}

function layoutToCss(layout = {}, size = {}, options = {}) {
  if (!isObject(layout)) {
    return '';
  }

  const sizeProperties = isObject(size) ? size : {};
  const resolvedOptions = isObject(options) ? options : {};
  const densityFactor = resolveDensityFactor(resolvedOptions.density);

  const css = [];
  const type = layout.type || 'stack';

  if (type === 'none') {
    // Leaf nodes with no authored layout: size only, let the element's CSS decide display.
  } else if (type === 'stack') {
    css.push('display:flex', 'flex-direction:column');
  } else if (type === 'row') {
    css.push('display:flex', 'flex-direction:row');
  } else if (type === 'grid') {
    css.push('display:grid', `grid-template-columns:${gridTemplateColumns(layout, resolvedOptions)}`);
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
  resolveDefaultGridColumns,
  gridTemplateColumns,
  toPx,
  resolveDensityFactor,
  resolveSeparatorPolicy,
  scaleSpacingValue,
  shouldRenderParentSeparators,
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
};
