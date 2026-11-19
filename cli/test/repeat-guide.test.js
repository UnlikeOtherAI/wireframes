'use strict';

// The agent guidance teaches repeat with examples that validate as written.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { generateLlmReference } = require('../../engine/schema/llm-reference');
const { elementCheatSheet } = require('../../engine/schema/element-reference');
const { validateProject } = require('../../engine/validate');
const { renderPage } = require('../../engine/build');
const { documentMap } = require('./fixtures/repeat-project');

function validates(content) {
  const map = documentMap(content);
  assert.deepEqual(validateProject(map).errors, []);
  const page = renderPage(map, 'home');
  assert.equal(page.ok, true, page.error);
  return page.html;
}

test('wf llm teaches repeat in one section whose example validates', () => {
  const reference = generateLlmReference();
  const start = reference.indexOf('## Repeat\n');
  assert.ok(start >= 0);
  const section = reference.slice(start, reference.indexOf('\n## ', start + 1));
  assert.match(section, /Three or more similar siblings/);
  const example = /```yaml\n([\s\S]*?)```/.exec(section)[1];
  const html = validates(yaml.load(example));
  assert.match(html, /id="team__ada"/);
  assert.match(html, /id="team__grace"/);
});

test('wf llm --short says when to use repeat, with an example that validates', () => {
  const sheet = elementCheatSheet();
  const lines = sheet.split('\n').filter((line) => line.includes('repeat') || line.includes('<host>__<id>'));
  assert.ok(lines.length > 0 && lines.length <= 3, lines.join('\n'));
  const inline = /`(repeat: \{.*\})`/.exec(lines.at(-1))[1];
  const html = validates([{ id: 'kpis', component: 'row', ...yaml.load(inline) }]);
  assert.match(html, /id="kpis__mrr"/);
});
