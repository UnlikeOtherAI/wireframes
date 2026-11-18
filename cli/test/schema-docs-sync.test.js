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

test('the canonical validation inventory lists each reported code under its severity', () => {
  const listed = canonicalCodes();
  const reported = new Map();
  for (const result of [slotDiagnostics(), stdAliasDiagnostics()]) {
    for (const severity of Object.values(SECTIONS)) {
      for (const entry of result[severity] || []) reported.set(entry.code, severity);
    }
  }
  for (const code of ['EMPTY_COMPONENT_SLOT', 'STD_ALIAS_SHADOWED', 'UNKNOWN_COMPONENT_SLOT', 'DUPLICATE_DEFAULT_SLOT_FILL', 'SLOTS_WITHOUT_USE']) {
    assert.ok(reported.has(code), `the fixtures report ${code}`);
  }
  for (const [code, severity] of reported) {
    const sections = Object.keys(listed).filter((name) => listed[name].has(code));
    if (sections.length === 0) continue;
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
