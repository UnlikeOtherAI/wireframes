'use strict';

const path = require('node:path');
const {
  addTemplate,
  listTemplates,
  removeTemplate,
} = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'template'));

const SUBCOMMAND_USAGE = 'Usage: wf template <add|remove|list> [id]';

function runTemplate(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const [subcommand, targetId] = args;

  if (!subcommand) {
    console.error(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  if (subcommand === 'add') {
    if (!targetId || targetId.trim() === '') {
      console.error('wf template add requires a template id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = addTemplate({ projectPath: cwd, templateId: targetId.trim() });
    if (result.ok) {
      console.log(`Added template: ${result.templateId}`);
      return;
    }

    console.error(`wf template add failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'remove') {
    if (!targetId || targetId.trim() === '') {
      console.error('wf template remove requires a template id.');
      console.log(SUBCOMMAND_USAGE);
      process.exitCode = 2;
      return;
    }

    const result = removeTemplate({ projectPath: cwd, templateId: targetId.trim() });
    if (result.ok) {
      console.log(`Removed template: ${result.templateId}`);
      return;
    }

    console.error(`wf template remove failed: ${result.error}`);
    if (result.details && Array.isArray(result.details.usages) && result.details.usages.length > 0) {
      for (const usage of result.details.usages) {
        console.error(`  - used by: ${usage}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  if (subcommand === 'list') {
    const ids = listTemplates(cwd);
    for (const id of ids) {
      console.log(id);
    }
    return;
  }

  console.error(`Unknown template command: ${subcommand}`);
  console.log(SUBCOMMAND_USAGE);
  process.exitCode = 1;
}

module.exports = {
  runTemplate,
};
