'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runBuild } = require('../../engine/build/fs-writer');
const { resolvePageTargets } = require('../../engine/screenshots');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

const galleryPath = path.resolve(__dirname, '../../engine/renderer/__fixtures__/gallery');
const baselinesPath = path.join(galleryPath, 'baselines');

function readGeneratedHtml(outputDir, pageId) {
  return fs.readFileSync(path.join(outputDir, 'web', `${pageId}.html`), 'utf8');
}

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

function baselineFiles() {
  if (!fs.existsSync(baselinesPath)) return [];
  return fs.readdirSync(baselinesPath).filter((file) => file.endsWith('.png')).sort();
}

function pngComparator() {
  const playwrightPackagePath = require.resolve('playwright/package.json', {
    paths: [path.resolve(__dirname, '..')],
  });
  const comparatorsPath = path.join(
    path.dirname(playwrightPackagePath),
    '..',
    'playwright-core',
    'lib',
    'server',
    'utils',
    'comparators.js',
  );
  return require(comparatorsPath).getComparator('image/png');
}

async function canLaunchChromium() {
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

test('renderer gallery fixture builds and contains the rendering contract markers', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-gallery-build-'));
  const result = runBuild({
    projectPath: galleryPath,
    output: outputDir,
    platform: 'web',
    clean: true,
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(outputDir, 'web', 'card_text_forms.html')), true);
  assert.equal(fs.existsSync(path.join(outputDir, 'web', 'line_auth.html')), true);

  const textHtml = readGeneratedHtml(outputDir, 'card_text_forms');
  assert.equal(textHtml.includes('Gallery heading'), true);
  assert.equal(textHtml.includes('Label alias heading'), true);
  assert.equal(textHtml.includes('wf-skeleton'), true);
  assert.equal(textHtml.includes('wf-field-label">Project name</label>'), true);
  assert.equal(textHtml.includes('[ Primary ]'), false);

  const structureHtml = readGeneratedHtml(outputDir, 'card_structure');
  assert.match(structureHtml, /id="nested_group" class="[^"]*wf-group/);
  assert.match(structureHtml, /id="grid_tile_a" class="[^"]*wf-surface/);
  assert.match(structureHtml, /id="promoted_tile" class="[^"]*wf-surface/);
  assert.equal(structureHtml.includes('flex:1 1 auto'), true);

  const mediaHtml = readGeneratedHtml(outputDir, 'card_media_charts');
  assert.equal(mediaHtml.includes('Line chart title'), true);
  assert.equal(mediaHtml.includes('Donut chart title'), true);

  const authHtml = readGeneratedHtml(outputDir, 'card_auth');
  assert.equal(authHtml.includes('align-items:center;justify-content:center'), true);

  fs.rmSync(outputDir, { recursive: true, force: true });
});

test('renderer gallery direct render covers all fixture pages', () => {
  const result = resolvePageTargets(galleryPath);
  assert.equal(result.ok, true);
  assert.equal(result.targets.length, 8);

  for (const target of result.targets) {
    const html = renderTarget(target);
    assert.equal(html.includes('wf-mode-card') || html.includes('wf-mode-line'), true);
    assert.equal(html.includes('Heading</h'), false);
  }
});

test('renderer gallery screenshots match committed baselines', { skip: baselineFiles().length === 0 ? 'No gallery baselines committed yet; run pnpm gallery:update after Playwright works.' : false }, async () => {
  assert.equal(await canLaunchChromium(), true, 'Chromium could not launch for gallery screenshot comparison.');

  const { chromium } = require('playwright');
  const targets = resolvePageTargets(galleryPath).targets;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of targets) {
      const page = await browser.newPage({
        viewport: {
          width: target.viewport.width,
          height: target.viewport.height,
        },
      });
      await page.setContent(renderTarget(target), { waitUntil: 'networkidle' });
      await page.waitForTimeout(50);
      const actual = await page.screenshot({ fullPage: false });
      const expected = fs.readFileSync(path.join(baselinesPath, `${target.pageId}.png`));
      const comparison = pngComparator()(actual, expected, { maxDiffPixelRatio: 0.01 });
      assert.equal(comparison, null, `${target.pageId} screenshot differs from baseline: ${comparison?.errorMessage || 'unknown difference'}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
