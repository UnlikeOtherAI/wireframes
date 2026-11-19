'use strict';

// Frame classes B (a bar's own edge at the top level) and T (a box at the top
// level), and the sidebar panel a role: sidebar slot draws (render polish
// items 6 and 7, plan §9.3-9.4).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('../../engine/renderer/primitives');
const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');

const frameOf = (html, id) => (html.match(new RegExp(`id="${id}"[^>]*data-wf-frame="(\\w+)"`)) || [])[1];
const items = [{ label: 'Home', route: 'home' }, { label: 'Docs' }];
const menu = (id, extra = {}) => ({ id, component: 'menu', props: { items }, ...extra });
const nav = (id, variant) => ({ id, component: 'nav', props: { ...(variant ? { variant } : {}), items } });

test('a menu is a box at the top level and plain inside any frame', () => {
  assert.equal(frameOf(renderNode(menu('m')), 'm'), 'surface');
  const card = renderNode({ id: 'c', component: 'card', children: [menu('in_card')] });
  assert.equal(frameOf(card, 'in_card'), 'content');
  // Rule 8 makes grid children tiles, but not inside a card: no box in a box.
  const gridCard = renderNode({ id: 'g', component: 'card', layout: { type: 'grid', columns: 2 }, children: [menu('tile')] });
  assert.equal(frameOf(gridCard, 'tile'), 'content');
  const topGrid = renderNode({ id: 'g', component: 'grid', children: [menu('top_tile')] });
  assert.equal(frameOf(topGrid, 'top_tile'), 'surface');
  assert.equal(frameOf(renderNode(menu('flat', { surface: false })), 'flat'), 'group', 'surface: false still wins');
  assert.equal(frameOf(renderNode(menu('chrome'), { insideChrome: true }), 'chrome'), 'content');
});

test('sidebar, rail and top nav and the menubar draw their own edge at the top level only', () => {
  for (const variant of ['sidebar', 'rail', 'top']) {
    assert.equal(frameOf(renderNode(nav('n', variant)), 'n'), 'edge', variant);
    assert.equal(frameOf(renderNode(nav('n', variant), { surfaceDepth: 1 }), 'n'), 'content', `${variant} in a frame`);
    assert.equal(frameOf(renderNode(nav('n', variant), { insideChrome: true }), 'n'), 'content', `${variant} in a sidebar panel`);
  }
  assert.equal(frameOf(renderNode(nav('plain')), 'plain'), 'content', 'a nav without a variant is unchanged');
  assert.equal(frameOf(renderNode({ id: 'mb', component: 'menubar', props: { items } }), 'mb'), 'edge');
  assert.equal(frameOf(renderNode({ id: 'mb', component: 'menubar', props: { items } }, { surfaceDepth: 1 }), 'mb'), 'content');
});

const SIDE = { id: 'side', kind: 'slot', role: 'sidebar', layout: { type: 'stack', padding: 0 } };
const MAIN = { id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } };
function sidebarPage(regions, { sideContent = [nav('side_nav', 'sidebar'), menu('side_menu')] } = {}) {
  const map = polishProject([{ id: 'title', component: 'heading', props: { text: 'Main' } }], { regions });
  map.pages.get('home').page.slots.push({ slotId: 'side', content: sideContent });
  return renderPage(map, 'home', { deviceChrome: false });
}
const regionTag = (html, id) => html.match(new RegExp(`<section id="${id}"[^>]*>`))[0];

test('a role: sidebar slot draws a sidebar panel, and what it holds draws no chrome of its own', () => {
  const { html, ok, error } = sidebarPage([SIDE, MAIN]);
  assert.equal(ok, true, error);
  const side = regionTag(html, 'side');
  assert.match(side, /data-wf-frame="edge" data-wf-edge-side="end"/);
  assert.match(side, /padding:16px/, 'an authored padding of 0 still gets a comfortable inset');
  assert.equal(frameOf(html, 'side_nav'), 'content');
  assert.equal(frameOf(html, 'side_menu'), 'content');
  assert.match(regionTag(html, 'main'), /data-wf-frame="group"/);

  assert.match(regionTag(sidebarPage([MAIN, SIDE]).html, 'side'), /data-wf-edge-side="start"/, 'after the content the edge is on the left');
  const padded = regionTag(sidebarPage([{ ...SIDE, layout: { type: 'stack', padding: 8 } }, MAIN]).html, 'side');
  assert.doesNotMatch(padded, /style="[^"]*padding:16px/, 'an authored inset is kept');
});

test('a persistent sidebar region stays a surface, so its nav adds no second frame', () => {
  const persistent = { id: 'side', kind: 'persistent', role: 'sidebar', layout: { type: 'stack', padding: 0 }, children: [nav('side_nav', 'sidebar')] };
  const map = polishProject([{ id: 'title', component: 'heading', props: { text: 'Main' } }], { regions: [persistent, MAIN] });
  const { html } = renderPage(map, 'home', { deviceChrome: false });
  assert.match(regionTag(html, 'side'), /data-wf-frame="surface"/);
  assert.doesNotMatch(regionTag(html, 'side'), /data-wf-edge-side/);
  assert.equal(frameOf(html, 'side_nav'), 'content');
});

test('rail tiles without an icon keep a decorative placeholder; the link keeps its name', () => {
  const html = renderNode(nav('r', 'rail'), { routeTable: { home: '#home' } });
  assert.match(html, /<a class="wf-nav-item[^"]*" href="#home"[^>]*><span class="wf-ico wf-ico-placeholder" aria-hidden="true"><\/span><span class="wf-nav-label">Home<\/span>/);
  const sidebar = renderNode(nav('s', 'sidebar'));
  assert.doesNotMatch(sidebar, /wf-ico-placeholder/, 'only a rail draws tiles');
});
