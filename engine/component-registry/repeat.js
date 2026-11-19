'use strict';

/**
 * `repeat: { cell, items }` (docs/cli/schema-systems.md §14.1): one cell, and
 * one row per keyed item, rendered after the host's authored children.
 *
 * A row is the node an author would have written by hand:
 * `{ id: <host>__<item>, component: <cell>, props }` for an element cell, or
 * the same with `use: <cell>` for a component cell. `__repeat` records which
 * host, item and cell it came from, and a stamped host passes its source on, so
 * a rendered row points at `…repeat.items[i]`.
 */

const { resolvePrimitiveName } = require('../schema/primitive-registry');
const { rendersAuthoredChildren } = require('../renderer/child-hosts');
const { isSlotPlaceholder } = require('./slot-placeholders');

const REPEAT_SEPARATOR = '__';

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function cloneDeep(value) {
  if (Array.isArray(value)) return value.map(cloneDeep);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneDeep(entry)]));
}

/** The node's repeat when it has the shape expansion needs, else null. */
function repeatOf(node) {
  if (!isObject(node) || !isObject(node.repeat)) return null;
  const { cell, items } = node.repeat;
  if (typeof cell !== 'string' || cell.trim() === '' || !Array.isArray(items)) return null;
  return { cell: cell.trim(), items };
}

/** A registry element name or alias is an element cell; anything else names a component. */
function isElementCell(cell) {
  return resolvePrimitiveName(cell) != null;
}

/** The component a node's repeat renders per item, or null for an element cell or no repeat. */
function repeatCellReference(node) {
  const repeat = repeatOf(node);
  return repeat && !isElementCell(repeat.cell) ? repeat.cell : null;
}

function repeatRowId(hostId, itemId) {
  return `${hostId}${REPEAT_SEPARATOR}${itemId}`;
}

/**
 * Why a node with `repeat` cannot host rows, or null when it can: a concrete
 * `component:` node whose element renders its authored children.
 */
function repeatHostProblem(node) {
  if (isSlotPlaceholder(node)) return 'a slot placeholder is replaced by its fill';
  if (node.use != null) return 'a use: instance renders its component; repeat on a node inside the component, or in a fill';
  if (node.injectable === true) return 'an injectable marker is replaced by the injected content';
  if (!rendersAuthoredChildren(node)) return `"${node.component}" does not lay out authored children`;
  return null;
}

/**
 * The items that become rows: keyed maps whose id is a string. An id repeated
 * in the same repeat keys no second row; DUPLICATE_REPEAT_ITEM_ID reports it.
 */
function keyedItems(items) {
  const seen = new Set();
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => {
      if (!isObject(item) || typeof item.id !== 'string' || item.id.trim() === '' || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

/** The node one item renders as, without its provenance. */
function repeatRowNode(hostId, cell, item) {
  const { id: itemId, ...props } = item;
  const row = { id: repeatRowId(hostId, itemId) };
  row[isElementCell(cell) ? 'component' : 'use'] = cell;
  if (Object.keys(props).length > 0) row.props = cloneDeep(props);
  return row;
}

/**
 * The rows a host renders, in item order. Empty unless the host can host rows.
 * A definition root has taken its instance's id and stamps by the time its rows
 * are made, but its rows are named and stamped as written: `hostId` is the id
 * the host is written with, and `written` the node whose stamps they take.
 */
function repeatRows(host, hostId = host?.id, written = host) {
  const repeat = repeatOf(host);
  if (!repeat || typeof hostId !== 'string' || repeatHostProblem(host) != null) return [];
  return keyedItems(repeat.items).map(({ item, index }) => {
    const row = repeatRowNode(hostId, repeat.cell, item);
    row.__repeat = { host: hostId, item: item.id, index, cell: repeat.cell };
    if (typeof written?.__source === 'string') row.__source = `${written.__source.split('#')[0]}#${row.id}`;
    if (typeof written?.__sourcePath === 'string') row.__sourcePath = `${written.__sourcePath}.repeat.items[${index}]`;
    return row;
  });
}

module.exports = {
  REPEAT_SEPARATOR,
  isElementCell,
  keyedItems,
  repeatCellReference,
  repeatHostProblem,
  repeatOf,
  repeatRowId,
  repeatRowNode,
  repeatRows,
};
