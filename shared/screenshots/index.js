'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { renderWireframeMarkup } = require(path.resolve(__dirname, 'renderer'));

const { runValidate } = require(path.resolve(__dirname, '..', 'validate'));
const { listPages } = require(path.resolve(__dirname, '..', 'page'));
const { pageFilePath } = require(path.resolve(__dirname, '..', 'addressing'));
const { listRoutes } = require(path.resolve(__dirname, '..', 'introspection', 'routes'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { buildTreeTargets } = require(path.resolve(__dirname, '..', 'tree'));

const DEFAULT_OUTPUT_DIR = 'screenshots';
const VIEWPORT_PRESETS = {
  web: { width: 1280, height: 900 },
  mobile: {
    portrait: { width: 390, height: 844 },
    landscape: { width: 844, height: 390 },
  },
  tablet: {
    portrait: { width: 820, height: 1180 },
    landscape: { width: 1180, height: 820 },
  },
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function imageFileToDataUri(filePath) {
  const buffer = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === '.jpg' || extension === '.jpeg'
    ? 'image/jpeg'
    : extension === '.gif'
      ? 'image/gif'
      : extension === '.webp'
        ? 'image/webp'
        : extension === '.svg'
          ? 'image/svg+xml'
          : 'image/png';

  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function readYaml(filePath) {
  try {
    const parsed = yaml.load(fs.readFileSync(filePath, 'utf8'));
    return isObject(parsed) ? parsed : {};
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;');
}

function escapeAttr(value) {
  return String(value ?? '').replaceAll('\"', '&quot;');
}

function formatIndexEntry(pageId, route, fileName) {
  return `<li><a href="${escapeAttr(fileName)}">${escapeHtml(pageId)}</a> <span>${escapeHtml(route || '/')}</span></li>`;
}

function writeIndexHtml(outputPath, items) {
  const listItems = items.map((entry) => formatIndexEntry(entry.pageId, entry.route, entry.imageFileName)).join('\n');
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <title>Wireframe Screenshots</title>',
    '  <style>',
    '    body{font-family:Arial,sans-serif;margin:16px;}',
    '    ul{list-style:none;padding:0;}',
    '    li{margin:8px 0;}',
    '    span{color:#666;margin-left:12px;}',
    '  </style>',
    '</head>',
    '<body>',
    '  <h1>Wireframe Screenshots</h1>',
    `  <ul>${listItems}</ul>`,
    '</body>',
    '</html>',
  ].join('\n');
  fs.writeFileSync(outputPath, html, 'utf8');
}

function resolveViewport(viewport = {}) {
  if (!viewport || typeof viewport !== 'object') {
    return { ok: false, error: 'Page viewport is missing.' };
  }

  if (viewport.device === 'web') {
    return {
      ok: true,
      width: VIEWPORT_PRESETS.web.width,
      height: VIEWPORT_PRESETS.web.height,
      device: 'web',
      orientation: undefined,
    };
  }

  const preset = VIEWPORT_PRESETS[viewport.device]?.[viewport.orientation];
  if (!preset) {
    return {
      ok: false,
      error: viewport.device ? `Unsupported device "${viewport.device}" in viewport.` : 'Page viewport is missing required device.',
    };
  }

  return {
    ok: true,
    width: preset.width,
    height: preset.height,
    device: viewport.device,
    orientation: viewport.orientation,
  };
}

function resolveFrame(projectPath, frameId) {
  if (!frameId) return { ok: true, frame: null };

  const framesPath = path.join(projectPath, 'assets', 'frames', 'frames.yaml');
  const framesDocument = readYaml(framesPath);
  if (!framesDocument || !isObject(framesDocument.frames)) {
    return { ok: false, error: `Invalid or missing frames configuration at ${framesPath}.` };
  }

  const frame = framesDocument.frames[frameId];
  if (!isObject(frame)) {
    return { ok: false, error: `Unknown frame "${frameId}".` };
  }

  const file = typeof frame.file === 'string' ? frame.file.trim() : '';
  if (!file) return { ok: false, error: `Frame "${frameId}" is missing a file name.` };

  const imagePath = path.join(projectPath, 'assets', 'frames', file);
  if (!fs.existsSync(imagePath)) {
    return { ok: false, error: `Frame image does not exist: ${imagePath}` };
  }

  const screen = isObject(frame.screen) ? frame.screen : { top: 0, left: 0, width: 0, height: 0 };
  return {
    ok: true,
    frame: {
      id: frameId,
      imageData: imageFileToDataUri(imagePath),
      top: Number.parseInt(screen.top, 10) || 0,
      left: Number.parseInt(screen.left, 10) || 0,
      width: Number.parseInt(screen.width, 10) || 0,
      height: Number.parseInt(screen.height, 10) || 0,
    },
  };
}

function collectRouteMap(projectPath) {
  const routesResult = listRoutes(projectPath);
  if (!routesResult.ok) return { ok: false, error: routesResult.error };

  const map = new Map();
  for (const route of routesResult.routes) {
    if (typeof route?.page === 'string' && route.page.trim() !== '') {
      map.set(route.page, route.path || '/');
    }
  }

  return { ok: true, routeByPage: map };
}

function resolvePageTargets(projectPath, pageId) {
  const routeMap = collectRouteMap(projectPath);
  if (!routeMap.ok) return routeMap;

  const manifest = loadDocumentFromFile(path.join(projectPath, 'manifest.yaml'), { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const defaultWireframeStyle = manifest.document?.manifest?.defaultWireframeStyle || {};

  const pageIds = pageId ? [pageId] : listPages(projectPath);
  if (pageId && !pageIds.includes(pageId)) return { ok: false, error: `Page "${pageId}" does not exist.` };

  const trees = buildTreeTargets({
    projectPath,
    targetType: 'page',
    targetId: pageId || null,
    depth: null,
    filter: null,
  });
  if (!trees.ok) return trees;

  const rootsById = new Map();
  for (const tree of trees.trees) {
    rootsById.set(tree.id, tree.roots || []);
  }

  const targets = [];
  for (const id of pageIds) {
    const pageLoaded = loadDocumentFromFile(pageFilePath(projectPath, id), { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const page = pageLoaded.document?.page;
    if (!isObject(page)) return { ok: false, error: `Page "${id}" has no page payload.` };

    const viewportResult = resolveViewport(page.viewport);
    if (!viewportResult.ok) return { ok: false, error: viewportResult.error };
    const roots = rootsById.get(id);
    if (!Array.isArray(roots)) return { ok: false, error: `Could not resolve tree for page "${id}".` };

    targets.push({
      pageId: id,
      route: routeMap.routeByPage.get(id) || '/',
      viewport: {
        width: viewportResult.width,
        height: viewportResult.height,
        device: viewportResult.device,
        orientation: viewportResult.orientation,
      },
      wireframeStyle: page.wireframeStyle || defaultWireframeStyle,
      roots,
      projectPath,
    });
  }

  return { ok: true, targets };
}

async function getPlaywright() {
  try {
    const mod = require('playwright');
    if (!mod || !mod.chromium) return { ok: false, error: 'Playwright did not expose chromium launcher.' };
    return { ok: true, module: mod };
  } catch (error) {
    return { ok: false, error: `Playwright is not installed: ${error.message}` };
  }
}

async function captureScreenshots(targets, outputPath, frame) {
  const playwrightResult = await getPlaywright();
  if (!playwrightResult.ok) return playwrightResult;

  const browser = await playwrightResult.module.chromium.launch({ headless: true });
  try {
    for (const target of targets) {
      const browserPage = await browser.newPage();
      const shellWidth = frame?.width || 0;
      const shellHeight = frame?.height || 0;

      await browserPage.setViewportSize({
        width: frame ? Math.max(target.viewport.width + 80, shellWidth + 80) : target.viewport.width,
        height: frame ? Math.max(target.viewport.height + 140, shellHeight + 140) : target.viewport.height,
      });

      const content = renderWireframeMarkup({
        roots: target.roots,
        pageId: target.pageId,
        pageViewport: target.viewport,
        pageStyle: target.wireframeStyle,
        projectPath: target.projectPath,
        frame,
      });

      await browserPage.setContent(content, { waitUntil: 'networkidle' });
      if (frame) {
        await browserPage.waitForFunction(() => {
          const image = document.getElementById('wf-frame-image');
          return !!(image && image.complete && image.naturalWidth > 0);
        });
      }

      const screenshotPath = path.join(outputPath, `${target.pageId}.png`);
      if (frame) {
        await browserPage.locator('#wf-screenshot-shell').screenshot({ path: screenshotPath });
      } else {
        await browserPage.screenshot({ path: screenshotPath, fullPage: false });
      }
      await browserPage.close();
    }

    return { ok: true };
  } finally {
    await browser.close();
  }
}

function buildIndexEntries(results) {
  return results.map((entry) => ({ pageId: entry.pageId, route: entry.route, imageFileName: `${entry.pageId}.png` }));
}

async function runScreenshots({
  projectPath = process.cwd(),
  output = DEFAULT_OUTPUT_DIR,
  pageId = null,
  frameId = null,
  dryRun = false,
} = {}) {
  const normalizedProjectPath = path.resolve(projectPath);
  const outputDir = path.resolve(normalizedProjectPath, output);

  const validation = runValidate({ projectPath: normalizedProjectPath });
  if (!validation.ok) {
    return { ok: false, error: 'Project validation failed. Run wf validate before capturing.', details: validation };
  }

  const frame = resolveFrame(normalizedProjectPath, frameId);
  if (!frame.ok) return frame;

  const targetsResult = resolvePageTargets(normalizedProjectPath, pageId);
  if (!targetsResult.ok) return targetsResult;

  fs.mkdirSync(outputDir, { recursive: true });
  const targets = targetsResult.targets;

  if (!dryRun) {
    const captured = await captureScreenshots(targets, outputDir, frame.frame);
    if (!captured.ok) return captured;
  } else {
    for (const target of targets) {
      fs.writeFileSync(path.join(outputDir, `${target.pageId}.png`), 'dry-run\n', 'utf8');
    }
  }

  const indexEntries = buildIndexEntries(targets);
  writeIndexHtml(path.join(outputDir, 'index.html'), indexEntries);

  return {
    ok: true,
    outputDir,
    output: outputDir,
    screenshotCount: targets.length,
    frameId: frameId || null,
    files: targets.map((target) => `${target.pageId}.png`),
    pages: indexEntries,
  };
}

module.exports = {
  runScreenshots,
  resolveViewport,
  resolveFrame,
  renderWireframeMarkup,
  buildIndexEntries,
  DEFAULT_OUTPUT_DIR,
};
