'use strict';

const path = require('node:path');
const {
  addOverlay,
  listOverlays,
  removeOverlay,
} = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'overlay'));

const SUBCOMMAND_USAGE = 'Usage: wf overlay <add|remove|list> <targetId> [overlayId] [options]';

function parseTargetAndOptions(args) {
  const options = {
    targetId: args[0],
    template: false,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--template') {
      options.template = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseAddArgs(args) {
  const options = {
    targetId: args[0],
    overlayId: args[1],
    type: null,
    trigger: null,
    placement: null,
    template: false,
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--template') {
      options.template = true;
      continue;
    }

    if (arg === '--type') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --type.');
      }
      options.type = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--trigger') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --trigger.');
      }
      options.trigger = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--placement') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --placement.');
      }
      options.placement = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseRemoveArgs(args) {
  const options = {
    targetId: args[0],
    overlayId: args[1],
    template: false,
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--template') {
      options.template = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runOverlay(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [subcommand, ...rest] = args;

  if (!subcommand) {
    console.error(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (subcommand === 'add') {
    let options;
    try {
      options = parseAddArgs(rest);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.targetId || !options.overlayId || !options.type) {
      console.error('wf overlay add requires <targetId> <overlayId> and --type.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addOverlay({
      projectPath: cwd,
      targetId: options.targetId,
      overlayId: options.overlayId,
      type: options.type,
      trigger: options.trigger,
      placement: options.placement,
      template: options.template,
    });

    if (result.ok) {
      console.log(`Added overlay ${result.overlayId} to ${result.targetType} "${result.targetId}".`);
      return;
    }

    console.error(`wf overlay add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    let options;
    try {
      options = parseRemoveArgs(rest);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.targetId || !options.overlayId) {
      console.error('wf overlay remove requires <targetId> <overlayId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removeOverlay({
      projectPath: cwd,
      targetId: options.targetId,
      overlayId: options.overlayId,
      template: options.template,
    });

    if (result.ok) {
      console.log(`Removed overlay ${result.overlayId} from ${result.targetType} "${result.targetId}".`);
      return;
    }

    console.error(`wf overlay remove failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'list') {
    let options;
    try {
      options = parseTargetAndOptions(rest);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.targetId) {
      console.error('wf overlay list requires <targetId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = listOverlays({
      projectPath: cwd,
      targetId: options.targetId,
      template: options.template,
    });

    if (!result.ok) {
      console.error(`wf overlay list failed: ${result.error}`);
      process.exitCode = 1;
      return;
    }

    for (const overlay of result.overlays || []) {
      const source = overlay.source === 'template' ? 'template' : 'page';
      const details = [overlay.type && `type=${overlay.type}`]
        .concat(overlay.trigger ? `trigger=${overlay.trigger}` : [])
        .concat(overlay.placement ? `placement=${overlay.placement}` : []);
      console.log(`${overlay.id} (${source}${details.length ? `: ${details.join(', ')}` : ''})`);
    }

    return;
  }

  console.error(`Unknown overlay command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = { runOverlay };
