'use strict';

const { textRenderers } = require('./text');
const { controlRenderers } = require('./controls');
const { navigationRenderers } = require('./navigation');
const { navRenderers } = require('./navigation-nav');
const { menuRenderers } = require('./navigation-menus');
const { tableRenderers } = require('./table');
const { chartRenderers } = require('./chart');
const { structureRenderers } = require('./data-structures');
const { containerRenderers } = require('./containers');

const PRIMITIVE_RENDERERS = {
  ...containerRenderers,
  ...textRenderers,
  ...controlRenderers,
  ...navigationRenderers,
  ...navRenderers,
  ...menuRenderers,
  ...tableRenderers,
  ...chartRenderers,
  ...structureRenderers,
};

module.exports = { PRIMITIVE_RENDERERS };
