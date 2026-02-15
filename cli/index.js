#!/usr/bin/env node
'use strict';

const { runInit } = require('./commands/init');
const { runInfo } = require('./commands/info');
const { runDoctor } = require('./commands/doctor');

const USAGE = `wf <command> [arguments]\n\nCommands:\n  init <project-name>   Scaffold a new wireframe project\n  info                  Show project metadata from manifest.yaml\n  doctor                Check project health and references`;

function run(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [command, ...commandArgs] = args;

  if (!command || command === '-h' || command === '--help') {
    console.log(USAGE);
    return;
  }

  if (command === 'init') {
    runInit(commandArgs, { cwd });
    return;
  }

  if (command === 'info') {
    runInfo(commandArgs, { cwd });
    return;
  }

  if (command === 'doctor') {
    runDoctor(commandArgs, { cwd });
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(USAGE);
  process.exitCode = 1;
}

module.exports = { run, USAGE };
