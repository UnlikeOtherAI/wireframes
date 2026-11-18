'use strict';

const { hasInteraction, itemLink, itemsOn, flattenItems, openIndex } = require('./navigation-items');

const VARIANTS = ['rail', 'sidebar', 'top'];

// A nav row is a page link; one with children it can open or close also says whether it is expanded.
function rowOwner(lib, expandable) {
  const link = lib.STATE_OWNERS.link;
  return expandable ? { ...link, aria: { ...link.aria, expanded: 'aria-expanded' } } : link;
}

function children(item) {
  return Array.isArray(item.items) ? item.items : [];
}

function heading(label, lib, className = 'wf-nav-group') {
  return `<span class="${className}">${lib.escapeHtml(lib.str(label))}</span>`;
}

function navRow(item, view, depth) {
  const { ctx, lib, on, inert } = view;
  const label = lib.str(item.label);
  const glyph = lib.iconSpan(item.icon, { style: item.iconStyle });
  const badge = item.badge != null ? `<span class="wf-nav-badge">${lib.escapeHtml(String(item.badge))}</span>` : '';
  const nested = children(item);
  // Children always show unless the item says `expanded: false`; only an
  // explicit `expanded` makes the row a disclosure with a chevron.
  const expandable = nested.length > 0 && typeof item.expanded === 'boolean';
  const chevron = expandable
    ? `<span class="wf-nav-chevron">${lib.icon(item.expanded ? 'chevron-down' : 'chevron-right')}</span>`
    : '';
  const body = `${glyph}<span class="wf-nav-label">${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</span>${badge}${chevron}`;
  const current = on.get(item) === true;
  const state = { current, disabled: item.disabled === true, expanded: expandable ? item.expanded : undefined };
  const className = `wf-nav-item${current ? ' wf-nav-on' : ''}${depth > 0 ? ' wf-nav-child' : ''}`;
  const row = itemLink(item, className, body, ctx, lib, { inert, state, owner: rowOwner(lib, expandable) });
  const shown = nested.length > 0 && item.expanded !== false
    ? `<span class="wf-nav-children">${nested.map((child) => sideEntry(child, view, depth + 1)).join('')}</span>`
    : '';
  return `${row}${shown}`;
}

function sideEntry(entry, view, depth = 0) {
  if (entry.type === 'heading') return heading(entry.label, view.lib);
  if (entry.type === 'separator') return '<span class="wf-nav-sep"></span>';
  if (entry.type === 'group') {
    return `${heading(entry.label, view.lib)}${children(entry).map((child) => sideEntry(child, view, depth)).join('')}`;
  }
  return navRow(entry, view, depth);
}

// One link in an open top-nav panel: an icon box, the label and a description line.
function panelEntry(entry, view) {
  const { ctx, lib, on, inert } = view;
  if (entry.type === 'heading') return heading(entry.label, lib, 'wf-nav-panel-heading');
  if (entry.type === 'separator') return '<span class="wf-nav-panel-sep"></span>';
  if (entry.type === 'group') {
    return `${heading(entry.label, lib, 'wf-nav-panel-heading')}${children(entry).map((child) => panelEntry(child, view)).join('')}`;
  }
  const label = lib.str(entry.label);
  const description = lib.str(entry.description);
  const glyph = lib.str(entry.icon)
    ? `<span class="wf-nav-link-icon">${lib.icon(entry.icon, { style: entry.iconStyle })}</span>`
    : '';
  const text = `<span class="wf-nav-link-text"><span class="wf-nav-link-label">${
    label ? lib.escapeHtml(label) : lib.renderSkeleton(10)
  }</span>${description ? `<span class="wf-nav-link-desc">${lib.escapeHtml(description)}</span>` : ''}</span>`;
  const current = on.get(entry) === true;
  const state = { current, disabled: entry.disabled === true };
  return itemLink(entry, `wf-nav-link${current ? ' wf-nav-on' : ''}`, `${glyph}${text}`, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.link });
}

// A top-level item with children is a disclosure button with a chevron; `open` draws its panel below it.
function topEntry(entry, index, opened, view) {
  const { lib, on } = view;
  if (entry.type === 'heading') return heading(entry.label, lib);
  if (entry.type === 'separator') return '<span class="wf-nav-sep"></span>';
  const nested = children(entry);
  if (nested.length === 0) return navRow(entry, view, 0);
  const label = lib.str(entry.label);
  const glyph = lib.iconSpan(entry.icon, { style: entry.iconStyle });
  const current = on.get(entry) === true;
  const open = index === opened;
  const state = { current, disabled: entry.disabled === true, expanded: open };
  const trigger = `<button type="button" class="wf-nav-item wf-nav-trigger${current ? ' wf-nav-on' : ''}"${
    lib.stateAttrs(state, { owner: rowOwner(lib, true) })
  }>${glyph}<span class="wf-nav-label">${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</span><span class="wf-nav-chevron">${
    lib.icon('chevron-down')
  }</span></button>`;
  const panel = open ? `<div class="wf-nav-panel">${nested.map((child) => panelEntry(child, view)).join('')}</div>` : '';
  return `<div class="wf-nav-menu">${trigger}${panel}</div>`;
}

// Legacy `active` belongs to nav's own rule, as it always did: it adds to
// route inference instead of replacing it, and `active: false` never hid the
// row for the current route. Only the canonical `selected` decides first.
function legacyActive(value, lib) {
  if (!Array.isArray(value)) return value;
  return value.map((entry) => {
    if (!lib.isObject(entry)) return entry;
    const { active, ...rest } = entry;
    if (active !== undefined) rest.legacyActive = active;
    for (const key of ['items', 'children']) if (Array.isArray(entry[key])) rest[key] = legacyActive(entry[key], lib);
    return rest;
  });
}

function renderNav(node, ctx, lib) {
  const props = node.props || {};
  const entries = lib.normalizeItems(legacyActive(props.items, lib), lib.itemProfiles.nav);
  // A shared sidebar cannot know which page it is on, so when no item says
  // which one is current, the renderer marks the items pointing at the current route.
  const flat = flattenItems(entries);
  const onList = itemsOn(flat, lib, (item) => (
    item.legacyActive === true || (item.route != null && String(item.route) === ctx.currentRoute)
  ));
  const view = { ctx, lib, on: new Map(flat.map((item, index) => [item, onList[index]])), inert: hasInteraction(node) };
  const variant = VARIANTS.includes(props.variant) ? props.variant : '';
  const opened = variant === 'top' ? openIndex(entries, props.open) : -1;
  const markup = variant === 'top'
    ? entries.map((entry, index) => topEntry(entry, index, opened, view)).join('')
    : entries.map((entry) => sideEntry(entry, view)).join('');
  const collapsed = props.collapsed === true;
  const classes = [collapsed ? 'wf-nav-collapsed' : '', variant ? 'wf-nav-' + variant : ''].filter(Boolean).join(' ');
  let style = '';
  if (variant === 'rail') {
    const size = node.size || {};
    const width = size.width == null ? lib.token('sidebar.collapsedWidth', ctx.viewport, ctx.sizing) : null;
    style = [width ? 'width:' + width + 'px' : '', size.minWidth == null ? 'min-width:0' : '', 'flex:0 0 auto'].filter(Boolean).join(';');
  }
  return { tag: 'nav', inner: markup, className: classes, style };
}

module.exports = { navRenderers: { nav: renderNav } };
