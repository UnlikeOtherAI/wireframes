'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { buildProject } = require('../../engine/build');
const { validateProject } = require('../../engine/validate');
const { componentSlotNames } = require('../../engine/component-registry/slot-placeholders');
const { builtinComponentDefinition, builtinComponentIds } = require('../../engine/stdlib');
const { memoryProject } = require('./fixtures/std-project');

// Checkouts with core.autocrlf have CRLF line endings.
const DOC = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'cli', 'stdlib.md'), 'utf8').replaceAll('\r\n', '\n');

function section(id) {
  const start = DOC.indexOf(`\n## ${id}\n`);
  assert.ok(start >= 0, `stdlib.md has a section for ${id}`);
  const end = DOC.indexOf('\n## ', start + 1);
  return DOC.slice(start, end < 0 ? undefined : end);
}

test('stdlib.md documents every prop and slot of every pattern', () => {
  for (const id of builtinComponentIds()) {
    const text = section(id);
    const definition = builtinComponentDefinition(id);
    for (const prop of new Set([...Object.keys(definition.propDefaults), ...Object.keys(definition.propHints)])) {
      assert.ok(text.includes(`| \`${prop}\` |`), `${id} prop ${prop}`);
    }
    for (const slot of componentSlotNames(definition)) {
      assert.ok(text.includes(`| \`${slot}\` |`), `${id} slot ${slot}`);
    }
  }
});

test('every YAML example in stdlib.md validates and renders', () => {
  const examples = [...DOC.matchAll(/```yaml\n([\s\S]*?)```/g)].map((match) => yaml.load(match[1]));
  assert.ok(examples.length >= 9);
  // A comma inside an unquoted flow-mapping value splits it into a stray key
  // with a null value, which validation does not catch.
  const nullProps = (value) => (Array.isArray(value) ? value.flatMap(nullProps)
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, entry]) => (entry === null ? [key] : nullProps(entry)))
      : []);
  for (const content of examples) {
    assert.deepEqual(nullProps(content), [], `an example value was split by a comma: ${JSON.stringify(content)}`);
    const documentMap = memoryProject(content);
    const validation = validateProject(documentMap);
    assert.deepEqual(validation.errors, [], JSON.stringify(content));
    const built = buildProject(documentMap, { platform: 'web', basePath: '/' });
    assert.equal(built.ok, true, built.error);
    assert.match(built.pages[0].html, new RegExp(`id="${content[0].id}"`));
  }
});
