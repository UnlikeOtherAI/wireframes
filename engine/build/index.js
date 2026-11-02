'use strict';

const { resolveTemplatePage } = require('../resolver');
const {
  renderWireframeMarkup,
} = require('../screenshots/renderer');
const { buildWireframeStyles } = require('../renderer/styles');
const {
  buildInteractionRuntimeFromWindowContext,
} = require('../renderer/interactions');
const {
  normalizeBasePath,
  joinBasePath,
  buildPageFileName,
  buildRouteTableFromTargets,
} = require('../routes');

const VALID_PLATFORM_FILTERS = new Set(['all', 'web', 'mobile', 'tablet']);
const DEFAULT_BASE_PATH = '/';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeAttr(value) {
  return String(value ?? '').replaceAll('"', '&quot;');
}

function normalizePlatform(value) {
  if (typeof value !== 'string') return 'all';
  const normalized = value.trim().toLowerCase();
  return VALID_PLATFORM_FILTERS.has(normalized) ? normalized : null;
}

function normalizeAssetPrefix(basePath) {
  const joined = joinBasePath(basePath, 'assets');
  return joined.endsWith('/') ? joined : `${joined}/`;
}

function resolveViewport(viewport = {}) {
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

  if (!viewport || typeof viewport !== 'object') {
    return { ok: false, error: 'Page viewport is missing.' };
  }

  if (viewport.device === 'web') {
    return { ok: true, width: VIEWPORT_PRESETS.web.width, height: VIEWPORT_PRESETS.web.height, device: 'web' };
  }

  const preset = VIEWPORT_PRESETS[viewport.device]?.[viewport.orientation];
  if (!preset) {
    return { ok: false, error: viewport.device ? `Unsupported device "${viewport.device}".` : 'Page viewport missing device.' };
  }

  return { ok: true, width: preset.width, height: preset.height, device: viewport.device, orientation: viewport.orientation };
}

function resolvePageRendering(page) {
  const rendering = isObject(page?.rendering) ? { ...page.rendering } : {};
  if (!rendering.mode && (page?.renderMode === 'line' || page?.renderMode === 'card')) {
    rendering.mode = page.renderMode;
  }
  return rendering;
}

function resolvePageTree(documentMap, pageId) {
  const pageDoc = documentMap.pages instanceof Map
    ? documentMap.pages.get(pageId)
    : documentMap.pages?.[pageId];

  if (!isObject(pageDoc)) {
    return { ok: false, error: `Page "${pageId}" not found in document map.` };
  }

  const page = isObject(pageDoc.page) ? pageDoc.page : null;
  if (!page) {
    return { ok: false, error: `Page "${pageId}" has no page payload.` };
  }

  const templateId = page.template;
  if (typeof templateId !== 'string' || templateId.trim() === '') {
    return { ok: false, error: `Page "${pageId}" does not define a template.` };
  }

  const templates = isObject(documentMap.templates?.templates)
    ? documentMap.templates.templates
    : isObject(documentMap.templates)
      ? documentMap.templates
      : {};
  const template = templates[templateId];
  if (!isObject(template)) {
    return { ok: false, error: `Page "${pageId}" references missing template "${templateId}".` };
  }

  const components = isObject(documentMap.components?.components)
    ? documentMap.components.components
    : isObject(documentMap.components)
      ? documentMap.components
      : {};

  const resolved = resolveTemplatePage({ template, page, components });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const templateLayout = isObject(template.layout) ? template.layout : {};
  const bodyLayoutType = templateLayout.type === 'row' ? 'row' : 'stack';

  return {
    ok: true,
    roots: Array.isArray(resolved.roots) ? resolved.roots : [],
    bodyLayoutType,
    bodyLayout: templateLayout,
    page,
    templateId,
  };
}

function resolveDocumentMapRoutes(documentMap) {
  const sitemap = isObject(documentMap.sitemap?.sitemap)
    ? documentMap.sitemap.sitemap
    : isObject(documentMap.sitemap)
      ? documentMap.sitemap
      : {};
  const routes = Array.isArray(sitemap.routes) ? sitemap.routes : [];
  const routeByPage = new Map();
  const routeIdByPage = new Map();
  const routeIdToPage = new Map();

  for (const route of routes) {
    const page = typeof route?.page === 'string' && route.page.trim() !== '' ? route.page.trim() : null;
    const routeId = typeof route?.id === 'string' && route.id.trim() !== '' ? route.id.trim() : null;
    const routePath = typeof route?.path === 'string' && route.path.trim() !== '' ? route.path.trim() : '/';
    if (page) {
      routeByPage.set(page, { id: routeId || routeIdByPage.get(page) || page, path: routePath });
      if (routeId) {
        routeIdByPage.set(page, routeId);
      }
    }
    if (routeId && page) {
      routeIdToPage.set(routeId, page);
    }
  }

  return { routeByPage, routeIdByPage, routeIdToPage };
}

function resolveDataSources(documentMap, page) {
  const sourceMap = {};
  const dataSources = Array.isArray(page?.dataSources) ? page.dataSources : [];

  for (const entry of dataSources) {
    if (!isObject(entry) || typeof entry.id !== 'string' || typeof entry.dataset !== 'string') {
      continue;
    }
    const sourceId = entry.id.trim();
    const datasetId = entry.dataset.trim();
    if (!sourceId || !datasetId) {
      continue;
    }

    const datasetDoc = documentMap.datasets instanceof Map
      ? documentMap.datasets.get(datasetId)
      : documentMap.datasets?.[datasetId];
    if (!isObject(datasetDoc)) {
      continue;
    }
    const dataset = isObject(datasetDoc.dataset) ? datasetDoc.dataset : datasetDoc;
    const items = Array.isArray(dataset.items) ? dataset.items : [];
    sourceMap[sourceId] = {
      items,
      primaryKey: typeof dataset.primaryKey === 'string' ? dataset.primaryKey : null,
    };
  }

  return sourceMap;
}

function buildPlatformIndexHtml(platform, pages, options = {}) {
  const rows = pages
    .map((entry) => `<li><a href="${escapeAttr(entry.fileName)}">${escapeHtml(entry.pageId)}</a> — ${escapeHtml(entry.route || '/')} </li>`)
    .join('\n');
  const title = `Wireframe ${platform}`;
  const masterIndex = joinBasePath(options.basePath, 'index.html');

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

function renderPage(documentMap, pageId, options = {}) {
  const treeResult = resolvePageTree(documentMap, pageId);
  if (!treeResult.ok) {
    return { ok: false, error: treeResult.error };
  }

  const page = treeResult.page;
  const viewportResult = resolveViewport(page.viewport);
  if (!viewportResult.ok) {
    return { ok: false, error: viewportResult.error };
  }

  const routeMap = resolveDocumentMapRoutes(documentMap);
  const routeInfo = routeMap.routeByPage.get(pageId) || {};

  const manifest = isObject(documentMap.manifest?.manifest)
    ? documentMap.manifest.manifest
    : isObject(documentMap.manifest)
      ? documentMap.manifest
      : {};
  const defaultWireframeStyle = manifest.defaultWireframeStyle || {};
  const parsedDefaultGridColumns = Number(manifest.defaultGridColumns);
  const defaultGridColumns = Number.isInteger(parsedDefaultGridColumns) && parsedDefaultGridColumns > 0
    ? parsedDefaultGridColumns
    : 12;

  const sitemap = isObject(documentMap.sitemap?.sitemap)
    ? documentMap.sitemap.sitemap
    : isObject(documentMap.sitemap)
      ? documentMap.sitemap
      : {};
  const appStateDefaults = isObject(sitemap.appState) ? sitemap.appState : {};
  const dataSources = resolveDataSources(documentMap, page);

  const html = renderWireframeMarkup({
    roots: treeResult.roots,
    pageViewport: {
      width: viewportResult.width,
      height: viewportResult.height,
      device: viewportResult.device,
      orientation: viewportResult.orientation,
    },
    pageRouteId: routeInfo.id || pageId,
    routeTable: options.routeTable || {},
    appStateDefaults,
    pageStateDefaults: isObject(page.pageState) ? page.pageState : {},
    pageStyle: page.wireframeStyle || defaultWireframeStyle,
    rendering: resolvePageRendering(page),
    defaultGridColumns,
    bodyLayoutType: treeResult.bodyLayoutType,
    bodyLayout: treeResult.bodyLayout,
    dataSources,
    assetUrlPrefix: options.assetUrlPrefix || '',
    imageResolver: options.imageResolver || null,
  });

  return { ok: true, html, pageId };
}

function buildProject(documentMap, options = {}) {
  const basePath = normalizeBasePath(options.basePath || DEFAULT_BASE_PATH);
  const platform = normalizePlatform(options.platform || 'all');
  if (!platform) {
    return { ok: false, error: `Unsupported platform "${options.platform}".` };
  }

  const requestedPlatforms = platform === 'all'
    ? ['web', 'mobile', 'tablet']
    : [platform];

  const manifest = isObject(documentMap.manifest?.manifest)
    ? documentMap.manifest.manifest
    : isObject(documentMap.manifest)
      ? documentMap.manifest
      : {};
  const defaultWireframeStyle = manifest.defaultWireframeStyle || {};
  const parsedDefaultGridColumns = Number(manifest.defaultGridColumns);
  const defaultGridColumns = Number.isInteger(parsedDefaultGridColumns) && parsedDefaultGridColumns > 0
    ? parsedDefaultGridColumns
    : 12;

  const sitemap = isObject(documentMap.sitemap?.sitemap)
    ? documentMap.sitemap.sitemap
    : isObject(documentMap.sitemap)
      ? documentMap.sitemap
      : {};
  const appStateDefaults = isObject(sitemap.appState) ? sitemap.appState : {};
  const routeMap = resolveDocumentMapRoutes(documentMap);

  const pageIds = documentMap.pages instanceof Map
    ? [...documentMap.pages.keys()]
    : Object.keys(documentMap.pages || {});

  const targets = [];
  for (const pageId of pageIds) {
    const treeResult = resolvePageTree(documentMap, pageId);
    if (!treeResult.ok) {
      return { ok: false, error: treeResult.error };
    }

    const page = treeResult.page;
    const viewportResult = resolveViewport(page.viewport);
    if (!viewportResult.ok) {
      return { ok: false, error: viewportResult.error };
    }

    const routeInfo = routeMap.routeByPage.get(pageId) || {};
    const dataSources = resolveDataSources(documentMap, page);

    targets.push({
      pageId,
      route: routeInfo.path || '/',
      pageRouteId: routeInfo.id || routeMap.routeIdByPage.get(pageId) || pageId,
      dataSources,
      appStateDefaults,
      pageStateDefaults: isObject(page.pageState) ? page.pageState : {},
      viewport: {
        width: viewportResult.width,
        height: viewportResult.height,
        device: viewportResult.device,
        orientation: viewportResult.orientation,
      },
      wireframeStyle: page.wireframeStyle || defaultWireframeStyle,
      rendering: resolvePageRendering(page),
      defaultGridColumns,
      bodyLayoutType: treeResult.bodyLayoutType,
      bodyLayout: treeResult.bodyLayout,
      roots: treeResult.roots,
    });
  }

  const runtimeRouteTable = buildRouteTableFromTargets(targets, {
    basePath,
    platforms: new Set(requestedPlatforms),
  });

  const assetUrlPrefix = normalizeAssetPrefix(basePath);
  const builtPages = [];
  const platformIndexes = {};
  const platformEntries = [];

  for (const platformName of requestedPlatforms) {
    const platformTargets = targets.filter((t) => t.viewport?.device === platformName);
    if (platformTargets.length === 0) continue;

    const platformPages = [];
    for (const target of platformTargets) {
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
        bodyLayoutType: target.bodyLayoutType || 'row',
        bodyLayout: target.bodyLayout,
        dataSources: target.dataSources,
        wireframeCssHref: './_shared/wireframe.css',
        fontAwesomeCssHref: './_shared/fa/css/all.min.css',
        runtimeJsSrc: './_shared/interactions.js',
        runtimeContext: {
          routeId: target.pageRouteId,
          routeTable: runtimeRouteTable,
          appStateDefaults: target.appStateDefaults,
          pageStateDefaults: target.pageStateDefaults,
          platform: platformName,
        },
        assetUrlPrefix,
        imageResolver: options.imageResolver || null,
      });

      builtPages.push({ pageId: target.pageId, platform: platformName, html, fileName });
      platformPages.push({ pageId: target.pageId, route: target.route, fileName });
    }

    const platformIndexHtml = buildPlatformIndexHtml(platformName, platformPages, { basePath });
    platformIndexes[platformName] = platformIndexHtml;
    platformEntries.push({
      platform: platformName,
      count: platformPages.length,
      href: joinBasePath(basePath, platformName, 'index.html'),
    });
  }

  const css = buildWireframeStyles();
  const js = buildInteractionRuntimeFromWindowContext();
  const indexHtml = buildMasterIndexHtml(platformEntries, { basePath });

  return {
    ok: true,
    pages: builtPages,
    css,
    js,
    routeTable: runtimeRouteTable,
    indexHtml,
    platformIndexes,
    basePath,
    platform,
  };
}

module.exports = {
  buildProject,
  renderPage,
  buildMasterIndexHtml,
  buildPlatformIndexHtml,
  buildPageFileName,
  resolvePageTree,
  DEFAULT_BASE_PATH,
};
