'use strict';

// Text in, documents out: splitting a source into its YAML documents and parsing
// each one alone, so one that is broken does not hide the others.

const { fileNameFor } = require('../../wf-format');
const { parseDocument } = require('./positions');

// A document larger than this is refused rather than walked by every rule.
const MAX_VALUES = 200000;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** True for text that holds no document: blank lines, comments and `%` directives. */
function isPreamble(text) {
  return text.split(/\r\n|\r|\n/).every((line) => /^\s*(?:#.*)?$/.test(line) || line.startsWith('%'));
}

/**
 * The YAML documents of one text. A `---` line starts a document and a `...` line
 * ends one. Each chunk is the source's own text from `start` to `end`, except that a
 * `...` marker is blanked, so an offset in a chunk plus `start` is an offset in the
 * source. Directives stay with the document they precede.
 *
 * This reads the streams `wf pack` writes, and folder files. It is not a general YAML
 * stream reader: a `---` line inside a root block scalar also starts a document here.
 * @returns {{ start: number, end: number, text: string }[]}
 */
function splitSource(text) {
  const source = typeof text === 'string' ? text : '';
  const chunks = [];
  let start = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let afterEnd = false;
  /** Adds the chunk from `start` to `end` if it holds a document. */
  const close = (end) => {
    const body = afterEnd ? `   ${source.slice(start + 3, end)}` : source.slice(start, end);
    if (isPreamble(body.replace(/^---(?=[ \t\r\n]|$)/, '   '))) return false;
    chunks.push({ start, end, text: body });
    return true;
  };
  const marker = /^(---|\.\.\.)(?=[ \t\r\n]|$)/gm;
  let match;
  while ((match = marker.exec(source)) !== null) {
    if (match.index < start) continue;
    const closed = close(match.index);
    // Directives before `---` belong to the document it starts, so they stay in its chunk.
    const directives = !closed && !afterEnd && match[1] === '---' && /^%/m.test(source.slice(start, match.index));
    if (directives) continue;
    start = match.index;
    afterEnd = match[1] === '...';
  }
  close(source.length);
  return chunks;
}

/** Why a parsed value cannot be handed to rules that walk it, or null when it can. */
function unsafeShape(root) {
  const ancestors = new Set();
  let count = 0;
  const visit = (value) => {
    if (value === null || typeof value !== 'object') return null;
    if (ancestors.has(value)) return 'recursive';
    count += 1;
    if (count > MAX_VALUES) return 'large';
    ancestors.add(value);
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      const problem = visit(child);
      if (problem) return problem;
    }
    ancestors.delete(value);
    return null;
  };
  return visit(root);
}

/** What the document map calls a document, which is how a rule names it. */
function labelOf(type, value) {
  if (type === 'page' || type === 'dataset') return `${type}:${typeof value.id === 'string' ? value.id : ''}`;
  return type;
}

/**
 * @param {{ name: string, text: string }[]} sources
 * @param {(severity: string, code: string, message: string, where: object) => void} report
 * @returns {object[]} one entry per YAML document. `value` is null when it could not be read.
 */
function readDocuments(sources, report) {
  const documents = [];
  const seenFiles = new Map();
  sources.forEach((source, sourceIndex) => {
    const chunks = splitSource(source.text);
    chunks.forEach((chunk, index) => {
      const entry = {
        source: sourceIndex, index, start: chunk.start, end: chunk.end,
        value: null, root: null, type: null, id: null, label: null, file: null, path: null, valid: false,
      };
      documents.push(entry);
      const parsed = parseDocument(chunk.text);
      if (!parsed.ok) {
        const offset = chunk.start + parsed.error.offset;
        report('error', 'INVALID_YAML', parsed.error.message, { source: sourceIndex, start: offset, end: offset + 1 });
        return;
      }
      entry.root = parsed.root;
      if (!isObject(parsed.value)) {
        report('error', 'INVALID_DOCUMENT', 'A document is a mapping with documentType, specVersion and id.', { entry });
        return;
      }
      const problem = unsafeShape(parsed.value);
      if (problem) {
        report('error', problem === 'recursive' ? 'RECURSIVE_ALIAS' : 'DOCUMENT_TOO_LARGE', problem === 'recursive'
          ? 'An alias refers to a value that contains it, so this document cannot be checked.'
          : 'This document is too large to check.', { entry });
        return;
      }
      entry.value = parsed.value;
      entry.type = typeof parsed.value.documentType === 'string' ? parsed.value.documentType.trim() : null;
      entry.id = typeof parsed.value.id === 'string' ? parsed.value.id : null;
      entry.label = entry.type ? labelOf(entry.type, parsed.value) : null;
      entry.file = fileNameFor(parsed.value, seenFiles);
      // A file is known by the name it was given; a document of a stream by where it unpacks to.
      entry.path = chunks.length === 1 && source.name ? source.name : entry.file;
    });
  });
  return documents;
}

module.exports = {
  isObject,
  splitSource,
  readDocuments,
};
