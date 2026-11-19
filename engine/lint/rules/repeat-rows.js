'use strict';

// Lint on `repeat`. Element prop contracts run on each row as the node an author
// would have written by hand, and a finding under the row's `props.<key>` is
// moved to the item's `<key>`, where it is written. A component cell's items
// keep the component-input policy: they are props of an instance, not element
// props. `items: []` and an `{{item.` token in an item are info.

const { appendPath } = require('../../schema/validator');
const { isElementCell, repeatOf, repeatRows } = require('../../component-registry/repeat');

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
 * @param {Function} lintRow  `(result, row, context, at)`: the element rules for one node
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

module.exports = { lintRepeat };
