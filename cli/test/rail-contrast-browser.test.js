'use strict';

// The current item of a `nav variant: rail` is a plain tile: its icon reaches
// 3:1 against the tile, its cue (the tile's edge, which is all a placeholder
// item has) 3:1 against the rail, and its label 4.5:1 against what it sits on.
// It used to be an ink tile with an ink icon, 1:1.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject, ROUTE_TABLE } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const items = (current) => [
  { label: 'Home', icon: 'house', route: current === 'icon' ? 'home' : 'docs' },
  { label: 'Inbox', icon: 'inbox', route: 'docs' },
  { label: 'Reports', route: current === 'placeholder' ? 'home' : 'docs' },
];
const CONTENT = [
  { id: 'with_icon', component: 'nav', props: { variant: 'rail', items: items('icon') } },
  { id: 'placeholder', component: 'nav', props: { variant: 'rail', items: items('placeholder') } },
];
const CASES = [
  ['web', 1280, {}],
  ['adaptive phone', 390, { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }],
];

// What the current item paints, read from the page, with WCAG contrast ratios.
const current = (page, id) => page.locator(`#${id} .wf-nav-on`).evaluate((on) => {
  const luminance = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };
  const paint = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
    }
    return 'rgb(255, 255, 255)';
  };
  const tile = on.querySelector('.wf-ico');
  const glyph = tile.querySelector('.wf-icon-glyph');
  const label = on.querySelector('.wf-nav-label');
  const tileBg = paint(tile);
  const railBg = paint(tile.parentElement);
  const cue = (getComputedStyle(tile).boxShadow.match(/rgba?\([^)]*\)/) || [])[0] || null;
  return {
    glyph: glyph ? ratio(getComputedStyle(glyph).color, tileBg) : null,
    cue: cue ? ratio(cue, railBg) : 1,
    label: ratio(getComputedStyle(label).color, paint(label)),
  };
});

for (const engine of engines()) {
  test(`the current rail tile keeps its icon, cue and label readable in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const result = renderPage(polishProject(CONTENT, { mode, routes: ['docs', 'settings'] }), 'home', { deviceChrome: false, routeTable: ROUTE_TABLE, ...options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${name}`;
          const icon = await current(page, 'with_icon');
          assert.ok(icon.glyph >= 3, `${label}: the icon reaches 3:1 on the current tile (${icon.glyph.toFixed(2)}:1)`);
          assert.ok(icon.cue >= 3, `${label}: the current tile's edge reaches 3:1 on the rail (${icon.cue.toFixed(2)}:1)`);
          assert.ok(icon.label >= 4.5, `${label}: the current label reaches 4.5:1 (${icon.label.toFixed(2)}:1)`);
          const blank = await current(page, 'placeholder');
          assert.equal(blank.glyph, null, `${label}: a placeholder item has no glyph`);
          assert.ok(blank.cue >= 3, `${label}: a current placeholder shows its edge at 3:1 (${blank.cue.toFixed(2)}:1)`);
          assert.ok(blank.label >= 4.5, `${label}: the placeholder's label reaches 4.5:1 (${blank.label.toFixed(2)}:1)`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
