'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { PRIMITIVE_RENDERERS } = require('@wireframes/engine/renderer/primitives/index');
const { renderNode } = require('@wireframes/engine/renderer/primitives');

const ROUTES = { home: '/index.html', settings: '/settings.html' };
const ctx = (extra = {}) => ({ bindingContext: {}, routeTable: ROUTES, ...extra });
const render = (component, props, extra = {}) => PRIMITIVE_RENDERERS[component](
  { id: `${component}_demo`, component, props, ...extra.node },
  ctx(extra.ctx),
  lib,
);

// Legacy YAML may only gain these state attributes, so the oracle compares
// what is left once they are removed.
const STATE_ATTRS = / (?:role="button"|aria-expanded="(?:true|false)"|aria-busy="true"|aria-disabled="true"|data-wf-(?:expanded|selected|disabled|loading))(?=[ >])/g;
const withoutState = (markup) => markup.replace(STATE_ATTRS, '');

// The renderers as they were at 8872d67, kept as byte-identity oracles.
const legacy = {
  listRow(item, kind, c) {
    const title = lib.str(item.title) || lib.str(item.label);
    const text = lib.str(item.text);
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
    const body = `<span class="wf-list-body"><span class="wf-list-title">${
      title ? lib.bound(title, c) : lib.renderSkeleton(12)
    }${badge}</span>${text ? `<span class="wf-list-text">${lib.bound(text, c)}</span>` : ''}</span>`;
    const trailing = kind === 'action' || Array.isArray(item.actions)
      ? `<span class="wf-list-trail">${(Array.isArray(item.actions) && item.actions.length > 0 ? item.actions : ['ellipsis'])
        .map((action) => `<button class="wf-act wf-act-icon">${lib.icon(String(action.icon || action), { size: 'sm' })}</button>`)
        .join('')}</span>`
      : (meta ? `<span class="wf-list-meta">${lib.bound(meta, c)}</span>` : '');
    const check = item.selected != null
      ? `<span class="wf-list-lead"><span class="wf-check-mark${item.selected === true ? ' wf-check-on' : ''}"></span></span>`
      : '';
    const side = kind === 'chat' ? ` wf-chat-${lib.toSafeClass(lib.str(item.side) || 'start')}` : '';
    return `<div class="wf-list-row${side}">${check}${leading}${body}${trailing}</div>`;
  },
  list(props, c) {
    const kind = lib.str(props.kind) || 'plain';
    const entries = lib.items(props.items, 'title');
    const rows = entries.length > 0 ? entries : Array.from({ length: 3 }, () => ({}));
    const refresh = props.refreshable === true ? '<div class="wf-list-refresh">↻</div>' : '';
    return `${refresh}${rows.map((item) => legacy.listRow(item, kind, c)).join('')}`;
  },
  treeRow(item, c, depth) {
    const label = lib.str(item.label) || lib.str(item.title);
    const children = lib.items(item.children);
    const hasChildren = children.length > 0;
    const open = item.open !== false;
    const caret = hasChildren
      ? `<span class="wf-tree-caret">${open ? '▾' : '▸'}</span>`
      : '<span class="wf-tree-caret wf-tree-leaf"></span>';
    const glyph = lib.iconSpan(item.icon || (hasChildren ? 'folder' : 'file'), { size: 'sm' });
    const row = `<div class="wf-tree-row" style="padding-left:${depth * 16}px">${caret}${glyph}<span class="wf-tree-label">${
      label ? lib.bound(label, c) : lib.renderSkeleton(9)
    }</span></div>`;
    const kids = hasChildren && open ? children.map((child) => legacy.treeRow(child, c, depth + 1)).join('') : '';
    return `${row}${kids}`;
  },
  tree(props, c) {
    const entries = lib.items(props.items);
    const rows = entries.length > 0 ? entries : [{ label: '', children: [{ label: '' }] }];
    return rows.map((item) => legacy.treeRow(item, c, 0)).join('');
  },
  accordion(props, c) {
    const entries = lib.items(props.items, 'title');
    const rows = entries.length > 0 ? entries : [{}, {}, {}];
    return rows.map((item) => {
      const open = item.open === true;
      const title = lib.str(item.title);
      const text = lib.str(item.text);
      const body = open
        ? `<div class="wf-accordion-body">${text ? lib.bound(text, c) : lib.renderSkeleton('80%')}</div>`
        : '';
      return `<div class="wf-accordion-item${open ? ' wf-accordion-open' : ''}"><div class="wf-accordion-head"><span class="wf-accordion-title">${
        title ? lib.bound(title, c) : lib.renderSkeleton(12)
      }</span><span class="wf-accordion-caret">${open ? '−' : '+'}</span></div>${body}</div>`;
    }).join('');
  },
  carouselSlides(props, c) {
    return lib.items(props.items, 'title').map((item) => (
      `<div class="wf-slide">${lib.str(item.title) ? lib.bound(item.title, c) : lib.renderSkeleton(14)}</div>`
    )).join('');
  },
};

// Every item form each element read before the shared model, awkward ones included.
const SCALARS = [null, undefined, true, false, 0, 7, '', 'Plain', ['nested'], () => 'fn'];
const LIST_ITEMS = [...SCALARS,
  { title: 'T', text: 'Body', meta: '2m', badge: 3, selected: true }, { title: '', label: 'L' }, { title: '  ', label: '' },
  { title: 5, label: 'L' }, { label: 'Only label' }, { title: 'T', label: 'L' }, { title: 'T', selected: false, actions: ['star'], side: 'end' },
  { avatar: 'Ada Lovelace' }, { text: '' }, { selected: null }, { icon: 'folder', title: 'Docs' }, { title: 'A', actions: [{ icon: 'pen' }, 'trash'] },
  { title: '{{props.name}}', text: 'Bound' }, { title: '<b>', text: '&', meta: '"q"', badge: '<i>' }, { title: 'Zero badge', badge: 0 }];
const TREE_ITEMS = [...SCALARS,
  { label: 'src', children: [{ label: 'a.js' }, { title: 'b.js', open: false }, 'c.js'] }, { label: '', title: 'From title' }, { title: 'T' },
  { label: 'closed', open: false, children: ['x'] }, { label: 'odd', open: 'no' }, { label: 5, title: 'T' }, { title: 5 },
  { label: null, title: 'T' }, { label: 'deep', children: [{ label: 'mid', children: [{ label: 'leaf', icon: 'file' }] }] },
  { label: 'empty kids', children: [] }, { label: 'not an array', children: 'x' }, { label: 'iconed', icon: 'gear', children: ['k'] }];
const ACCORDION_ITEMS = [...SCALARS,
  { title: 'Q', text: 'A', open: true }, { title: 'Q', open: false }, { title: 'Q', open: 'yes' }, { title: '', text: '' },
  { text: 'Body only' }, {}, { title: 'Open, no text', open: true }, { title: '<b>', text: '&amp;', open: true }];
const CAROUSEL_ITEMS = [...SCALARS, { title: 'Slide' }, { title: '' }, { title: 4 }, {}, { title: '  padded  ' }];

test('list: every legacy item form and kind renders unchanged', () => {
  for (const kind of [undefined, 'plain', 'avatar', 'action', 'file', 'chat', 'timeline', 'settings']) {
    for (const props of [{ items: LIST_ITEMS }, { items: [] }, { items: 'nope' }, {}, { items: LIST_ITEMS, refreshable: true }]) {
      const withKind = { ...props, kind };
      assert.equal(withoutState(render('list', withKind).inner), legacy.list(withKind, ctx()), `${kind} ${JSON.stringify(props)}`);
    }
    for (const entry of LIST_ITEMS) {
      const props = { kind, items: [entry] };
      assert.equal(withoutState(render('list', props).inner), legacy.list(props, ctx()), `${kind} ${JSON.stringify(entry)}`);
    }
  }
});

test('list: title beats label only when it is nonblank, and blank labels draw a skeleton', () => {
  const rows = render('list', { items: [{ title: 'Title', label: 'Label' }, { title: '  ', label: 'Label' }, { title: '', label: '' }] }).inner;
  const titles = rows.split('<div class="wf-list-row">').slice(1)
    .map((row) => row.replace(/^<span class="wf-list-body"><span class="wf-list-title">/, '').replace(/<\/span><\/span><\/div>$/, ''));
  assert.deepEqual(titles, ['Title', 'Label', lib.renderSkeleton(12)]);
});

test('tree: every legacy item form renders unchanged', () => {
  for (const props of [{ items: TREE_ITEMS }, { items: [] }, {}, { items: 'nope' }]) {
    assert.equal(withoutState(render('tree', props).inner), legacy.tree(props, ctx()), JSON.stringify(props));
  }
  for (const entry of TREE_ITEMS) {
    const props = { items: [entry] };
    assert.equal(withoutState(render('tree', props).inner), legacy.tree(props, ctx()), JSON.stringify(entry));
  }
});

test('accordion: every legacy item form renders unchanged', () => {
  for (const props of [{ items: ACCORDION_ITEMS }, { items: [] }, {}]) {
    assert.equal(withoutState(render('accordion', props).inner), legacy.accordion(props, ctx()), JSON.stringify(props));
  }
  for (const entry of ACCORDION_ITEMS) {
    const props = { items: [entry] };
    assert.equal(withoutState(render('accordion', props).inner), legacy.accordion(props, ctx()), JSON.stringify(entry));
  }
});

test('carousel: every legacy item form renders unchanged', () => {
  for (const items of [CAROUSEL_ITEMS, ...CAROUSEL_ITEMS.map((entry) => [entry])]) {
    const result = render('carousel', { items });
    const slides = legacy.carouselSlides({ items }, ctx());
    if (slides) assert.ok(result.inner.startsWith(`<div class="wf-carousel-track">${slides}</div>`), JSON.stringify(items));
    else assert.equal(result.useChildren, true, JSON.stringify(items));
  }
});

test('canonical-only items render in list, tree, accordion and carousel', () => {
  const list = render('list', {
    items: [{ label: 'Inbox', description: 'Three unread', icon: 'inbox', badge: 3, meta: 'now', selected: true }],
  }).inner;
  assert.match(list, /<span class="wf-list-title">Inbox<span class="wf-badge/);
  assert.match(list, /<span class="wf-list-text">Three unread<\/span>/);
  assert.match(list, /wf-check-on/);
  assert.match(list, /<span class="wf-list-meta">now<\/span>/);

  const tree = render('tree', { items: [{ label: 'src', items: [{ label: 'index.js' }] }, { label: 'docs', expanded: false, items: ['hidden.md'] }] }).inner;
  assert.match(tree, /index\.js/);
  assert.doesNotMatch(tree, /hidden\.md/);

  const accordion = render('accordion', { items: [{ label: 'Billing', description: 'Monthly', expanded: true }] }).inner;
  assert.match(accordion, /wf-accordion-title">Billing</);
  assert.match(accordion, /wf-accordion-body">Monthly</);

  assert.match(render('carousel', { items: [{ label: 'Slide A' }] }).inner, /<div class="wf-slide">Slide A<\/div>/);
});

test('tree items stay open unless false; accordion items stay closed unless true', () => {
  const tree = render('tree', { items: [{ label: 'open by default', items: ['kid'] }, { label: 'closed', expanded: false, items: ['gone'] }, { label: 'legacy closed', open: false, items: ['gone too'] }] }).inner;
  assert.match(tree, /role="button" aria-expanded="true" data-wf-expanded>.*open by default/);
  assert.match(tree, />kid</);
  assert.match(tree, /role="button" aria-expanded="false">.*closed/);
  assert.doesNotMatch(tree, /gone/);

  const accordion = render('accordion', { items: [{ label: 'closed by default', description: 'hidden' }, { label: 'open', description: 'shown', expanded: true }, { label: 'legacy', text: 'also shown', open: true }] }).inner;
  const heads = [...accordion.matchAll(/<div class="wf-accordion-head"([^>]*)>/g)].map((m) => m[1]);
  assert.deepEqual(heads, [
    ' role="button" aria-expanded="false"',
    ' role="button" aria-expanded="true" data-wf-expanded',
    ' role="button" aria-expanded="true" data-wf-expanded',
  ]);
  assert.doesNotMatch(accordion, /hidden/);
  assert.match(accordion, /shown/);
  assert.match(accordion, /also shown/);
});

test('tree: leaves carry no expanded state, and selected rows are marked', () => {
  const tree = render('tree', { items: [{ label: 'src', selected: true, items: [{ label: 'a.js', selected: true }, { label: 'b.js', selected: false }] }] }).inner;
  const rows = [...tree.matchAll(/<div class="wf-tree-row" style="[^"]*"([^>]*)>/g)].map((m) => m[1]);
  assert.deepEqual(rows, [
    ' role="button" aria-expanded="true" data-wf-selected data-wf-expanded',
    ' data-wf-selected',
    '',
  ]);
});

test('list: selected and disabled states, and selected: false keeps an unchecked control', () => {
  const rows = render('list', { selectable: true, items: [{ label: 'On', selected: true }, { label: 'Off', selected: false }, { label: 'None' }, { label: 'Disabled', disabled: true }] }).inner;
  const opens = [...rows.matchAll(/<div class="wf-list-row"([^>]*)>(.*?)<span class="wf-list-body">/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(opens, [
    [' data-wf-selected', '<span class="wf-list-lead"><span class="wf-check-mark wf-check-on"></span></span>'],
    ['', '<span class="wf-list-lead"><span class="wf-check-mark"></span></span>'],
    ['', ''],
    [' aria-disabled="true" data-wf-disabled', ''],
  ]);
});

test('list routes: a known route links the row; disabled, unknown and interactive lists never link', () => {
  const rows = render('list', { items: [{ label: 'Home', route: 'home' }, { label: 'Off', route: 'home', disabled: true }, { label: 'Lost', route: 'nowhere' }] }).inner;
  assert.match(rows, /^<a class="wf-list-row" href="\/index.html" data-wf-route-target="home"><span class="wf-list-body">/);
  assert.match(rows, /<div class="wf-list-row" aria-disabled="true" data-wf-disabled><span class="wf-list-body"><span class="wf-list-title">Off</);
  assert.match(rows, /<div class="wf-list-row"><span class="wf-list-body"><span class="wf-list-title">Lost</);
  assert.equal((rows.match(/href=/g) || []).length, 1);

  // Rows with action buttons link their body, so no button sits inside a link.
  const action = render('list', { kind: 'action', items: [{ label: 'Keys', route: 'settings' }] }).inner;
  assert.match(action, /^<div class="wf-list-row"><a class="wf-list-body" href="\/settings.html" data-wf-route-target="settings">/);
  assert.doesNotMatch(action, /<a [^>]*>(?:(?!<\/a>).)*<button/);

  // A list that carries an interaction is already a link target.
  const interactive = render('list', { items: [{ label: 'Home', route: 'home' }] }, {
    node: { interaction: [{ type: 'navigation', targetRoute: 'settings' }] },
  }).inner;
  assert.doesNotMatch(interactive, /href=/);
});

test('table: the loading state marks its body busy; other states do not', () => {
  const columns = ['Name', 'Status'];
  assert.match(render('table', { state: 'loading', columns }).inner, /<div class="wf-table-body" aria-busy="true" data-wf-loading>/);
  for (const state of ['default', 'empty', undefined]) {
    assert.match(render('table', { state, columns, rows: [['a', 'b']] }, { ctx: { tableRows: (n, p) => p.rows || [], cellValue: (row, col) => row[col.index] } }).inner, /<div class="wf-table-body">/);
  }
});

test('the element shell is unchanged; states sit on the owning rows', () => {
  const html = renderNode({ id: 'files', component: 'tree', props: { items: [{ label: 'src', items: ['a'] }] } });
  assert.match(html, /^<div id="files" class="wf-node wf-tree[^"]*"[^>]*><div class="wf-tree-row"/);
  assert.doesNotMatch(html.slice(0, html.indexOf('><div class="wf-tree-row"')), /aria-|data-wf-expanded/);
});
