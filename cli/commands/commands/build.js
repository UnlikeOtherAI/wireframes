'use strict';

const path = require('node:path');
const { runBuild } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'build'));

const VALID_PLATFORMS = new Set(['all', 'web', 'mobile', 'tablet']);
const SUBCOMMAND_USAGE = 'Usage: wf build [--output <path>] [--platform <all|web|mobile|tablet>] [--clean] [--base-path <path>]';

function parseBuildArgs(args) {
  const options = {
    output: null,
    platform: null,
    clean: false,
    basePath: null,
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

    if (arg === '--clean') {
      options.clean = true;
      continue;
    }

    if (arg === '--base-path') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --base-path.');
      }
      options.basePath = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runBuildCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  let options;

  try {
    options = parseBuildArgs(args);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = runBuild({
    projectPath: cwd,
    output: options.output,
    platform: options.platform,
    clean: options.clean,
    basePath: options.basePath,
  });

  if (!result.ok) {
    console.error(`wf build failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Built wireframes to: ${path.resolve(result.outputDir)}`);
  if (result.warnings && result.warnings.length > 0) {
    console.log('Build warnings:');
    for (const warning of result.warnings) {
      console.log(`  - [${warning.code ?? 'WARNING'}] ${warning.message}`);
    }
  }
}

module.exports = {
  runBuildCommand,
};
