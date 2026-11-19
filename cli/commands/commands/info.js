'use strict';

const path = require('node:path');
const { getProjectInfo } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'info'));

function formatStyle(value) {
  if (!value || typeof value !== 'object') {
    return `${value}`;
  }

  return JSON.stringify(value, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function runInfo(_args, context = {}) {
  const cwd = context.cwd || process.cwd();
  try {
    const info = getProjectInfo(cwd);
    console.log(`Project Name: ${info.projectName ?? '<missing>'}`);
    console.log(`Schema Version: ${info.schemaVersion ?? '<missing>'}`);
    console.log(`Created With CLI: ${info.createdWithCLI ?? '<missing>'}`);
    // Unset means tiles: a grid without columns or placed children fills the row.
    console.log(`Default Grid Columns: ${info.defaultGridColumns ?? 'auto'}`);
    console.log('Default Wireframe Style:');
    console.log(formatStyle(info.defaultWireframeStyle));
  } catch (error) {
    console.error(`wf info failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { runInfo };
