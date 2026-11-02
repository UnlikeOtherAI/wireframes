'use strict';

// Regenerates every image the README shows. Run it after any renderer change
// that alters what a wireframe looks like:
//
//   node scripts/update-readme-screenshots.js
//
// The shots come from real projects in this repo — examples/quickstart and the
// element gallery — so a README picture can never drift from what wf renders.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { runBuild } = require('../engine/build/fs-writer');
const { launchChromium } = require('../engine/screenshots/playwright-launcher');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = path.join(ROOT, 'docs', 'images');
const QUICKSTART = path.join(ROOT, 'examples', 'quickstart');
const GALLERY = path.join(ROOT, 'engine', 'renderer', '__fixtures__', 'gallery');

const DESKTOP = { width: 1280, height: 860 };
const PHONE = { width: 430, height: 844 };

// [output, project, platform, page, viewport, extra]
const SHOTS = [
  ['quickstart', QUICKSTART, 'web', 'billing', DESKTOP, {}],
  ['quickstart-modal', QUICKSTART, 'web', 'billing', DESKTOP, { click: '#danger_action button' }],
  ['frames', GALLERY, 'web', 'containers', DESKTOP, {}],
  ['elements-content', GALLERY, 'web', 'content', DESKTOP, {}],
  ['elements-forms', GALLERY, 'web', 'forms', DESKTOP, {}],
  ['mode-card', GALLERY, 'web', 'data', DESKTOP, {}],
  ['mode-line', GALLERY, 'web', 'line_data', DESKTOP, {}],
  ['colour', GALLERY, 'web', 'content', DESKTOP, { crop: '.wf-alert' }],
  ['colour-status', GALLERY, 'web', 'content', DESKTOP, { crop: '#badge_row, #badge_status_row' }],
  ['mobile-ios', GALLERY, 'mobile', 'mobile_mobile', PHONE, {}],
  ['mobile-android', GALLERY, 'mobile', 'android_mobile', PHONE, {}],
  ['mobile-menu', GALLERY, 'mobile', 'android_mobile', PHONE, { click: '.wf-button-fab button' }],
];

function requireFromCli(packageName) {
  return require(require.resolve(packageName, { paths: [path.join(ROOT, 'cli')] }));
}

function buildOnce(projectPath, platform, cache) {
  const key = `${projectPath}::${platform}`;
  if (!cache.has(key)) {
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-readme-'));
    const result = runBuild({ projectPath, output, platform, clean: true });
    if (!result.ok) throw new Error(result.error || `build failed for ${projectPath}`);
    cache.set(key, output);
  }
  return cache.get(key);
}

// A crop is measured against the viewport, so scroll the subject into it first.
async function clipFor(page, selector) {
  const pad = 16;
  const box = await page.evaluate(({ sel, pad: padding }) => {
    const nodes = [...document.querySelectorAll(sel)];
    if (!nodes.length) return null;
    const bounds = (list) => {
      const rects = list.map((node) => node.getBoundingClientRect());
      return {
        left: Math.min(...rects.map((r) => r.left)),
        top: Math.min(...rects.map((r) => r.top)),
        right: Math.max(...rects.map((r) => r.right)),
        bottom: Math.max(...rects.map((r) => r.bottom)),
      };
    };
    window.scrollTo(0, Math.max(0, bounds(nodes).top + window.scrollY - padding));
    return bounds(nodes);
  }, { sel: selector, pad });
  if (!box) throw new Error(`nothing matched ${selector}`);
  return {
    x: box.left - pad,
    y: Math.max(0, box.top - pad),
    width: (box.right - box.left) + pad * 2,
    height: (box.bottom - box.top) + pad * 2,
  };
}

async function main() {
  fs.mkdirSync(IMAGES, { recursive: true });
  const builds = new Map();
  const playwright = requireFromCli('playwright');
  const browser = await launchChromium(playwright, { headless: true });

  try {
    for (const [name, projectPath, platform, pageId, viewport, extra] of SHOTS) {
      const outputDir = buildOnce(projectPath, platform, builds);
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const htmlPath = path.join(outputDir, platform === 'web' ? 'web' : platform, `${pageId}.html`);
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
      if (extra.click) {
        await page.click(extra.click);
        await page.waitForTimeout(300);
      }
      const clip = extra.crop ? await clipFor(page, extra.crop) : undefined;
      await page.screenshot({ path: path.join(IMAGES, `${name}.png`), clip });
      await page.close();
      process.stdout.write(`${name}.png\n`);
    }
  } finally {
    await browser.close();
    for (const dir of builds.values()) fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
