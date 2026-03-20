import { parseYaml } from './parser.js';

export interface DocumentMap {
  manifest: Record<string, unknown> | null;
  sitemap: Record<string, unknown> | null;
  templates: Record<string, unknown> | null;
  components: Record<string, unknown> | null;
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

  const entries = Object.entries(yamlFiles);
  entries.sort(([a], [b]) => a.localeCompare(b));

  for (const [fileName, content] of entries) {
    const parsed = parseYaml(content, fileName);
    if (!isObject(parsed)) {
      continue;
    }

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
        documentMap.components = parsed;
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

  return documentMap;
}
