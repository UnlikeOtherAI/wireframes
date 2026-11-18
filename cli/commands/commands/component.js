'use strict';

const path = require('node:path');
const {
  addComponent,
  listComponents,
  removeComponent,
} = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'component'));
const { describeComponent } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'component', 'describe'));
const { copyComponent } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'component', 'copy'));
const { builtinComponentIds } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'stdlib'));

const SUBCOMMAND_USAGE = 'Usage: wf component <add|remove|list|show|copy> [id]';

function flagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function runCopy(args, cwd) {
  const [, sourceId] = args;
  if (!sourceId || sourceId.startsWith('--')) {
    console.error('wf component copy requires a built-in id, for example std.login.');
    console.log('Usage: wf component copy std.<name> [--as <id>] [--file <path>]');
    process.exitCode = 2;
    return;
  }
  for (const flag of ['--as', '--file']) {
    if (args.includes(flag) && !flagValue(args, flag)) {
      console.error(`wf component copy: ${flag} needs a value.`);
      process.exitCode = 2;
      return;
    }
  }
  const result = copyComponent({
    projectPath: cwd,
    componentId: sourceId,
    as: flagValue(args, '--as'),
    file: flagValue(args, '--file'),
  });
  if (!result.ok) {
    console.error(`wf component copy failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Copied ${result.source} to ${result.filePath}${result.created ? ' (created)' : ''} as "${result.componentId}".`);
  console.log(result.useId
    ? `Use it with: use: ${result.useId}`
    : `Import ${result.filePath} from a page, template or components.yaml to use it.`);
}

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

  if (subcommand === 'show') {
    if (!targetId || targetId.trim() === '') {
      console.error('wf component show requires a component id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = describeComponent({ projectPath: cwd, componentId: targetId });
    if (!result.ok) {
      console.error(`wf component show failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }
    for (const line of result.lines) {
      console.log(line);
    }
    return;
  }

  if (subcommand === 'copy') {
    runCopy(args, cwd);
    return;
  }

  if (subcommand === 'list') {
    const ids = args.includes('--std') ? builtinComponentIds() : listComponents(cwd);
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
