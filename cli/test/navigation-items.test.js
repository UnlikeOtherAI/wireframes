'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('../../engine/renderer/primitives');
const { getPrimitive, itemProps, frameClass } = require('../../engine/schema/primitive-registry');
const legacy = require('./fixtures/navigation-legacy.json');

// `navigation-legacy.json` holds the markup the navigation renderers produced
// at 8872d67, before the item model, for every legacy item form. Rendering the
// same nodes now may only add the state attributes legacy items can reach.
const LEGACY_STATE = / (?:aria-current="(?:page|location|step)"|data-wf-current|data-wf-selected)(?=[ >])/g;
const routeTable = { home: 'home.html', settings: 'settings.html', reports: 'reports.html' };

function render(node, options = {}) {
  return renderNode(node, { routeTable, routeId: 'settings', ...options });
}

// The element's own markup, without the shell's opening tag.
function inner(html) {
  return html.slice(html.indexOf('>') + 1);
}

function tag(html, text) {
  const end = html.indexOf(`>${text}<`);
  assert.ok(end > 0, `no element with text ${text}`);
  return html.slice(html.lastIndexOf('<', end), end + 1);
}

for (const { name, node, html } of legacy.cases) {
  test(`legacy ${name}: only state attributes are added`, () => {
    const now = renderNode(node, { routeTable: legacy.routeTable, routeId: legacy.routeId });
    assert.equal(now.replace(LEGACY_STATE, ''), html);
  });
}

test('legacy on states gain their ARIA owner', () => {
  const [tabs, , , , bottom, crumbs, , pages, , steps, , nav] = legacy.cases.map(({ node }) => render(node));
  assert.match(tabs, /aria-pressed="false"/);
  assert.match(render(legacy.cases[1].node), /class="wf-tab wf-tab-on"[^>]*aria-pressed="true" data-wf-selected>/);
  assert.match(bottom, /<a class="wf-btab wf-tab-on" href="home.html" data-wf-route-target="home" aria-current="page" data-wf-current>/);
  assert.match(crumbs, /<span class="wf-crumb wf-crumb-current" aria-current="location" data-wf-current>Last<\/span>/);
  assert.match(pages, /<button class="wf-pagenum wf-pagenum-on" aria-current="page" data-wf-current>4<\/button>/);
  assert.match(steps, /<span class="wf-step wf-step-on" aria-current="step" data-wf-current>/);
  // Legacy nav: `active: true` adds to route inference, as it always did.
  assert.match(nav, /<a class="wf-nav-item wf-nav-on" href="home.html"[^>]*aria-current="page" data-wf-current>/);
  assert.match(nav, /<a class="wf-nav-item wf-nav-on" href="settings.html"[^>]*aria-current="page" data-wf-current>/);
  assert.equal((nav.match(/aria-current/g) || []).length, 3);
  const inactive = render({ id: 'n', component: 'nav', props: { items: [{ label: 'Settings', route: 'settings', active: false }] } });
  assert.match(inactive, /wf-nav-on/, 'legacy active: false never hid the current route');
  assert.doesNotMatch(legacy.cases.map(({ node }) => render(node)).join(''), /data-wf-(?:disabled|expanded)|aria-(?:disabled|expanded)/);
});

test('navigation item props are marked items: true; app-bar actions stay glyph data', () => {
  assert.deepEqual(itemProps('tab_bar'), ['tabs']);
  assert.deepEqual(itemProps('bottom_tab_bar'), ['tabs']);
  assert.deepEqual(itemProps('breadcrumb'), ['items']);
  assert.deepEqual(itemProps('stepper'), ['steps']);
  assert.deepEqual(itemProps('nav'), ['items']);
  assert.deepEqual(itemProps('menu'), ['items']);
  assert.deepEqual(itemProps('action_sheet'), ['items']);
  assert.deepEqual(itemProps('page_header'), ['breadcrumb', 'actions', 'tabs']);
  assert.deepEqual(itemProps('command'), ['items']);
  assert.deepEqual(itemProps('menubar'), ['items']);
  assert.deepEqual(itemProps('app_bar'), []);
  assert.deepEqual(getPrimitive('nav').props.variant.enum, ['rail', 'sidebar', 'top']);
  assert.equal(frameClass('command'), 'C');
  assert.equal(frameClass('menubar'), 'N');
});

test('canonical-only items render in every navigation consumer', () => {
  const tabs = render({ id: 't', component: 'tab_bar', props: { tabs: [{ label: 'A' }, { label: 'B', selected: true }, { type: 'separator' }] } });
  assert.match(tag(tabs, 'B'), /class="wf-tab wf-tab-on"[^>]*aria-pressed="true" data-wf-selected/);
  assert.equal((tabs.match(/class="wf-tab/g) || []).length, 2, 'tab lists skip separators');

  const nav = render({ id: 'n', component: 'nav', props: { items: [
    { type: 'heading', label: 'Workspace' },
    { label: 'Reports', items: [{ label: 'Weekly', route: 'reports' }] },
    { type: 'separator' },
    { type: 'group', label: 'Account', items: [{ label: 'Profile' }] },
  ] } });
  assert.match(nav, /<span class="wf-nav-group">Workspace<\/span>/);
  assert.match(nav, /<span class="wf-nav-children"><a class="wf-nav-item wf-nav-child" href="reports.html"/);
  assert.match(nav, /<span class="wf-nav-sep"><\/span><span class="wf-nav-group">Account<\/span><span class="wf-nav-item">/);

  const menu = render({ id: 'm', component: 'menu', props: { items: [
    { type: 'group', label: 'File', items: ['Open'] }, { type: 'separator' }, { label: 'Delete', tone: 'danger' },
  ] } });
  assert.match(menu, /<span class="wf-menu-heading">File<\/span><span class="wf-menu-item">/);
  assert.match(menu, /<span class="wf-menu-sep"><\/span><span class="wf-menu-item wf-menu-danger">/);

  const crumbs = render({ id: 'c', component: 'breadcrumb', props: { items: [
    { label: 'Home', route: 'home' }, { label: 'Acme', current: true }, { label: 'Settings', route: 'settings' },
  ] } });
  assert.match(crumbs, /<span class="wf-crumb wf-crumb-current" aria-current="location" data-wf-current>Acme<\/span>/);
  assert.match(crumbs, /<a class="wf-crumb" href="settings.html" data-wf-route-target="settings">Settings<\/a>/, 'the last crumb links when another is current');

  const sheet = render({ id: 'a', component: 'action_sheet', props: { items: [
    { type: 'heading', label: 'Share' }, 'Copy', { type: 'separator' }, { label: 'Delete', tone: 'danger', disabled: true },
  ] } });
  assert.match(sheet, /<div class="wf-sheet-heading">Share<\/div><button class="wf-sheet-row">Copy<\/button><span class="wf-sheet-sep"><\/span>/);
  assert.match(sheet, /<button class="wf-sheet-row wf-sheet-danger" disabled data-wf-disabled>Delete<\/button>/);
  const divider = render({ id: 'a2', component: 'action_sheet', props: { items: ['Copy', { divider: true }, 'Mail'] } });
  assert.match(divider, /Copy<\/button><span class="wf-sheet-sep"><\/span><button/, 'a legacy divider is a separator, not a blank row');
});

test('selection: an explicit item state beats the element rule', () => {
  // `selected: false` beats route inference.
  const off = render({ id: 'n', component: 'nav', props: { items: [{ label: 'Settings', route: 'settings', selected: false }, { label: 'Again', route: 'settings' }] } });
  assert.doesNotMatch(off, /wf-nav-on[^>]*><span class="wf-nav-label">Settings/);
  assert.match(off, /<a class="wf-nav-item wf-nav-on" href="settings.html" data-wf-route-target="settings" aria-current="page" data-wf-current><span class="wf-nav-label">Again/);
  // A nested `selected: true` turns route inference off across the whole nav.
  const nested = render({ id: 'n2', component: 'nav', props: { items: [{ label: 'Settings', route: 'settings' }, { label: 'Reports', items: [{ label: 'Weekly', selected: true }] }] } });
  assert.equal((nested.match(/wf-nav-on/g) || []).length, 1);
  assert.match(nested, /<span class="wf-nav-item wf-nav-on wf-nav-child" aria-current="page" data-wf-current>/);
  // `current` stands in for an absent `selected`; `selected` wins when both are set.
  const current = render({ id: 'n3', component: 'nav', props: { items: [{ label: 'A', current: true }, { label: 'B', current: true, selected: false }, { label: 'C', route: 'settings' }] } });
  assert.equal((current.match(/wf-nav-on/g) || []).length, 1);
  assert.match(current, /<span class="wf-nav-item wf-nav-on" aria-current="page" data-wf-current><span class="wf-nav-label">A/);
  // Route inference skips disabled rows; an explicit state does not.
  const disabled = render({ id: 'n4', component: 'nav', props: { items: [{ label: 'Off', route: 'settings', disabled: true }, { label: 'Held', route: 'settings', disabled: true, active: true }] } });
  assert.match(disabled, /<span class="wf-nav-item" aria-disabled="true" data-wf-disabled><span class="wf-nav-label">Off/);
  assert.match(disabled, /<span class="wf-nav-item wf-nav-on" aria-disabled="true" aria-current="page" data-wf-disabled data-wf-current><span class="wf-nav-label">Held/);

  // Stepper: an explicit step moves `current`; earlier steps are done.
  const steps = render({ id: 's', component: 'stepper', props: { current: 1, steps: ['A', 'B', { label: 'C', selected: true }] } });
  assert.deepEqual(steps.match(/wf-step-(?:done|on|next)/g), ['wf-step-done', 'wf-step-done', 'wf-step-on']);
  const stepOff = render({ id: 's2', component: 'stepper', props: { current: 2, steps: ['A', { label: 'B', selected: false }, 'C'] } });
  assert.deepEqual(stepOff.match(/wf-step-(?:done|on|next)/g), ['wf-step-done', 'wf-step-next', 'wf-step-next']);
  assert.doesNotMatch(stepOff, /aria-current/);

  // Breadcrumb: `selected: false` on the last crumb leaves no crumb current.
  const crumbs = render({ id: 'c', component: 'breadcrumb', props: { items: ['A', { label: 'B', route: 'home', selected: false }] } });
  assert.doesNotMatch(crumbs, /wf-crumb-current|aria-current/);
  assert.match(crumbs, /<a class="wf-crumb" href="home.html"/);

  // Tabs: the legacy `active` key still wins over `selected` on one entry.
  const tabs = render({ id: 't', component: 'tab_bar', props: { tabs: [{ label: 'A', active: false, selected: true }, { label: 'B' }] } });
  assert.doesNotMatch(tabs, /wf-tab-on/);
});

test('a disabled routed item renders no link anywhere', () => {
  const item = { label: 'Off', route: 'home', disabled: true };
  const cases = [
    ['nav', { items: [item] }, 'wf-nav-item'],
    ['breadcrumb', { items: [item, 'Last'] }, 'wf-crumb'],
    ['tab_bar', { tabs: [item, 'B'] }, 'wf-tab'],
    ['bottom_tab_bar', { tabs: [item] }, 'wf-btab'],
    ['menu', { items: [item] }, 'wf-menu-item'],
    ['command', { items: [item] }, 'wf-command-item'],
    ['page_header', { title: 'T', breadcrumb: [item, 'Here'], tabs: [item] }, 'wf-crumb'],
    ['nav', { variant: 'top', open: 'P', items: [{ label: 'P', items: [item] }] }, 'wf-nav-link'],
  ];
  for (const [component, props, className] of cases) {
    const html = render({ id: 'x', component, props });
    assert.doesNotMatch(html, /href=/, `${component} links a disabled item`);
    assert.match(html, new RegExp(`<span class="${className}[^"]*" aria-disabled="true" data-wf-disabled>`), component);
  }
  const tabs = render({ id: 't', component: 'tab_bar', props: { tabs: [{ label: 'Off', disabled: true }, 'B'] } });
  assert.match(tabs, /<button type="button" class="wf-tab" data-wf-choice-value="&quot;Off&quot;" disabled aria-pressed="false" data-wf-disabled>Off<\/button>/);
  assert.match(render({ id: 'u', component: 'nav', props: { items: [{ label: 'Lost', route: 'nowhere' }] } }), /<span class="wf-nav-item"><span class="wf-nav-label">Lost/, 'an unknown route is plain text');
});

test('an element with its own interaction renders no item links', () => {
  const interaction = [{ type: 'navigation', targetRoute: 'reports' }];
  const routed = { label: 'Home', route: 'home' };
  const elements = [
    ['nav', { items: [routed, { label: 'P', items: [routed] }] }],
    ['nav', { variant: 'top', open: 'P', items: [routed, { label: 'P', items: [routed] }] }],
    ['breadcrumb', { items: [routed, 'Here'] }],
    ['tab_bar', { tabs: [routed, 'B'] }],
    ['bottom_tab_bar', { tabs: [routed] }],
    ['menu', { items: [routed] }],
    ['command', { items: [routed] }],
    ['page_header', { title: 'T', breadcrumb: [routed, 'Here'], tabs: [routed], actions: [routed] }],
  ];
  for (const [component, props] of elements) {
    const free = inner(render({ id: 'x', component, props }));
    assert.match(free, /<a /, `${component} links its items without an interaction`);
    const html = render({ id: 'x', component, props, interaction });
    assert.match(html.slice(0, html.indexOf('>')), /data-wf-interactions/);
    assert.doesNotMatch(inner(html), /<a |href=/, `${component} nests anchors under its interaction`);
  }
});
