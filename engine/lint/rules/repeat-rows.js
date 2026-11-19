'use strict';

// Lint on `repeat`. On the authored YAML: `items: []` and an `{{item.` token in
// an item are info, and each row gets the rules on how it is framed. On the
// rendered page: element prop contracts run on each row that renders, with the
// values it renders with (after a definition's `{{props}}`), and a finding under
// the row's `props.<key>` is moved to the item's `<key>`, where it is written. A
// component cell's items keep the component-input policy: they are props of an
// instance, not element props.

const { appendPath } = require('../../schema/validator');
const { PRIMITIVE_COMPONENTS } = require('../../schema/primitives');
const { resolvePrimitiveName } = require('../../schema/primitive-registry');
const { isElementCell, repeatOf, repeatRows } = require('../../component-registry/repeat');
const { placeOf } = require('../../doctor/row-places');
const { validateElementContract } = require('./element-contract');

const SEVERITIES = ['errors', 'warnings', 'info'];

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function add(result, severity, code, message, at) {
  if (!Array.isArray(result[severity])) result[severity] = [];
  result[severity].push(at && result.locations ? { code, message, at } : { code, message });
}

function under(at, segments, key = false) {
  if (!at) return undefined;
  const path = segments.reduce((current, segment) => appendPath(current, segment), at.path);
  return key ? { document: at.document, path, key: true } : { document: at.document, path };
}

/** Each string in an item that holds an `{{item.` token, with the path segments to it. */
function itemTokens(value, segments = []) {
  if (typeof value === 'string') return value.includes('{{item.') ? [segments] : [];
  if (Array.isArray(value)) return value.flatMap((entry, index) => itemTokens(entry, [...segments, index]));
  if (isObject(value)) return Object.entries(value).flatMap(([key, entry]) => itemTokens(entry, [...segments, key]));
  return [];
}

/** A row finding's place, moved from the row's props and component to the item and the cell. */
function moved(at, itemPath, cellPath) {
  if (!at || typeof at.path !== 'string') return at;
  const props = `${itemPath}.props`;
  if (at.path === props || at.path.startsWith(`${props}.`) || at.path.startsWith(`${props}[`)) {
    return { ...at, path: `${itemPath}${at.path.slice(props.length)}` };
  }
  if (at.path === `${itemPath}.component`) return { ...at, path: cellPath };
  return at;
}

/**
 * @param {Function} lintRow  `(result, row, context, at)`: the authored rules for one row
 */
function lintRepeat(result, node, context, at, lintRow) {
  const repeat = repeatOf(node);
  if (!repeat) return;
  if (repeat.items.length === 0) {
    add(result, 'info', 'EMPTY_REPEAT', `${context}: repeat has no items, so it renders no rows. Add items, or remove the repeat.`, under(at, ['repeat', 'items'], true));
  }
  repeat.items.forEach((item, index) => {
    for (const segments of itemTokens(item)) {
      add(result, 'info', 'REPEAT_ITEM_TOKEN', `${context}: item "${item?.id}" holds an {{item.}} token. Repeat items are plain props, so it renders as written; put the value in the item itself.`,
        under(at, ['repeat', 'items', index, ...segments]));
    }
  });
  if (!isElementCell(repeat.cell)) return;

  const cellPath = at ? appendPath(appendPath(at.path, 'repeat'), 'cell') : null;
  for (const row of repeatRows(node)) {
    const rowAt = under(at, ['repeat', 'items', row.__repeat.index]);
    const scratch = { errors: [], warnings: [], info: [], locations: result.locations };
    lintRow(scratch, row, `${context} > ${row.id}`, rowAt);
    for (const severity of SEVERITIES) {
      for (const finding of scratch[severity]) add(result, severity, finding.code, finding.message, rowAt ? moved(finding.at, rowAt.path, cellPath) : finding.at);
    }
  }
}

/** Who writes a stamped row, as a finding names it: `page "home"`, `component "card"`. */
function authorOf(row) {
  const address = row.__source.slice(0, row.__source.indexOf('#'));
  const colon = address.indexOf(':');
  return `${address.slice(0, colon)} "${address.slice(colon + 1)}"`;
}

function visitRendered(nodes, visit) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!isObject(node)) continue;
    visit(node);
    for (const key of ['children', 'nodes', 'content']) visitRendered(node[key], visit);
  }
}

/**
 * The element contract on every element row the pages render. A row of a
 * definition renders once per instance; a finding is reported once per place
 * and message.
 * @param {{ roots: object[], sources?: object }[]} pages  stamped rendered pages (`collectRenderedRoots`)
 */
function lintRenderedRows(result, pages) {
  const seen = new Set();
  for (const { roots, sources } of Array.isArray(pages) ? pages : []) {
    visitRendered(roots, (row) => {
      if (!isObject(row.__repeat) || !isElementCell(row.__repeat.cell)) return;
      const at = placeOf(row, sources);
      const component = resolvePrimitiveName(row.component) || row.component;
      if (!at || !PRIMITIVE_COMPONENTS.has(component)) return;
      const scratch = { errors: [], warnings: [], info: [], locations: true };
      validateElementContract(scratch, component, row, `${authorOf(row)} > ${row.__repeat.host}__${row.__repeat.item}`, at);
      const cellPath = `${at.path.replace(/\.items\[\d+\]$/, '')}.cell`;
      for (const severity of SEVERITIES) {
        for (const finding of scratch[severity]) {
          const place = { ...moved(finding.at, at.path, cellPath), ...(at.file ? { file: at.file } : {}) };
          const key = JSON.stringify([severity, finding.code, finding.message, place.document, place.file ?? null, place.path, place.key === true]);
          if (seen.has(key)) continue;
          seen.add(key);
          add(result, severity, finding.code, finding.message, place);
        }
      }
    });
  }
}

module.exports = { lintRenderedRows, lintRepeat };
