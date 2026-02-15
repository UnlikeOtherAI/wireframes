'use strict';

const path = require('node:path');
const { listDatasets, dataStats } = require(path.resolve(__dirname, '..', 'data'));
const { listTemplates } = require(path.resolve(__dirname, '..', 'template'));
const { listPages } = require(path.resolve(__dirname, '..', 'page'));
const { listComponents } = require(path.resolve(__dirname, '..', 'component'));
const { listUsedComponents } = require('./usage');

function collectProjectStats({ projectPath }) {
  const totalPages = listPages(path.resolve(projectPath)).length;
  const totalTemplates = listTemplates(path.resolve(projectPath)).length;
  const componentList = listComponents(path.resolve(projectPath));
  const totalComponents = componentList.length;

  const used = listUsedComponents(path.resolve(projectPath));
  if (!used.ok) {
    return used;
  }

  const unusedComponents = componentList.filter((id) => !used.usedComponents.has(id)).sort();

  const datasetIds = listDatasets(path.resolve(projectPath));
  const datasetStats = [];
  for (const datasetId of datasetIds) {
    const stats = dataStats({ projectPath: path.resolve(projectPath), datasetId });
    if (!stats.ok) {
      return {
        ok: false,
        error: `Unable to collect stats for dataset "${datasetId}": ${stats.error}`,
      };
    }
    datasetStats.push({
      id: stats.datasetId,
      items: stats.itemCount,
      bytes: stats.byteSize,
    });
  }

  return {
    ok: true,
    totalPages,
    totalTemplates,
    totalComponents,
    unusedComponents,
    datasetStats,
  };
}

module.exports = { collectProjectStats };
