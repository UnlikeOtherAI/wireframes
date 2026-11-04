'use strict';

// Per-node wireframeStyle overrides live here; rendering-mode CSS lives in ./styles/.

const { toPx } = require('./layout');

// Per-node wireframeStyle override helpers live here; mode CSS strings live in ./styles/.
const CARD_SHADOWS = {
  0: 'none',
  1: '0 1px 3px rgba(0,0,0,0.08)',
  2: '0 6px 16px rgba(0,0,0,0.12)',
  3: '0 12px 28px rgba(0,0,0,0.16)',
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function wireframeBorderCss(mergedStyle = {}) {
  const border = mergedStyle.border || {};
  const borderStyle = border.style || 'solid';
  const borderWidth = border.width === 'medium' ? 2 : 1;
  const width = toPx(borderWidth);
  const corner = mergedStyle.corner || {};
  const radius = Number.isFinite(corner.radius) ? `${corner.radius}px` : (corner.radius != null ? toPx(corner.radius) : '0px');
  const borderRadius = corner.style === 'sharp' ? '0px' : corner.style === 'pill' ? '9999px' : radius;

  return `border:${width} ${borderStyle} #333; border-radius:${borderRadius}`;
}

function resolveRenderingMode(rendering = {}) {
  return rendering?.mode === 'line' ? 'line' : 'card';
}

function scaleSurfaceRadius(radius, mode) {
  if (mode !== 'line') {
    return radius;
  }

  const numericRadius = Number.parseFloat(String(radius || '0'));
  if (!Number.isFinite(numericRadius)) {
    return radius;
  }

  const scaled = Number((numericRadius / 3).toFixed(2));
  return `${scaled}px`;
}

function resolveSurfaceShadow(elevation, rendering = {}) {
  const mode = resolveRenderingMode(rendering);
  if (mode !== 'card') {
    return 'none';
  }

  const normalized = Number.isInteger(elevation)
    ? elevation
    : Number.isFinite(Number(elevation))
      ? Math.round(Number(elevation))
      : 1;
  const clamped = Math.max(0, Math.min(3, normalized));

  return CARD_SHADOWS[clamped];
}

function resolveWireframeStyle(style = {}, rendering = {}) {
  const border = isObject(style.border) ? style.border : {};
  const corner = isObject(style.corner) ? style.corner : {};
  const mode = resolveRenderingMode(rendering);

  const borderStyle = border.style === 'dashed' ? 'dashed' : 'solid';
  const borderWidth = border.width === 'medium'
    ? '2px'
    : border.width === 'thin'
      ? '1px'
      : Number.isFinite(border.width)
        ? `${border.width}px`
        : toPx(border.width) || '1px';

  const cornerStyle = ['rounded', 'pill'].includes(corner.style) ? corner.style : 'sharp';
  const radius = Number.isFinite(corner.radius)
    ? `${corner.radius}px`
    : corner.radius != null
      ? (toPx(corner.radius) || '0px')
      : '0px';
  const cornerRadius = cornerStyle === 'sharp' ? '0px' : cornerStyle === 'pill' ? '9999px' : radius;

  return {
    borderStyle,
    borderWidth,
    cornerStyle,
    cornerRadius,
    surfaceRadius: cornerStyle === 'sharp' ? '0px' : cornerStyle === 'pill' ? '9999px' : scaleSurfaceRadius(cornerRadius, mode),
    surfaceShadow: resolveSurfaceShadow(1, rendering),
  };
}

function wireframeRootStyle(pageStyle = {}, overlayStyle = {}, rendering = {}) {
  const base = resolveWireframeStyle(pageStyle, rendering);
  const overrides = wireframeNodeStyleOverrides(overlayStyle, pageStyle, rendering);

  const baseStyles = [
    `--wf-border-width:${base.borderWidth}`,
    `--wf-border-style:${base.borderStyle}`,
    `--wf-corner-radius:${base.cornerRadius}`,
    `--wf-surface-radius:${base.surfaceRadius}`,
    `--wf-surface-shadow:${base.surfaceShadow}`,
  ].join(';');

  return [baseStyles, overrides].filter(Boolean).join(';');
}

function surfaceElevationOverride(elevation, rendering = {}) {
  if (elevation == null) {
    return '';
  }

  return `--wf-surface-shadow:${resolveSurfaceShadow(elevation, rendering)}`;
}

function wireframeNodeStyleOverrides(nodeStyle = {}, pageStyle = {}, rendering = {}) {
  if (!isObject(nodeStyle)) {
    return '';
  }

  const page = resolveWireframeStyle(pageStyle, rendering);
  const next = resolveWireframeStyle(mergeWireframeStyle(pageStyle, nodeStyle), rendering);
  const overrides = {};

  if (next.borderStyle !== page.borderStyle) {
    overrides['--wf-border-style'] = next.borderStyle;
  }

  if (next.borderWidth !== page.borderWidth) {
    overrides['--wf-border-width'] = next.borderWidth;
  }

  if (next.cornerStyle !== 'pill' && next.cornerRadius !== page.cornerRadius) {
    overrides['--wf-corner-radius'] = next.cornerRadius;
  }

  if (next.cornerStyle !== 'pill' && next.surfaceRadius !== page.surfaceRadius) {
    overrides['--wf-surface-radius'] = next.surfaceRadius;
  }

  return Object.entries(overrides).map(([key, value]) => `${key}:${value}`).join(';');
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

function normalizeAssetUrlPrefix(prefix) {
  if (typeof prefix !== 'string') {
    return '';
  }
  const trimmed = prefix.trim();
  if (!trimmed) {
    return '';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function extname(filePath) {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filePath.length - 1) {
    return '';
  }
  return filePath.slice(lastDot);
}

function readLocalImage(projectPath, source, options = {}) {
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

  const assetUrlPrefix = normalizeAssetUrlPrefix(options.assetUrlPrefix);
  if (assetUrlPrefix) {
    return `${assetUrlPrefix}${trimmed.replace(/^\/+/, '')}`;
  }

  if (typeof options.imageResolver === 'function') {
    return options.imageResolver(projectPath, trimmed);
  }

  return null;
}

module.exports = {
  wireframeBorderCss,
  wireframeNodeStyleOverrides,
  wireframeRootStyle,
  resolveRenderingMode,
  resolveSurfaceShadow,
  resolveWireframeStyle,
  mergeWireframeStyle,
  surfaceElevationOverride,
  readLocalImage,
  extname,
};
