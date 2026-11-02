import yaml from 'js-yaml';

import { buildDocumentMap, type DocumentMap } from './document-map.js';

// @ts-expect-error CJS module without type declarations
import * as wfFormat from '../../engine/wf-format/index.js';

const { unpackDocuments, looksLikeWf, fileNameFor } = wfFormat as {
  unpackDocuments: (documents: unknown[]) => {
    ok: boolean
    error?: string
    manifest?: Record<string, unknown>
    documents?: Array<Record<string, unknown>>
    files?: Record<string, Record<string, unknown>>
  }
  looksLikeWf: (text: string) => boolean
  fileNameFor: (document: Record<string, unknown>, seen?: Map<string, number>) => string | null
};

export interface WfProject {
  documentMap: DocumentMap;
  pageIds: string[];
  routeIds: string[];
  name: string;
}

function decode(source: string | ArrayBuffer | Uint8Array): string {
  if (typeof source === 'string') return source;
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  return new TextDecoder('utf-8').decode(bytes);
}

function routeIdsOf(documentMap: DocumentMap): string[] {
  const sitemap = documentMap.sitemap as Record<string, unknown> | null;
  const data = (sitemap?.sitemap ?? sitemap) as Record<string, unknown> | undefined;
  const routes = Array.isArray(data?.routes) ? (data.routes as Array<Record<string, unknown>>) : [];
  return routes
    .map((route) => (typeof route?.id === 'string' ? route.id.trim() : ''))
    .filter((id) => id !== '');
}

/**
 * Parse a `.wf` file — or a plain map of YAML files — into a project the
 * renderer can draw. Everything happens in the browser; nothing is uploaded.
 */
export function parseWf(source: string | ArrayBuffer | Uint8Array | Record<string, string>): WfProject {
  let files: Record<string, string>;

  if (typeof source === 'object' && source !== null && !(source instanceof ArrayBuffer) && !(source instanceof Uint8Array)) {
    files = source as Record<string, string>;
  } else {
    const text = decode(source);
    if (!looksLikeWf(text)) {
      throw new Error('Not a .wf project: expected "format: wf/1" or a multi-document YAML stream.');
    }

    let documents: unknown[];
    try {
      documents = yaml.loadAll(text);
    } catch (error) {
      throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : String(error)}`);
    }

    const unpacked = unpackDocuments(documents);
    if (!unpacked.ok) throw new Error(unpacked.error || 'Could not read this .wf file.');

    // Back to the file map the engine already understands.
    files = {};
    const seen = new Map<string, number>();
    for (const document of unpacked.documents ?? []) {
      if (document.documentType === 'config') continue;
      const name = fileNameFor(document, seen);
      if (!name) continue;
      const { format: _dropped, ...rest } = document;
      files[name] = yaml.dump(rest, { lineWidth: 100, noRefs: true });
    }
  }

  const documentMap = buildDocumentMap(files);
  const manifest = (documentMap.manifest as Record<string, unknown> | null)?.manifest as Record<string, unknown> | undefined;

  return {
    documentMap,
    pageIds: [...documentMap.pages.keys()],
    routeIds: routeIdsOf(documentMap),
    name: typeof manifest?.name === 'string' ? manifest.name : 'Wireframe',
  };
}

/** Serialize a project back to `.wf` text, so a browser editor can save. */
export function serializeWf(files: Record<string, string>): string {
  const documents: Array<Record<string, unknown>> = [];
  for (const content of Object.values(files)) {
    const parsed = yaml.load(content);
    if (parsed && typeof parsed === 'object') documents.push(parsed as Record<string, unknown>);
  }
  const ordered = (wfFormat as { orderDocuments: (d: unknown[]) => Array<Record<string, unknown>> })
    .orderDocuments(documents)
    .map((document) => (document.documentType === 'manifest' ? { format: 'wf/1', ...document } : document));
  return ordered.map((document) => yaml.dump(document, { lineWidth: 100, noRefs: true })).join('---\n');
}
