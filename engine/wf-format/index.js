'use strict';

// The `.wf` container: one text file holding a whole wireframe project.
//
// It is a multi-document YAML stream — the same documents as the folder layout,
// separated by `---`, with `format: wf/1` on the manifest. That keeps it
// diffable, readable and parseable by the js-yaml the browser bundle already
// carries, with no zip reader and no binary blob.
//
// This module is pure: documents in, documents out. The CLI adds the disk.

const FORMAT = 'wf/1';
const DOCUMENT_ORDER = ['manifest', 'config', 'sitemap', 'templates', 'components', 'page', 'dataset', 'asset'];

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function orderOf(document) {
  const index = DOCUMENT_ORDER.indexOf(document?.documentType);
  return index === -1 ? DOCUMENT_ORDER.length : index;
}

/**
 * Order a set of documents into the canonical `.wf` sequence. Sorting is stable
 * within a type and keyed on the id, so packing the same project twice produces
 * byte-identical output.
 */
function orderDocuments(documents) {
  return [...documents].sort((a, b) => {
    const byType = orderOf(a) - orderOf(b);
    if (byType !== 0) return byType;
    return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
  });
}

/** Stamp the format marker onto the manifest so the parser can sniff it. */
function withFormatMarker(documents) {
  return documents.map((document) => (
    document?.documentType === 'manifest'
      ? { format: FORMAT, ...document }
      : document
  ));
}

/**
 * @param {object[]} documents
 * @param {(docs: object[]) => string} dump  a multi-document YAML serializer
 */
function packDocuments(documents, dump) {
  const ordered = withFormatMarker(orderDocuments(documents.filter(isObject)));
  if (ordered.length === 0) {
    return { ok: false, error: 'Nothing to pack: no documents.' };
  }
  if (!ordered.some((document) => document.documentType === 'manifest')) {
    return { ok: false, error: 'A .wf file needs a manifest document.' };
  }
  return { ok: true, documents: ordered, text: dump(ordered) };
}

/**
 * @param {object[]} documents  already parsed from the YAML stream
 */
function unpackDocuments(documents) {
  const list = Array.isArray(documents) ? documents.filter(isObject) : [];
  if (list.length === 0) {
    return { ok: false, error: 'No documents in this file.' };
  }

  const manifest = list.find((document) => document.documentType === 'manifest');
  if (!manifest) {
    return { ok: false, error: 'No manifest document: this is not a .wf project.' };
  }
  const format = typeof manifest.format === 'string' ? manifest.format : null;
  if (format && format !== FORMAT) {
    return { ok: false, error: `Unsupported .wf format "${format}". This engine reads ${FORMAT}.` };
  }

  const files = {};
  const seen = new Map();
  for (const document of list) {
    const name = fileNameFor(document, seen);
    if (!name) continue;
    const { format: _dropped, ...rest } = document;
    files[name] = rest;
  }

  return { ok: true, manifest, documents: list, files };
}

function slug(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  const safe = text.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_|_$/g, '');
  return safe || fallback;
}

/** Where a document lands when unpacked back into a folder. */
function fileNameFor(document, seen = new Map()) {
  const type = document?.documentType;
  const id = slug(document?.id, type);
  const count = (seen.get(`${type}:${id}`) || 0) + 1;
  seen.set(`${type}:${id}`, count);
  const suffix = count > 1 ? `_${count}` : '';

  if (type === 'manifest') return 'manifest.yaml';
  if (type === 'config') return '.wfrc.yaml';
  if (type === 'sitemap') return 'sitemap.yaml';
  if (type === 'templates') return 'templates.yaml';
  if (type === 'components') return count > 1 ? `components_${count}.yaml` : 'components.yaml';
  if (type === 'page') return `pages/${id}${suffix}.yaml`;
  if (type === 'dataset') return `data/${id}${suffix}.yaml`;
  if (type === 'asset') return `assets/${id}${suffix}.yaml`;
  return null;
}

/** True when a text blob looks like a `.wf` stream rather than a single document. */
function looksLikeWf(text) {
  if (typeof text !== 'string') return false;
  return /(^|\n)format:\s*wf\/1\b/.test(text) || /\n---\s*\n/.test(text);
}

module.exports = {
  FORMAT,
  DOCUMENT_ORDER,
  orderDocuments,
  packDocuments,
  unpackDocuments,
  fileNameFor,
  looksLikeWf,
};
