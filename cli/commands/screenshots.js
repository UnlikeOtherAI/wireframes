'use strict';

const path = require('node:path');
const { runScreenshots } = require(path.resolve(__dirname, '..', '..', 'shared', 'screenshots'));

const SUBCOMMAND_USAGE = 'Usage: wf screenshots [--output <path>] [--page <pageId>] [--frame <frameId>]';

function parseScreenshotsArgs(args) {
  const options = {
    output: 'screenshots',
    pageId: null,
    frameId: null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--output') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --output.');
      }
      options.output = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--page') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --page.');
      }
      options.pageId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--frame') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --frame.');
      }
      options.frameId = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runScreenshotsCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  let options;

  try {
    options = parseScreenshotsArgs(args);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  runScreenshots({
    projectPath: cwd,
    output: options.output,
    pageId: options.pageId,
    frameId: options.frameId,
  }).then((result) => {
    if (!result.ok) {
      console.error(`wf screenshots failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Captured ${result.screenshotCount} screenshot(s) in ${path.resolve(result.outputDir)}`);
  }).catch((error) => {
    console.error(`wf screenshots failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { runScreenshotsCommand };
