import { buildDocumentMap, type DocumentMap } from './document-map.js';

// Engine imports — esbuild resolves these from the engine package (CJS → ESM)
// @ts-expect-error CJS module without type declarations
import { buildProject, renderPage as engineRenderPage } from '../../engine/build/index.js';

export interface RenderedProject {
  pages: Map<string, string>;
  css: string;
  js: string;
  routeTable: Record<string, string>;
}

export interface ParsedProject {
  documentMap: DocumentMap;
  pageIds: string[];
  routeIds: string[];
}

export interface RenderOptions {
  platform?: string;
  basePath?: string;
  mode?: 'line' | 'card';
}

function applyModeOverride(documentMap: DocumentMap, mode: 'line' | 'card'): void {
  for (const [, pageDoc] of documentMap.pages) {
    const page = pageDoc.page as Record<string, unknown> | undefined;
    if (page) {
      if (!page.rendering || typeof page.rendering !== 'object') {
        page.rendering = { mode };
      } else {
        (page.rendering as Record<string, unknown>).mode = mode;
      }
    }
  }
}

export function renderProject(
  yamlFiles: Record<string, string>,
  options?: RenderOptions,
): RenderedProject {
  const documentMap = buildDocumentMap(yamlFiles);

  if (options?.mode) {
    applyModeOverride(documentMap, options.mode);
  }

  const result = buildProject(documentMap, {
    platform: options?.platform ?? 'all',
    basePath: options?.basePath ?? '/',
  });

  if (!result.ok) {
    throw new Error(result.error || 'Build failed');
  }

  const pages = new Map<string, string>();
  for (const entry of result.pages) {
    pages.set(entry.pageId, entry.html);
  }

  return {
    pages,
    css: result.css,
    js: result.js,
    routeTable: result.routeTable,
  };
}

export function renderPage(
  yamlFiles: Record<string, string>,
  pageId: string,
  options?: RenderOptions,
): string {
  const documentMap = buildDocumentMap(yamlFiles);

  if (options?.mode) {
    applyModeOverride(documentMap, options.mode);
  }

  const projectResult = buildProject(documentMap, {
    platform: options?.platform ?? 'all',
    basePath: options?.basePath ?? '/',
  });

  const routeTable = projectResult.ok ? projectResult.routeTable : {};

  const result = engineRenderPage(documentMap, pageId, {
    routeTable,
    assetUrlPrefix: options?.basePath ?? '/',
  });

  if (!result.ok) {
    throw new Error(result.error || `Failed to render page "${pageId}"`);
  }

  return result.html;
}

export function parseProject(
  yamlFiles: Record<string, string>,
): ParsedProject {
  const documentMap = buildDocumentMap(yamlFiles);
  const pageIds = [...documentMap.pages.keys()];

  const routeIds: string[] = [];
  const sitemap = documentMap.sitemap as Record<string, unknown> | null;
  const sitemapData = sitemap?.sitemap as Record<string, unknown> | undefined;
  const routes = Array.isArray(sitemapData?.routes)
    ? (sitemapData.routes as Array<Record<string, unknown>>)
    : Array.isArray((sitemap as Record<string, unknown> | null)?.routes)
      ? ((sitemap as Record<string, unknown>).routes as Array<Record<string, unknown>>)
      : [];

  for (const route of routes) {
    if (route && typeof route.id === 'string' && route.id.trim() !== '') {
      routeIds.push(route.id.trim());
    }
  }

  return {
    documentMap,
    pageIds,
    routeIds,
  };
}
