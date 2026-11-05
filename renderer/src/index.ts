import { buildDocumentMap, type DocumentMap } from './document-map.js';
import { extractAppStateDefaults, extractPageStateDefaults } from './state.js';
import { resolveDataSources } from './data.js';

// Engine imports — esbuild resolves these from the engine package (CJS → ESM)
// @ts-expect-error CJS module without type declarations
import * as engineBuildModule from '../../engine/build/index.js';

const {
  buildProject,
  renderPage: engineRenderPage,
} = engineBuildModule as {
  buildProject: (
    documentMap: DocumentMap,
    options: { platform: string; basePath: string },
  ) => {
    ok: boolean
    error?: string
    pages: Array<{ pageId: string; html: string }>
    css: string
    js: string
    routeTable: Record<string, string>
  }
  renderPage: (
    documentMap: DocumentMap,
    pageId: string,
    options: { routeTable: Record<string, string>; assetUrlPrefix: string },
  ) => { ok: boolean; error?: string; html?: string }
};

export { parseYaml } from './parser.js';
// @ts-expect-error Shared CJS engine module has no TypeScript declarations.
export { assertComponentExpansion } from '../../engine/component-registry/expansion.js';

export type { DocumentMap } from './document-map.js';
export type { InteractionRuntimeOptions } from './interactions.js';
export type { DataSourceEntry } from './data.js';
export { buildRuntimeJs, buildRuntimeJsFromWindowContext } from './interactions.js';
export { extractAppStateDefaults, extractPageStateDefaults } from './state.js';
export { resolveDataSources } from './data.js';
export { parseWf, serializeWf } from './wf.js';
export type { WfProject } from './wf.js';
export { createWireframe } from './mount.js';
export type { MountOptions, WireframeInstance, Mode, Platform } from './mount.js';

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
    js: result.js as string,
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

  return result.html as string;
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
