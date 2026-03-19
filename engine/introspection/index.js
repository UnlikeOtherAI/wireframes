'use strict';

const path = require('node:path');
const { inspectAddress } = require(path.resolve(__dirname, 'inspect'));
const { findUsagesForId, findComponentUsages, listDataUsages, listUsedComponents } = require(path.resolve(__dirname, 'usage'));
const { listRoutes } = require(path.resolve(__dirname, 'routes'));
const { collectProjectStats } = require(path.resolve(__dirname, 'stats'));
const { collectNodeComponentUsages } = require(path.resolve(__dirname, 'helpers'));

module.exports = {
  collectComponentUsagesFromNodes: collectNodeComponentUsages,
  collectProjectStats,
  findComponentUsages,
  findUsagesForId,
  inspectAddress,
  listDataUsages,
  listRoutes,
  listUsedComponents,
  collectProjectStats,
};
