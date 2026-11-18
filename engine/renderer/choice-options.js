'use strict';

// The options a choice control selects among, read with the profile and the
// traversal its renderer uses, so rendering and the AMBIGUOUS_VALUE lint
// agree on what is selected.

const { normalizeItems, itemProfiles } = require('./items');
const { isObject } = require('./render-utils');

/**
 * `select.options` as rows through the `select` profile: `{ item, scalar }`,
 * and for a `group` its own `rows`. `scalar` marks a top-level option written
 * as a plain value, which renders exactly as given.
 */
function selectOptionRows(options) {
  return (Array.isArray(options) ? options : []).map((entry) => {
    const [item] = normalizeItems([entry], itemProfiles.select);
    if (!item) return null;
    return { item, scalar: !isObject(entry), rows: item.type === 'group' ? selectOptionRows(item.items) : null };
  }).filter(Boolean);
}

/** The option rows of every group, in document order. */
function optionLeaves(rows, out = []) {
  for (const row of rows) {
    if (row.rows) optionLeaves(row.rows, out);
    else if (row.item.type === 'item') out.push(row);
  }
  return out;
}

/**
 * The items a choice control selects among: a select's options across all
 * its groups, otherwise the top-level `choice` items (segmented,
 * choice_group, picker).
 */
function choiceOptions(component, options) {
  if (component === 'select') return optionLeaves(selectOptionRows(options)).map((row) => row.item);
  return normalizeItems(options, itemProfiles.choice);
}

module.exports = { selectOptionRows, optionLeaves, choiceOptions };
