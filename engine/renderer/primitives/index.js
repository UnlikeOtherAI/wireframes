'use strict';

const { textRenderers } = require('./text');
const { controlRenderers } = require('./controls');
const { navigationRenderers } = require('./navigation');
const { tableRenderers } = require('./table');
const { chartRenderers } = require('./chart');
const { structureRenderers } = require('./data-structures');
const { containerRenderers } = require('./containers');

const PRIMITIVE_RENDERERS = {
  ...containerRenderers,
  ...textRenderers,
  ...controlRenderers,
  ...navigationRenderers,
  ...tableRenderers,
  ...chartRenderers,
  ...structureRenderers,
};

module.exports = { PRIMITIVE_RENDERERS };
