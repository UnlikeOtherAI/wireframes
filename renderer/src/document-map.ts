import { parseYaml } from './parser.js';
import { resolveVirtualComponentImports } from './component-imports.js';

export interface DocumentMap {
  manifest: Record<string, unknown> | null;
  sitemap: Record<string, unknown> | null;
  templates: Record<string, unknown> | null;
  components: Record<string, unknown> | null;
  componentRegistriesByPage?: Map<string, Record<string, unknown>>;
  componentRegistriesByFile?: Map<string, Record<string, unknown>>;
  pages: Map<string, Record<string, unknown>>;
  datasets: Map<string, Record<string, unknown>>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export function buildDocumentMap(
  yamlFiles: Record<string, string>,
): DocumentMap {
  const documentMap: DocumentMap = {
    manifest: null,
    sitemap: null,
    templates: null,
    components: null,
    pages: new Map(),
    datasets: new Map(),
  };

  const documents = new Map<string, Record<string, unknown>>();
  const entries = Object.entries(yamlFiles);
  entries.sort(([a], [b]) => a.localeCompare(b));

  for (const [fileName, content] of entries) {
    const parsed = parseYaml(content, fileName);
    if (!isObject(parsed)) {
      continue;
    }

    documents.set(fileName, parsed);
    const documentType =
      typeof parsed.documentType === 'string'
        ? parsed.documentType.trim()
        : '';
    const id = typeof parsed.id === 'string' ? parsed.id.trim() : '';

    switch (documentType) {
      case 'manifest':
        documentMap.manifest = parsed;
        break;
      case 'sitemap':
        documentMap.sitemap = parsed;
        break;
      case 'templates':
        documentMap.templates = parsed;
        break;
      case 'components':
        // Component modules enter the registry only through explicit imports.
        break;
      case 'page':
        if (id) {
          documentMap.pages.set(id, parsed);
        }
        break;
      case 'dataset':
        if (id) {
          documentMap.datasets.set(id, parsed);
        }
        break;
    }
  }

  Object.assign(documentMap, resolveVirtualComponentImports(documents));
  return documentMap;
}
