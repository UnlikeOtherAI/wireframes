'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { runBuild } = require('../../engine/build/fs-writer');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');

const example = path.resolve(__dirname, '../../examples/interactive-workspace');
let output, browser;
const evidence = process.env.WF_INTERACTIVE_EVIDENCE;
test.before(async () => {
  output = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-interactive-'));
  const result = runBuild({ projectPath: example, output, platform: 'tablet', clean: true });
  assert.equal(result.ok, true, JSON.stringify(result));
  browser = await launchChromium(require('playwright'), { headless: true });
  if (evidence) fs.mkdirSync(evidence, { recursive: true });
});
test.after(async () => {
  await browser?.close();
  if (output) fs.rmSync(output, { recursive: true, force: true });
});
async function open() {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
  await page.goto(pathToFileURL(path.join(output, 'tablet/home.html')).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await shot(page, 'workspace-debug-initial');
  return page;
}
async function shot(page, name) {
  if (evidence) await page.screenshot({ path: path.join(evidence, name + '.png') });
}
test('iPad layout renders real Free styles, icon positions, labelled images and a pill composer', async () => {
  const page = await open();
  try {
    for (const selector of ['#github_action .fa-github', '#email_field .fa-envelope', '#search_projects .fa-magnifying-glass']) {
      const glyph = page.locator(selector);
      assert.equal(await glyph.count(), 1);
      const content = await glyph.evaluate((el) => getComputedStyle(el, '::before').content);
      assert.ok(content && content !== 'none' && content !== '""', selector + ' has no glyph');
      assert.equal(await glyph.getAttribute('aria-hidden'), 'true');
    }
    const columns = await page.locator('#workspace_columns').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(columns, 2, 'tablet workspace has two columns');
    const right = await page.locator('#open_library .wf-icon-glyph').boundingBox();
    const rightButton = await page.locator('#open_library .wf-button-link').boundingBox();
    assert.ok(right.x + right.width / 2 > rightButton.x + rightButton.width / 2);
    const left = await page.locator('#github_action .wf-icon-glyph').boundingBox();
    const leftButton = await page.locator('#github_action .wf-button-link').boundingBox();
    assert.ok(left.x + left.width / 2 < leftButton.x + leftButton.width / 2);
    assert.equal(await page.getByRole('button', { name: 'Discard note', exact: true }).count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Send note', exact: true }).count(), 1);
    const radii = await page.locator('#search_projects .wf-control, #note_composer, #send_note a').evaluateAll((nodes) =>
      nodes.map((el) => ({ radius: parseFloat(getComputedStyle(el).borderTopLeftRadius), width: el.clientWidth, height: el.clientHeight })));
    assert.equal(radii.length, 3);
    for (const r of radii) assert.ok(r.radius >= Math.min(r.width, r.height) / 2, JSON.stringify(r));
    const plainBorder = await page.locator('#note_text .wf-control').evaluate((el) => getComputedStyle(el).borderTopWidth);
    assert.equal(plainBorder, '0px', 'composer has one enclosing frame');
    const image = page.locator('#project_image [role="img"]');
    assert.match(await image.getAttribute('aria-label'), /reusable water bottle/);
    assert.equal(await image.locator('.wf-image-caption').isVisible(), true);
    await shot(page, 'workspace-initial');
  } finally { await page.close(); }
});
test('centred search keeps its full hit area, accepts typing and restores empty decoration', async () => {
  const page = await open();
  try {
    const input = page.getByLabel('Search projects', { exact: true });
    const bounds = await input.boundingBox();
    const control = await page.locator('#search_projects .wf-control').boundingBox();
    assert.ok(bounds.width >= control.width - 2, 'full-width native input');
    await input.click({ position: { x: bounds.width - 5, y: bounds.height / 2 } });
    assert.equal(await input.evaluate((el) => el === document.activeElement), true);
    await page.keyboard.type('Launch assets');
    assert.equal(await input.inputValue(), 'Launch assets');
    const hidden = await page.locator('#search_projects .wf-input-placeholder').evaluate((el) => getComputedStyle(el).display);
    assert.equal(hidden, 'none');
    await shot(page, 'workspace-search-focused');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Tab');
    const visible = await page.locator('#search_projects .wf-input-placeholder').evaluate((el) => getComputedStyle(el).display);
    assert.notEqual(visible, 'none');
  } finally { await page.close(); }
});
test('sticky bar and user menu keep working after a long scroll across three real pages', async () => {
  const page = await open();
  try {
    await page.evaluate(() => window.scrollTo(0, 1000));
    const scroll = await page.evaluate(() => window.scrollY);
    assert.ok(scroll >= 800, 'the document must actually scroll');
    const bar = await page.locator('#workspace_bar').boundingBox();
    assert.ok(Math.abs(bar.y) <= 1, 'sticky bar top is ' + bar.y);
    await page.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.getByRole('link', { name: 'Your profile', exact: true }).waitFor({ state: 'visible' });
    const menu = await page.locator('#account_menu').boundingBox();
    assert.ok(menu.x >= 0 && menu.x + menu.width <= 1025, 'menu overflows tablet');
    await shot(page, 'workspace-scrolled-menu');
    await page.getByRole('link', { name: 'Your profile', exact: true }).click();
    await page.waitForURL(/profile\.html/);
    assert.equal(await page.getByRole('heading', { name: 'Your profile', exact: true }).count(), 1);
    await page.getByLabel('Name', { exact: true }).fill('Ada Byron');
    await shot(page, 'workspace-profile');
    await page.getByRole('link', { name: 'Asset library', exact: true }).click();
    await page.waitForURL(/library\.html/);
    await page.getByLabel('Find an asset', { exact: true }).fill('Launch');
    await shot(page, 'workspace-library');
    await page.getByRole('link', { name: 'Back to workspace', exact: true }).click();
    await page.waitForURL(/home\.html/);
    await page.getByRole('button', { name: 'Ada', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#account_menu').isVisible(), false);
  } finally { await page.close(); }
});
