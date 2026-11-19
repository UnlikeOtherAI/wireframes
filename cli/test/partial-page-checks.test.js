'use strict';

// When one entry of a page cannot be expanded, validation reports it where it is
// written and still checks everything around it on the rendered tree: rows,
// injections and overlay content. Only a reference that may point into what
// failed is left unreported.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { lintSources } = require('../../engine/lint/source');
const { documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });
const rows = (id, cell, items) => ({ id, component: 'stack', repeat: { cell, items } });
const BROKEN = { id: 'broken', use: 'missing' };
const TYPO_ROWS = rows('stats', 'stat', [{ id: 'a', lable: 'typo', trend: 'sideways' }]);
const MARKER = { id: 'holder', injectable: true };

function findings(map) {
  const list = [
    { name: 'manifest.yaml', text: dump(map.manifest) },
    { name: 'sitemap.yaml', text: dump(map.sitemap) },
    { name: 'templates.yaml', text: dump(map.templates) },
    { name: 'components.yaml', text: dump(map.components) },
    { name: 'pages/home.yaml', text: dump(map.pages.get('home')) },
  ];
  return lintSources(list).diagnostics.map((d) => `${d.code} ${d.path}`);
}

/** The page's `main` slot holds `content`; a persistent region above it holds the `holder` marker. */
function withHolder(content, injected) {
  const map = documentMap(content, { components: {}, page: { injectables: [{ injectableId: 'holder', content: injected }] } });
  map.templates.templates.main.regions.unshift({ id: 'top', kind: 'persistent', children: [MARKER] });
  return map;
}

const typoAt = (path) => [`UNKNOWN_PROP ${path}.repeat.items[0].lable`, `UNKNOWN_PROP_VALUE ${path}.repeat.items[0].trend`];

test('rows beside an entry that cannot expand are still linted', () => {
  const found = findings(documentMap([BROKEN, TYPO_ROWS], { components: {} }));
  assert.deepEqual(found, ['BROKEN_COMPONENT_REFERENCE $.page.slots[0].content[0].use', ...typoAt('$.page.slots[0].content[1]')]);
});

test('rows in an overlay beside an entry that cannot expand are still linted', () => {
  const body = { id: 'body', component: 'text', props: { text: 'Body' } };
  const map = documentMap([body], { components: {}, page: { overlays: [{ id: 'modal', type: 'modal', content: [BROKEN, TYPO_ROWS] }] } });
  assert.deepEqual(findings(map), ['BROKEN_COMPONENT_REFERENCE $.page.overlays[0].content[0].use', ...typoAt('$.page.overlays[0].content[1]')]);
});

test('injected rows are linted when another entry fails, once even where the injection reaches itself', () => {
  for (const injected of [[TYPO_ROWS], [MARKER, TYPO_ROWS]]) {
    const found = findings(withHolder([BROKEN], injected));
    const at = `$.page.injectables[0].content[${injected.length - 1}]`;
    assert.deepEqual(found, ['BROKEN_COMPONENT_REFERENCE $.page.slots[0].content[0].use', ...typoAt(at)], JSON.stringify(injected));
  }
});

test('ids beside an entry that cannot expand are still checked', () => {
  const dup = (text) => ({ id: 'dup', component: 'text', props: { text } });
  const map = withHolder([BROKEN, dup('a')], [dup('b')]);
  assert.ok(findings(map).includes('DUPLICATE_NODE_ID null'), findings(map).join('\n'));
});

test('a submit that names a form which failed to expand is not reported as a missing form', () => {
  const form = { id: 'signup', component: 'form', children: [BROKEN] };
  const submit = { id: 'send', component: 'button', props: { label: 'Send' }, interaction: [{ type: 'submit', formId: 'signup' }] };
  assert.deepEqual(findings(documentMap([form, submit], { components: {} })), ['BROKEN_COMPONENT_REFERENCE $.page.slots[0].content[0].children[0].use']);
});
