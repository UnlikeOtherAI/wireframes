'use strict';

// Element prop contracts on repeat rows read what renders: rows a page renders,
// with the values they render with, each finding once per place and message.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { lintSources } = require('../../engine/lint/source');
const { runLint } = require('../../engine/lint');
const { createRepeatProject, documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });
const rows = (id, cell, items) => ({ id, component: 'stack', repeat: { cell, items } });
const text = (id, value) => ({ id, component: 'text', props: { text: value } });

function findings(map, code) {
  const list = [
    { name: 'manifest.yaml', text: dump(map.manifest) },
    { name: 'sitemap.yaml', text: dump(map.sitemap) },
    { name: 'templates.yaml', text: dump(map.templates) },
    { name: 'components.yaml', text: dump(map.components) },
    { name: 'pages/home.yaml', text: dump(map.pages.get('home')) },
  ];
  return lintSources(list).diagnostics.filter((d) => d.code === code).map((d) => ({
    source: d.source,
    path: d.path,
    underlined: list.find((s) => s.name === d.source).text.slice(d.range.start.offset, d.range.end.offset),
    message: d.message,
  }));
}

const SLOTTED_TYPO = { slotted: { root: { id: 'slotted', component: 'stack', children: [{ id: 'spot', slot: 'default', children: [rows('fallback', 'stat', [{ id: 'a', lable: 'typo' }])] }] } } };

test('a row in a replaced fallback is not linted; the same row is when the fallback renders', () => {
  assert.deepEqual(findings(documentMap([{ id: 'instance', use: 'slotted', children: [text('visible', 'Live')] }], { components: SLOTTED_TYPO }), 'UNKNOWN_PROP'), []);
  const rendered = findings(documentMap([{ id: 'one', use: 'slotted' }, { id: 'two', use: 'slotted' }], { components: SLOTTED_TYPO }), 'UNKNOWN_PROP');
  assert.deepEqual(rendered.map(({ source, path, underlined }) => ({ source, path, underlined })), [
    { source: 'components.yaml', path: '$.components.slotted.root.children[0].children[0].repeat.items[0].lable', underlined: 'lable' },
  ], 'two instances report it once');
});

const GROUP = { group: { propDefaults: { trend: 'up' }, root: rows('group', 'stat', [{ id: 'mrr', label: 'MRR', trend: '{{props.trend}}' }]) } };
const GROUP_PAGE = [
  { id: 'good', use: 'group', props: { trend: 'up' } },
  { id: 'bad', use: 'group', props: { trend: 'sideways' } },
  { id: 'worse', use: 'group', props: { trend: 'sideways' } },
];

test('row prop values are checked after {{props}} substitution, once per distinct value', () => {
  const found = findings(documentMap(GROUP_PAGE, { components: GROUP }), 'UNKNOWN_PROP_VALUE');
  assert.equal(found.length, 1, JSON.stringify(found));
  assert.equal(found[0].path, '$.components.group.root.repeat.items[0].trend');
  assert.match(found[0].message, /"sideways"/);
  assert.doesNotMatch(found[0].message, /\{\{props/);
});

test('wf lint on disk checks the rendered row values too', () => {
  const result = runLint({ projectPath: createRepeatProject(GROUP_PAGE, { components: GROUP }) });
  const values = result.warnings.filter((w) => w.code === 'UNKNOWN_PROP_VALUE');
  assert.equal(values.length, 1, JSON.stringify(result.warnings));
  assert.match(values[0].message, /"sideways"/);
});
