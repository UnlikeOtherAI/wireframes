'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseServeArgs, runServeCommand } = require('../cli/commands/serve');
const { runServe } = require('../shared/serve');

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

test('parseServeArgs parses supported options', () => {
  const options = parseServeArgs(['--platform', 'mobile', '--port', '4000', '--open', '--no-reload']);
  assert.equal(options.platform, 'mobile');
  assert.equal(options.port, 4000);
  assert.equal(options.open, true);
  assert.equal(options.hotReload, false);
});

test('parseServeArgs fails on unknown flags', () => {
  assert.throws(() => parseServeArgs(['--unsupported']), /Unknown argument/);
});

test('runServeCommand rejects invalid platform', async () => {
  const output = runWithCapture(() => {
    const previousExitCode = process.exitCode;
    process.exitCode = 0;
    runServeCommand(['--platform', 'desktop']);
    process.exitCode = previousExitCode || 0;
  });
  assert.equal(output.errors.some((line) => line.includes('Invalid platform "desktop".')), true);
});

test('runServe rejects invalid platform without starting server', async () => {
  const result = await runServe({ platform: 'desktop' });
  assert.equal(result.ok, false);
  assert.equal(result.error.includes('Invalid platform "desktop"'), true);
});
