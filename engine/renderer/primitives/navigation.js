'use strict';

const { hasInteraction, itemLink, itemsOn, expandGroups } = require('./navigation-items');

// A tab, crumb or step list has no headings or separators.
function entries(value, profile, lib) {
  return lib.normalizeItems(value, profile).filter((item) => item.type !== 'separator' && item.type !== 'heading');
}

function crumbOwner(lib) {
  return { ...lib.STATE_OWNERS.link, current: 'location' };
}

// The last crumb is current unless an item says otherwise; the current crumb never links.
function crumbTrail(value, separator, ctx, lib, inert) {
  const crumbs = entries(value, lib.itemProfiles.basic, lib);
  const on = itemsOn(crumbs, lib, (_, index) => index === crumbs.length - 1);
  const owner = crumbOwner(lib);
  return crumbs.map((crumb, index) => {
    const label = lib.str(crumb.label);
    const last = index === crumbs.length - 1;
    const body = label ? lib.escapeHtml(label) : lib.renderSkeleton(6);
    const state = { current: on[index], disabled: crumb.disabled === true };
    const item = on[index]
      ? `<span class="wf-crumb wf-crumb-current"${lib.stateAttrs(state, { owner })}>${body}</span>`
      : itemLink(crumb, 'wf-crumb', body, ctx, lib, { inert, state, owner });
    const sep = last ? '' : `<span class="wf-crumb-sep">${lib.escapeHtml(separator)}</span>`;
    return `${item}${sep}`;
  }).join('');
}

function renderTabBar(node, ctx, lib) {
  const tabs = entries(node.props?.tabs, lib.itemProfiles.tabs, lib);
  if (tabs.length === 0) {
    // No tabs[] — the author supplied children; the shell renders them.
    return { inner: '', useChildren: true, className: `wf-tabs-${lib.toSafeClass(lib.str(node.props?.variant) || 'underline')}` };
  }
  const variant = lib.str(node.props?.variant) || 'underline';
  const inert = hasInteraction(node);
  const on = itemsOn(tabs, lib);
  const markup = tabs.map((tab, index) => {
    const glyph = lib.iconSpan(tab.icon);
    const label = lib.str(tab.label);
    const body = `${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(6)}`;
    const active = on[index] ? ' wf-tab-on' : '';
    const badge = tab.badge != null ? `<span class="wf-tab-badge">${lib.escapeHtml(String(tab.badge))}</span>` : '';
    const disabled = tab.disabled === true;
    if (lib.str(tab.route)) {
      const state = { current: on[index], disabled };
      return itemLink(tab, `wf-tab${active}`, `${body}${badge}`, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.link });
    }
    // Tabs are buttons that announce selection with aria-pressed. A blank or
    // unselectable tab has always been disabled; that stays a bare attribute.
    const state = lib.stateAttrs({ selected: on[index], disabled }, { owner: lib.STATE_OWNERS.tab });
    const off = !disabled && (!label || node.selection?.selectable === false) ? ' disabled' : '';
    return `<button type="button" class="wf-tab${active}" data-wf-choice-value="${lib.escapeAttr(JSON.stringify(label))}"${state}${off}${!label ? ' aria-label="Empty tab"' : ''}>${body}${badge}</button>`;
  }).join('');
  return { inner: markup, className: `wf-tabs-${lib.toSafeClass(variant)}` };
}

function renderBottomTabBar(node, ctx, lib) {
  const tabs = entries(node.props?.tabs, lib.itemProfiles.tabs, lib);
  if (tabs.length === 0) return { inner: '', useChildren: true };
  const inert = hasInteraction(node);
  const on = itemsOn(tabs, lib);
  const markup = tabs.map((tab, index) => {
    const glyph = lib.icon(lib.str(tab.icon) || 'circle', { size: 'lg' });
    const label = lib.str(tab.label);
    const active = on[index] ? ' wf-tab-on' : '';
    const body = `<span class="wf-btab-glyph">${glyph}</span><span class="wf-btab-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(4)
    }</span>`;
    const state = { current: on[index], disabled: tab.disabled === true };
    return itemLink(tab, `wf-btab${active}`, body, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.link });
  }).join('');
  return { inner: markup };
}

function renderBreadcrumb(node, ctx, lib) {
  const separator = lib.str(node.props?.separator) || '/';
  return { tag: 'nav', inner: crumbTrail(node.props?.items, separator, ctx, lib, hasInteraction(node)) };
}

function renderPagination(node, ctx, lib) {
  const variant = lib.str(node.props?.variant) || 'numbers';
  const pages = Math.max(1, lib.num(node.props?.pages, 5));
  const page = Math.max(1, Math.min(pages, lib.num(node.props?.page, 1)));
  const current = lib.stateAttrs({ current: true }, { owner: lib.STATE_OWNERS.link });

  if (variant === 'dots') {
    const dots = Array.from({ length: pages }, (_, i) => (
      i + 1 === page ? `<span class="wf-dot wf-dot-on"${current}></span>` : '<span class="wf-dot"></span>'
    )).join('');
    return { tag: 'nav', inner: dots, className: 'wf-pagination-dots' };
  }
  const prev = '<button class="wf-page-step">‹</button>';
  const next = '<button class="wf-page-step">›</button>';
  if (variant === 'simple') {
    return {
      tag: 'nav',
      inner: `${prev}<span class="wf-page-label">${page} of ${pages}</span>${next}`,
      className: 'wf-pagination-simple',
    };
  }
  const window = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) window.push(i);
    else if (window[window.length - 1] !== '…') window.push('…');
  }
  const numbers = window.map((entry) => {
    if (entry === '…') return '<span class="wf-page-gap">…</span>';
    return entry === page
      ? `<button class="wf-pagenum wf-pagenum-on"${current}>${entry}</button>`
      : `<button class="wf-pagenum">${entry}</button>`;
  }).join('');
  return { tag: 'nav', inner: `${prev}${numbers}${next}`, className: 'wf-pagination-numbers' };
}

function renderStepper(node, ctx, lib) {
  const steps = entries(node.props?.steps, lib.itemProfiles.basic, lib);
  const legacyCurrent = Math.max(1, lib.num(node.props?.current, 1));
  const on = itemsOn(steps, lib, (_, index) => index + 1 === legacyCurrent);
  // Steps before the first current one are done.
  const current = on.includes(true) ? on.indexOf(true) + 1 : legacyCurrent;
  const vertical = lib.str(node.props?.orientation) === 'stack';
  const owner = { ...lib.STATE_OWNERS.item, current: 'step' };
  const markup = steps.map((step, index) => {
    const n = index + 1;
    const state = n < current ? 'done' : on[index] ? 'on' : 'next';
    const marker = state === 'done' ? '✓' : String(n);
    const label = lib.str(step.label);
    const connector = index < steps.length - 1 ? '<span class="wf-step-line"></span>' : '';
    const attrs = lib.stateAttrs({ current: on[index], disabled: step.disabled === true }, { owner });
    return `<span class="wf-step wf-step-${state}"${attrs}><span class="wf-step-marker">${marker}</span><span class="wf-step-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(7)
    }</span>${connector}</span>`;
  }).join('');
  return { inner: markup, className: vertical ? 'wf-stepper-stack' : 'wf-stepper-row' };
}

function renderAppBar(node, ctx, lib) {
  const props = node.props || {};
  if (Array.isArray(node.children) && node.children.length && !props.title && !props.leading && !props.actions?.length) {
    return { tag: 'header', inner: '', useChildren: true, style: 'justify-content:space-between' };
  }
  const leading = lib.str(props.leading)
    ? `<span class="wf-appbar-leading">${lib.icon(props.leading, { size: 'lg' })}</span>`
    : '';
  const title = lib.str(props.title);
  const subtitle = lib.str(props.subtitle);
  const centre = `<span class="wf-appbar-title">${
    title ? lib.bound(title, ctx) : lib.renderSkeleton(10)
  }${subtitle ? `<span class="wf-appbar-sub">${lib.bound(subtitle, ctx)}</span>` : ''}</span>`;
  // App-bar actions are glyph data, not items.
  const actions = lib.items(props.actions).map((action) => (
    `<span class="wf-appbar-action">${lib.icon(lib.str(action.icon) || lib.str(action.label) || 'ellipsis', { size: 'lg' })}</span>`
  )).join('');
  return { tag: 'header', inner: `${leading}${centre}<span class="wf-appbar-actions">${actions}</span>`, useChildren: true };
}

function renderPageHeader(node, ctx, lib) {
  const props = node.props || {};
  const inert = hasInteraction(node);
  const crumbs = crumbTrail(props.breadcrumb, '/', ctx, lib, inert);
  const crumbMarkup = crumbs ? `<nav class="wf-breadcrumb wf-ph-crumbs">${crumbs}</nav>` : '';
  const title = lib.str(props.title);
  const subtitle = lib.str(props.subtitle);
  const heading = `<div class="wf-ph-text"><h1 class="wf-ph-title">${
    title ? lib.bound(title, ctx) : lib.renderSkeleton(14)
  }</h1>${subtitle ? `<p class="wf-ph-sub">${lib.bound(subtitle, ctx)}</p>` : ''}</div>`;
  // An empty route table turns every routed action into a plain button.
  const actions = lib.actionButtons(props.actions, inert ? { ...ctx, routeTable: {} } : ctx);
  const tabs = entries(props.tabs, lib.itemProfiles.tabs, lib);
  const on = itemsOn(tabs, lib);
  const tabMarkup = tabs.length > 0
    ? `<div class="wf-tab-bar wf-ph-tabs" data-wf-frame="edge">${tabs.map((tab, index) => {
      const label = lib.str(tab.label);
      const body = label ? lib.escapeHtml(label) : lib.renderSkeleton(6);
      const state = { current: on[index], disabled: tab.disabled === true };
      return itemLink(tab, `wf-tab${on[index] ? ' wf-tab-on' : ''}`, body, ctx, lib, { inert, state, owner: lib.STATE_OWNERS.link });
    }).join('')}</div>`
    : '';
  return {
    tag: 'header',
    inner: `${crumbMarkup}<div class="wf-ph-main">${heading}${actions}</div>${tabMarkup}`,
  };
}

function renderActionSheet(node, ctx, lib) {
  const props = node.props || {};
  const title = lib.str(props.title);
  const head = title ? `<div class="wf-sheet-title">${lib.bound(title, ctx)}</div>` : '';
  const rows = expandGroups(lib.normalizeItems(props.items, lib.itemProfiles.menu)).map((item) => {
    if (item.type === 'separator') return '<span class="wf-sheet-sep"></span>';
    if (item.type === 'heading') return `<div class="wf-sheet-heading">${lib.escapeHtml(lib.str(item.label))}</div>`;
    const label = lib.str(item.label);
    const glyph = lib.iconSpan(item.icon, { style: item.iconStyle });
    const danger = item.tone === 'danger' ? ' wf-sheet-danger' : '';
    const state = lib.stateAttrs({ disabled: item.disabled === true }, { owner: lib.STATE_OWNERS.button });
    return `<button class="wf-sheet-row${danger}"${state}>${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</button>`;
  }).join('');
  const cancel = props.cancel === false
    ? ''
    : `<button class="wf-sheet-row wf-sheet-cancel">${lib.escapeHtml(lib.str(props.cancel) || 'Cancel')}</button>`;
  return { inner: `<div class="wf-sheet-group">${head}${rows}</div>${cancel}` };
}

module.exports = {
  navigationRenderers: {
    action_sheet: renderActionSheet,
    tab_bar: renderTabBar,
    bottom_tab_bar: renderBottomTabBar,
    breadcrumb: renderBreadcrumb,
    pagination: renderPagination,
    stepper: renderStepper,
    app_bar: renderAppBar,
    page_header: renderPageHeader,
  },
};
