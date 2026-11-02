'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runBuild } = require('../engine/build/fs-writer');
const { resolvePageTargets } = require('../engine/screenshots');
const { renderWireframeMarkup } = require('../engine/screenshots/renderer');

const root = path.resolve(__dirname, '..');
const galleryPath = path.join(root, 'engine', 'renderer', '__fixtures__', 'gallery');
const baselinesPath = path.join(galleryPath, 'baselines');

function renderTarget(target) {
  return renderWireframeMarkup({
    roots: target.roots,
    pageViewport: target.viewport,
    pageRouteId: target.pageRouteId,
    routeTable: target.routeTable,
    appStateDefaults: target.appStateDefaults,
    pageStateDefaults: target.pageStateDefaults,
    pageStyle: target.wireframeStyle,
    rendering: target.rendering || {},
    defaultGridColumns: target.defaultGridColumns,
    bodyLayoutType: target.bodyLayoutType || 'row',
    bodyLayout: target.bodyLayout,
    projectPath: target.projectPath,
    dataSources: target.dataSources,
  });
}

async function main() {
  const outputDir = path.join(os.tmpdir(), `wireframe-gallery-build-${process.pid}`);
  const build = runBuild({
    projectPath: galleryPath,
    output: outputDir,
    platform: 'web',
    clean: true,
  });
  if (!build.ok) {
    throw new Error(build.error || 'Gallery build failed.');
  }

  const targetsResult = resolvePageTargets(galleryPath);
  if (!targetsResult.ok) {
    throw new Error(targetsResult.error || 'Could not resolve gallery pages.');
  }

  const { chromium } = require('playwright');
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    fs.rmSync(baselinesPath, { recursive: true, force: true });
    fs.mkdirSync(baselinesPath, { recursive: true });

    for (const target of targetsResult.targets) {
      const page = await browser.newPage({
        viewport: {
          width: target.viewport.width,
          height: target.viewport.height,
        },
      });
      await page.setContent(renderTarget(target), { waitUntil: 'networkidle' });
      await page.waitForTimeout(50);
      await page.screenshot({
        path: path.join(baselinesPath, `${target.pageId}.png`),
        fullPage: false,
      });
      await page.close();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
