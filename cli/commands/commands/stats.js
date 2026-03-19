'use strict';

const path = require('node:path');
const { collectProjectStats } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'introspection'));

function runStats(_args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const result = collectProjectStats({ projectPath: cwd });

  if (!result.ok) {
    console.error(`wf stats failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Total pages: ${result.totalPages}`);
  console.log(`Total templates: ${result.totalTemplates}`);
  console.log(`Total components: ${result.totalComponents}`);

  console.log(`Unused components (${result.unusedComponents.length}):`);
  if (result.unusedComponents.length === 0) {
    console.log('  <none>');
  } else {
    for (const componentId of result.unusedComponents) {
      console.log(`  ${componentId}`);
    }
  }

  console.log('Datasets:');
  if (result.datasetStats.length === 0) {
    console.log('  <none>');
    return;
  }

  for (const dataset of result.datasetStats) {
    console.log(`  ${dataset.id}: ${dataset.items} items, ${dataset.bytes} bytes`);
  }
}

module.exports = {
  runStats,
};
