'use strict';

const { baseStyles } = require('./base');
const { containerStyles } = require('./containers');
const { contentStyles } = require('./content');
const { controlStyles } = require('./controls');
const { navigationStyles } = require('./navigation');
const { dataStyles } = require('./data');

function buildWireframeStyles() {
  return [
    baseStyles,
    containerStyles,
    contentStyles,
    controlStyles,
    navigationStyles,
    dataStyles,
  ].filter(Boolean).join('\n');
}

module.exports = { buildWireframeStyles };
