'use strict';

// The disk half of the catalogue: the page plus the icon font it needs, so the
// committed copy opens offline with no CDN and no build step.

const fs = require('node:fs');
const path = require('node:path');

const { buildCataloguePage } = require('./index');
const { copyFontAwesomeAssets } = require('../build/fs-writer');

function writeCatalogue({ outputDir, mode, platform }) {
  if (!outputDir) return { ok: false, error: 'outputDir is required' };

  const page = buildCataloguePage({ mode, platform });
  fs.mkdirSync(outputDir, { recursive: true });
  const indexPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(indexPath, page, 'utf8');
  copyFontAwesomeAssets(path.join(outputDir, '_shared'));

  return { ok: true, indexPath, bytes: Buffer.byteLength(page, 'utf8') };
}

module.exports = { writeCatalogue };
