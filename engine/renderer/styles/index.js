'use strict';

const { baseStyles } = require('./base');
const { componentStyles } = require('./components');

function buildWireframeStyles() {
  return [
    ...baseStyles,
    ...componentStyles,
  ].join('\n');
}

module.exports = { buildWireframeStyles };
