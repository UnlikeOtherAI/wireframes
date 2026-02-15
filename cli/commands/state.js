'use strict';

const path = require('node:path');
const { listStateKeys } = require(path.resolve(__dirname, '..', '..', 'shared', 'state'));

const SUBCOMMAND_USAGE = 'Usage: wf state <list> [--scope <app|page>] [--page <pageId>]';

function parseListArgs(args) {
  const options = {
    scope: 'all',
    page: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--scope') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --scope.');
      }
      options.scope = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--page') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --page.');
      }
      options.page = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runState(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [subcommand, ...rest] = args;

  if (!subcommand) {
    console.error(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (subcommand !== 'list') {
    console.error(`Unknown state command: ${subcommand}`);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 1;
    return;
  }

  let options;
  try {
    options = parseListArgs(rest);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (options.scope !== 'app' && options.scope !== 'page' && options.scope !== 'all') {
    console.error(`Invalid scope "${options.scope}". Allowed values: app, page.`);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (options.scope !== 'page' && options.page) {
    console.error('--page can only be used with --scope page.');
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (options.scope === 'page' && !options.page) {
    console.error('--scope page requires --page <pageId>.');
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = listStateKeys({
    projectPath: cwd,
    scope: options.scope,
    page: options.page,
  });

  if (!result.ok) {
    console.error(`wf state list failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  for (const key of result.keys) {
    console.log(key);
  }
}

module.exports = {
  runState,
};
