'use strict';

// Build/CLI entry only. Browser hosts bundle the compact index, never SVG metadata.
const metadata = require('@fortawesome/fontawesome-free/metadata/icon-families.json');
const { createIconIndex } = require('./search');

module.exports = createIconIndex(metadata);
