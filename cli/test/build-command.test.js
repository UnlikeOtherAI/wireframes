'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const { runBuildCommand } = require('../commands/commands/build');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-build-command-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function runWithCapture(callback) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  try {
    callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { logs, errors };
}

test('runBuildCommand rejects invalid platform arguments', () => {
  const projectPath = createTempProject('Build Command Invalid Platform');

  const previousExitCode = process.exitCode;
  process.exitCode = 0;
  const output = runWithCapture(() => {
    runBuildCommand(['--platform', 'desktop'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.equal(output.errors.join('\n').includes('Invalid platform "desktop".'), true);
  process.exitCode = previousExitCode || 0;
});

test('runBuildCommand rejects missing values for options', () => {
  const projectPath = createTempProject('Build Command Missing Option');

  const previousExitCode = process.exitCode;
  process.exitCode = 0;
  const output = runWithCapture(() => {
    runBuildCommand(['--output'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.equal(output.errors.join('\n').includes('Missing value for --output.'), true);
  process.exitCode = previousExitCode || 0;
});
