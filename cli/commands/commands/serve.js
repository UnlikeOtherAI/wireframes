'use strict';

const path = require('node:path');
const { runServe } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'serve'));

const VALID_PLATFORMS = new Set(['all', 'web', 'mobile', 'tablet']);
const SUBCOMMAND_USAGE = 'Usage: wf serve [--port <number>] [--platform <all|web|mobile|tablet>] [--open] [--no-reload]';

function parseServeArgs(args) {
  const options = {
    port: null,
    platform: null,
    open: null,
    hotReload: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--port') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --port.');
      }

      const port = Number.parseInt(args[index + 1], 10);
      if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`Invalid port value "${args[index + 1]}".`);
      }

      options.port = port;
      index += 1;
      continue;
    }

    if (arg === '--platform') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --platform.');
      }

      const platform = args[index + 1];
      if (!VALID_PLATFORMS.has(platform)) {
        throw new Error(`Invalid platform "${platform}".`);
      }

      options.platform = platform;
      index += 1;
      continue;
    }

    if (arg === '--open') {
      options.open = true;
      continue;
    }

    if (arg === '--no-reload') {
      options.hotReload = false;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runServeCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  let options;

  try {
    options = parseServeArgs(args);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  runServe({
    projectPath: cwd,
    port: options.port,
    platform: options.platform,
    open: options.open,
    hotReload: options.hotReload,
  }).then((result) => {
    if (!result.ok) {
      console.error(`wf serve failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }
  }).catch((error) => {
    console.error(`wf serve failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  runServeCommand,
  parseServeArgs,
};
