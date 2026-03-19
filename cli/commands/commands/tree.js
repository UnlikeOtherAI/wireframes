'use strict';

const path = require('node:path');
const { buildTreeReport } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'tree'));

const SUBCOMMAND_USAGE = 'Usage: wf tree [page|template|component|all] [targetId] [--depth <n>] [--filter <text>]';
const VALID_TARGET_TYPES = new Set(['page', 'template', 'component', 'all']);

function parseTreeArgs(args) {
  const options = {
    targetType: 'all',
    targetId: null,
    depth: null,
    filter: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--depth') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --depth.');
      }

      const value = Number.parseInt(args[index + 1], 10);
      if (!Number.isInteger(value) || String(value) !== args[index + 1]) {
        throw new Error(`Invalid value for --depth: ${args[index + 1]}.`);
      }
      if (value < 0) {
        throw new Error('--depth must be 0 or greater.');
      }

      options.depth = value;
      index += 1;
      continue;
    }

    if (arg === '--filter') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --filter.');
      }

      options.filter = args[index + 1];
      index += 1;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    if (VALID_TARGET_TYPES.has(arg)) {
      if (options.targetType !== 'all') {
        throw new Error(`Unexpected target argument: ${arg}.`);
      }
      options.targetType = arg;
      continue;
    }

    if (options.targetId === null) {
      if (options.targetType === 'all') {
        throw new Error('targetId requires a target type of page, template, or component.');
      }

      options.targetId = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runTree(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  let options;

  try {
    options = parseTreeArgs(args);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = buildTreeReport({
    projectPath: cwd,
    targetType: options.targetType,
    targetId: options.targetId,
    depth: options.depth,
    filter: options.filter,
  });

  if (!result.ok) {
    console.error(`wf tree failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  for (const line of result.lines) {
    console.log(line);
  }
}

module.exports = { runTree };
