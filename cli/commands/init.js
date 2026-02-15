'use strict';

const path = require('node:path');
const { initProject } = require(path.resolve(__dirname, '..', '..', 'shared', 'init'));

function runInit(args, context = {}) {
  const [projectName] = args;
  const cwd = context.cwd || process.cwd();

  if (!projectName || projectName.trim() === '') {
    console.error('wf init requires a project name.');
    console.log('Usage: wf init <project-name>');
    process.exitCode = 2;
    return;
  }

  const result = initProject({
    projectName: projectName.trim(),
    projectPath: path.resolve(cwd, projectName.trim()),
  });

  console.log(`Created wireframe project at: ${result.projectPath}`);
  console.log(`  - manifest.yaml`);
  console.log(`  - .wfrc.yaml`);
  console.log(`  - sitemap.yaml`);
  console.log(`  - templates.yaml`);
  console.log(`  - components.yaml`);
  console.log(`  - pages/${result.starterPageId}.yaml`);
}

module.exports = { runInit };
