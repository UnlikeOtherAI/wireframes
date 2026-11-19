'use strict';

// What every navigation renderer shares: which items are on, whether an item
// links, and how a shortcut is drawn (docs/cli/rendering-navigation.md).

/** An element with its own interaction: its items never link, so anchors never nest. */
function hasInteraction(node) {
  return Array.isArray(node?.interaction) && node.interaction.length > 0;
}

function routeTarget(route, ctx, lib) {
  const routeId = lib.str(route);
  if (!routeId || !lib.isObject(ctx.routeTable)) return null;
  const href = ctx.routeTable[routeId];
  return typeof href === 'string' && href.trim() !== '' ? { href: href.trim(), routeId } : null;
}

/**
 * An item as a link when its route is known, else as plain text. A disabled
 * item never navigates, and neither does an item of an `inert` element. The
 * state attributes go on whichever element renders.
 */
function itemLink(item, className, inner, ctx, lib, { inert = false, state = {}, owner } = {}) {
  const target = inert || item.disabled === true ? null : routeTarget(item.route, ctx, lib);
  const attrs = lib.stateAttrs(state, { owner });
  return target
    ? `<a class="${className}" ${lib.navigationAttrs(target).join(' ')}${attrs}>${inner}</a>`
    : `<span class="${className}"${attrs}>${inner}</span>`;
}

/**
 * Which items are on, for elements with one "on" state (tabs, nav, crumbs,
 * steps). An item's own `selected` decides first, or its `current` when
 * `selected` is absent. The element's `legacy` rule applies only when no item
 * decided, and never to an item marked off.
 */
function itemsOn(items, lib, legacy = null) {
  const marked = items.map((item) => (
    typeof item.selected !== 'boolean' && typeof item.current === 'boolean'
      ? { ...item, selected: item.current }
      : item
  ));
  const { selected, source } = lib.resolveSelection(marked);
  if (source || typeof legacy !== 'function') return selected;
  return marked.map((item, index) => item.type === 'item' && item.selected !== false && legacy(item, index) === true);
}

/** Every item in a tree, depth first. */
function flattenItems(items, out = []) {
  for (const item of items) {
    out.push(item);
    if (Array.isArray(item.items)) flattenItems(item.items, out);
  }
  return out;
}

/** A `type: group` becomes its heading followed by its items. */
function expandGroups(items) {
  return items.flatMap((item) => (
    item.type === 'group'
      ? [{ type: 'heading', label: item.label }, ...expandGroups(Array.isArray(item.items) ? item.items : [])]
      : [item]
  ));
}

/** Item identity for `open`: `value`, else `label`, as a trimmed string. */
function identity(raw) {
  return typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
}

/** The index of the item `open` names, else of the first `expanded: true`; only items with children open. */
function openIndex(items, open) {
  const nested = (item) => Array.isArray(item.items) && item.items.length > 0;
  const wanted = identity(open);
  const named = wanted
    ? items.findIndex((item) => nested(item) && (identity(item.value) || identity(item.label)) === wanted)
    : -1;
  return named >= 0 ? named : items.findIndex((item) => nested(item) && item.expanded === true);
}

const MODIFIER = /^[⌘⇧⌥⌃]/u;

/**
 * The keys of a shortcut. An array is one key per entry. A string splits on
 * spaces and on `+` between keys, and leading modifier glyphs (⌘⇧⌥⌃) become
 * keys of their own: `⌘⇧P` is ⌘, ⇧, P and `Ctrl+K` is Ctrl, K.
 */
function shortcutKeys(shortcut) {
  const text = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '');
  if (Array.isArray(shortcut)) return shortcut.map(text).filter(Boolean);
  const keys = [];
  for (let part of text(shortcut).split(/\s+|(?<=\S)\+(?=\S)/u).filter(Boolean)) {
    while (part.length > 1 && MODIFIER.test(part)) {
      keys.push(part[0]);
      part = part.slice(1);
    }
    keys.push(part);
  }
  return keys;
}

/** A shortcut as key chips, or `''`. */
function keyChips(shortcut, lib) {
  const keys = shortcutKeys(shortcut);
  return keys.length > 0
    ? `<span class="wf-keys">${keys.map((key) => `<kbd class="wf-kbd">${lib.escapeHtml(key)}</kbd>`).join('')}</span>`
    : '';
}

module.exports = {
  hasInteraction,
  itemLink,
  itemsOn,
  flattenItems,
  expandGroups,
  openIndex,
  shortcutKeys,
  keyChips,
};
