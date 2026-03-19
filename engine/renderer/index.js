'use strict';

const path = require('node:path');

const screenshotsRenderer = require(path.resolve(__dirname, '..', 'screenshots', 'renderer'));
const { buildInteractionRuntime } = require(path.resolve(__dirname, 'interactions'));

module.exports = {
  renderWireframeMarkup: screenshotsRenderer.renderWireframeMarkup,
  renderNode: screenshotsRenderer.renderNode,
  renderNodes: screenshotsRenderer.renderNodes,
  readLocalImage: screenshotsRenderer.readLocalImage,
  buildInteractionRuntime,
};
