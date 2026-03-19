'use strict';

const screenshotsRenderer = require('../screenshots/renderer');
const { buildInteractionRuntime } = require('./interactions');

module.exports = {
  renderWireframeMarkup: screenshotsRenderer.renderWireframeMarkup,
  renderNode: screenshotsRenderer.renderNode,
  renderNodes: screenshotsRenderer.renderNodes,
  readLocalImage: screenshotsRenderer.readLocalImage,
  buildInteractionRuntime,
};
