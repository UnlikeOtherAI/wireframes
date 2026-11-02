'use strict';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function renderCalendar(node, ctx, lib) {
  const props = node.props || {};
  const view = lib.str(props.view) || 'month';
  const label = lib.str(props.date) || 'This month';
  const head = `<div class="wf-cal-head"><button class="wf-page-step">‹</button><span class="wf-cal-title">${
    lib.bound(label, ctx)
  }</span><button class="wf-page-step">›</button></div>`;
  const dayNames = `<div class="wf-cal-row wf-cal-names">${
    WEEKDAYS.map((day) => `<span class="wf-cal-name">${day}</span>`).join('')
  }</div>`;

  if (view === 'day' || view === 'week') {
    const columns = view === 'day' ? 1 : 7;
    const slots = Array.from({ length: 8 }, (_, hour) => (
      `<div class="wf-cal-slot-row">${Array.from({ length: columns }, (_, col) => {
        const busy = lib.seeded(node.id || 'cal', hour * columns + col) > 0.72;
        return `<span class="wf-cal-slot">${busy ? '<span class="wf-cal-event"></span>' : ''}</span>`;
      }).join('')}</div>`
    )).join('');
    return {
      inner: `${head}${view === 'week' ? dayNames : ''}<div class="wf-cal-slots" style="--wf-cal-cols:${columns}">${slots}</div>`,
      className: `wf-cal-${lib.toSafeClass(view)}`,
    };
  }

  const events = lib.items(props.events, 'title');
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2;
    const inMonth = day >= 1 && day <= 31;
    const event = inMonth && events.length > 0 && lib.seeded(node.id || 'cal', i) > 0.78
      ? '<span class="wf-cal-event"></span>'
      : '';
    return `<span class="wf-cal-cell${inMonth ? '' : ' wf-cal-out'}">${inMonth ? day : ''}${event}</span>`;
  }).join('');

  return {
    inner: `${head}${dayNames}<div class="wf-cal-grid">${cells}</div>`,
    className: view === 'picker' ? 'wf-cal-picker' : 'wf-cal-month',
  };
}

function renderKanban(node, ctx, lib) {
  const columns = lib.items(node.props?.columns, 'title');
  const list = columns.length > 0 ? columns : [{ title: '' }, { title: '' }, { title: '' }];
  const markup = list.map((column) => {
    const cards = lib.items(column.cards, 'title');
    const body = (cards.length > 0 ? cards : [{}, {}]).map((card) => (
      `<div class="wf-kanban-card"><span class="wf-kanban-card-title">${
        lib.str(card.title) ? lib.bound(card.title, ctx) : lib.renderSkeleton(10)
      }</span>${lib.str(card.meta) ? `<span class="wf-kanban-card-meta">${lib.bound(card.meta, ctx)}</span>` : ''}</div>`
    )).join('');
    const count = column.count != null
      ? `<span class="wf-kanban-count">${lib.escapeHtml(String(column.count))}</span>`
      : '';
    return `<div class="wf-kanban-col" data-wf-frame="surface"><div class="wf-kanban-head">${
      lib.str(column.title) ? lib.bound(column.title, ctx) : lib.renderSkeleton(8)
    }${count}</div><div class="wf-kanban-cards">${body}</div></div>`;
  }).join('');
  return { inner: markup };
}

function treeRow(item, ctx, lib, depth) {
  const label = lib.str(item.label) || lib.str(item.title);
  const children = lib.items(item.children);
  const hasChildren = children.length > 0;
  const open = item.open !== false;
  const caret = hasChildren
    ? `<span class="wf-tree-caret">${open ? '▾' : '▸'}</span>`
    : '<span class="wf-tree-caret wf-tree-leaf"></span>';
  const glyph = lib.iconSpan(item.icon || (hasChildren ? 'folder' : 'file'), { size: 'sm' });
  const row = `<div class="wf-tree-row" style="padding-left:${depth * 16}px">${caret}${glyph}<span class="wf-tree-label">${
    label ? lib.bound(label, ctx) : lib.renderSkeleton(9)
  }</span></div>`;
  const kids = hasChildren && open
    ? children.map((child) => treeRow(child, ctx, lib, depth + 1)).join('')
    : '';
  return `${row}${kids}`;
}

function renderTree(node, ctx, lib) {
  const entries = lib.items(node.props?.items);
  const rows = entries.length > 0 ? entries : [{ label: '', children: [{ label: '' }] }];
  return { inner: rows.map((item) => treeRow(item, ctx, lib, 0)).join('') };
}

function renderAccordion(node, ctx, lib) {
  const entries = lib.items(node.props?.items, 'title');
  const rows = entries.length > 0 ? entries : [{}, {}, {}];
  const markup = rows.map((item) => {
    const open = item.open === true;
    const title = lib.str(item.title);
    const text = lib.str(item.text);
    const body = open
      ? `<div class="wf-accordion-body">${text ? lib.bound(text, ctx) : lib.renderSkeleton('80%')}</div>`
      : '';
    return `<div class="wf-accordion-item${open ? ' wf-accordion-open' : ''}"><div class="wf-accordion-head"><span class="wf-accordion-title">${
      title ? lib.bound(title, ctx) : lib.renderSkeleton(12)
    }</span><span class="wf-accordion-caret">${open ? '−' : '+'}</span></div>${body}</div>`;
  }).join('');
  return { inner: markup };
}

module.exports = {
  structureRenderers: {
    calendar: renderCalendar,
    kanban: renderKanban,
    tree: renderTree,
    accordion: renderAccordion,
  },
};
