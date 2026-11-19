'use strict';

// One decision for a grid's tracks (docs/done/2026-11-19-render-polish.md §9.1).

const test = require('node:test');
const assert = require('node:assert/strict');

const { gridTemplateColumns, resolveDefaultGridColumns } = require('../../engine/renderer/layout');
const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');

const WEB = { device: 'web' };
const PHONE = { device: 'mobile' };
const TABLET = { device: 'tablet' };
const card = (id, extra = {}) => ({ id, component: 'card', props: { title: id }, ...extra });
const tiles = (min) => `repeat(auto-fit,minmax(min(${min}px,100%),1fr))`;

function tracksOf(html, id) {
  const match = html.match(new RegExp(`id="${id}"[^>]*style="[^"]*grid-template-columns:([^;"]+)`));
  return match ? match[1] : null;
}

test('an unset manifest default stays unset; only a positive integer counts', () => {
  assert.equal(resolveDefaultGridColumns({}), null);
  assert.equal(resolveDefaultGridColumns({ defaultGridColumns: 12 }), 12);
  assert.equal(resolveDefaultGridColumns({ defaultGridColumns: 0 }), null);
  assert.equal(resolveDefaultGridColumns({ defaultGridColumns: 2.5 }), null);
  assert.equal(resolveDefaultGridColumns(null), null);
});

test('a grid with no columns and no placed children lays out tiles at the device minimum', () => {
  const children = [card('a'), card('b'), card('c')];
  assert.equal(gridTemplateColumns({}, { children, viewport: WEB }), tiles(220));
  assert.equal(gridTemplateColumns({}, { children, viewport: TABLET }), tiles(200));
  assert.equal(gridTemplateColumns({}, { children, viewport: PHONE }), tiles(150));
  assert.equal(gridTemplateColumns({}, { children, viewport: WEB, sizing: { 'grid.minItemWidth': 300 } }), tiles(300));
});

test('explicit columns, an explicit manifest default and placed children keep the column system', () => {
  const children = [card('a'), card('b')];
  assert.equal(gridTemplateColumns({ columns: 3 }, { children, viewport: WEB }), 'repeat(3,minmax(0,1fr))');
  assert.equal(gridTemplateColumns({}, { children, defaultGridColumns: 12, viewport: WEB }), 'repeat(12,minmax(0,1fr))');
  const placed = [card('a', { gridItem: { span: 8 } }), card('b')];
  assert.equal(gridTemplateColumns({}, { children: placed, viewport: WEB }), 'repeat(12,minmax(0,1fr))');
  assert.equal(gridTemplateColumns({ columns: 6 }, { children: placed, viewport: WEB }), 'repeat(6,minmax(0,1fr))');
  assert.equal(gridTemplateColumns({}, { children: placed, defaultGridColumns: 8 }), 'repeat(8,minmax(0,1fr))');
  for (const gridItem of [{ offset: 1 }, { row: 2 }, { column: 3 }]) {
    assert.equal(gridTemplateColumns({}, { children: [card('a', { gridItem })] }), 'repeat(12,minmax(0,1fr))');
  }
  assert.equal(gridTemplateColumns({}, { children: [card('a', { gridItem: {} })], viewport: WEB }), tiles(220));
});

test('minItemWidth wins over columns and is clamped to the container', () => {
  assert.equal(gridTemplateColumns({ columns: 2 }, { minItemWidth: 280, viewport: WEB }), tiles(280));
  assert.equal(gridTemplateColumns({}, { minItemWidth: 0, viewport: WEB }), tiles(220));
});

test('adaptive mode reflows every unplaced grid at the shown device and never reflows placement', () => {
  const children = [card('a'), card('b'), card('c')];
  assert.equal(gridTemplateColumns({ columns: 3 }, { children, adaptive: true, viewport: PHONE }), tiles(150));
  assert.equal(gridTemplateColumns({}, { children, defaultGridColumns: 12, adaptive: true, viewport: TABLET }), tiles(200));
  assert.equal(gridTemplateColumns({ columns: 2 }, { minItemWidth: 280, adaptive: true, viewport: PHONE }), tiles(280));
  const placed = [card('a', { gridItem: { span: 4 } })];
  assert.equal(gridTemplateColumns({}, { children: placed, adaptive: true, viewport: PHONE }), 'repeat(12,minmax(0,1fr))');
});

test('every host renders the same decision: grid, layout grid, form and region', () => {
  const content = [
    { id: 'tiles', component: 'grid', children: [card('a'), card('b')] },
    { id: 'layout_grid', component: 'section', layout: { type: 'grid' }, children: [card('c'), card('d')] },
    { id: 'form_grid', component: 'form', props: { columns: 2 }, children: [{ id: 'f1', component: 'input', props: { label: 'A' } }] },
    { id: 'placed', component: 'grid', children: [card('e', { gridItem: { span: 8 } }), card('f', { gridItem: { span: 4 } })] },
  ];
  const regions = [{ id: 'main', kind: 'slot', role: 'main', layout: { type: 'grid', gap: 16, padding: 16 } }];
  const unset = renderPage(polishProject(content, { regions }), 'home', { deviceChrome: false });
  assert.equal(unset.ok, true, unset.error);
  assert.equal(tracksOf(unset.html, 'tiles'), tiles(220));
  assert.equal(tracksOf(unset.html, 'layout_grid'), tiles(220));
  assert.equal(tracksOf(unset.html, 'form_grid'), 'repeat(2,minmax(0,1fr))');
  assert.equal(tracksOf(unset.html, 'placed'), 'repeat(12,minmax(0,1fr))');
  assert.match(unset.html, /class="wf-root-body"[^>]*grid-template-columns:repeat\(auto-fit,minmax\(min\(220px,100%\),1fr\)\)/);

  const explicit = renderPage(polishProject(content, { regions, manifest: { defaultGridColumns: 12 } }), 'home', { deviceChrome: false });
  assert.equal(tracksOf(explicit.html, 'tiles'), 'repeat(12,minmax(0,1fr))');
  assert.equal(tracksOf(explicit.html, 'layout_grid'), 'repeat(12,minmax(0,1fr))');
  assert.match(explicit.html, /class="wf-root-body"[^>]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
});

test('repeat rows are the children the decision sees', () => {
  // The cell's root is placed, so only the expanded rows carry a placement.
  const team = { id: 'team', component: 'grid', repeat: { cell: 'half_tile', items: [
    { id: 'ada', title: 'Ada' }, { id: 'grace', title: 'Grace' },
  ] } };
  assert.equal(gridTemplateColumns({}, { children: team.children, viewport: WEB }), tiles(220), 'the host as written has no placed child');
  const map = polishProject([team]);
  map.components.components = { half_tile: { root: { id: 'half_tile', component: 'card', gridItem: { span: 6 }, props: { title: '{{props.title}}' } } } };
  const result = renderPage(map, 'home', { deviceChrome: false });
  assert.equal(result.ok, true, result.error);
  assert.match(result.html, /id="team__grace"[^>]*grid-column:span 6/);
  assert.equal(tracksOf(result.html, 'team'), 'repeat(12,minmax(0,1fr))');
});

test('adaptive renders replay the decision on phone and tablet', () => {
  const content = [
    { id: 'tiles', component: 'grid', props: { columns: 4 }, children: [card('a'), card('b'), card('c'), card('d')] },
    { id: 'outer', component: 'grid', props: { columns: 3 }, children: [
      { id: 'narrow', component: 'grid', props: { minItemWidth: 400 }, children: [card('n1'), card('n2')] },
    ] },
    { id: 'placed', component: 'grid', children: [card('e', { gridItem: { span: 6 } }), card('f', { gridItem: { span: 6 } })] },
  ];
  for (const [device, min] of [['mobile', 150], ['tablet', 200]]) {
    const { html } = renderPage(polishProject(content), 'home', {
      adaptive: true, deviceChrome: false, viewportOverride: { device, orientation: 'portrait' },
    });
    assert.match(html, new RegExp(`<body class="wf wf-adapt-${device} `));
    assert.equal(tracksOf(html, 'tiles'), tiles(min));
    assert.equal(tracksOf(html, 'narrow'), tiles(400));
    assert.equal(tracksOf(html, 'placed'), 'repeat(12,minmax(0,1fr))');
    assert.doesNotMatch(html, /\.wf-adapt-[a-z]+ \.wf-grid\{grid-template-columns/);
  }
});

test('the same input renders identical HTML twice', () => {
  const content = [{ id: 'tiles', component: 'grid', children: [card('a'), card('b')] }];
  const first = renderPage(polishProject(content), 'home', { deviceChrome: false });
  const second = renderPage(polishProject(content), 'home', { deviceChrome: false });
  assert.equal(first.ok, true, first.error);
  assert.equal(second.ok, true, second.error);
  assert.equal(tracksOf(first.html, 'tiles'), tiles(220));
  assert.equal(first.html, second.html);
});
