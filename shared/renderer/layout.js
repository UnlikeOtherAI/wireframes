'use strict';

const DEFAULT_GRID_COLUMNS = 12;

function toPx(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }
  return null;
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

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  DEFAULT_GRID_COLUMNS,
  toPx,
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
};
