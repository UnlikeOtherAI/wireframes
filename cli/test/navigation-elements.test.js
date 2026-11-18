'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const playwright = require('playwright');

const { renderNode } = require('../../engine/renderer/primitives');
const { getPrimitive } = require('../../engine/schema/primitive-registry');
const { shortcutKeys } = require('../../engine/renderer/primitives/navigation-items');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');

const routeTable = { home: 'home.html', settings: 'settings.html', docs: 'docs.html' };

function render(node, options = {}) {
  return renderNode(node, { routeTable, routeId: 'settings', ...options });
}

function count(html, pattern) {
  return (html.match(pattern) || []).length;
}

test('shortcut keys split into chips', () => {
  assert.deepEqual(shortcutKeys('⌘K'), ['⌘', 'K']);
  assert.deepEqual(shortcutKeys('⌘⇧P'), ['⌘', '⇧', 'P']);
  assert.deepEqual(shortcutKeys('Ctrl+Shift+P'), ['Ctrl', 'Shift', 'P']);
  assert.deepEqual(shortcutKeys('G D'), ['G', 'D']);
  assert.deepEqual(shortcutKeys('⌘+'), ['⌘', '+']);
  assert.deepEqual(shortcutKeys('Ctrl++'), ['Ctrl', '+']);
  assert.deepEqual(shortcutKeys(['⌘', 'Enter', '']), ['⌘', 'Enter']);
  assert.deepEqual(shortcutKeys('esc'), ['esc']);
  assert.deepEqual(shortcutKeys(undefined), []);
  assert.deepEqual(shortcutKeys(true), []);
});

test('command draws a search row, grouped rows, states, chips and a footer', () => {
  const html = render({ id: 'cmd', component: 'command', props: {
    placeholder: 'Search',
    footer: true,
    items: [
      { type: 'group', label: 'Suggestions', items: [
        { label: 'New', icon: 'plus', shortcut: '⌘N', selected: true },
        { label: 'Docs', description: 'Read the guide', route: 'docs', current: true },
        { label: 'Off', route: 'home', disabled: true },
      ] },
      { type: 'separator' },
      { type: 'heading', label: 'More' },
      'Loose',
    ],
  } });
  assert.match(html, /^<div id="cmd" class="wf-node wf-command[^"]*"/);
  assert.match(html, /<div class="wf-command-search"><span class="wf-ico">.*fa-magnifying-glass.*<\/span><span class="wf-command-placeholder">Search<\/span><\/div>/);
  assert.match(html, /<div class="wf-command-group"><div class="wf-command-heading">Suggestions<\/div><ul class="wf-command-items"><li>/);
  assert.match(html, /<li><span class="wf-command-item" data-wf-selected>.*<span class="wf-command-label">New<\/span><\/span><span class="wf-keys"><kbd class="wf-kbd">⌘<\/kbd><kbd class="wf-kbd">N<\/kbd><\/span><\/span><\/li>/);
  assert.match(html, /<a class="wf-command-item" href="docs.html" data-wf-route-target="docs" aria-current="true" data-wf-current><span class="wf-command-text"><span class="wf-command-label">Docs<\/span><span class="wf-command-desc">Read the guide<\/span>/);
  assert.match(html, /<span class="wf-command-item" aria-disabled="true" data-wf-disabled>/);
  assert.match(html, /<div class="wf-command-sep"><\/div><div class="wf-command-heading">More<\/div><ul class="wf-command-items"><li><span class="wf-command-item">/);
  assert.equal(count(html, /<kbd class="wf-kbd">/g), 2 + 4, 'row chips plus the footer hints');
  assert.match(html, /<div class="wf-command-footer"><span class="wf-command-hint"><span class="wf-keys"><kbd class="wf-kbd">↑<\/kbd><kbd class="wf-kbd">↓<\/kbd><\/span>Navigate<\/span>/);
  assert.doesNotMatch(html, /role=|aria-selected|aria-pressed/, 'display-only: no listbox or option roles');
});

test('command shows the query, and the empty text when there are no rows', () => {
  const empty = render({ id: 'c', component: 'command', props: { query: 'forecast', empty: 'Nothing here.' } });
  assert.match(empty, /<span class="wf-command-query">forecast<\/span>/);
  assert.match(empty, /<div class="wf-command-empty">Nothing here.<\/div>/);
  assert.doesNotMatch(empty, /wf-command-list|wf-command-footer|wf-command-placeholder/);
  const fallback = render({ id: 'c', component: 'command', props: { items: [{ type: 'separator' }] } });
  assert.match(fallback, /<span class="wf-command-placeholder"><span class="wf-bar"[^>]*><\/span><\/span>/);
  assert.match(fallback, /<div class="wf-command-empty">No results found.<\/div>/);
  // The shorthand sets the placeholder.
  const doc = yaml.load('- command: Run a command');
  assert.deepEqual(Object.keys(doc[0]), ['command']);
  assert.equal(Object.entries(getPrimitive('command').props).find(([, spec]) => spec.primary)[0], 'placeholder');
});

test('menubar opens the named menu below its trigger, display-only', () => {
  const items = [
    { label: 'File', items: ['New'] },
    { label: 'Edit', value: 'edit', items: [
      { label: 'Undo', shortcut: '⌘Z' },
      { label: 'Redo', disabled: true },
      { type: 'separator' },
      { type: 'group', label: 'Clipboard', items: [{ label: 'Copy', selected: true, route: 'home' }] },
      { label: 'Find', items: ['Find…'] },
    ] },
    { label: 'Window', disabled: true, items: ['Minimise'] },
    'Help',
  ];
  const html = render({ id: 'mb', component: 'menubar', props: { open: 'edit', items } });
  assert.match(html, /^<div id="mb" class="wf-node wf-menubar" data-wf-frame="content"/);
  assert.match(html, /<div class="wf-menubar-menu"><button type="button" class="wf-menubar-trigger" aria-expanded="false">File<\/button><\/div>/);
  assert.match(html, /<button type="button" class="wf-menubar-trigger" aria-expanded="true" data-wf-expanded>Edit<\/button><div class="wf-menubar-panel wf-menu">/);
  assert.match(html, /<button type="button" class="wf-menubar-trigger" aria-disabled="true" aria-expanded="false" data-wf-disabled>Window<\/button>/);
  assert.match(html, /<button type="button" class="wf-menubar-trigger">Help<\/button>/, 'a menu without items is a plain trigger');
  assert.equal(count(html, /wf-menubar-panel/g), 1);
  assert.match(html, /<span class="wf-menu-label">Undo<\/span><span class="wf-keys"><kbd class="wf-kbd">⌘<\/kbd><kbd class="wf-kbd">Z<\/kbd><\/span>/);
  assert.match(html, /<span class="wf-menu-item" aria-disabled="true" data-wf-disabled><span class="wf-menu-label">Redo/);
  assert.match(html, /<span class="wf-menu-sep"><\/span><span class="wf-menu-heading">Clipboard<\/span><span class="wf-menu-item" data-wf-selected>/);
  assert.match(html, /<span class="wf-menu-label">Find<\/span><span class="wf-menu-sub">.*fa-chevron-right/);
  assert.doesNotMatch(html, /href=|role=/, 'menubar rows never link and carry no menu roles');

  // By label, and the first `expanded: true` when `open` names nothing.
  assert.match(render({ id: 'mb', component: 'menubar', props: { open: 'File', items } }), /aria-expanded="true" data-wf-expanded>File/);
  const expanded = render({ id: 'mb', component: 'menubar', props: { open: 'Nope', items: [{ label: 'A', items: ['x'] }, { label: 'B', expanded: true, items: ['y'] }] } });
  assert.match(expanded, /aria-expanded="true" data-wf-expanded>B/);
  assert.equal(count(render({ id: 'mb', component: 'menubar', props: { open: 'Help', items } }), /wf-menubar-panel/g), 0);
});

test('nav variant top: links, disclosure triggers and the open panel', () => {
  const html = render({ id: 'top', component: 'nav', props: {
    variant: 'top',
    open: 'Products',
    items: [
      { label: 'Products', route: 'home', items: [
        { label: 'Analytics', icon: 'chart-line', description: 'Dashboards', route: 'home' },
        { type: 'separator' },
        { label: 'Settings', route: 'settings' },
        { type: 'group', label: 'Labs', items: [{ label: 'Beta', disabled: true, route: 'docs' }] },
      ] },
      { type: 'group', label: 'Solutions', items: ['Startups'] },
      { label: 'Docs', route: 'docs' },
      { type: 'separator' },
    ],
  } });
  assert.match(html, /^<nav id="top" class="wf-node wf-nav wf-nav-top"/);
  assert.match(html, /<div class="wf-nav-menu"><button type="button" class="wf-nav-item wf-nav-trigger" aria-expanded="true" data-wf-expanded><span class="wf-nav-label">Products<\/span><span class="wf-nav-chevron">.*fa-chevron-down/);
  assert.match(html, /<button type="button" class="wf-nav-item wf-nav-trigger" aria-expanded="false"><span class="wf-nav-label">Solutions/, 'a group is a trigger too');
  assert.equal(count(html, /<div class="wf-nav-panel">/g), 1);
  assert.match(html, /<a class="wf-nav-link" href="home.html" data-wf-route-target="home"><span class="wf-nav-link-icon">.*fa-chart-line.*<\/span><span class="wf-nav-link-text"><span class="wf-nav-link-label">Analytics<\/span><span class="wf-nav-link-desc">Dashboards<\/span><\/span><\/a>/);
  // Route inference reaches panel links.
  assert.match(html, /<a class="wf-nav-link wf-nav-on" href="settings.html" data-wf-route-target="settings" aria-current="page" data-wf-current>/);
  assert.match(html, /<span class="wf-nav-panel-sep"><\/span>/);
  assert.match(html, /<span class="wf-nav-panel-heading">Labs<\/span><span class="wf-nav-link" aria-disabled="true" data-wf-disabled>/);
  assert.match(html, /<\/div><a class="wf-nav-item" href="docs.html" data-wf-route-target="docs"><span class="wf-nav-label">Docs<\/span><\/a><span class="wf-nav-sep"><\/span><\/nav>$/);
  assert.doesNotMatch(html, /<a [^>]*>(?:(?!<\/a>)[^])*<a /, 'no anchor inside an anchor');
  // Without `open`, nothing is drawn open.
  assert.doesNotMatch(render({ id: 't', component: 'nav', props: { variant: 'top', items: [{ label: 'P', items: ['x'] }] } }), /wf-nav-panel|data-wf-expanded/);
});

test('sidebar nav rows with an explicit expanded become disclosures', () => {
  const html = render({ id: 'n', component: 'nav', props: { items: [
    { label: 'Open', expanded: true, items: ['A'] },
    { label: 'Shut', expanded: false, items: ['B'] },
    { label: 'Plain', items: ['C'] },
  ] } });
  assert.match(html, /<span class="wf-nav-item" aria-expanded="true" data-wf-expanded><span class="wf-nav-label">Open<\/span><span class="wf-nav-chevron">.*fa-chevron-down/);
  assert.match(html, /<span class="wf-nav-item" aria-expanded="false"><span class="wf-nav-label">Shut<\/span><span class="wf-nav-chevron">.*fa-chevron-right/);
  assert.doesNotMatch(html, />B</, 'a collapsed row hides its children');
  assert.match(html, /<span class="wf-nav-item"><span class="wf-nav-label">Plain<\/span><\/span><span class="wf-nav-children">/);
});

test('every navigation registry example renders', () => {
  for (const name of ['command', 'menubar', 'nav', 'menu', 'tab_bar', 'breadcrumb', 'stepper', 'page_header', 'action_sheet']) {
    const [entry] = yaml.load(getPrimitive(name).example);
    const [component, props] = Object.entries(entry)[0];
    const html = render({ id: 'example', component, props: typeof props === 'object' ? props : {} });
    assert.match(html, new RegExp(`class="wf-node wf-${name}`), name);
  }
  const menubar = render({ id: 'm', component: 'menubar', props: { ...yaml.load(getPrimitive('menubar').example)[0].menubar, open: 'Edit' } });
  assert.match(menubar, /wf-menubar-panel/);
});

test('runtime tab changes keep data-wf-selected in step with aria-pressed', async () => {
  const markup = renderWireframeMarkup({
    roots: [{ id: 'main', kind: 'container', nodes: [
      { id: 'tabs', component: 'tab_bar', props: { tabs: [{ label: 'One', selected: true }, 'Two', { label: 'Three', disabled: true }] } },
    ] }],
    pageViewport: { device: 'web', width: 800, height: 600 },
    deviceChrome: false,
  });
  const browser = await launchChromium(playwright, { headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(markup);
    const states = () => page.$$eval('#tabs button', (buttons) => buttons.map((button) => [
      button.getAttribute('aria-pressed'), button.hasAttribute('data-wf-selected'),
    ]));
    assert.deepEqual(await states(), [['true', true], ['false', false], ['false', false]]);
    await page.getByRole('button', { name: 'Two' }).click();
    assert.deepEqual(await states(), [['false', false], ['true', true], ['false', false]]);
    await page.getByRole('button', { name: 'Three' }).click({ force: true });
    assert.deepEqual(await states(), [['false', false], ['true', true], ['false', false]], 'a disabled tab never selects');
  } finally {
    await browser.close();
  }
});
