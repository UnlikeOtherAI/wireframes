'use strict';

// Turns "where a rule says a finding is" into a range of the text it came from.

const { parsePath, locate, findAllById, skipBlank } = require('./positions');

/** Where each line starts. A line ends at LF, CRLF or a lone CR, as YAML reads it. */
function lineStartsOf(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n' || (text[index] === '\r' && text[index + 1] !== '\n')) starts.push(index + 1);
  }
  return starts;
}

/** The end of the line `offset` is on, before its line break. */
function lineEnd(text, offset) {
  let end = offset;
  while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end += 1;
  return end;
}

/**
 * @param {{ name: string, text: string }[]} sources
 * @param {object[]} documents  what `readDocuments` read, each with its chunk `start`, `root` and `label`
 */
function createLocator(sources, documents) {
  const lineStarts = sources.map((source) => lineStartsOf(source.text));

  function position(sourceIndex, offset) {
    const starts = lineStarts[sourceIndex];
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (starts[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return { line: low, column: offset - starts[low], offset };
  }

  /** A block of YAML is underlined on its first line only. */
  function firstLine(entry, node) {
    const text = sources[entry.source].text;
    const start = entry.start + node.start;
    return { start, end: Math.min(entry.start + node.end, lineEnd(text, start)) };
  }

  function documentStart(entry) {
    const text = sources[entry.source].text;
    // A chunk starts at its `---` line, which is not the document.
    const marker = /^(?:---|\.\.\.)/.test(text.slice(entry.start, entry.start + 3)) ? 3 : 0;
    const start = Math.min(skipBlank(text, entry.start + marker), entry.end);
    return { source: entry.source, start, end: lineEnd(text, start), document: entry.label, path: null };
  }

  function atPath(entry, path, keyWanted) {
    if (!entry.root) return documentStart(entry);
    const hit = locate(entry.root, parsePath(path));
    let span;
    if (hit.complete && !((keyWanted || hit.node.kind === 'null') && hit.key)) span = firstLine(entry, hit.node);
    else if (hit.key) span = { start: entry.start + hit.key.start, end: entry.start + hit.key.end };
    else span = firstLine(entry, hit.node);
    return { source: entry.source, ...span, document: entry.label, path, complete: hit.complete };
  }

  /**
   * The node a semantic rule named by id. Those rules walk a page with its template
   * and shared components folded in, so the id may be written in another document. It
   * is only looked for there when one node has it: a guess could underline the wrong file.
   * `within` is the path of the definition being walked, when the rule knows it; the
   * id is looked for under it first, since every components document has one label.
   */
  function atNode(candidates, id, last, within) {
    const idRange = (entry, hit) => ({
      source: entry.source, start: entry.start + hit.id.start, end: entry.start + hit.id.end, document: entry.label, path: null,
    });
    if (typeof within === 'string') {
      for (const entry of candidates) {
        const scope = entry.root ? locate(entry.root, parsePath(within)) : null;
        const hits = scope?.complete ? findAllById(scope.node, id) : [];
        if (hits.length > 0) return idRange(entry, last ? hits[hits.length - 1] : hits[0]);
      }
    }
    for (const entry of candidates) {
      const hits = entry.root ? findAllById(entry.root, id) : [];
      if (hits.length > 0) return idRange(entry, last ? hits[hits.length - 1] : hits[0]);
    }
    const elsewhere = documents
      .filter((entry) => entry.root && entry.value !== null && !candidates.includes(entry)
        && (entry.type === 'templates' || entry.type === 'components'))
      .flatMap((entry) => findAllById(entry.root, id).map((hit) => ({ entry, hit })));
    if (elsewhere.length === 1) return idRange(elsewhere[0].entry, elsewhere[0].hit);
    return candidates.length > 0 ? documentStart(candidates[0]) : null;
  }

  /** @returns {object | null} null for a finding that belongs to no source */
  function resolve(where) {
    if (Number.isInteger(where.source) && Number.isInteger(where.start)) {
      return { source: where.source, start: where.start, end: where.end, document: null, path: null };
    }
    if (where.entry) {
      return where.path ? atPath(where.entry, where.path, where.key === true) : documentStart(where.entry);
    }
    const at = where.at;
    if (!at || typeof at.document !== 'string') return null;
    const candidates = documents.filter((entry) => entry.label === at.document && entry.value !== null);
    if (typeof at.node === 'string') return atNode(candidates, at.node, where.last === true, at.within);
    if (candidates.length === 0) return null;
    if (typeof at.path !== 'string') return documentStart(candidates[0]);
    const places = candidates.map((entry) => atPath(entry, at.path, at.key === true));
    return places.find((place) => place.complete) || places[0];
  }

  function range(place) {
    const text = sources[place.source].text;
    let { start, end } = place;
    // An empty range cannot be underlined, so it takes the character beside it.
    if (end <= start) {
      if (start < lineEnd(text, start)) end = start + 1;
      else if (start > 0 && text[start - 1] !== '\n' && text[start - 1] !== '\r') { end = start; start -= 1; }
      else end = start;
    }
    return { start: position(place.source, start), end: position(place.source, end) };
  }

  return { resolve, range };
}

module.exports = { createLocator };
