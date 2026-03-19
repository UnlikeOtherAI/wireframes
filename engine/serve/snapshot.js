'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { runValidate } = require(path.resolve(__dirname, '..', 'validate'));
const { resolvePageTargets } = require(path.resolve(__dirname, '..', 'screenshots'));
const { buildPageFileName, buildMasterIndexHtml, buildPlatformIndexHtml } = require(path.resolve(__dirname, '..', 'build'));
const { renderWireframeMarkup } = require(path.resolve(__dirname, '..', 'screenshots', 'renderer'));
const { buildRouteTableFromTargets } = require(path.resolve(__dirname, '..', 'routes'));

const DEFAULT_PORT = 8080;
const DEFAULT_SERVE = {
  port: DEFAULT_PORT,
  open: false,
  hotReload: true,
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInt(value, fallback) {
  const numeric = Number.parseInt(value, 10);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : fallback;
}

function loadWfrcConfig(projectPath) {
  const wfrcPath = path.join(projectPath, '.wfrc.yaml');
  if (!fs.existsSync(wfrcPath)) {
    return {
      strictValidation: true,
      failOnWarnings: false,
      serve: DEFAULT_SERVE,
      parseError: null,
    };
  }

  try {
    const parsed = yaml.load(fs.readFileSync(wfrcPath, 'utf8')) || {};
    if (!isObject(parsed)) {
      return {
        strictValidation: true,
        failOnWarnings: false,
        serve: DEFAULT_SERVE,
        parseError: 'Invalid .wfrc.yaml payload: expected object.',
      };
    }

    const cliConfig = isObject(parsed.cli) ? parsed.cli : {};
    const serveConfig = isObject(cliConfig.serve) ? cliConfig.serve : {};

    return {
      strictValidation: parseBoolean(cliConfig.strictValidation, true),
      failOnWarnings: parseBoolean(cliConfig.failOnWarnings, false),
      serve: {
        port: normalizePositiveInt(serveConfig.port, DEFAULT_PORT),
        open: parseBoolean(serveConfig.open, DEFAULT_SERVE.open),
        hotReload: parseBoolean(serveConfig.hotReload, DEFAULT_SERVE.hotReload),
      },
      parseError: null,
    };
  } catch (error) {
    return {
      strictValidation: true,
      failOnWarnings: false,
      serve: DEFAULT_SERVE,
      parseError: `Invalid .wfrc.yaml: ${error.message}`,
    };
  }
}

function resolveTargets(projectPath, platform, strictValidation, failOnWarnings) {
  const shouldFail = Boolean(strictValidation) || Boolean(failOnWarnings);
  const validationResult = runValidate({ projectPath, strict: shouldFail });
  if (!validationResult.ok) {
    return {
      ok: false,
      error: 'Project validation failed. Run wf validate before serving.',
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
    };
  }

  const targetsResult = resolvePageTargets(projectPath, null);
  if (!targetsResult.ok) return targetsResult;

  const requested = platform === 'all' ? ['web', 'mobile', 'tablet'] : [platform];
  const targetList = targetsResult.targets || [];
  const runtimeRouteTable = buildRouteTableFromTargets(targetList, {
    basePath: '/',
    platforms: new Set(requested),
  });
  const platformTargets = [];

  for (const platformName of requested) {
    const pagesForPlatform = targetList.filter((target) => target.viewport?.device === platformName);

    const pages = pagesForPlatform.map((target) => {
      const fileName = buildPageFileName(target.pageId, platformName);
      const html = renderWireframeMarkup({
        roots: target.roots,
        pageViewport: target.viewport,
        pageRouteId: target.pageRouteId,
        routeTable: runtimeRouteTable,
        appStateDefaults: target.appStateDefaults,
        pageStateDefaults: target.pageStateDefaults,
        pageStyle: target.wireframeStyle,
        rendering: target.rendering || {},
        defaultGridColumns: target.defaultGridColumns,
        projectPath,
        dataSources: target.dataSources,
        wireframeCssHref: './_shared/wireframe.css',
        runtimeJsSrc: './_shared/interactions.js',
        runtimeContext: {
          routeId: target.pageRouteId,
          routeTable: runtimeRouteTable,
          appStateDefaults: target.appStateDefaults,
          pageStateDefaults: target.pageStateDefaults,
          platform: platformName,
        },
        assetUrlPrefix: '/assets/',
      });

      return {
        route: target.route || '/',
        routeId: target.pageRouteId,
        pageId: target.pageId,
        fileName,
        html,
      };
    });

    platformTargets.push({
      platform: platformName,
      count: pages.length,
      href: `/${platformName}/index.html`,
      pages,
      indexHtml: buildPlatformIndexHtml(platformName, pages, {
        basePath: '/',
      }),
    });
  }

  return {
    ok: true,
    masterIndexHtml: buildMasterIndexHtml(platformTargets, { basePath: '/' }),
    platformTargets,
    warnings: validationResult.warnings || [],
  };
}

module.exports = {
  DEFAULT_PORT,
  loadWfrcConfig,
  resolveTargets,
};
