'use strict';

const path = require('node:path');
const { runValidate } = require(path.resolve(__dirname, '..', '..', 'shared', 'validate'));

function formatIssues(result) {
  if (result.errors.length > 0) {
    console.log('wf validate found issues:');
    for (const issue of result.errors) {
      const code = issue.code ?? 'SCHEMA_VALIDATION';
      console.log(`  - [${code}] ${issue.message}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('wf validate found warnings:');
    for (const issue of result.warnings) {
      const code = issue.code ?? 'WARNING';
      console.log(`  - [${code}] ${issue.message}`);
    }
  }
}

function runValidateCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const outputJson = args.includes('--json');
  const strict = args.includes('--strict');

  const result = runValidate({ projectPath: cwd, strict });

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  formatIssues(result);

  if (result.ok) {
    console.log('wf validate found no blocking errors.');
    return;
  }

  process.exitCode = 1;
}

module.exports = { runValidateCommand };
