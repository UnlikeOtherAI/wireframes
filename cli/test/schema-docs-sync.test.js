'use strict';

// The schema docs describe what the engine does: the canonical validation
// inventory files each coded diagnostic under the severity it is reported
// with, and the item profile table states nav's own legacy `active` rule.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { createStdProject, readYaml, writeYaml } = require('./fixtures/std-project');
const { lintSources } = require('../../engine/lint/source');
const { COMPONENTS, documentMap } = require('./fixtures/repeat-project');

const DOCS = path.join(__dirname, '..', '..', 'docs', 'cli');
const SECTIONS = { blockingErrors: 'errors', warnings: 'warnings', info: 'info' };

/** Codes named in parentheses in each section of the canonical `validation` inventory. */
function canonicalCodes() {
  const { validation } = yaml.load(fs.readFileSync(path.join(DOCS, 'schema-canonical.yaml'), 'utf8'));
  const bySeverity = {};
  for (const [section, severity] of Object.entries(SECTIONS)) {
    bySeverity[severity] = new Set((validation[section] || []).flatMap((line) => [...String(line).matchAll(/\(([A-Z][A-Z_]+)/g)].map((m) => m[1])));
  }
  return bySeverity;
}

function slotDiagnostics() {
  const page = (content) => ({
    documentType: 'page', specVersion: '1.1', id: 'home',
    page: { id: 'home', template: 'main', viewport: { device: 'web' }, slots: [{ slotId: 'main', content }] },
  });
  return validateProject({
    templates: { documentType: 'templates', specVersion: '1.1', id: 'templates',
      templates: { main: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } },
    components: { documentType: 'components', specVersion: '1.1', id: 'components', components: {
      panel: { root: { id: 'panel', component: 'card', children: [{ id: 'body', slot: 'default' }] } },
    } },
    pages: new Map([['home', page([
      { id: 'filled', use: 'panel', children: [{ id: 'a', component: 'text' }], slots: { default: [], aside: [] } },
      { id: 'quiet', use: 'panel' },
      { id: 'loose', component: 'stack', slots: { footer: [] } },
    ])]]),
  });
}

function stdAliasDiagnostics() {
  const projectPath = createStdProject([{ id: 'sign_in', use: 'std.login' }]);
  writeYaml(path.join(projectPath, 'shared', 'std.yaml'), {
    documentType: 'components', specVersion: '1.1', id: 'mine',
    components: { login: { root: { id: 'login', component: 'text', props: { text: 'Ours' } } } },
  });
  const components = readYaml(path.join(projectPath, 'components.yaml'));
  components.imports = { std: './shared/std.yaml' };
  writeYaml(path.join(projectPath, 'components.yaml'), components);
  return runValidate({ projectPath });
}

/** Every repeat code, from lint on text, filed by the severity lint reports. */
function repeatDiagnostics() {
  const wide = (cell) => ({ root: { id: cell, component: 'stack', repeat: { cell: cell === 'level_2' ? 'text' : `level_${Number(cell.slice(-1)) + 1}`,
    items: Array.from({ length: 200 }, (_, index) => ({ id: `i${index}` })) } } });
  const components = {
    ...COMPONENTS, level_0: wide('level_0'), level_1: wide('level_1'), level_2: wide('level_2'),
    broken: { root: { id: 'broken', component: 'stack', children: [{ id: 'gone', use: 'nowhere' }] } },
  };
  const map = documentMap([
    { id: 'a', component: 'stack', repeat: { cell: 'statt', items: [{ id: 'x' }, { id: 'x' }] } },
    { id: 'b', component: 'button', binding: { source: 'people' }, repeat: { cell: 'text', items: [{ id: 'y', text: '{{item.name}}' }] } },
    { id: 'c', component: 'stack', repeat: { cell: 'stat', items: [] } },
    // Before the fan-out: nothing after a page goes over the budget is expanded.
    { id: 'e', component: 'stack', repeat: { cell: 'broken', items: [{ id: 'w' }] } },
    { id: 'd', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'z' }] } },
  ], { components });
  const text = (value) => yaml.dump(value);
  const result = lintSources([
    { name: 'manifest.yaml', text: text(map.manifest) },
    { name: 'sitemap.yaml', text: text(map.sitemap) },
    { name: 'templates.yaml', text: text(map.templates) },
    { name: 'components.yaml', text: text(map.components) },
    { name: 'pages/home.yaml', text: text(map.pages.get('home')) },
  ]);
  const bySeverity = { errors: [], warnings: [], info: [] };
  for (const diagnostic of result.diagnostics) {
    bySeverity[{ error: 'errors', warning: 'warnings', info: 'info' }[diagnostic.severity]].push(diagnostic);
  }
  return bySeverity;
}

test('the canonical validation inventory lists each reported code under its severity', () => {
  const listed = canonicalCodes();
  const reported = new Map();
  for (const result of [slotDiagnostics(), stdAliasDiagnostics(), repeatDiagnostics()]) {
    for (const severity of Object.values(SECTIONS)) {
      for (const entry of result[severity] || []) reported.set(entry.code, severity);
    }
  }
  for (const code of ['EMPTY_COMPONENT_SLOT', 'STD_ALIAS_SHADOWED', 'UNKNOWN_COMPONENT_SLOT', 'DUPLICATE_DEFAULT_SLOT_FILL', 'SLOTS_WITHOUT_USE',
    'UNKNOWN_REPEAT_CELL', 'REPEAT_INVALID_HOST', 'DUPLICATE_REPEAT_ITEM_ID', 'REPEAT_WITH_BINDING', 'REPEAT_BUDGET_EXCEEDED', 'REPEAT_ROW_FAILED', 'EMPTY_REPEAT', 'REPEAT_ITEM_TOKEN']) {
    assert.ok(reported.has(code), `the fixtures report ${code}`);
  }
  for (const [code, severity] of reported) {
    const sections = Object.keys(listed).filter((name) => listed[name].has(code));
    if (sections.length === 0) {
      assert.ok(!/REPEAT/.test(code), `${code} is listed in the inventory`);
      continue;
    }
    assert.deepEqual(sections, [severity], `${code} is reported as ${severity}`);
  }
});

test('the nav item profile keeps legacy active in its own rule, not as selected', () => {
  const doc = fs.readFileSync(path.join(DOCS, 'schema-systems.md'), 'utf8');
  const row = doc.split('\n').find((line) => line.startsWith('| `nav` | `nav` |'));
  assert.ok(row, 'the profile table has a nav row');
  assert.doesNotMatch(row, /`active` → `selected`/);
  assert.match(row, /`active: true` turns a row on next to route inference/);
  assert.match(row, /`active: false` never turns off the row for the current route/);
});
