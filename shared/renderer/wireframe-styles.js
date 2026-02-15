'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { toPx } = require('./layout');

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
  const borderRadius = corner.style === 'sharp' ? '0px' : radius;

  return `border:${width} ${borderStyle} #333; border-radius:${borderRadius}`;
}

function resolveWireframeStyle(style = {}) {
  const border = isObject(style.border) ? style.border : {};
  const corner = isObject(style.corner) ? style.corner : {};

  const borderStyle = border.style === 'dashed' ? 'dashed' : 'solid';
  const borderWidth = border.width === 'medium'
    ? '2px'
    : border.width === 'thin'
      ? '1px'
      : Number.isFinite(border.width)
        ? `${border.width}px`
        : toPx(border.width) || '1px';

  const cornerStyle = corner.style === 'rounded' ? 'rounded' : 'sharp';
  const radius = Number.isFinite(corner.radius)
    ? `${corner.radius}px`
    : corner.radius != null
      ? (toPx(corner.radius) || '0px')
      : '0px';

  return {
    borderStyle,
    borderWidth,
    cornerStyle,
    cornerRadius: cornerStyle === 'sharp' ? '0px' : radius,
  };
}

function wireframeRootStyle(pageStyle = {}, overlayStyle = {}) {
  const base = resolveWireframeStyle(pageStyle);
  const overrides = wireframeNodeStyleOverrides(overlayStyle, pageStyle);

  const baseStyles = [
    `--wf-border-width:${base.borderWidth}`,
    `--wf-border-style:${base.borderStyle}`,
    `--wf-corner-radius:${base.cornerRadius}`,
  ].join(';');

  return [baseStyles, overrides].filter(Boolean).join(';');
}

function wireframeNodeStyleOverrides(nodeStyle = {}, pageStyle = {}) {
  const page = resolveWireframeStyle(pageStyle);

  if (!isObject(nodeStyle)) {
    return '';
  }

  const border = isObject(nodeStyle.border) ? nodeStyle.border : {};
  const corner = isObject(nodeStyle.corner) ? nodeStyle.corner : {};
  const overrides = {};

  if (Object.prototype.hasOwnProperty.call(border, 'style')) {
    const nextBorderStyle = border.style === 'dashed' ? 'dashed' : 'solid';
    if (nextBorderStyle !== page.borderStyle) {
      overrides['--wf-border-style'] = nextBorderStyle;
    }
  }

  if (Object.prototype.hasOwnProperty.call(border, 'width')) {
    const nextBorderWidth = border.width === 'medium'
      ? '2px'
      : border.width === 'thin'
        ? '1px'
        : Number.isFinite(border.width)
          ? `${border.width}px`
          : toPx(border.width) || page.borderWidth;

    if (nextBorderWidth !== page.borderWidth) {
      overrides['--wf-border-width'] = nextBorderWidth;
    }
  }

  if (Object.prototype.hasOwnProperty.call(corner, 'radius')) {
    const nextCornerRadius = Number.isFinite(corner.radius)
      ? `${corner.radius}px`
      : (toPx(corner.radius) || page.cornerRadius);

    if (nextCornerRadius !== page.cornerRadius) {
      overrides['--wf-corner-radius'] = nextCornerRadius;
    }
  }

  if (Object.prototype.hasOwnProperty.call(corner, 'style')) {
    const nextCornerStyle = corner.style === 'rounded' ? 'rounded' : 'sharp';
    const nextCornerRadius = nextCornerStyle === 'sharp'
      ? '0px'
      : (Object.prototype.hasOwnProperty.call(corner, 'radius')
        ? overrides['--wf-corner-radius'] || page.cornerRadius
        : page.cornerRadius);

    if (nextCornerStyle !== page.cornerStyle) {
      overrides['--wf-corner-radius'] = nextCornerRadius;
    }
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

  const assetPath = path.join(projectPath, 'assets', trimmed.replace(/^\/+/, ''));
  if (!fs.existsSync(assetPath)) {
    return null;
  }

  const assetUrlPrefix = normalizeAssetUrlPrefix(options.assetUrlPrefix);
  if (assetUrlPrefix) {
    return `${assetUrlPrefix}${trimmed.replace(/^\/+/, '')}`;
  }

  const buffer = fs.readFileSync(assetPath);
  const extension = path.extname(assetPath).toLowerCase();
  const mime = extension === '.svg'
    ? 'image/svg+xml'
    : extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : extension === '.gif'
        ? 'image/gif'
        : extension === '.webp'
          ? 'image/webp'
          : 'image/png';

  return `data:${mime};base64,${buffer.toString('base64')}`;
}

module.exports = {
  wireframeBorderCss,
  wireframeNodeStyleOverrides,
  wireframeRootStyle,
  resolveWireframeStyle,
  mergeWireframeStyle,
  readLocalImage,
};
