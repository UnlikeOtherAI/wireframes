'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { generateLlmReference } = require('../../engine/schema/llm-reference');
const { elementCheatSheet } = require('../../engine/schema/element-reference');
const { builtinComponentDefinition, builtinComponentIds } = require('../../engine/stdlib');

test('wf llm teaches slot syntax and fill rules', () => {
  const reference = generateLlmReference();
  assert.match(reference, /## Component slots/);
  assert.match(reference, /- \{ id: body, slot: default \}/);
  assert.match(reference, /slots\.<name>: \[\] leaves that slot empty on purpose/);
  assert.match(reference, /Never give both children and slots\.default/);
});

test('wf llm lists every std pattern with props, defaults, hints and slots from its definition', () => {
  const reference = generateLlmReference();
  const section = reference.slice(reference.indexOf('## Screen patterns (std)'), reference.indexOf('## Interactions'));
  for (const id of builtinComponentIds()) {
    const start = section.indexOf(`### ${id}\n`);
    assert.ok(start >= 0, id);
    const end = section.indexOf('\n### ', start + 1);
    const entry = section.slice(start, end < 0 ? undefined : end);
    const definition = builtinComponentDefinition(id);
    for (const [prop, hint] of Object.entries(definition.propHints)) {
      assert.ok(entry.includes(`  - ${prop}`) && entry.includes(hint), `${id} ${prop}`);
    }
    assert.match(entry, /- slots: /);
  }
  assert.match(section, /STD_ALIAS_SHADOWED/);
  assert.match(reference, /wf component copy std\.<name> \[--as <id>\] \[--file <path>\]/);
});

test('wf llm --short names the patterns in a few lines', () => {
  const sheet = elementCheatSheet();
  const section = sheet.slice(sheet.indexOf('## Screen patterns'), sheet.indexOf('## Boxes'));
  assert.ok(section.split('\n').length <= 8, 'the short guide stays compact');
  for (const id of builtinComponentIds()) assert.ok(section.includes(`\`${id}\``), id);
});
