'use strict';

const path = require('node:path');
const { runExport } = require(path.resolve(__dirname, '..', '..', 'shared', 'export'));

const SUBCOMMAND_USAGE = 'Usage: wf export [--output <path>]';

function parseExportArgs(args) {
  const options = {
    output: 'build.zip',
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

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runExportCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  let options;

  try {
    options = parseExportArgs(args);
  } catch (error) {
    console.error(error.message);
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = runExport({ projectPath: cwd, output: options.output });
  if (!result.ok) {
    console.error(`wf export failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  const outputPath = path.resolve(cwd, options.output);
  console.log(`Created export archive: ${path.resolve(outputPath)}`);

  if (result.warnings && result.warnings.length > 0) {
    console.log('Export warnings:');
    for (const warning of result.warnings) {
      console.log(`  - [${warning.code ?? 'WARNING'}] ${warning.message}`);
    }
  }
}

module.exports = { runExportCommand };
