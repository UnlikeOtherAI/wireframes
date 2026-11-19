'use strict';

// The repeat budget is one per page: repeats that share a page are counted
// together on every path, the build, disk and in-memory validation and lint.
// What a replaced slot fallback would cost is in repeat-overrides.test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { renderPage } = require('../../engine/build');
const { lintSources } = require('../../engine/lint/source');
const { validateProject } = require('../../engine/validate');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { createRepeatProject, documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });
const items = (count) => Array.from({ length: count }, (_, index) => ({ id: `i${index}` }));
const rows = (id, cell, list) => ({ id, component: 'stack', repeat: { cell, items: list } });

function sources(map) {
  return [
    { name: 'manifest.yaml', text: dump(map.manifest) },
    { name: 'sitemap.yaml', text: dump(map.sitemap) },
    { name: 'templates.yaml', text: dump(map.templates) },
    { name: 'components.yaml', text: dump(map.components) },
    { name: 'pages/home.yaml', text: dump(map.pages.get('home')) },
  ];
}

function budgetFindings(map) {
  const list = sources(map);
  return lintSources(list).diagnostics.filter((d) => d.code === 'REPEAT_BUDGET_EXCEEDED').map((d) => ({
    source: d.source,
    path: d.path,
    underlined: list.find((s) => s.name === d.source).text.slice(d.range.start.offset, d.range.end.offset),
  }));
}

// Each wall fits on its own (200 rows of 126 nodes), two of them do not.
const INNER = { inner: { root: rows('inner', 'text', items(125)) } };
const WALL_A = rows('wall_a', 'inner', items(200));
const WALL_B = rows('wall_b', 'inner', items(200));
const modal = (id, content) => ({ id, type: 'modal', content });

const SHARED = {
  'two region repeats': {
    map: () => documentMap([WALL_A, WALL_B], { components: INNER }),
    at: { source: 'pages/home.yaml', path: '$.page.slots[0].content[1].repeat' },
  },
  'two overlays': {
    map: () => documentMap([], { components: INNER, page: { overlays: [modal('modal_a', [WALL_A]), modal('modal_b', [WALL_B])] } }),
    at: { source: 'pages/home.yaml', path: '$.page.overlays[1].content[0].repeat' },
  },
  'a region and an overlay': {
    map: () => documentMap([WALL_A], { components: INNER, page: { overlays: [modal('modal_b', [WALL_B])] } }),
    at: { source: 'pages/home.yaml', path: '$.page.overlays[0].content[0].repeat' },
  },
  'two hosts in one definition': {
    map: () => documentMap([{ id: 'shell', use: 'shell' }], {
      components: { ...INNER, shell: { root: { id: 'shell', component: 'stack', children: [WALL_A, WALL_B] } } },
    }),
    at: { source: 'components.yaml', path: '$.components.shell.root.children[1].repeat' },
  },
};

for (const [name, { map, at }] of Object.entries(SHARED)) {
  test(`repeats that share a page share its budget: ${name}`, () => {
    assert.equal(renderPage(map(), 'home').ok, false, 'the build refuses the page');
    assert.deepEqual(budgetFindings(map()), [{ ...at, underlined: 'repeat' }]);
    assert.deepEqual(validateProject(map()).errors.map((e) => e.code), ['REPEAT_BUDGET_EXCEEDED']);
  });
}

test('wf validate refuses what wf build refuses, and the in-memory validation does too', () => {
  const onDisk = runValidate({ projectPath: createRepeatProject([WALL_A, WALL_B], { components: INNER }) });
  assert.equal(onDisk.ok, false);
  assert.deepEqual(onDisk.errors.map((e) => e.code), ['REPEAT_BUDGET_EXCEEDED']);

  const single = documentMap([rows('wall', 'inner', items(200))], {
    components: { inner: { root: rows('inner', 'leaf', items(200)) }, leaf: { root: rows('leaf', 'text', items(2)) } },
  });
  const inMemory = validateProject(single);
  assert.equal(inMemory.ok, false);
  assert.deepEqual(inMemory.errors.map((e) => e.code), ['REPEAT_BUDGET_EXCEEDED']);
  assert.match(inMemory.errors[0].message, /Repeat on "wall" would expand to 160400 more nodes/);
});

test('a budget failure under an earlier broken entry is still reported', () => {
  const map = documentMap([{ id: 'gone', use: 'nowhere' }, WALL_A, WALL_B], { components: INNER });
  const found = lintSources(sources(map)).diagnostics.map((d) => `${d.code} ${d.path}`);
  assert.ok(found.some((line) => line.startsWith('BROKEN_COMPONENT_REFERENCE $.page.slots[0].content[0]')), found.join('\n'));
  assert.ok(found.includes('REPEAT_BUDGET_EXCEEDED $.page.slots[0].content[2].repeat'), found.join('\n'));
});
