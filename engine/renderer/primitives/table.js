'use strict';

const {
  deriveKeyFromLabel,
  normalizeTableColumns,
  tableGridTemplate,
} = require('../table-columns');

const CELL_KINDS = new Set(['text', 'badge', 'avatar', 'actions', 'check', 'link']);
// The table body is the region that is loading, so it carries aria-busy.
const LOADING_OWNER = { aria: { loading: 'aria-busy' } };

function cellMarkup(column, value, ctx, lib) {
  const kind = CELL_KINDS.has(column.kind) ? column.kind : 'text';
  if (value == null || value === '') {
    return kind === 'actions' ? '' : lib.renderSkeleton(7);
  }
  if (kind === 'link' && lib.isObject(value)) {
    const text = typeof value.text === 'string' || typeof value.text === 'number' ? String(value.text) : '';
    const routeId = lib.str(value.route).trim();
    const routes = ctx.routeTable;
    const href = lib.isObject(routes) && Object.prototype.hasOwnProperty.call(routes, routeId) ? routes[routeId] : null;
    // New cells accept internal prototype routes, never raw hrefs or URL schemes.
    const safe = typeof href === 'string' && href !== '' && !/[\s\\\u0000-\u001f\u007f]/.test(href)
      && !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
    const body = lib.escapeHtml(text);
    return typeof value.text === 'string' && text.trim() && routeId && safe
      ? `<a class="wf-inline-link wf-table-link" ${lib.navigationAttrs({href, routeId}).join(' ')}>${body}</a>`
      : `<span class="wf-inline-link">${body}</span>`;
  }
  const text = String(value);
  if (kind === 'badge') {
    return `<span class="wf-badge wf-badge-outline"><span class="wf-badge-body">${lib.escapeHtml(text)}</span></span>`;
  }
  if (kind === 'avatar') {
    return `<span class="wf-cell-avatar"><span class="wf-avatar-chip" style="width:24px;height:24px;border-radius:50%;font-size:10px">${
      lib.escapeHtml(lib.initials(text) || '?')
    }</span><span>${lib.escapeHtml(text)}</span></span>`;
  }
  if (kind === 'check') {
    return `<span class="wf-check-mark${/^(true|yes|on|1)$/i.test(text) ? ' wf-check-on' : ''}"></span>`;
  }
  if (kind === 'link') {
    return `<span class="wf-inline-link">${lib.escapeHtml(text)}</span>`;
  }
  return lib.bound(text, ctx);
}

function actionsCell(column, lib) {
  const glyphs = Array.isArray(column.actions) && column.actions.length > 0
    ? column.actions
    : ['pen', 'trash'];
  return `<span class="wf-cell-actions">${glyphs.map((glyph) => (
    `<button class="wf-act wf-act-icon">${lib.icon(String(glyph), { size: 'sm' })}</button>`
  )).join('')}</span>`;
}

function headerCell(column, ctx, lib) {
  const sort = column.sortable === true ? `<span class="wf-sort">${lib.icon('sort', { size: 'xs' })}</span>` : '';
  const align = column.align ? ` wf-align-${lib.toSafeClass(column.align)}` : '';
  return `<div class="wf-table-cell wf-table-header-cell${align}" data-wf-table-column="${column.index}">${
    lib.bound(column.label, ctx)
  }${sort}</div>`;
}

function renderTable(node, ctx, lib) {
  const props = node.props || {};
  const columns = normalizeTableColumns(props);
  const state = lib.str(props.state) || 'default';
  const selectable = props.selectable === true;
  const rows = state === 'default' ? ctx.tableRows(node, props) : [];

  const leading = selectable ? '32px ' : '';
  const template = tableGridTemplate(columns);
  const gridStyle = template
    ? ` style="${lib.escapeAttr(`grid-template-columns:${leading}${template}`)}"`
    : '';

  const checkHead = selectable ? '<div class="wf-table-cell wf-table-check"><span class="wf-check-mark"></span></div>' : '';
  const header = columns.length > 0
    ? columns.map((column) => headerCell(column, ctx, lib)).join('')
    : '<div class="wf-table-cell wf-table-header-cell">Table</div>';

  let body;
  let bodyState = '';
  if (state === 'loading') {
    bodyState = lib.stateAttrs({ loading: true }, { owner: LOADING_OWNER });
    body = Array.from({ length: 4 }, () => (
      `<div class="wf-table-row wf-table-grid"${gridStyle}>${checkHead ? '<div class="wf-table-cell"></div>' : ''}${
        (columns.length > 0 ? columns : [{}]).map(() => `<div class="wf-table-cell">${lib.renderSkeleton('70%')}</div>`).join('')
      }</div>`
    )).join('');
  } else if (state === 'empty' || rows.length === 0) {
    const text = lib.str(props.emptyText) || 'No rows';
    body = `<div class="wf-table-row wf-table-row-empty"><div class="wf-table-cell">${lib.escapeHtml(text)}</div></div>`;
  } else {
    body = rows.map((row, rowIndex) => {
      const cells = columns.map((column) => {
        const align = column.align ? ` wf-align-${lib.toSafeClass(column.align)}` : '';
        const value = column.kind === 'actions'
          ? actionsCell(column, lib)
          : cellMarkup(column, ctx.cellValue(row, column), ctx, lib);
        return `<div class="wf-table-cell${align}" data-wf-table-column="${column.index}">${value}</div>`;
      }).join('');
      const check = selectable
        ? '<div class="wf-table-cell wf-table-check"><span class="wf-check-mark"></span></div>'
        : '';
      return `<div class="wf-table-row wf-table-grid" data-wf-table-row="${rowIndex}"${gridStyle}>${check}${cells}</div>`;
    }).join('');
  }

  const caption = lib.str(props.caption)
    ? `<div class="wf-table-caption">${lib.bound(props.caption, ctx)}</div>`
    : '';
  const footer = props.pagination === true
    ? '<div class="wf-table-footer"><span class="wf-page-label">1 of 1</span><span class="wf-table-pager"><button class="wf-page-step">‹</button><button class="wf-page-step">›</button></span></div>'
    : '';

  return {
    inner: `${caption}<div class="wf-table-header wf-table-grid"${gridStyle}>${checkHead}${header}</div><div class="wf-table-body"${bodyState}>${body}</div>${footer}`,
    className: `${props.dense === true ? 'wf-table-dense ' : ''}wf-table-state-${lib.toSafeClass(state)}`,
  };
}

function routeFor(item, ctx, lib) {
  const routeId = lib.str(item.route);
  const href = routeId && lib.isObject(ctx.routeTable) ? ctx.routeTable[routeId] : null;
  return item.disabled !== true && typeof href === 'string' && href.trim() !== ''
    ? { href: href.trim(), routeId }
    : null;
}

/**
 * One list row. A routed row is a link, unless it is disabled, its route is
 * unknown or the list itself is interactive. A row with action buttons links
 * its body instead, so the buttons never sit inside the link.
 */
function listRow(item, kind, ctx, lib, routed) {
  const title = lib.str(item.label);
  const text = lib.str(item.description);
  const meta = lib.str(item.meta);

  let leading = '';
  if (kind === 'avatar') {
    leading = `<span class="wf-list-lead"><span class="wf-avatar-chip" style="width:36px;height:36px;border-radius:50%;font-size:13px">${
      lib.escapeHtml(lib.initials(item.avatar || title) || '?')
    }</span></span>`;
  } else if (kind === 'file') {
    leading = `<span class="wf-list-lead">${lib.icon(lib.str(item.icon) || 'file', { size: 'lg' })}</span>`;
  } else if (kind === 'timeline') {
    leading = '<span class="wf-list-lead wf-timeline-rail"><span class="wf-timeline-dot"></span></span>';
  } else if (lib.str(item.icon)) {
    leading = `<span class="wf-list-lead">${lib.icon(item.icon, { size: 'lg' })}</span>`;
  }

  const badge = item.badge != null
    ? `<span class="wf-badge wf-badge-outline"><span class="wf-badge-body">${lib.escapeHtml(String(item.badge))}</span></span>`
    : '';
  const bodyInner = `<span class="wf-list-title">${
    title ? lib.bound(title, ctx) : lib.renderSkeleton(12)
  }${badge}</span>${text ? `<span class="wf-list-text">${lib.bound(text, ctx)}</span>` : ''}`;

  const buttons = kind === 'action' || Array.isArray(item.actions);
  const trailing = buttons
    ? `<span class="wf-list-trail">${(Array.isArray(item.actions) && item.actions.length > 0 ? item.actions : ['ellipsis'])
      .map((action) => `<button class="wf-act wf-act-icon">${lib.icon(String(action.icon || action), { size: 'sm' })}</button>`)
      .join('')}</span>`
    : (meta ? `<span class="wf-list-meta">${lib.bound(meta, ctx)}</span>` : '');

  // Any `selected` key draws the check control, so `selected: false` is an unchecked box.
  const check = item.selected != null
    ? `<span class="wf-list-lead"><span class="wf-check-mark${item.selected === true ? ' wf-check-on' : ''}"></span></span>`
    : '';

  const side = kind === 'chat' ? ` wf-chat-${lib.toSafeClass(lib.str(item.side) || 'start')}` : '';
  const state = lib.stateAttrs({ selected: item.selected, disabled: item.disabled }, { owner: lib.STATE_OWNERS.item });
  const nav = routed ? routeFor(item, ctx, lib) : null;
  const link = nav ? ` ${lib.navigationAttrs(nav).join(' ')}` : '';
  if (nav && !buttons) {
    return `<a class="wf-list-row${side}"${link}${state}>${check}${leading}<span class="wf-list-body">${bodyInner}</span>${trailing}</a>`;
  }
  const body = nav
    ? `<a class="wf-list-body"${link}>${bodyInner}</a>`
    : `<span class="wf-list-body">${bodyInner}</span>`;
  return `<div class="wf-list-row${side}"${state}>${check}${leading}${body}${trailing}</div>`;
}

function renderList(node, ctx, lib) {
  const props = node.props || {};
  const kind = lib.str(props.kind) || 'plain';
  const entries = lib.normalizeItems(props.items, lib.itemProfiles.list);
  const rows = entries.length > 0
    ? entries
    : Array.from({ length: 3 }, () => ({}));
  const refresh = props.refreshable === true
    ? '<div class="wf-list-refresh">↻</div>'
    : '';
  // An interactive list is one link already, so its rows never nest another.
  const routed = !(Array.isArray(node.interaction) && node.interaction.length > 0);
  return {
    inner: `${refresh}${rows.map((item) => listRow(item, kind, ctx, lib, routed)).join('')}`,
    className: `wf-list-${lib.toSafeClass(kind)}${props.divided === false ? '' : ' wf-list-divided'}`,
  };
}

module.exports = {
  tableRenderers: { table: renderTable, list: renderList },
  deriveKeyFromLabel,
};
