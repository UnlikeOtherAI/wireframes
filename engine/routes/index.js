'use strict';

function normalizeBasePath(raw) {
  if (typeof raw !== 'string') {
    return '/';
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return '/';
  }

  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const withoutTrailing = withLeading.endsWith('/') && withLeading !== '/'
    ? withLeading.replace(/\/+$/, '')
    : withLeading;

  return withoutTrailing || '/';
}

function joinBasePath(basePath, ...parts) {
  const normalizedBase = normalizeBasePath(basePath);
  const normalizedParts = parts
    .map((part) => {
      if (typeof part !== 'string') return '';
      return part.trim().replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean);

  return [normalizedBase, ...normalizedParts].filter(Boolean).join('/').replace(/\/{2,}/g, '/');
}

function buildPageFileName(pageId, platform) {
  const safePageId = String(pageId || '').trim();
  const safePlatform = String(platform || '').trim() || 'web';
  return safePlatform === 'web' ? `${safePageId}.html` : `${safePageId}_${safePlatform}.html`;
}

function buildRouteHref(pageId, platform, basePath = '/') {
  return joinBasePath(basePath, platform, buildPageFileName(pageId, platform));
}

function buildRouteTableFromTargets(targets, options = {}) {
  const basePath = typeof options.basePath === 'string' ? options.basePath : '/';
  const platformFilter = options.platforms instanceof Set
    ? options.platforms
    : Array.isArray(options.platforms)
      ? new Set(options.platforms)
      : null;

  const entries = Array.isArray(targets) ? [...targets] : [];
  entries.sort((left, right) => {
    const leftRoute = String(left?.pageRouteId || left?.pageId || '');
    const rightRoute = String(right?.pageRouteId || right?.pageId || '');
    return leftRoute.localeCompare(rightRoute);
  });

  const routeTable = {};
  for (const target of entries) {
    const platform = String(target?.viewport?.device || 'web').trim() || 'web';
    if (platformFilter && !platformFilter.has(platform)) {
      continue;
    }

    const routeId = String(target?.pageRouteId || target?.pageId || '').trim();
    const pageId = String(target?.pageId || '').trim();
    if (!routeId || !pageId) {
      continue;
    }

    routeTable[routeId] = buildRouteHref(pageId, platform, basePath);
  }

  return routeTable;
}

module.exports = {
  normalizeBasePath,
  joinBasePath,
  buildPageFileName,
  buildRouteHref,
  buildRouteTableFromTargets,
};
