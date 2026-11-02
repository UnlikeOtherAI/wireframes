'use strict';

function hrefFor(route, ctx, lib) {
  const routeId = lib.str(route);
  if (!routeId || !lib.isObject(ctx.routeTable)) return null;
  const href = ctx.routeTable[routeId];
  return typeof href === 'string' && href.trim() !== '' ? { href: href.trim(), routeId } : null;
}

function linkOrSpan(target, className, inner, ctx, lib) {
  const nav = hrefFor(target, ctx, lib);
  return nav
    ? `<a class="${className}" ${lib.navigationAttrs(nav).join(' ')}>${inner}</a>`
    : `<span class="${className}">${inner}</span>`;
}

function tabItems(node, ctx, lib) {
  return lib.items(node.props?.tabs);
}

function renderTabBar(node, ctx, lib) {
  const tabs = tabItems(node, ctx, lib);
  if (tabs.length === 0) {
    // No tabs[] — the author supplied children; the shell renders them.
    return { inner: '', useChildren: true, className: `wf-tabs-${lib.toSafeClass(lib.str(node.props?.variant) || 'underline')}` };
  }
  const variant = lib.str(node.props?.variant) || 'underline';
  const markup = tabs.map((tab) => {
    const glyph = lib.iconSpan(tab.icon);
    const label = lib.str(tab.label);
    const body = `${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(6)}`;
    const active = tab.active === true ? ' wf-tab-on' : '';
    const badge = tab.badge != null ? `<span class="wf-tab-badge">${lib.escapeHtml(String(tab.badge))}</span>` : '';
    return linkOrSpan(tab.route, `wf-tab${active}`, `${body}${badge}`, ctx, lib);
  }).join('');
  return { inner: markup, className: `wf-tabs-${lib.toSafeClass(variant)}` };
}

function renderBottomTabBar(node, ctx, lib) {
  const tabs = tabItems(node, ctx, lib);
  if (tabs.length === 0) return { inner: '', useChildren: true };
  const markup = tabs.map((tab) => {
    const glyph = lib.icon(lib.str(tab.icon) || 'circle', { size: 'lg' });
    const label = lib.str(tab.label);
    const active = tab.active === true ? ' wf-tab-on' : '';
    const body = `<span class="wf-btab-glyph">${glyph}</span><span class="wf-btab-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(4)
    }</span>`;
    return linkOrSpan(tab.route, `wf-btab${active}`, body, ctx, lib);
  }).join('');
  return { inner: markup };
}

function renderBreadcrumb(node, ctx, lib) {
  const crumbs = lib.items(node.props?.items);
  const separator = lib.str(node.props?.separator) || '/';
  const markup = crumbs.map((crumb, index) => {
    const label = lib.str(crumb.label);
    const last = index === crumbs.length - 1;
    const body = label ? lib.escapeHtml(label) : lib.renderSkeleton(6);
    const item = last
      ? `<span class="wf-crumb wf-crumb-current">${body}</span>`
      : linkOrSpan(crumb.route, 'wf-crumb', body, ctx, lib);
    const sep = last ? '' : `<span class="wf-crumb-sep">${lib.escapeHtml(separator)}</span>`;
    return `${item}${sep}`;
  }).join('');
  return { tag: 'nav', inner: markup };
}

function renderPagination(node, ctx, lib) {
  const variant = lib.str(node.props?.variant) || 'numbers';
  const pages = Math.max(1, lib.num(node.props?.pages, 5));
  const page = Math.max(1, Math.min(pages, lib.num(node.props?.page, 1)));

  if (variant === 'dots') {
    const dots = Array.from({ length: pages }, (_, i) => (
      `<span class="wf-dot${i + 1 === page ? ' wf-dot-on' : ''}"></span>`
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
  const numbers = window.map((entry) => (
    entry === '…'
      ? '<span class="wf-page-gap">…</span>'
      : `<button class="wf-pagenum${entry === page ? ' wf-pagenum-on' : ''}">${entry}</button>`
  )).join('');
  return { tag: 'nav', inner: `${prev}${numbers}${next}`, className: 'wf-pagination-numbers' };
}

function renderStepper(node, ctx, lib) {
  const steps = lib.items(node.props?.steps);
  const current = Math.max(1, lib.num(node.props?.current, 1));
  const vertical = lib.str(node.props?.orientation) === 'stack';
  const markup = steps.map((step, index) => {
    const n = index + 1;
    const state = n < current ? 'done' : n === current ? 'on' : 'next';
    const marker = state === 'done' ? '✓' : String(n);
    const label = lib.str(step.label);
    const connector = index < steps.length - 1 ? '<span class="wf-step-line"></span>' : '';
    return `<span class="wf-step wf-step-${state}"><span class="wf-step-marker">${marker}</span><span class="wf-step-label">${
      label ? lib.escapeHtml(label) : lib.renderSkeleton(7)
    }</span>${connector}</span>`;
  }).join('');
  return { inner: markup, className: vertical ? 'wf-stepper-stack' : 'wf-stepper-row' };
}

function navItem(item, ctx, lib, depth = 0) {
  const label = lib.str(item.label);
  const glyph = lib.iconSpan(item.icon);
  const badge = item.badge != null ? `<span class="wf-nav-badge">${lib.escapeHtml(String(item.badge))}</span>` : '';
  const body = `${glyph}<span class="wf-nav-label">${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</span>${badge}`;
  // A shared sidebar cannot know which page it is on, so the renderer marks
  // the item pointing at the current route. `active: true` still wins.
  const onCurrentRoute = item.route != null && String(item.route) === ctx.currentRoute;
  const active = item.active === true || onCurrentRoute ? ' wf-nav-on' : '';
  const row = linkOrSpan(item.route, `wf-nav-item${active}${depth > 0 ? ' wf-nav-child' : ''}`, body, ctx, lib);
  const children = Array.isArray(item.children) && item.children.length > 0
    ? `<span class="wf-nav-children">${lib.items(item.children).map((child) => navItem(child, ctx, lib, depth + 1)).join('')}</span>`
    : '';
  return `${row}${children}`;
}

function renderNav(node, ctx, lib) {
  const entries = lib.items(node.props?.items);
  const collapsed = node.props?.collapsed === true;
  const markup = entries.map((entry) => {
    if (entry.group != null || entry.heading != null) {
      const heading = lib.str(entry.group || entry.heading);
      return `<span class="wf-nav-group">${lib.escapeHtml(heading)}</span>`;
    }
    return navItem(entry, ctx, lib);
  }).join('');
  return { tag: 'nav', inner: markup, className: collapsed ? 'wf-nav-collapsed' : '' };
}

function renderMenu(node, ctx, lib) {
  const entries = lib.items(node.props?.items);
  const markup = entries.map((entry) => {
    if (entry.divider === true) return '<span class="wf-menu-sep"></span>';
    const glyph = lib.iconSpan(entry.icon);
    const label = lib.str(entry.label);
    const shortcut = lib.str(entry.shortcut);
    const body = `${glyph}<span class="wf-menu-label">${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</span>${
      shortcut ? `<span class="wf-menu-shortcut">${lib.escapeHtml(shortcut)}</span>` : ''
    }`;
    return linkOrSpan(entry.route, `wf-menu-item${entry.danger === true ? ' wf-menu-danger' : ''}`, body, ctx, lib);
  }).join('');
  return { inner: markup };
}

function renderAppBar(node, ctx, lib) {
  const props = node.props || {};
  const leading = lib.str(props.leading)
    ? `<span class="wf-appbar-leading">${lib.icon(props.leading, { size: 'lg' })}</span>`
    : '';
  const title = lib.str(props.title);
  const subtitle = lib.str(props.subtitle);
  const centre = `<span class="wf-appbar-title">${
    title ? lib.bound(title, ctx) : lib.renderSkeleton(10)
  }${subtitle ? `<span class="wf-appbar-sub">${lib.bound(subtitle, ctx)}</span>` : ''}</span>`;
  const actions = lib.items(props.actions).map((action) => (
    `<span class="wf-appbar-action">${lib.icon(lib.str(action.icon) || lib.str(action.label) || 'ellipsis', { size: 'lg' })}</span>`
  )).join('');
  return { tag: 'header', inner: `${leading}${centre}<span class="wf-appbar-actions">${actions}</span>` };
}

function renderPageHeader(node, ctx, lib) {
  const props = node.props || {};
  const crumbs = lib.items(props.breadcrumb);
  const crumbMarkup = crumbs.length > 0
    ? `<nav class="wf-breadcrumb wf-ph-crumbs">${crumbs.map((crumb, index) => {
      const label = lib.str(crumb.label);
      const last = index === crumbs.length - 1;
      const body = label ? lib.escapeHtml(label) : lib.renderSkeleton(6);
      return `${last ? `<span class="wf-crumb wf-crumb-current">${body}</span>` : linkOrSpan(crumb.route, 'wf-crumb', body, ctx, lib)}${
        last ? '' : '<span class="wf-crumb-sep">/</span>'
      }`;
    }).join('')}</nav>`
    : '';
  const title = lib.str(props.title);
  const subtitle = lib.str(props.subtitle);
  const heading = `<div class="wf-ph-text"><h1 class="wf-ph-title">${
    title ? lib.bound(title, ctx) : lib.renderSkeleton(14)
  }</h1>${subtitle ? `<p class="wf-ph-sub">${lib.bound(subtitle, ctx)}</p>` : ''}</div>`;
  const actions = lib.actionButtons(props.actions, ctx);
  const tabs = lib.items(props.tabs);
  const tabMarkup = tabs.length > 0
    ? `<div class="wf-tab-bar wf-ph-tabs" data-wf-frame="edge">${tabs.map((tab) => {
      const label = lib.str(tab.label);
      const body = label ? lib.escapeHtml(label) : lib.renderSkeleton(6);
      return linkOrSpan(tab.route, `wf-tab${tab.active === true ? ' wf-tab-on' : ''}`, body, ctx, lib);
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
  const rows = lib.items(props.items).map((item) => {
    const label = lib.str(item.label);
    const glyph = lib.iconSpan(item.icon);
    const danger = item.danger === true ? ' wf-sheet-danger' : '';
    return `<button class="wf-sheet-row${danger}">${glyph}${label ? lib.escapeHtml(label) : lib.renderSkeleton(8)}</button>`;
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
    nav: renderNav,
    menu: renderMenu,
    app_bar: renderAppBar,
    page_header: renderPageHeader,
  },
};
