'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { skinProject } = require('./fixtures/skin-project');
const { renderPage } = require('../../engine/build');

test('custom app bar has a leading 44-point menu button that opens a left drawer', async () => {
  const map = skinProject();
  map.pages.get('home').page.slots[0].content = [{
    id: 'nav_bar', component: 'app_bar', children: [
      { id: 'burger', component: 'button', props: { label: 'Menu', icon: 'bars', iconPosition: 'center', variant: 'ghost' },
        interaction: [{ type: 'open_overlay', targetOverlay: 'left_menu' }] },
      { id: 'nav_title', component: 'heading', props: { text: 'Nessie', level: 3 } },
      { id: 'account', component: 'button', props: { label: 'Account', icon: 'user', variant: 'ghost' } },
    ],
  }];
  map.pages.get('home').page.overlays = [{
    id: 'left_menu', type: 'drawer_left', trigger: 'burger', dismissOn: ['outside', 'escape'],
    content: [{ id: 'drawer_links', component: 'nav', props: { items: [{ label: 'Settings', route: 'home' }] } }],
  }];
  const result = renderPage(map, 'home', { deviceChrome: false, viewportOverride: { device: 'tablet', platform: 'ios', width: 1024, height: 768 } });
  assert.equal(result.ok, true);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-admin-chrome-'));
  const html = result.html.replace(/<link[^>]*fa\/css\/all.min.css[^>]*>/,
    '<link rel="stylesheet" href="' + pathToFileURL(require.resolve('@fortawesome/fontawesome-free/css/all.min.css')).href + '">');
  fs.writeFileSync(path.join(temp, 'index.html'), html);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    await page.goto(pathToFileURL(path.join(temp, 'index.html')).href);
    await page.evaluate(() => document.fonts.ready);
    const bar = await page.locator('#nav_bar').boundingBox();
    const button = await page.getByRole('button', { name: 'Menu', exact: true }).boundingBox();
    assert.ok(button.width >= 44 && button.height >= 44, JSON.stringify(button));
    assert.ok(button.x - bar.x <= 24, 'Menu is the leading bar control');
    assert.ok(button.y >= bar.y && button.y + button.height <= bar.y + bar.height + 1);
    assert.equal(await page.locator('#nav_bar .wf-skeleton').count(), 0);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Settings', exact: true }).waitFor({ state: 'hidden' });
  } finally {
    await browser.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
