'use strict';

const path = require('node:path');
const { packProject, unpackProject } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'wf-format', 'fs'));

function flagValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function runPack(args = [], context = {}) {
  const cwd = context.cwd || process.cwd();
  const result = packProject(cwd, flagValue(args, '--out'));
  if (!result.ok) {
    console.error(`wf pack failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Packed ${result.documentCount} documents into ${result.output} (${result.bytes} bytes)`);
}

function runUnpack(args = [], context = {}) {
  const cwd = context.cwd || process.cwd();
  const file = args.find((arg) => !arg.startsWith('--') && arg !== flagValue(args, '--out'));
  if (!file) {
    console.error('wf unpack requires a .wf file.');
    console.log('Usage: wf unpack <file.wf> [--out <dir>]');
    process.exitCode = 2;
    return;
  }
  const result = unpackProject(path.resolve(cwd, file), flagValue(args, '--out'));
  if (!result.ok) {
    console.error(`wf unpack failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Unpacked ${result.files.length} documents into ${result.output}`);
  for (const name of result.files) console.log(`  ${name}`);
}

module.exports = { runPack, runUnpack };
