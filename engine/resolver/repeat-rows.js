'use strict';

/**
 * Materializing `repeat` rows (design `docs/plans/2026-11-19-repeat-cells.md`
 * §4.2). A host's author expands its rows where hand-written siblings would be
 * processed:
 * - caller content (a page, a template, a fill) as the caller prepares it,
 *   before any callee is pushed, through `expandHostRows`;
 * - a definition's own hosts after its `{{props}}` substitution and before its
 *   namespace pass and placeholder splicing, through `materializeDefinitionRows`.
 * A repeat's whole fan-out, nested components and rows included, is checked
 * against the page budget before its first row is allocated.
 */

const { childNodeLists } = require('../component-registry/child-nodes');
const { repeatNodeCount } = require('../component-registry/expansion');
const { repeatRows } = require('../component-registry/repeat');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/** Where a failure came from: enough of the node for validation to find it in its source. */
function origin(node) {
  const place = { id: node.id };
  for (const key of ['__source', '__sourcePath', '__repeat']) {
    if (node[key] !== undefined) place[key] = node[key];
  }
  return place;
}

/**
 * Replaces the host's `repeat` with its rows, after its authored children.
 * `hostId` is the id the host is written with (see `repeatRows`).
 */
function expandHostRows(host, definitions, budget, hostId = host?.id) {
  if (!isObject(host) || !Object.hasOwn(host, 'repeat')) return { ok: true };
  const rows = repeatRows(host, hostId);
  if (rows.length > 0) {
    const need = repeatNodeCount(host, definitions, budget);
    if (budget.used + need > budget.max) {
      return {
        ok: false,
        reason: 'repeat-budget',
        error: `Repeat on "${hostId}" would expand to ${need} more nodes; a page may expand to at most ${budget.max}.`,
        host: { ...origin(host), id: hostId },
      };
    }
    host.children = [...(Array.isArray(host.children) ? host.children : []), ...rows];
  }
  delete host.repeat;
  return { ok: true };
}

/**
 * Expands every host a prepared definition tree contains, the root included.
 * `rootId` is the definition root's own id; the root carries its instance's.
 */
function materializeDefinitionRows(root, definitions, budget, rootId = root?.id) {
  const expanded = expandHostRows(root, definitions, budget, rootId);
  if (!expanded.ok) return expanded;
  for (const list of childNodeLists(root)) {
    for (const node of list) {
      const below = materializeDefinitionRows(node, definitions, budget);
      if (!below.ok) return below;
    }
  }
  return { ok: true };
}

module.exports = { expandHostRows, materializeDefinitionRows, origin };
