'use strict';

const path = require('node:path');
const { runValidate } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'validate', 'cli-adapter'));
const { formatGroupedIssues } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'validate', 'format'));

function formatIssues(result) {
  const errorOutput = formatGroupedIssues(result.errors, 'issues');
  if (errorOutput) {
    console.log(errorOutput);
  }
  const warningOutput = formatGroupedIssues(result.warnings, 'warnings');
  if (warningOutput) {
    console.log(warningOutput);
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
