'use strict';

const { baseStyles } = require('./base');
const { containerStyles } = require('./containers');
const { contentStyles } = require('./content');
const { controlStyles } = require('./controls');
const { navigationStyles } = require('./navigation');
const { dataStyles } = require('./data');
const { overlayStyles } = require('./overlays');
const { cornerStyles } = require('./corners');

function buildWireframeStyles() {
  return [
    baseStyles,
    containerStyles,
    contentStyles,
    controlStyles,
    navigationStyles,
    dataStyles,
    overlayStyles,
    cornerStyles,
  ].filter(Boolean).join('\n');
}

module.exports = { buildWireframeStyles };
