'use strict';

// Rows follow the rules hand-written children follow: a slotless instance's
// children replace its root's rows, a slot fallback the caller replaces makes
// no rows and costs nothing, and a definition's rows point at the definition.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { renderPage } = require('../../engine/build');
const { lintSources } = require('../../engine/lint/source');
const { validateProject } = require('../../engine/validate');
const { documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });
const items = (count) => Array.from({ length: count }, (_, index) => ({ id: `i${index}` }));
const rows = (id, cell, list) => ({ id, component: 'stack', repeat: { cell, items: list } });
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
  }));
}

function html(map, options) {
  const result = renderPage(map, 'home', options);
  assert.equal(result.ok, true, result.error);
  return result.html;
}

test("a slotless instance's children replace its root's rows, as they replace hand-written children", () => {
  const repeated = { id: 'section', component: 'stack', repeat: { cell: 'text', items: [{ id: 'ada', text: 'Ada' }] } };
  const handWritten = { id: 'section', component: 'stack', children: [text('section__ada', 'Ada')] };
  const ids = (root, children) => {
    const instance = children ? { id: 'instance', use: 'section', children } : { id: 'instance', use: 'section' };
    return [...html(documentMap([instance], { components: { section: { root } } })).matchAll(/id="(instance[^"]*)"/g)].map((m) => m[1]);
  };
  for (const children of [undefined, [], [text('authored', 'Authored')]]) {
    assert.deepEqual(ids(repeated, children), ids(handWritten, children), JSON.stringify(children));
  }
  assert.deepEqual(ids(repeated, []), ['instance']);
});

test("a slotless definition root's rows are stamped with the definition, the root with its instance", () => {
  const components = { owner: { root: rows('own', 'text', [{ id: 'one', text: 'Owned' }]) } };
  const page = html(documentMap([{ id: 'instance', use: 'owner' }], { components }), { annotateSource: true });
  assert.match(page, /id="instance__own__one"[^>]*data-wf-source="component:owner#own__one" data-wf-source-path="root\.repeat\.items\[0\]"/);
  assert.match(page, /id="instance"[^>]*data-wf-source="page:home#instance"/);

  const clash = findings(documentMap([{ id: 'instance', use: 'owner' }, text('instance__own__one', 'Clash')], { components }), 'DUPLICATE_NODE_ID');
  assert.deepEqual(clash, [{ source: 'components.yaml', path: '$.components.owner.root.repeat.items[0].id', underlined: 'one' }]);
});

// The fallback costs 200 × (1 + 1 + 2 × (1 + 1 + 200)) = 81,200 nodes when it renders.
const FALLBACK = {
  middle: { root: rows('middle', 'inner', items(2)) },
  inner: { root: rows('inner', 'text', items(200)) },
  slotted: { root: { id: 'slotted', component: 'stack', children: [{ id: 'spot', slot: 'default', children: [rows('fallback', 'middle', items(200))] }] } },
};

for (const [name, fill] of [['a fill', { children: [text('visible', 'Live fill')] }], ['an explicit empty fill', { children: [] }]]) {
  test(`a slot fallback replaced by ${name} is not expanded or charged`, () => {
    const map = () => documentMap([{ id: 'instance', use: 'slotted', ...fill }], { components: FALLBACK });
    assert.equal(/id="visible"/.test(html(map())), fill.children.length > 0);
    assert.deepEqual(findings(map(), 'REPEAT_BUDGET_EXCEEDED'), []);
    assert.deepEqual(validateProject(map()).errors, []);
  });
}

test('a fallback that renders is still charged', () => {
  const map = () => documentMap([{ id: 'instance', use: 'slotted' }], { components: FALLBACK });
  assert.equal(renderPage(map(), 'home').ok, false);
  assert.deepEqual(findings(map(), 'REPEAT_BUDGET_EXCEEDED'), [{
    source: 'components.yaml', path: '$.components.slotted.root.children[0].children[0].repeat', underlined: 'repeat',
  }]);
});

test("a repeat's preflight does not count what its cell's instances replace", () => {
  const components = {
    ...FALLBACK,
    wrapper: { root: { id: 'wrapper', component: 'card', children: [{ id: 'framed', use: 'slotted', children: [text('note', 'Note')] }] } },
    bare: { root: { id: 'bare', component: 'card', children: [rows('wide', 'middle', items(200))] } },
    overridden: { root: { id: 'overridden', component: 'stack', children: [{ id: 'inst', use: 'bare', children: [text('only', 'Only')] }] } },
  };
  // The fill is the wrapper's content, so it is named under the row.
  const filled = html(documentMap([rows('cards', 'wrapper', items(3))], { components }));
  assert.equal((filled.match(/id="cards__i\d__note"/g) || []).length, 3);
  // A slotless instance's children replace its root's children and its rows
  // (and, as before repeat, the callee namespaces them under the instance).
  assert.match(html(documentMap([rows('many', 'overridden', items(150))], { components })), /id="many__i149__inst__many__i149__only"/);
});
