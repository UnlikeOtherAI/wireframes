'use strict';

const path = require('node:path');
const {
  addComponent,
  listComponents,
  removeComponent,
} = require(path.resolve(__dirname, '..', '..', 'shared', 'component'));

const SUBCOMMAND_USAGE = 'Usage: wf component <add|remove|list> [id]';

function runComponent(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [subcommand, targetId] = args;

  if (!subcommand) {
    console.error(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (subcommand === 'add') {
    if (!targetId || targetId.trim() === '') {
      console.error('wf component add requires a component id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addComponent({ projectPath: cwd, componentId: targetId.trim() });
    if (result.ok) {
      console.log(`Added component: ${result.componentId}`);
      return;
    }

    console.error(`wf component add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    if (!targetId || targetId.trim() === '') {
      console.error('wf component remove requires a component id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removeComponent({ projectPath: cwd, componentId: targetId.trim() });
    if (result.ok) {
      console.log(`Removed component: ${result.componentId}`);
      return;
    }

    console.error(`wf component remove failed: ${result.error}`);
    if (result.details && Array.isArray(result.details.usages) && result.details.usages.length > 0) {
      for (const usage of result.details.usages) {
        console.error(`  - used by: ${usage}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'list') {
    const ids = listComponents(cwd);
    for (const id of ids) {
      console.log(id);
    }
    return;
  }

  console.error(`Unknown component command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = {
  runComponent,
};
