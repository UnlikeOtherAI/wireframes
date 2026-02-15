'use strict';

const {
  isObject,
  normalizeId,
  readYaml,
  sitemapFilePath,
} = require('./helpers');

function listRoutes(projectPath) {
  const loaded = readYaml(sitemapFilePath(projectPath));
  if (!loaded) {
    return { ok: false, error: 'Invalid or missing sitemap.yaml document.' };
  }

  const topLevelRoutes = Array.isArray(loaded.routes) ? loaded.routes : [];
  const nestedRoutes = isObject(loaded.sitemap) && Array.isArray(loaded.sitemap.routes)
    ? loaded.sitemap.routes
    : [];
  const routes = [...topLevelRoutes, ...nestedRoutes];

  if (!Array.isArray(routes)) {
    return { ok: false, error: 'sitemap routes must be an array.' };
  }

  const normalized = [];
  const seen = new Set();
  for (const entry of routes) {
    const id = normalizeId(entry?.id) || '<unknown>';
    const key = `${id}:${normalizeId(entry?.path) || '<unknown>'}:${normalizeId(entry?.page) || '<unknown>'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      id,
      path: normalizeId(entry?.path) || '<unknown>',
      page: normalizeId(entry?.page) || '<unknown>',
      template: normalizeId(entry?.template) || '<unknown>',
    });
  }

  return {
    ok: true,
    routes: normalized,
  };
}

module.exports = { listRoutes };
