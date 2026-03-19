import { buildDocumentMap } from './document-map.js';

// Engine imports — esbuild resolves these from the engine package (CJS → ESM)
// @ts-expect-error CJS module without type declarations
import { buildProject } from '../../engine/build/index.js';

export interface RenderedProject {
  pages: Array<{ pageId: string; platform: string; html: string; fileName: string }>;
  css: string;
  js: string;
  routeTable: Record<string, string>;
}

export interface RenderOptions {
  platform?: string;
  basePath?: string;
}

export function renderProject(
  yamlFiles: Record<string, string>,
  options?: RenderOptions,
): RenderedProject {
  const documentMap = buildDocumentMap(yamlFiles);
  const result = buildProject(documentMap, {
    platform: options?.platform ?? 'all',
    basePath: options?.basePath ?? '/',
  });

  if (!result.ok) {
    throw new Error(result.error || 'Build failed');
  }

  return {
    pages: result.pages,
    css: result.css,
    js: result.js,
    routeTable: result.routeTable,
  };
}
