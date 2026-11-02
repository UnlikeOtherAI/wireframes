'use strict';

const path = require('node:path');
const { runLint } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'lint'));

function formatIssues(result) {
  if (result.errors.length > 0) {
    console.log('wf lint found issues:');
    for (const issue of result.errors) {
      const code = issue.code ?? 'LINT_ERROR';
      console.log(`  - [${code}] ${issue.message}`);
    }
  }
  if (result.warnings.length > 0) {
    console.log('wf lint found warnings:');
    for (const issue of result.warnings) {
      const code = issue.code ?? 'LINT_WARNING';
      console.log(`  - [${code}] ${issue.message}`);
    }
  }
  if (Array.isArray(result.info) && result.info.length > 0) {
    console.log('wf lint found info:');
    for (const issue of result.info) {
      const code = issue.code ?? 'LINT_INFO';
      console.log(`  - [${code}] ${issue.message}`);
    }
  }
}

function runLintCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const outputJson = args.includes('--json');
  const strict = args.includes('--strict');

  const result = runLint({ projectPath: cwd, strict });

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  formatIssues(result);

  if (result.ok) {
    console.log('wf lint found no blocking issues.');
    return;
  }

  process.exitCode = 1;
}

module.exports = { runLintCommand };
