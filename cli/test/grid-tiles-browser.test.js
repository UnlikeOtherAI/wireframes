'use strict';

// Grids without columns lay out tiles that fill the row (render polish item 1).
// Measured in Chromium and, where installed, WebKit.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const card = (id, title = id) => ({ id, component: 'card', props: { title, description: 'Plan details' } });
const CONTENT = [
  { id: 'pricing', component: 'grid', repeat: { cell: 'card', items: [
    { id: 'basic', title: 'Basic', description: '$10/mo' },
    { id: 'pro', title: 'Pro', description: '$29/month' },
    { id: 'enterprise', title: 'Enterprise', description: '$500/month' },
  ] } },
  { id: 'outer', component: 'grid', props: { columns: 4 }, children: [
    { id: 'narrow', component: 'grid', children: [card('n1'), card('n2')] },
  ] },
  { id: 'placed', component: 'grid', children: [
    { ...card('main'), gridItem: { span: 8 } }, { ...card('side'), gridItem: { span: 4 } },
  ] },
];

const CASES = [
  { name: 'web', options: {}, width: 1280, min: 220 },
  { name: 'phone page', project: { device: 'mobile' }, options: {}, width: 390, min: 150 },
  { name: 'adaptive phone', options: { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }, width: 390, min: 150 },
  { name: 'adaptive tablet', options: { adaptive: true, viewportOverride: { device: 'tablet', orientation: 'portrait' } }, width: 820, min: 200 },
];

function measure(page) {
  return page.evaluate(() => {
    const box = (el) => el.getBoundingClientRect();
    const tracks = (id) => getComputedStyle(document.getElementById(id)).gridTemplateColumns.split(' ').length;
    const tiles = [...document.querySelectorAll('#pricing > .wf-node-children > .wf-node')].map((el) => box(el));
    const content = (el) => {
      const s = getComputedStyle(el);
      return box(el).width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    };
    return {
      pricingWidth: content(document.getElementById('pricing')),
      tiles: tiles.map((r) => ({ left: r.left, top: r.top, width: r.width })),
      narrowWidth: content(document.getElementById('narrow')),
      narrowTiles: [...document.querySelectorAll('#narrow > .wf-node-children > .wf-node')].map((el) => box(el).width),
      placedTracks: tracks('placed'),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

for (const engine of engines()) {
  test(`grids without columns fill the row with tiles in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const c of CASES) {
          const result = renderPage(polishProject(CONTENT, { mode, ...c.project }), 'home', { deviceChrome: false, ...c.options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width: c.width, height: 900 } });
          await page.setContent(result.html);
          const m = await measure(page);
          const label = `${engine.name} ${mode} ${c.name}`;
          assert.ok(m.overflow <= 0, `${label}: page overflows by ${m.overflow}px`);
          for (const tile of m.tiles) assert.ok(tile.width >= Math.min(c.min, m.pricingWidth) - 0.5, `${label}: tile ${tile.width}px`);
          // Tiles on the first row reach the row's end: they fill it.
          const firstRow = m.tiles.filter((t) => Math.abs(t.top - m.tiles[0].top) < 1);
          const last = firstRow[firstRow.length - 1];
          const rowLeft = m.tiles[0].left;
          assert.ok(Math.abs(last.left + last.width - rowLeft - m.pricingWidth) < 1.5, `${label}: tiles leave the row unfilled`);
          // A nested grid narrower than its minimum gets one full-width track, never overflow.
          for (const width of m.narrowTiles) assert.ok(width <= m.narrowWidth + 0.5, `${label}: nested tile ${width}px > ${m.narrowWidth}px`);
          assert.equal(m.placedTracks, 12, `${label}: a placed grid keeps 12 columns`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
