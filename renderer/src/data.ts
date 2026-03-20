import type { DocumentMap } from './document-map.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export interface DataSourceEntry {
  items: Record<string, unknown>[];
  primaryKey: string | null;
}

export function resolveDataSources(
  documentMap: DocumentMap,
  page: Record<string, unknown>,
): Record<string, DataSourceEntry> {
  const sourceMap: Record<string, DataSourceEntry> = {};
  const dataSources = Array.isArray(page.dataSources) ? page.dataSources : [];

  for (const entry of dataSources) {
    if (
      !isObject(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.dataset !== 'string'
    ) {
      continue;
    }

    const sourceId = (entry.id as string).trim();
    const datasetId = (entry.dataset as string).trim();
    if (!sourceId || !datasetId) continue;

    const datasetDoc = documentMap.datasets.get(datasetId);
    if (!isObject(datasetDoc)) continue;

    const dataset = isObject(datasetDoc.dataset) ? datasetDoc.dataset : datasetDoc;
    const items = Array.isArray(dataset.items)
      ? (dataset.items as Record<string, unknown>[])
      : [];

    sourceMap[sourceId] = {
      items,
      primaryKey:
        typeof dataset.primaryKey === 'string'
          ? (dataset.primaryKey as string)
          : null,
    };
  }

  return sourceMap;
}
