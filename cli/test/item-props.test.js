'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const { getPrimitive, itemProps, PRIMITIVES } = require('@wireframes/engine/schema/primitive-registry');
const { FIELD_PROPS } = require('@wireframes/engine/schema/primitive-registry/shared');
const { validatePrimitiveProps } = require('@wireframes/engine/lint/rules/primitive-props');
const { initProject } = require('../../engine/init');
const { runLint } = require('../../engine/lint');

const repoRoot = path.resolve(__dirname, '..', '..');

// No family marks its props in this tranche, so the tests mark one in-process
// (each test file runs in its own process) and unmark it afterwards.
function withMarked(component, prop, run) {
  const spec = getPrimitive(component).props[prop];
  spec.items = true;
  try {
    return run();
  } finally {
    delete spec.items;
  }
}

function lint(node) {
  const result = { errors: [], warnings: [], info: [] };
  validatePrimitiveProps(result, node, 'page "home"');
  return result.info.filter((entry) => entry.code === 'AMBIGUOUS_VALUE');
}

test('itemProps lists only array props marked items: true', () => {
  assert.deepEqual(itemProps('segmented'), []);
  withMarked('segmented', 'options', () => {
    assert.deepEqual(itemProps('segmented'), ['options']);
  });
  const value = getPrimitive('segmented').props.value;
  value.items = true;
  try {
    assert.deepEqual(itemProps('segmented'), [], 'a non-array prop is never an item prop');
  } finally {
    delete value.items;
  }
  assert.deepEqual(itemProps('no_such_element'), []);
  assert.deepEqual(itemProps(undefined), []);
});

test('marking an item prop leaves schema.json unchanged', () => {
  const preload = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wf-items-')), 'mark.js');
  const registry = path.join(repoRoot, 'engine', 'schema', 'primitive-registry');
  fs.writeFileSync(preload, `
const { PRIMITIVES } = require(${JSON.stringify(registry)});
for (const entry of PRIMITIVES) {
  for (const spec of Object.values(entry.props || {})) if (spec.type === 'array') spec.items = true;
}
`);
  execFileSync(process.execPath, ['-r', preload, path.join(repoRoot, 'scripts', 'sync-schema-primitives.js'), '--check'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
});

test('FIELD_PROPS is the shared field contract and no family spreads it yet', () => {
  assert.deepEqual(Object.keys(FIELD_PROPS), ['label', 'help', 'error', 'required', 'disabled', 'readonly']);
  assert.deepEqual(Object.values(FIELD_PROPS).map((spec) => spec.type), ['string', 'string', 'string', 'boolean', 'boolean', 'boolean']);
  assert.ok(Object.values(FIELD_PROPS).every((spec) => spec.primary !== true), 'label is not primary for every control');
  assert.ok(Object.isFrozen(FIELD_PROPS) && Object.isFrozen(FIELD_PROPS.label));
  assert.ok(PRIMITIVES.every((entry) => !Object.hasOwn(entry.props || {}, 'readonly')));
});

test('AMBIGUOUS_VALUE: a single-choice value matching several items', () => {
  withMarked('segmented', 'options', () => {
    const [info] = lint({ id: 'period', component: 'segmented', props: { options: ['Day', 'Week', 'Week'], value: 'Week' } });
    assert.equal(info.code, 'AMBIGUOUS_VALUE');
    assert.match(info.message, /page "home": segmented\.value "Week" matches more than one of its options/);
    // Identity is value, else label.
    assert.equal(lint({ id: 's', component: 'segmented', props: { options: [{ label: 'A', value: 'x' }, { label: 'B', value: 'x' }], value: 'x' } }).length, 1);
  });
  // Alias names resolve to the element.
  withMarked('select', 'options', () => {
    const [info] = lint({ id: 's', component: 'combobox', props: { options: ['A', 'A'], value: 'A' } });
    assert.match(info.message, /select\.value "A"/);
  });
});

test('AMBIGUOUS_VALUE stays quiet when the selection is not ambiguous', () => {
  withMarked('segmented', 'options', () => {
    assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: ['A', 'B'], value: 'A' } }), []);
    assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: ['A', 'A'] } }), []);
    assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: ['A', 'A'], value: 'A', multiple: true } }), []);
    assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: [{ label: 'A', selected: true }, 'A'], value: 'A' } }), []);
    assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: [{ label: 'A', selected: false }, 'A'], value: 'A' } }), []);
  });
  // An unmarked prop is never checked.
  assert.deepEqual(lint({ id: 's', component: 'segmented', props: { options: ['A', 'A'], value: 'A' } }), []);
  assert.deepEqual(lint({ id: 'x', use: 'card_component', props: { options: ['A', 'A'], value: 'A' } }), []);
});

test('AMBIGUOUS_VALUE reaches wf lint as info, including nested nodes', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-cli-'));
  const projectPath = path.join(base, 'project');
  initProject({ projectName: 'Ambiguous Value', projectPath });
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = yaml.load(fs.readFileSync(homePath, 'utf8'));
  homeDoc.page.slots[0].content = [{
    id: 'wrapper',
    component: 'stack',
    children: [{ id: 'period', component: 'segmented', props: { options: ['Day', 'Day'], value: 'Day' } }],
  }];
  fs.writeFileSync(homePath, `${yaml.dump(homeDoc)}\n`, 'utf8');

  withMarked('segmented', 'options', () => {
    const result = runLint({ projectPath });
    assert.equal(result.ok, true);
    const found = result.info.filter((entry) => entry.code === 'AMBIGUOUS_VALUE');
    assert.equal(found.length, 1);
    assert.match(found[0].message, /wrapper > period/);
  });
  assert.equal(runLint({ projectPath }).info.some((entry) => entry.code === 'AMBIGUOUS_VALUE'), false);
});
