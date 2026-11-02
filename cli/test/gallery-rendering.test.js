'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');

const { runBuild } = require('../../engine/build/fs-writer');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');

const FIXTURE = path.join(__dirname, '..', '..', 'engine', 'renderer', '__fixtures__', 'gallery');
const BASELINES = path.join(__dirname, '__screenshots__', 'gallery');
// One page per family, plus both modes and an auth screen.
const PAGE_IDS = ['containers', 'content', 'forms', 'data', 'charts', 'navigation_elements', 'line_structure', 'line_forms', 'auth'];
const MAX_DIFF_PIXEL_RATIO = 0.01;

function diffPixelRatio(actualBuffer, expectedBuffer) {
  const actual = PNG.sync.read(actualBuffer);
  const expected = PNG.sync.read(expectedBuffer);
  assert.equal(actual.width, expected.width, 'screenshot width changed');
  assert.equal(actual.height, expected.height, 'screenshot height changed');

  let diffPixels = 0;
  const pixelCount = actual.width * actual.height;
  for (let offset = 0; offset < actual.data.length; offset += 4) {
    const dr = Math.abs(actual.data[offset] - expected.data[offset]);
    const dg = Math.abs(actual.data[offset + 1] - expected.data[offset + 1]);
    const db = Math.abs(actual.data[offset + 2] - expected.data[offset + 2]);
    const da = Math.abs(actual.data[offset + 3] - expected.data[offset + 3]);
    if (dr + dg + db + da > 24) {
      diffPixels += 1;
    }
  }
  return diffPixels / pixelCount;
}

test('renderer gallery matches committed Playwright baselines', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-gallery-test-'));
  const build = runBuild({
    projectPath: FIXTURE,
    output: outputDir,
    platform: 'web',
    clean: true,
  });
  assert.equal(build.ok, true, build.error);

  const playwright = require('playwright');
  const browser = await launchChromium(playwright, { headless: true });
  try {
    for (const pageId of PAGE_IDS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const htmlPath = path.join(outputDir, 'web', `${pageId}.html`);
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
      const actual = await page.screenshot({ fullPage: false });
      await page.close();

      const baselinePath = path.join(BASELINES, `${pageId}.png`);
      assert.equal(fs.existsSync(baselinePath), true, `Missing gallery baseline ${baselinePath}; run pnpm gallery:update.`);
      const ratio = diffPixelRatio(actual, fs.readFileSync(baselinePath));
      assert.ok(
        ratio <= MAX_DIFF_PIXEL_RATIO,
        `${pageId} screenshot diff ${ratio} exceeded ${MAX_DIFF_PIXEL_RATIO}`,
      );
    }
  } finally {
    await browser.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('mobile bottom chrome sits at the foot of the device', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-mobile-test-'));
  const build = runBuild({
    projectPath: FIXTURE,
    output: outputDir,
    platform: 'mobile',
    clean: true,
  });
  assert.equal(build.ok, true, build.error);

  const playwright = require('playwright');
  const browser = await launchChromium(playwright, { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const htmlPath = path.join(outputDir, 'mobile', 'android_mobile.html');
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

    const boxes = await page.evaluate(() => {
      const rect = (selector) => {
        const node = document.querySelector(selector);
        return node ? node.getBoundingClientRect().toJSON() : null;
      };
      return { shell: rect('.wf-page'), tabs: rect('.wf-bottom_tab_bar'), fab: rect('.wf-button-fab') };
    });

    assert.ok(boxes.shell && boxes.tabs && boxes.fab, 'page, tab bar and FAB must all render');
    // The screen is taller than its content, so the gap belongs above the bar.
    assert.ok(
      Math.abs(boxes.shell.bottom - boxes.tabs.bottom) <= 1,
      `tab bar ended at ${boxes.tabs.bottom}, device at ${boxes.shell.bottom}`,
    );
    // A FAB floats clear of the bar, at the trailing edge.
    assert.ok(boxes.fab.bottom <= boxes.tabs.top, 'FAB overlaps the tab bar');
    assert.ok(boxes.shell.right - boxes.fab.right < boxes.fab.left - boxes.shell.left, 'FAB is not trailing-aligned');
    await page.close();
  } finally {
    await browser.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
