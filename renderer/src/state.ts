import type { DocumentMap } from './document-map.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function extractAppStateDefaults(
  documentMap: DocumentMap,
): Record<string, unknown> {
  const sitemap = documentMap.sitemap;
  if (!isObject(sitemap)) return {};

  const sitemapData = isObject(sitemap.sitemap) ? sitemap.sitemap : sitemap;
  return isObject(sitemapData.appState)
    ? (sitemapData.appState as Record<string, unknown>)
    : {};
}

export function extractPageStateDefaults(
  documentMap: DocumentMap,
  pageId: string,
): Record<string, unknown> {
  const pageDoc = documentMap.pages.get(pageId);
  if (!isObject(pageDoc)) return {};

  const page = isObject(pageDoc.page) ? pageDoc.page : null;
  if (!page) return {};

  return isObject(page.pageState)
    ? (page.pageState as Record<string, unknown>)
    : {};
}
