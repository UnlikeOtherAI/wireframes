'use strict';

// A collection binding clones everything it renders, so REPEAT_WITH_BINDING
// follows it across component boundaries: into the definition a bound instance
// renders, and out to the content a bound root or placeholder ancestor holds.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { lintSources } = require('../../engine/lint/source');
const { validateProject } = require('../../engine/validate');
const { documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });
const rows = (id, cell, items) => ({ id, component: 'stack', repeat: { cell, items } });
const text = (id, value) => ({ id, component: 'text', props: { text: value } });
const BOUND = { source: 'people' };
const PEOPLE = {
  documentType: 'dataset', specVersion: '1.1', id: 'people_data',
  dataset: { id: 'people_data', primaryKey: 'name', items: [{ name: 'Ada' }, { name: 'Grace' }] },
};

const COMPONENTS = {
  owner: { root: rows('own', 'text', [{ id: 'one', text: 'Owned' }]) },
  delegated: { root: { id: 'alias', use: 'direct' } },
  direct: { root: { ...text('direct', 'Bound text'), binding: BOUND } },
  bound_frame: { root: { id: 'bound_frame', component: 'stack', binding: BOUND, children: [{ id: 'spot', slot: 'default' }] } },
  bound_plain: { root: { id: 'bound_plain', component: 'stack', binding: BOUND } },
  inner_bound: { root: { id: 'inner_bound', component: 'card', children: [{ id: 'cloned', component: 'stack', binding: BOUND, children: [{ id: 'spot', slot: 'default' }] }] } },
  relay: { root: { id: 'relay', use: 'owner' } },
  fallback_rows: { root: { id: 'frame', component: 'stack', children: [{ id: 'spot', slot: 'default', children: [rows('fb', 'text', [{ id: 'one', text: 'Fallback' }])] }] } },
  expression_alias: { root: { id: 'alias', use: 'direct', binding: { source: '{{state.people}}' } } },
};

function boundMap(content) {
  const map = documentMap(content, { components: COMPONENTS, page: { dataSources: [{ id: 'people', dataset: 'people_data' }] } });
  map.datasets.set('people_data', structuredClone(PEOPLE));
  return map;
}

function findings(map) {
  const list = [
    { name: 'manifest.yaml', text: dump(map.manifest) },
    { name: 'sitemap.yaml', text: dump(map.sitemap) },
    { name: 'templates.yaml', text: dump(map.templates) },
    { name: 'components.yaml', text: dump(map.components) },
    { name: 'pages/home.yaml', text: dump(map.pages.get('home')) },
    { name: 'data/people_data.yaml', text: dump(map.datasets.get('people_data')) },
  ];
  return lintSources(list).diagnostics.filter((d) => d.code === 'REPEAT_WITH_BINDING').map((d) => ({
    source: d.source,
    path: d.path,
    underlined: list.find((s) => s.name === d.source).text.slice(d.range.start.offset, d.range.end.offset),
    message: d.message,
  }));
}

const hosted = (use) => ({ id: 'x', use, children: [rows('host', 'text', [{ id: 'one', text: 'One' }])] });
const CROSSING = {
  'a binding on an instance of a repeat-owning definition': [[{ id: 'instance', use: 'owner', binding: BOUND }], 'components.yaml', '$.components.owner.root.repeat', /"instance" in page "home"/],
  'a binding above such an instance': [[{ id: 'bound', component: 'stack', binding: BOUND, children: [{ id: 'instance', use: 'owner' }] }], 'components.yaml', '$.components.owner.root.repeat', /"bound" in page "home"/],
  'a cell whose root delegates to a bound root': [[rows('list', 'delegated', [{ id: 'one' }])], 'pages/home.yaml', '$.page.slots[0].content[0].repeat', /cell "delegated"/],
  'a fill under a bound slotted root': [[hosted('bound_frame')], 'pages/home.yaml', '$.page.slots[0].content[0].children[0].repeat', /"bound_frame" in component "bound_frame"/],
  'override children under a bound slotless root': [[hosted('bound_plain')], 'pages/home.yaml', '$.page.slots[0].content[0].children[0].repeat', /"bound_plain" in component "bound_plain"/],
  'a fill under a bound node inside the definition': [[hosted('inner_bound')], 'pages/home.yaml', '$.page.slots[0].content[0].children[0].repeat', /"cloned" in component "inner_bound"/],
};

for (const [name, [content, source, at, names]] of Object.entries(CROSSING)) {
  test(`REPEAT_WITH_BINDING crosses component boundaries: ${name}`, () => {
    const found = findings(boundMap(content));
    assert.deepEqual(found.map((f) => [f.source, f.path, f.underlined]), [[source, at, 'repeat']], JSON.stringify(found));
    assert.match(found[0].message, names);
    assert.ok(validateProject(boundMap(content)).errors.some((e) => e.code === 'REPEAT_WITH_BINDING'));
  });
}

test('an unbound or single-value-bound instance of a repeat-owning definition is fine', () => {
  for (const content of [
    [{ id: 'instance', use: 'owner' }],
    [{ id: 'instance', use: 'owner', binding: { source: '{{state.team}}' } }],
    [{ id: 'x', use: 'bound_frame', children: [text('plain', 'No repeat')] }],
    [hosted('owner')],
  ]) {
    assert.deepEqual(findings(boundMap(content)), [], JSON.stringify(content));
  }
});

// Only a repeat that renders can be cloned. Each of these renders no definition
// row under the binding (the resolver drops it), so none is a conflict.
const kept = [text('kept', 'Kept')];
const UNREACHED = {
  'slotless instance children replace the root rows': [{ id: 'instance', use: 'owner', binding: BOUND, children: kept }],
  'an empty children override replaces them too': [{ id: 'instance', use: 'owner', binding: BOUND, children: [] }],
  'the children pass through a delegating root': [{ id: 'instance', use: 'relay', binding: BOUND, children: kept }],
  'a filled slot drops its fallback rows': [{ id: 'instance', use: 'fallback_rows', binding: BOUND, children: kept }],
};

for (const [name, content] of Object.entries(UNREACHED)) {
  test(`REPEAT_WITH_BINDING skips a repeat that does not render: ${name}`, () => {
    assert.deepEqual(findings(boundMap(content)), []);
    assert.deepEqual(validateProject(boundMap(content)).errors, []);
  });
}

test('the same definitions still conflict when their rows render', () => {
  assert.deepEqual(findings(boundMap([{ id: 'instance', use: 'relay', binding: BOUND }])).map((f) => f.path), ['$.components.owner.root.repeat']);
  assert.deepEqual(findings(boundMap([{ id: 'instance', use: 'fallback_rows', binding: BOUND }])).map((f) => f.path),
    ['$.components.fallback_rows.root.children[0].children[0].repeat']);
});

// The binding that renders is the nearest one written: an expression on a
// delegating root or on an instance replaces the collection on the root below.
const EXPRESSION = { binding: { source: '{{state.team}}' } };
const OVERRIDDEN = {
  'a cell root that delegates with an expression binding': [rows('list', 'expression_alias', [{ id: 'one' }])],
  'an instance expression over a bound slotless root': [{ ...hosted('bound_plain'), ...EXPRESSION }],
  'an instance expression over a bound slotted root': [{ ...hosted('bound_frame'), ...EXPRESSION }],
};

for (const [name, content] of Object.entries(OVERRIDDEN)) {
  test(`REPEAT_WITH_BINDING reads the effective binding: ${name}`, () => {
    assert.deepEqual(findings(boundMap(content)), []);
    assert.deepEqual(validateProject(boundMap(content)).errors, []);
  });
}
