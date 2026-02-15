'use strict';

const { runInit } = require('./commands/init');
const { runInfo } = require('./commands/info');
const { runDoctor } = require('./commands/doctor');
const { runValidateCommand } = require('./commands/validate');
const { runLintCommand } = require('./commands/lint');
const { runTemplate } = require('./commands/template');
const { runPage } = require('./commands/page');
const { runNode } = require('./commands/node');
const { runComponent } = require('./commands/component');
const { runData } = require('./commands/data');
const { runOverlay } = require('./commands/overlay');
const { runState } = require('./commands/state');

const USAGE = `wf <command> [arguments]\n\nCommands:\n  init <project-name>   Scaffold a new wireframe project\n  info                  Show project metadata from manifest.yaml\n  doctor                Check project health and references\n  validate              Validate document schema compliance\n  lint                  Check naming conventions\n  template              Manage templates\n  page                  Manage pages\n  component             Manage reusable components\n  node                  Add, update, and remove nodes\n  overlay               Manage overlays on pages and templates\n  state                 Inspect state keys in appState and pageState\n  data                  Manage datasets and dataset items`;

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

  if (command === 'validate') {
    runValidateCommand(commandArgs, { cwd });
    return;
  }

  if (command === 'lint') {
    runLintCommand(commandArgs, { cwd });
    return;
  }

  if (command === 'template') {
    runTemplate(commandArgs, { cwd });
    return;
  }

  if (command === 'page') {
    runPage(commandArgs, { cwd });
    return;
  }

  if (command === 'component') {
    runComponent(commandArgs, { cwd });
    return;
  }

  if (command === 'node') {
    runNode(commandArgs, { cwd });
    return;
  }

  if (command === 'overlay') {
    runOverlay(commandArgs, { cwd });
    return;
  }

  if (command === 'data') {
    runData(commandArgs, { cwd });
    return;
  }

  if (command === 'state') {
    runState(commandArgs, { cwd });
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(USAGE);
  process.exitCode = 1;
}

module.exports = { run, USAGE };
