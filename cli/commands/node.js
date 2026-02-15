'use strict';

const path = require('node:path');
const {
  addNode,
  removeNode,
  updateNode,
} = require(path.resolve(__dirname, '..', '..', 'shared', 'node'));

const SUBCOMMAND_USAGE = 'Usage: wf node <add|update|remove> ...';

function parseAddArgs(args) {
  const options = {
    component: args[0],
    props: null,
    below: null,
    inside: null,
    nodeId: null,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--below') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --below.');
      }
      options.below = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--inside') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --inside.');
      }
      options.inside = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--id') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --id.');
      }
      options.nodeId = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--props') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --props.');
      }
      options.props = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseUpdateArgs(args) {
  const options = {
    address: args[0],
    component: null,
    props: null,
    layout: null,
  };

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--component') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --component.');
      }
      options.component = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--props') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --props.');
      }
      options.props = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--layout') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --layout.');
      }
      options.layout = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function runNode(args, context = {}) {
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

    if (!options.component) {
      console.error('wf node add requires <component>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.nodeId) {
      console.error('wf node add requires --id <nodeId>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (!options.below && !options.inside) {
      console.error('wf node add requires --below or --inside.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    if (options.below && options.inside) {
      console.error('wf node add requires exactly one of --below or --inside.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addNode({
      projectPath: cwd,
      component: options.component,
      below: options.below,
      inside: options.inside,
      nodeId: options.nodeId,
      props: options.props,
    });

    if (result.ok) {
      console.log(`Added node: ${result.nodeId}`);
      return;
    }

    console.error(`wf node add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'update') {
    let options;
    try {
      options = parseUpdateArgs(rest);
    } catch (error) {
      console.error(error.message);
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const hasChange = options.component != null || options.props != null || options.layout != null;
    if (!options.address || !hasChange) {
      console.error('wf node update requires <address> and one of --props, --component, or --layout.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = updateNode({
      projectPath: cwd,
      address: options.address,
      props: options.props,
      component: options.component,
      layout: options.layout,
    });

    if (result.ok) {
      console.log(`Updated node at ${options.address}`);
      return;
    }

    console.error(`wf node update failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    const address = rest[0];
    if (!address) {
      console.error('wf node remove requires <address>.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removeNode({
      projectPath: cwd,
      address,
    });

    if (result.ok) {
      console.log(`Removed node ${result.nodeId} from ${address}`);
      return;
    }

    console.error(`wf node remove failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.error(`Unknown node command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = { runNode };
