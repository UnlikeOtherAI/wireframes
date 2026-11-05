'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

test('authored split widths survive equal-column defaults and narrow viewports', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const html = renderWireframeMarkup({
      roots: [{ id: 'main', kind: 'container', nodes: [
        { id: 'split', component: 'split', size: { height: 416 }, children: [
          { id: 'left', component: 'stack', size: { width: 280 }, children: [{ id: 'title', component: 'paragraph', props: { text: 'Channel details' } }] },
          { id: 'right', component: 'stack', children: [{ id: 'open', component: 'button', props: { label: 'Open settings' }, interaction: [{ type: 'navigation', targetRoute: 'settings' }] }] }
        ] },
        { id: 'equal', component: 'split', children: [{ id: 'first', component: 'stack' }, { id: 'second', component: 'stack' }] }
      ] }],
      pageViewport: { device: 'web', width: 1280, height: 800 },
      routeTable: { settings: '#settings' }, rendering: { mode: 'card' }, deviceChrome: false
    });
    await page.setContent(html);
    const box = id => page.locator('#' + id).boundingBox();
    assert.equal((await box('left')).width, 280);
    assert.equal((await box('split')).height, 416);
    assert.ok((await box('right')).width > 280);
    assert.ok(Math.abs((await box('first')).width - (await box('second')).width) < 1);
    await page.getByRole('button', { name: 'Open settings' }).click();
    assert.ok(page.url().endsWith('#settings'));
    await page.setViewportSize({ width: 360, height: 800 });
    const narrow = await box('split'), left = await box('left'), right = await box('right');
    assert.ok(left.width <= 280);
    assert.ok(right.x + right.width <= narrow.x + narrow.width + 1);
  } finally { await browser.close(); }
});
