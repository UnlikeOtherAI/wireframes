'use strict';

const path = require('node:path');
const { writeCatalogue } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'catalogue', 'fs'));

const USAGE = 'Usage: wf catalogue [--out <dir>] [--mode card|line] [--platform web|ios|android]';
const DEFAULT_OUT = './catalogue';

function flagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function runCatalogue(args, context = {}) {
  const cwd = context.cwd || process.cwd();

  if (args.includes('--help')) {
    console.log(USAGE);
    return;
  }

  const outputDir = path.resolve(cwd, flagValue(args, '--out') || DEFAULT_OUT);
  const result = writeCatalogue({
    outputDir,
    mode: flagValue(args, '--mode'),
    platform: flagValue(args, '--platform'),
  });

  if (!result.ok) {
    console.error(`wf catalogue failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Element catalogue written to: ${result.indexPath}`);
}

module.exports = { runCatalogue };
