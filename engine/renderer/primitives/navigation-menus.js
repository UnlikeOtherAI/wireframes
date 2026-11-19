'use strict';

const { hasInteraction, itemLink, itemsOn, flattenItems, expandGroups, openIndex, keyChips } = require('./navigation-items');

// Menus, the command palette and the menubar are display-only: plain lists
// with aria-current and aria-disabled, never menu or listbox roles, because
// no keyboard behaviour ships with them.

/**
 * Menu rows. `chips` is the newer drawing used by command and menubar panels:
 * shortcuts as key chips and a chevron on rows that open a submenu. `linked`
 * false keeps every row plain text.
 */
function menuRows(items, ctx, lib, { inert = false, chips = false, linked = true } = {}) {
  const rows = expandGroups(items);
  const { selected } = lib.resolveSelection(rows);
  return rows.map((entry, index) => {
    if (entry.type === 'separator') return '<span class="wf-menu-sep"></span>';
    if (entry.type === 'heading') return `<span class="wf-menu-heading">${lib.escapeHtml(lib.str(entry.label))}</span>`;
    const glyph = lib.iconSpan(entry.icon);
    const label = lib.str(entry.label);
    const shortcut = lib.str(entry.shortcut);
    const keys = chips
      ? keyChips(entry.shortcut, lib)
      : (shortcut ? `<span class="wf-menu-shortcut">${lib.escapeHtml(shortcut)}</span>` : '');
    const submenu = chips && Array.isArray(entry.items) && entry.items.length > 0
      ? `<span class="wf-menu-sub">${lib.icon('chevron-right')}</span>`
      : '';
    const body = `${glyph}<span class="wf-menu-label">${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</span>${keys}${submenu}`;
    const className = `wf-menu-item${entry.tone === 'danger' ? ' wf-menu-danger' : ''}`;
    const state = { disabled: entry.disabled === true, selected: selected[index], current: entry.current === true };
    return itemLink(entry, className, body, ctx, lib, { inert: inert || !linked, state, owner: lib.STATE_OWNERS.item });
  }).join('');
}

function renderMenu(node, ctx, lib) {
  const items = lib.normalizeItems(node.props?.items, lib.itemProfiles.menu);
  return { inner: menuRows(items, ctx, lib, { inert: hasInteraction(node) }) };
}

function commandRow(item, on, view) {
  const { ctx, lib, inert } = view;
  const label = lib.str(item.label);
  const description = lib.str(item.description);
  const text = `<span class="wf-command-text"><span class="wf-command-label">${
    label ? lib.escapeHtml(label) : lib.renderSkeleton(10)
  }</span>${description ? `<span class="wf-command-desc">${lib.escapeHtml(description)}</span>` : ''}</span>`;
  const body = `${lib.iconSpan(item.icon, { style: item.iconStyle })}${text}${keyChips(item.shortcut, lib)}`;
  const state = { disabled: item.disabled === true, selected: on.get(item) === true, current: item.current === true };
  return `<li>${itemLink(item, 'wf-command-item', body, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.item })}</li>`;
}

// Consecutive items share one list; a group is its heading and its own list.
function commandSections(items, on, view) {
  const { lib } = view;
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 0) out.push(`<ul class="wf-command-items">${run.join('')}</ul>`);
    run = [];
  };
  for (const item of items) {
    if (item.type === 'item') {
      run.push(commandRow(item, on, view));
      continue;
    }
    flush();
    if (item.type === 'separator') out.push('<div class="wf-command-sep"></div>');
    else if (item.type === 'heading') out.push(`<div class="wf-command-heading">${lib.escapeHtml(lib.str(item.label))}</div>`);
    else {
      const nested = Array.isArray(item.items) ? item.items : [];
      out.push(`<div class="wf-command-group"><div class="wf-command-heading">${
        lib.escapeHtml(lib.str(item.label))
      }</div>${commandSections(nested, on, view)}</div>`);
    }
  }
  flush();
  return out.join('');
}

const COMMAND_HINTS = [[['↑', '↓'], 'Navigate'], ['↵', 'Open'], ['esc', 'Close']];

function renderCommand(node, ctx, lib) {
  const props = node.props || {};
  const query = lib.str(props.query);
  const placeholder = lib.str(props.placeholder);
  const search = `<div class="wf-command-search">${lib.iconSpan('magnifying-glass')}${
    query
      ? `<span class="wf-command-query">${lib.bound(query, ctx)}</span>`
      : `<span class="wf-command-placeholder">${placeholder ? lib.bound(placeholder, ctx) : lib.renderSkeleton(14)}</span>`
  }</div>`;
  const items = lib.normalizeItems(props.items, lib.itemProfiles.canonical);
  const rows = flattenItems(items).filter((item) => item.type === 'item');
  const { selected } = lib.resolveSelection(rows);
  const on = new Map(rows.map((item, index) => [item, selected[index]]));
  const body = rows.length > 0
    ? `<div class="wf-command-list">${commandSections(items, on, { ctx, lib, inert: hasInteraction(node) })}</div>`
    : `<div class="wf-command-empty">${lib.escapeHtml(lib.str(props.empty) || 'No results found.')}</div>`;
  const footer = props.footer === true
    ? `<div class="wf-command-footer">${COMMAND_HINTS.map(([keys, text]) => (
      `<span class="wf-command-hint">${keyChips(keys, lib)}${text}</span>`
    )).join('')}</div>`
    : '';
  return { inner: `${search}${body}${footer}` };
}

// A title with a menu discloses it; a current one also says it is the page.
function triggerOwner(lib) {
  const link = lib.STATE_OWNERS.link;
  return { ...link, aria: { ...link.aria, expanded: 'aria-expanded' } };
}

function submenu(item) {
  return Array.isArray(item.items) ? item.items : [];
}

/**
 * Each title with a menu is a trigger button; the open one draws its panel
 * below it. A title without one is a page link in the bar when its route is
 * known (otherwise plain text, exactly as a nav row). Which titles are
 * current follows nav's rule: an item's own `selected` or `current` first,
 * otherwise an enabled leaf whose route is the page being rendered.
 */
function renderMenubar(node, ctx, lib) {
  const props = node.props || {};
  const menus = lib.normalizeItems(props.items, lib.itemProfiles.canonical)
    .filter((item) => item.type === 'item' || item.type === 'group');
  const opened = openIndex(menus, props.open);
  const inert = hasInteraction(node);
  const on = itemsOn(menus, lib, (item) => item.disabled !== true && submenu(item).length === 0
    && item.route != null && String(item.route) === ctx.currentRoute);
  const markup = menus.map((menu, index) => {
    const label = lib.str(menu.label);
    const nested = submenu(menu);
    const open = index === opened;
    const body = `${lib.iconSpan(menu.icon)}${label ? lib.escapeHtml(label) : lib.renderSkeleton(5)}`;
    if (nested.length === 0) {
      const state = { current: on[index] === true, disabled: menu.disabled === true };
      return `<div class="wf-menubar-menu">${itemLink(menu, 'wf-menubar-trigger', body, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.link })}</div>`;
    }
    const state = { current: on[index] === true, disabled: menu.disabled === true, expanded: open };
    const trigger = `<button type="button" class="wf-menubar-trigger"${lib.stateAttrs(state, { owner: triggerOwner(lib) })}>${body}</button>`;
    const panel = open
      ? `<div class="wf-menubar-panel wf-menu">${menuRows(nested, ctx, lib, { chips: true, linked: false })}</div>`
      : '';
    return `<div class="wf-menubar-menu">${trigger}${panel}</div>`;
  }).join('');
  return { inner: markup };
}

module.exports = {
  menuRenderers: {
    menu: renderMenu,
    command: renderCommand,
    menubar: renderMenubar,
  },
};
