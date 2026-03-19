'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { extname } = require('./wireframe-styles');

function fsImageResolver(projectPath, source) {
  const assetPath = path.join(projectPath, 'assets', source.replace(/^\/+/, ''));
  if (!fs.existsSync(assetPath)) {
    return null;
  }

  const buffer = fs.readFileSync(assetPath);
  const extension = extname(assetPath).toLowerCase();
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

module.exports = { fsImageResolver };
