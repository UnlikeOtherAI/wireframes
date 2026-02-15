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

function readLocalImage(projectPath, source) {
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
  mergeWireframeStyle,
  readLocalImage,
};
