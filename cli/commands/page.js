'use strict';

const path = require('node:path');
const {
  addPage,
  listPages,
  removePage,
} = require(path.resolve(__dirname, '..', '..', 'shared', 'page'));

const SUBCOMMAND_USAGE = 'Usage: wf page <add|remove|list> [id]';

function parseSlots(rawSlots) {
  if (!Array.isArray(rawSlots) || rawSlots.length === 0) {
    return [];
  }

  return rawSlots.map((entry) => {
    if (typeof entry !== 'string') {
      throw new Error('Invalid --slot value. Expected slotId=<jsonArray>.');
    }

    const separator = entry.indexOf('=');
    if (separator === -1) {
      throw new Error(`Invalid --slot value "${entry}". Expected slotId=<jsonArray>.`);
    }

    const slotId = entry.slice(0, separator).trim();
    const encoded = entry.slice(separator + 1).trim();
    if (slotId === '') {
      throw new Error(`Invalid --slot value "${entry}". slotId is required.`);
    }

    let content = [];
    if (encoded !== '') {
      try {
        content = JSON.parse(encoded);
      } catch (error) {
        throw new Error(`Invalid JSON for slot "${slotId}": ${error.message}`);
      }
    }

    return {
      slotId,
      content,
    };
  });
}

function parseWireframeStyle(rawStyle) {
  if (!rawStyle) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawStyle);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    throw new Error('must be an object');
  } catch (error) {
    throw new Error(`Invalid --wireframe-style value: ${error.message}`);
  }
}

function parseAddArgs(args) {
  const options = {
    pageId: args[0],
    slots: [],
  };

  const rawSlots = [];

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--path') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --path.');
      }
      options.path = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--template') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --template.');
      }
      options.templateId = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--device') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --device.');
      }
      options.device = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--orientation') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --orientation.');
      }
      options.orientation = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--slot') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --slot. Expected slotId=<jsonArray>.');
      }
      rawSlots.push(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg === '--wireframe-style') {
      if (index + 1 >= args.length) {
        throw new Error('Missing value for --wireframe-style.');
      }
      options.wireframeStyle = parseWireframeStyle(args[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  options.slots = parseSlots(rawSlots);
  return options;
}

function runPage(args, context = {}) {
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

    if (!options.path || !options.templateId || !options.device || !options.pageId) {
      console.error('wf page add requires id, --path, --template, and --device.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addPage({
      projectPath: cwd,
      pageId: options.pageId,
      path: options.path,
      templateId: options.templateId,
      device: options.device,
      orientation: options.orientation,
      wireframeStyle: options.wireframeStyle,
      slots: options.slots,
    });

    if (result.ok) {
      console.log(`Added page: ${result.pageId}`);
      return;
    }

    console.error(`wf page add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    const targetId = rest[0];
    if (!targetId || targetId.trim() === '') {
      console.error('wf page remove requires a page id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removePage({ projectPath: cwd, pageId: targetId.trim() });
    if (result.ok) {
      console.log(`Removed page: ${result.pageId}`);
      return;
    }

    console.error(`wf page remove failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'list') {
    const ids = listPages(cwd);
    for (const id of ids) {
      console.log(id);
    }
    return;
  }

  console.error(`Unknown page command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = { runPage };
