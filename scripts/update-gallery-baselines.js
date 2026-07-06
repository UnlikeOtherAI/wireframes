'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { runBuild } = require('../engine/build/fs-writer');
const { launchChromium } = require('../engine/screenshots/playwright-launcher');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'engine', 'renderer', '__fixtures__', 'gallery');
const BASELINES = path.join(ROOT, 'cli', 'test', '__screenshots__', 'gallery');
const PAGE_IDS = ['gallery_card', 'gallery_line', 'auth_card', 'auth_line'];

function requireFromCli(packageName) {
  return require(require.resolve(packageName, { paths: [path.join(ROOT, 'cli')] }));
}

async function main() {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-gallery-build-'));
  fs.mkdirSync(BASELINES, { recursive: true });

  const build = runBuild({
    projectPath: FIXTURE,
    output: outputDir,
    platform: 'web',
    clean: true,
  });
  if (!build.ok) {
    throw new Error(build.error || 'Gallery build failed');
  }

  const playwright = requireFromCli('playwright');
  const browser = await launchChromium(playwright, { headless: true });
  try {
    for (const pageId of PAGE_IDS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      const htmlPath = path.join(outputDir, 'web', `${pageId}.html`);
      await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
      await page.screenshot({
        path: path.join(BASELINES, `${pageId}.png`),
        fullPage: false,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
