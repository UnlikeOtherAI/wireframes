'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { printSchemaDoc } = require('../../engine/schema/doc-printer');
const { generateLlmReference } = require('../../engine/schema/llm-reference');

test('printSchemaDoc returns page structure', () => {
  const output = printSchemaDoc('page');
  assert.ok(output.includes('documentType'), 'Should include documentType');
  assert.ok(output.includes('specVersion'), 'Should include specVersion');
  assert.ok(output.includes('viewport'), 'Should include viewport');
  assert.ok(output.includes('slots'), 'Should include slots');
  assert.ok(output.includes('REQUIRED'), 'Should annotate required fields');
});

test('printSchemaDoc returns node structure', () => {
  const output = printSchemaDoc('node');
  assert.ok(output.includes('component'), 'Should include component');
  assert.ok(output.includes('interaction'), 'Should include interaction');
  assert.ok(output.includes('children'), 'Should include children');
});

test('printSchemaDoc returns manifest structure', () => {
  const output = printSchemaDoc('manifest');
  assert.ok(output.includes('projectId'), 'Should include projectId');
  assert.ok(output.includes('schemaVersion'), 'Should include schemaVersion');
});

test('printSchemaDoc returns null for unknown type', () => {
  const output = printSchemaDoc('nonexistent');
  assert.equal(output, null);
});

test('generateLlmReference produces comprehensive output', () => {
  const output = generateLlmReference();
  assert.ok(output.includes('interaction'), 'Should mention interaction field');
  assert.ok(output.includes('targetRoute'), 'Should mention targetRoute');
  assert.ok(output.includes('targetOverlay'), 'Should mention targetOverlay');
  assert.ok(output.includes('slots'), 'Should explain slot nesting');
  assert.ok(output.includes('component'), 'Should list component types');
  assert.ok(output.includes('section'), 'Should mention section');
  assert.ok(output.includes('card'), 'Should warn about card alias');
  assert.ok(output.includes('orientation'), 'Should mention orientation defaults');
  assert.ok(output.includes('columns'), 'Should explain table columns');
  assert.ok(output.includes('key'), 'Should mention column key');
  assert.ok(output.includes('wf page add'), 'Should show CLI commands');
  assert.ok(output.length > 2000, 'Should be comprehensive');
});
