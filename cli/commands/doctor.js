'use strict';

const path = require('node:path');
const { runDoctor: runDoctorCheck } = require(path.resolve(__dirname, '..', '..', 'shared', 'doctor'));

function runDoctor(_args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const result = runDoctorCheck({ projectPath: cwd });

  if (result.errors.length > 0) {
    console.log('wf doctor found issues:');
    for (const issue of result.errors) {
      console.log(`  - [${issue.code}] ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('wf doctor found no blocking issues.');
}

module.exports = { runDoctor };
