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
const { isSlotPlaceholder } = require('../component-registry/slot-placeholders');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const NONE = new Set();

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
 * - `hostId` is the id the host is written with (see `repeatRows`);
 * - `written` is the node as its author wrote it, whose stamps the rows take;
 * - `reserved` is what rows already made beside it will expand to, so hosts
 *   that share a definition share the budget.
 * Returns what the rows will expand to as `need`.
 */
function expandHostRows(host, definitions, budget, { hostId = host?.id, written = host, reserved = 0 } = {}) {
  if (!isObject(host) || !Object.hasOwn(host, 'repeat')) return { ok: true, need: 0 };
  const rows = repeatRows(host, hostId, written);
  let need = 0;
  if (rows.length > 0) {
    need = repeatNodeCount(host, definitions, budget);
    if (budget.used + reserved + need > budget.max) {
      return {
        ok: false,
        reason: 'repeat-budget',
        error: `Repeat on "${hostId}" would expand to ${need} more nodes; a page may expand to at most ${budget.max}. Fewer items, or fewer repeats inside the cell, bring it back under.`,
        host: { ...origin(written), id: hostId },
      };
    }
    host.children = [...(Array.isArray(host.children) ? host.children : []), ...rows];
  }
  delete host.repeat;
  return { ok: true, need };
}

/**
 * Expands every host a prepared definition tree contains, the root included.
 * - `root` is the definition's root as written: the prepared root carries its
 *   instance's id and stamps, its rows the definition's;
 * - `replaced` names the slots the caller fills, whose fallbacks never render.
 */
function materializeDefinitionRows(tree, definitions, budget, { root = tree, replaced = NONE } = {}) {
  let reserved = 0;
  const visit = (node, options) => {
    if (isSlotPlaceholder(node) && replaced.has(node.slot)) return { ok: true };
    const expanded = expandHostRows(node, definitions, budget, { ...options, reserved });
    if (!expanded.ok) return expanded;
    reserved += expanded.need;
    for (const list of childNodeLists(node)) {
      for (const child of list) {
        const below = visit(child, {});
        if (!below.ok) return below;
      }
    }
    return { ok: true };
  };
  return visit(tree, { hostId: root?.id, written: root });
}

module.exports = { expandHostRows, materializeDefinitionRows, origin };
