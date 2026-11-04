'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { runValidate } = require(path.resolve(__dirname, '..', 'validate', 'cli-adapter'));
const {
  resolvePageTargets,
} = require(path.resolve(__dirname, '..', 'screenshots'));
const {
  buildInteractionRuntimeFromWindowContext,
} = require(path.resolve(__dirname, '..', 'renderer', 'interactions'));
const {
  escapeHtml,
  escapeAttr,
} = require(path.resolve(__dirname, '..', 'screenshots'));
const {
  renderWireframeMarkup,
} = require(path.resolve(__dirname, '..', 'screenshots', 'renderer'));
const { buildWireframeStyles } = require(path.resolve(__dirname, '..', 'renderer', 'styles'));
const {
  normalizeBasePath,
  joinBasePath,
  buildPageFileName,
  buildRouteTableFromTargets,
} = require(path.resolve(__dirname, '..', 'routes'));

const DEFAULT_OUTPUT_DIR = './wireframes/build';
const VALID_PLATFORM_FILTERS = new Set(['all', 'web', 'mobile', 'tablet']);
const DEFAULT_BASE_PATH = '/';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeOutput(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePlatform(value) {
  if (typeof value !== 'string') return 'all';
  const normalized = value.trim().toLowerCase();
  return VALID_PLATFORM_FILTERS.has(normalized) ? normalized : null;
}

function parseBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function loadWfrcConfig(projectPath) {
  const wfrcPath = path.join(projectPath, '.wfrc.yaml');
  if (!fs.existsSync(wfrcPath)) {
    return {
      strictValidation: true,
      failOnWarnings: false,
      build: {
        outputDir: DEFAULT_OUTPUT_DIR,
        clean: false,
        basePath: DEFAULT_BASE_PATH,
      },
      parseError: null,
    };
  }

  let parsed;
  try {
    parsed = yaml.load(fs.readFileSync(wfrcPath, 'utf8')) || {};
    if (!isObject(parsed)) {
      return {
        strictValidation: true,
        failOnWarnings: false,
        build: {
          outputDir: DEFAULT_OUTPUT_DIR,
          clean: false,
          basePath: DEFAULT_BASE_PATH,
        },
        parseError: 'Invalid .wfrc.yaml payload: expected object.',
      };
    }
  } catch (error) {
    return {
      strictValidation: true,
      failOnWarnings: false,
      build: {
        outputDir: DEFAULT_OUTPUT_DIR,
        clean: false,
        basePath: DEFAULT_BASE_PATH,
      },
      parseError: `Invalid .wfrc.yaml: ${error.message}`,
    };
  }

  const cliConfig = isObject(parsed.cli) ? parsed.cli : {};
  const buildConfig = isObject(cliConfig.build) ? cliConfig.build : {};

  return {
    strictValidation: parseBoolean(cliConfig.strictValidation, true),
    failOnWarnings: parseBoolean(cliConfig.failOnWarnings, false),
    build: {
      outputDir: normalizeOutput(buildConfig.outputDir) || DEFAULT_OUTPUT_DIR,
      clean: parseBoolean(buildConfig.clean, false),
      basePath: normalizeOutput(buildConfig.basePath) || DEFAULT_BASE_PATH,
    },
    parseError: null,
  };
}

function normalizeAssetPrefix(basePath) {
  const joined = joinBasePath(basePath, 'assets');
  return joined.endsWith('/') ? joined : `${joined}/`;
}

function buildPlatformIndexHtml(platform, pages, options = {}) {
  const rows = pages
    .map((entry) => `<li><a href="${escapeAttr(entry.fileName)}">${escapeHtml(entry.pageId)}</a> — ${escapeHtml(entry.route || '/')} </li>`)
    .join('\n');
  const title = `Wireframe ${platform}`;
  const masterIndex = '../index.html';

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="./_shared/wireframe.css" />
  </head>
  <body>
    <div class="wf-root">
      <h1>${title}</h1>
      <p><a href="${masterIndex}">Back to master index</a></p>
      <ul>
        ${rows || '<li><em>No pages for this platform.</em></li>'}
      </ul>
    </div>
  </body>
</html>`;
}

function buildMasterIndexHtml(platformEntries, options = {}) {
  const rows = platformEntries
    .map((entry) => `<li><a href="${escapeAttr(entry.href)}">${escapeHtml(entry.platform)}</a> — ${entry.count} pages</li>`)
    .join('\n');

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe Build</title>
    <style>${buildWireframeStyles()}</style>
  </head>
  <body>
    <div class="wf-root">
      <h1>Wireframe Build</h1>
      <ul>
        ${rows || '<li><em>No platforms built.</em></li>'}
      </ul>
    </div>
  </body>
</html>`;
}

function copyFontAwesomeAssets(sharedDir) {
  const faPackageDir = path.dirname(require.resolve('@fortawesome/fontawesome-free/package.json'));
  const faCssDir = path.join(sharedDir, 'fa', 'css');
  const faWebfontsDir = path.join(sharedDir, 'fa', 'webfonts');
  fs.mkdirSync(faCssDir, { recursive: true });
  fs.mkdirSync(faWebfontsDir, { recursive: true });
  const faCssDest = path.join(faCssDir, 'all.min.css');
  fs.copyFileSync(path.join(faPackageDir, 'css', 'all.min.css'), faCssDest);
  const faCssContent = fs.readFileSync(faCssDest, 'utf8');
  fs.writeFileSync(faCssDest, faCssContent.replaceAll('font-display:block', 'font-display:swap'), 'utf8');
  const webfontsSource = path.join(faPackageDir, 'webfonts');
  for (const file of fs.readdirSync(webfontsSource)) {
    if (file.endsWith('.woff2')) {
      fs.copyFileSync(path.join(webfontsSource, file), path.join(faWebfontsDir, file));
    }
  }
}

function writePlatformArtifacts(platformResult, outputDir, assetUrlPrefix) {
  const platformDir = outputDir;
  const sharedDir = path.join(platformDir, '_shared');
  fs.mkdirSync(sharedDir, { recursive: true });

  const sharedCss = path.join(sharedDir, 'wireframe.css');
  const sharedJs = path.join(sharedDir, 'interactions.js');
  fs.writeFileSync(sharedCss, buildWireframeStyles(), 'utf8');
  fs.writeFileSync(sharedJs, buildInteractionRuntimeFromWindowContext(), 'utf8');
  copyFontAwesomeAssets(sharedDir);

  const indexHtml = buildPlatformIndexHtml(platformResult.platform, platformResult.pages, {
    basePath: platformResult.basePath,
  });
  fs.writeFileSync(path.join(platformDir, 'index.html'), indexHtml, 'utf8');

  for (const page of platformResult.pages) {
    const html = renderWireframeMarkup({
      roots: page.roots,
      pageViewport: page.viewport,
      pageRouteId: page.routeId,
      routeTable: page.routeTable,
      appStateDefaults: page.appStateDefaults,
      pageStateDefaults: page.pageStateDefaults,
      pageStyle: page.wireframeStyle,
      skin: page.skin,
      rendering: page.rendering || {},
      defaultGridColumns: page.defaultGridColumns,
      bodyLayoutType: page.bodyLayoutType || 'row',
      bodyLayout: page.bodyLayout,
      projectPath: platformResult.projectPath,
      dataSources: page.dataSources,
      wireframeCssHref: './_shared/wireframe.css',
      fontAwesomeCssHref: './_shared/fa/css/all.min.css',
      runtimeJsSrc: './_shared/interactions.js',
      runtimeContext: {
        routeId: page.routeId,
        routeTable: page.routeTable,
        appStateDefaults: page.appStateDefaults,
        pageStateDefaults: page.pageStateDefaults,
        platform: platformResult.platform,
      },
      assetUrlPrefix,
    });
    fs.writeFileSync(path.join(platformDir, page.fileName), html, 'utf8');
  }
}

function copyAssets(projectPath, outputDir) {
  const sourceAssets = path.join(projectPath, 'assets');
  const targetAssets = path.join(outputDir, 'assets');

  if (!fs.existsSync(sourceAssets)) return;

  fs.cpSync(sourceAssets, targetAssets, {
    recursive: true,
    force: true,
  });
}

function runBuild({
  projectPath = process.cwd(),
  output = null,
  platform = 'all',
  clean = null,
  basePath = null,
} = {}) {
  const normalizedProjectPath = path.resolve(projectPath);
  const config = loadWfrcConfig(normalizedProjectPath);
  if (config.parseError) {
    return {
      ok: false,
      error: config.parseError,
    };
  }

  const resolvedPlatform = normalizePlatform(platform);
  if (!resolvedPlatform) {
    return {
      ok: false,
      error: `Unsupported platform "${platform}".`,
    };
  }

  const selectedOutput = normalizeOutput(output) || config.build.outputDir;
  const selectedBasePath = normalizeBasePath(normalizeOutput(basePath) || config.build.basePath);
  const shouldClean = parseBoolean(clean, config.build.clean);
  const shouldFailOnWarnings = Boolean(config.strictValidation) || Boolean(config.failOnWarnings);

  const validationResult = runValidate({
    projectPath: normalizedProjectPath,
    strict: shouldFailOnWarnings,
  });
  if (!validationResult.ok) {
    return {
      ok: false,
      error: 'Project validation failed. Run wf validate before building.',
      details: validationResult,
    };
  }

  const targetsResult = resolvePageTargets(normalizedProjectPath, null);
  if (!targetsResult.ok) return targetsResult;

  const outputDir = path.resolve(normalizedProjectPath, selectedOutput);
  if (shouldClean && fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }

  fs.mkdirSync(outputDir, { recursive: true });
  copyAssets(normalizedProjectPath, outputDir);

  const requestedPlatforms = resolvedPlatform === 'all'
    ? ['web', 'mobile', 'tablet']
    : [resolvedPlatform];
  const targets = targetsResult.targets;
  const runtimeRouteTable = buildRouteTableFromTargets(targets, {
    basePath: selectedBasePath,
    platforms: new Set(requestedPlatforms),
  });

  const platformResults = [];
  const writtenPages = [];

  for (const platformName of requestedPlatforms) {
    const platformTargets = targets.filter((target) => target.viewport?.device === platformName);
    if (platformTargets.length === 0) {
      continue;
    }

    const platformDir = path.join(outputDir, platformName);
    fs.mkdirSync(platformDir, { recursive: true });

    const pages = [];
    for (const target of platformTargets) {
      const fileName = buildPageFileName(target.pageId, platformName);
      pages.push({
        pageId: target.pageId,
        route: target.route || '/',
        routeId: target.pageRouteId,
        fileName,
        routeTable: runtimeRouteTable,
        roots: target.roots,
        viewport: target.viewport,
        appStateDefaults: target.appStateDefaults,
        pageStateDefaults: target.pageStateDefaults,
        dataSources: target.dataSources,
        wireframeStyle: target.wireframeStyle,
        skin: target.skin,
        rendering: target.rendering || {},
        defaultGridColumns: target.defaultGridColumns,
        bodyLayoutType: target.bodyLayoutType || 'row',
        bodyLayout: target.bodyLayout,
        projectPath: normalizedProjectPath,
      });
    }

    const assetUrlPrefix = normalizeAssetPrefix(selectedBasePath);
    writePlatformArtifacts({
      platform: platformName,
      basePath: selectedBasePath,
      pages,
      projectPath: normalizedProjectPath,
    }, platformDir, assetUrlPrefix);
    platformResults.push({
      platform: platformName,
      count: pages.length,
      // The two index pages sit at known depths relative to each other, so
      // they link to each other directly and ignore basePath entirely.
      href: `./${platformName}/index.html`,
      indexPath: path.join(platformDir, 'index.html'),
      pages,
      outputDir: platformDir,
    });

    for (const page of pages) {
      writtenPages.push(path.join(platformName, page.fileName));
    }
  }

  const masterIndex = buildMasterIndexHtml(platformResults, {
    basePath: selectedBasePath,
  });
  fs.writeFileSync(path.join(outputDir, 'index.html'), masterIndex, 'utf8');

  return {
    ok: true,
    outputDir,
    output: outputDir,
    projectPath: normalizedProjectPath,
    platform: resolvedPlatform,
    basePath: selectedBasePath,
    pages: writtenPages,
    platforms: platformResults,
    warnings: validationResult.warnings || [],
  };
}

module.exports = {
  runBuild,
  copyFontAwesomeAssets,
  buildPageFileName,
  buildMasterIndexHtml,
  buildPlatformIndexHtml,
  DEFAULT_OUTPUT_DIR,
};
