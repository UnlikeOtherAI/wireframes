'use strict';

const path = require('node:path');
const { findUsagesForId } = require(path.resolve(__dirname, '..', '..', 'shared', 'introspection'));

const SUBCOMMAND_USAGE = 'Usage: wf where-used <componentId|datasetId>';

function printUsages(label, usages) {
  console.log(`${label}:`);
  if (usages.length === 0) {
    console.log('  <none>');
    return;
  }

  for (const usage of usages) {
    console.log(`  ${usage}`);
  }
}

function runWhereUsed(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const id = args[0];

  if (!id) {
    console.error('wf where-used requires <componentId|datasetId>.');
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = findUsagesForId({
    projectPath: cwd,
    id,
  });

  if (!result.ok) {
    console.error(`wf where-used failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (result.component !== null) {
    printUsages(`Component ${result.id}`, result.component);
  }

  if (result.dataset !== null) {
    printUsages(`Dataset ${result.dataset.id}`, result.dataset.usages);
  }
}

module.exports = {
  runWhereUsed,
};
