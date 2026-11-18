'use strict';

// Adds one component definition to the text of a components document, leaving
// every byte the author wrote in place: comments, quoting, flow or block style
// and line endings. The new definition is the only text that changes.

const yaml = require('js-yaml');
const { parseDocument } = require('../lint/source/positions');

const DEFAULT_STEP = 2;
const BOM = String.fromCharCode(0xfeff);

function columnOf(text, offset) {
  return offset - (text.lastIndexOf('\n', offset - 1) + 1);
}

/** The offset where the line after the one holding `offset` starts, or the end of the text. */
function nextLineStart(text, offset) {
  const newline = text.indexOf('\n', offset);
  return newline === -1 ? text.length : newline + 1;
}

const isFlow = (text, node) => text[node.start] === '{';

/** `key: value` in block style, every line indented by `indent`. */
function blockEntry(key, value, indent, step, eol) {
  const lines = yaml.dump({ [key]: value }, { indent: step }).trimEnd().split('\n');
  return lines.map((line) => (line ? `${' '.repeat(indent)}${line}` : line)).join(eol) + eol;
}

/** `key: value` in flow style. JSON is valid YAML flow, so it fits a flow or JSON document. */
const flowEntry = (key, value) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`;

/** Block text inserted on the line after `offset`, starting a line of its own. */
function blockAfterLine(text, offset, block, eol) {
  const at = nextLineStart(text, offset);
  const lead = at === text.length && at > 0 && !text.endsWith('\n') ? eol : '';
  return { start: at, end: at, text: `${lead}${block}` };
}

/** Whether an empty flow mapping holds comments: they are all that can be between its braces. */
const hasInnerComments = (text, mapping) => text.slice(mapping.start + 1, mapping.end - 1).trim() !== '';

/**
 * The only entry of an empty flow mapping. Its comments stay where they are: a
 * comment runs to the end of its line, so `}` is on a later line, and the entry
 * goes on a line of its own just before it.
 */
function fillEmptyFlow(text, mapping, key, value, eol) {
  if (!hasInnerComments(text, mapping)) return { start: mapping.start + 1, end: mapping.start + 1, text: ` ${flowEntry(key, value)} ` };
  const close = mapping.end - 1;
  const at = text.lastIndexOf('\n', close - 1) + 1;
  return { start: at, end: at, text: `${' '.repeat(columnOf(text, close) + DEFAULT_STEP)}${flowEntry(key, value)}${eol}` };
}

/** Adds `key: value` as the last entry of a block mapping, or of a flow mapping (`{}` included). */
function appendToMapping(text, mapping, key, value, eol) {
  const entries = [...mapping.entries.values()];
  if (isFlow(text, mapping)) {
    if (entries.length === 0) return [fillEmptyFlow(text, mapping, key, value, eol)];
    const last = entries[entries.length - 1];
    const end = last.value && last.value.end > last.key.end ? last.value.end : last.key.end;
    return [{ start: end, end, text: `, ${flowEntry(key, value)}` }];
  }
  const first = entries[0].key.start;
  return [blockAfterLine(text, mapping.end, blockEntry(key, value, columnOf(text, first), DEFAULT_STEP, eol), eol)];
}

/** `components: {}` in a block document becomes a block mapping of one entry; a comment after `}` stays. */
function fillEmptyBlock(text, entry, key, value, eol) {
  const indent = columnOf(text, entry.key.start) + DEFAULT_STEP;
  return [
    blockAfterLine(text, entry.value.end, blockEntry(key, value, indent, DEFAULT_STEP, eol), eol),
    { start: entry.value.start, end: entry.value.end, text: '' },
  ];
}

function editsFor(text, root, id, definition, eol) {
  const entry = root.entries.get('components');
  if (!entry?.value || entry.value.kind !== 'mapping') return null;
  // Only braces with nothing between them can be rewritten as a block without losing text.
  if (entry.value.entries.size === 0 && !isFlow(text, root) && !hasInnerComments(text, entry.value)) {
    return fillEmptyBlock(text, entry, id, definition, eol);
  }
  return appendToMapping(text, entry.value, id, definition, eol);
}

/**
 * The text of a valid components document with `components.<id>: definition`
 * added as its last component, or null when its text has no `components`
 * mapping to add to. The caller checks that the result parses as expected.
 */
function insertComponentDefinition(source, id, definition) {
  const bom = source.startsWith(BOM) ? BOM : '';
  const text = source.slice(bom.length);
  const parsed = parseDocument(text);
  if (!parsed.ok || !parsed.root || parsed.root.kind !== 'mapping') return null;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const edits = editsFor(text, parsed.root, id, definition, eol);
  if (!edits) return null;
  let next = text;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
  }
  return `${bom}${next}`;
}

module.exports = { insertComponentDefinition };
