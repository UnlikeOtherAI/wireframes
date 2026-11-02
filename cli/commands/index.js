'use strict';

const { runInit } = require('./commands/init');
const { runInfo } = require('./commands/info');
const { runDoctor } = require('./commands/doctor');
const { runSchema } = require('./commands/schema');
const { runValidateCommand } = require('./commands/validate');
const { runLintCommand } = require('./commands/lint');
const { runExportCommand } = require('./commands/export');
const { runTemplate } = require('./commands/template');
const { runPage } = require('./commands/page');
const { runNode } = require('./commands/node');
const { runComponent } = require('./commands/component');
const { runData } = require('./commands/data');
const { runOverlay } = require('./commands/overlay');
const { runState } = require('./commands/state');
const { runTree } = require('./commands/tree');
const { runInspect } = require('./commands/inspect');
const { runWhy } = require('./commands/why');
const { runPack, runUnpack } = require('./commands/pack');
const { runWhereUsed } = require('./commands/where-used');
const { runRoutes } = require('./commands/routes');
const { runStats } = require('./commands/stats');
const { runScreenshotsCommand } = require('./commands/screenshots');
const { runBuildCommand } = require('./commands/build');
const { runServeCommand } = require('./commands/serve');
const { runLlm } = require('./commands/llm');
const { runCatalogue } = require('./commands/catalogue');

const { usageFor, topLevelUsage, getCommand } = require('./registry');

const USAGE = topLevelUsage();

function version() {
  try {
    return require('../package.json').version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function run(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [command, ...commandArgs] = args;

  if (!command || command === '-h' || command === '--help' || command === 'help') {
    // `wf help <command>` is the same as `wf <command> --help`.
    const topic = commandArgs.find((arg) => !arg.startsWith('-'));
    const detail = topic ? usageFor(topic) : null;
    if (topic && !detail) {
      console.error(`Unknown command: ${topic}`);
      console.log(USAGE);
      process.exitCode = 1;
      return;
    }
    console.log(detail || USAGE);
    return;
  }

  if (command === '-v' || command === '--version') {
    console.log(version());
    return;
  }

  // Help is answered before the command runs, so asking for it never scaffolds
  // a project, writes a file or touches anything.
  if (commandArgs.includes('--help') || commandArgs.includes('-h')) {
    const detail = usageFor(command);
    if (detail) {
      console.log(detail);
      return;
    }
  }

  if (!getCommand(command)) {
    console.error(`Unknown command: ${command}`);
    console.log(USAGE);
    process.exitCode = 1;
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

  if (command === 'schema') {
    runSchema(commandArgs, { cwd });
    return;
  }

  if (command === 'llm') {
    runLlm(commandArgs);
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

  if (command === 'export') {
    runExportCommand(commandArgs, { cwd });
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

  if (command === 'tree') {
    runTree(commandArgs, { cwd });
    return;
  }

  if (command === 'inspect') {
    runInspect(commandArgs, { cwd });
    return;
  }

  if (command === 'pack') {
    runPack(commandArgs, { cwd });
    return;
  }

  if (command === 'unpack') {
    runUnpack(commandArgs, { cwd });
    return;
  }

  if (command === 'why') {
    runWhy(commandArgs, { cwd });
    return;
  }

  if (command === 'catalogue') {
    runCatalogue(commandArgs, { cwd });
    return;
  }

  if (command === 'where-used') {
    runWhereUsed(commandArgs, { cwd });
    return;
  }

  if (command === 'routes') {
    runRoutes(commandArgs, { cwd });
    return;
  }

  if (command === 'stats') {
    runStats(commandArgs, { cwd });
    return;
  }

  if (command === 'screenshots') {
    runScreenshotsCommand(commandArgs, { cwd });
    return;
  }

  if (command === 'build') {
    runBuildCommand(commandArgs, { cwd });
    return;
  }

  if (command === 'serve') {
    runServeCommand(commandArgs, { cwd });
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.log(USAGE);
  process.exitCode = 1;
}

module.exports = { run, USAGE };
