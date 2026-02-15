'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getSchemaReference } = require('../shared/schema/reference');
const { runSchema } = require('../cli/commands/schema');

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

test('wf schema command prints supported schema reference values', () => {
  const reference = getSchemaReference();
  const output = runWithCapture(() => {
    runSchema([]);
  });

  const text = output.logs.join('\n');

  process.exitCode = 0;
  assert.equal(text.includes(`Supported schema version: ${reference.supportedSchemaVersion}`), true);
  for (const interaction of reference.interactionTypes) {
    assert.equal(text.includes(interaction), true);
  }
  for (const gesture of reference.gestureTypes) {
    assert.equal(text.includes(gesture), true);
  }
  for (const overlay of reference.overlayTypes) {
    assert.equal(text.includes(overlay), true);
  }
  for (const primitive of reference.layoutPrimitives) {
    assert.equal(text.includes(primitive), true);
  }
  for (const condition of reference.conditionTypes) {
    assert.equal(text.includes(condition), true);
  }
});

test('wf schema command does not emit runtime errors', () => {
  const output = runWithCapture(() => {
    runSchema([]);
  });

  process.exitCode = 0;
  assert.equal(output.errors.length, 0);
});
