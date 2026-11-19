'use strict';

// Each navigation kind is recognisable at the top level; a role: sidebar slot
// draws the sidebar panel; nothing double-frames or overflows, in normal and
// adaptive mode (render polish items 6 and 7).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject, ROUTE_TABLE } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const items = [{ label: 'Home', route: 'home' }, { label: 'Docs', route: 'docs' }, { label: 'Settings', route: 'settings' }];
const KINDS = [
  { id: 'sidebar', component: 'nav', props: { variant: 'sidebar', items } },
  { id: 'rail', component: 'nav', props: { variant: 'rail', items } },
  { id: 'plain', component: 'nav', props: { items } },
  { id: 'menu', component: 'menu', props: { items: [...items, { label: 'A very long menu label that cannot fit', shortcut: 'Ctrl+K' }] } },
  { id: 'narrow', component: 'stack', size: { width: 120 }, children: [{ id: 'narrow_menu', component: 'menu', props: { items: ['Rename', 'Duplicate'] } }] },
  { id: 'top', component: 'nav', props: { variant: 'top', items } },
  { id: 'bar', component: 'menubar', props: { items } },
  { id: 'card', component: 'card', props: { title: 'Inside a card' }, children: [
    { id: 'card_nav', component: 'nav', props: { variant: 'sidebar', items } },
    { id: 'card_menu', component: 'menu', props: { items } },
  ] },
  { id: 'shell', component: 'row', layout: { type: 'row', gap: 0, align: 'stretch' }, children: [
    { id: 'row_nav', component: 'nav', props: { variant: 'sidebar', items } },
    { id: 'row_main', component: 'stack', children: [{ id: 'row_title', component: 'heading', props: { text: 'Content' } }] },
  ] },
];

const edges = (page, id) => page.locator(`#${id}`).evaluate((el) => {
  const s = getComputedStyle(el);
  const side = (name) => (s[`border${name}Style`] === 'none' ? 0 : parseFloat(s[`border${name}Width`]));
  return { top: side('Top'), right: side('Right'), bottom: side('Bottom'), left: side('Left'), shadow: s.boxShadow, outline: s.outlineStyle, width: el.getBoundingClientRect().width };
});
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const engine of engines()) {
  test(`navigation kinds are distinct at the top level and plain inside a frame in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(KINDS, { mode, routes: ['docs', 'settings'] }), 'home', { deviceChrome: false, routeTable: ROUTE_TABLE });
        assert.equal(result.ok, true, result.error);
        const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;
        const sidebar = await edges(page, 'sidebar');
        assert.deepEqual([sidebar.top, sidebar.right, sidebar.bottom, sidebar.left], [0, 1, 0, 0], `${label}: sidebar has one edge`);
        assert.equal(Math.round(sidebar.width), 256, `${label}: sidebar panel width`);
        const rail = await edges(page, 'rail');
        assert.equal(rail.right, 1);
        assert.ok(rail.width <= 64.5, `${label}: rail is a narrow strip`);
        const top = await edges(page, 'top');
        assert.deepEqual([top.top, top.bottom], [0, 1], `${label}: top nav is a bar with a bottom rule`);
        const bar = await edges(page, 'bar');
        assert.deepEqual([bar.top, bar.bottom], [1, 1], `${label}: menubar is ruled above and below`);
        assert.ok(bar.width > 1000 && top.width > 1000, `${label}: bars run across the width`);
        const plain = await edges(page, 'plain');
        assert.deepEqual([plain.top, plain.right, plain.bottom, plain.left], [0, 0, 0, 0], `${label}: a nav without a variant is unchanged`);
        // The inline menu is the dropdown panel: a box, a shadow in card mode, sized to its items.
        const menu = await edges(page, 'menu');
        assert.ok(menu.top >= 1 && menu.left >= 1, `${label}: the menu has a box`);
        if (mode === 'card') assert.match(menu.shadow, /30px/);
        assert.ok(menu.width < 400, `${label}: menu fits its items, not the page (${menu.width})`);
        const narrow = await page.locator('#narrow_menu').evaluate((el) => ({
          width: el.getBoundingClientRect().width, parent: document.getElementById('narrow').getBoundingClientRect().width,
        }));
        assert.ok(narrow.width <= narrow.parent + 0.5, `${label}: a menu never overflows a narrow container`);
        // Inside a card neither draws chrome.
        for (const id of ['card_nav', 'card_menu']) {
          const inner = await edges(page, id);
          assert.deepEqual([inner.top, inner.right, inner.bottom, inner.left, inner.shadow], [0, 0, 0, 0, 'none'], `${label}: ${id}`);
        }
        // Placeholders are decorative; links keep their label as their name.
        assert.equal(await page.locator('#rail').getByRole('link', { name: 'Docs', exact: true }).count(), 1);
        assert.equal(await page.locator('#rail .wf-ico-placeholder').first().getAttribute('aria-hidden'), 'true');
        assert.ok(await overflow(page) <= 0, `${label}: no horizontal overflow`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  test(`a role: sidebar slot draws a sidebar panel, normal and adaptive, in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      const regions = [
        { id: 'side', kind: 'slot', role: 'sidebar', layout: { type: 'stack', padding: 0 } },
        { id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } },
      ];
      const cases = [
        { name: 'web', options: {}, width: 1280 },
        { name: 'adaptive tablet', options: { adaptive: true, viewportOverride: { device: 'tablet', orientation: 'portrait' } }, width: 820 },
        { name: 'adaptive phone', options: { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }, width: 390, phone: true },
      ];
      for (const mode of ['card', 'line']) {
        for (const c of cases) {
          const map = polishProject(KINDS.slice(5, 7), { mode, regions, routes: ['docs', 'settings'] });
          map.pages.get('home').page.slots.push({ slotId: 'side', content: [{ id: 'side_nav', component: 'nav', props: { variant: 'sidebar', items } }] });
          const result = renderPage(map, 'home', { deviceChrome: false, routeTable: ROUTE_TABLE, ...c.options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width: c.width, height: 900 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${c.name}`;
          const side = await edges(page, 'side');
          if (c.phone) assert.deepEqual([side.right, side.bottom], [0, 1], `${label}: across the top, ruled below`);
          else assert.deepEqual([side.top, side.right, side.bottom, side.left], [0, 1, 0, 0], `${label}: one edge facing the content`);
          const fill = await page.locator('#side').evaluate((el) => getComputedStyle(el).backgroundColor);
          assert.equal(fill, mode === 'card' ? 'rgb(255, 255, 255)' : 'rgba(0, 0, 0, 0)', `${label}: panel fill`);
          const inset = await page.locator('#side').evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
          assert.ok(inset >= 12, `${label}: comfortable padding (${inset})`);
          const inner = await edges(page, 'side_nav');
          assert.deepEqual([inner.top, inner.right, inner.bottom, inner.left], [0, 0, 0, 0], `${label}: the nav adds no second frame`);
          assert.equal(await page.locator('#side_nav').getByRole('link', { name: 'Home', exact: true }).getAttribute('aria-current'), 'page');
          assert.ok(await overflow(page) <= 0, `${label}: no horizontal overflow`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`a standalone sidebar or rail reflows on an adaptive phone in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(KINDS, { mode, routes: ['docs', 'settings'] }), 'home', {
          deviceChrome: false, routeTable: ROUTE_TABLE, adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' },
        });
        const page = await browser.newPage({ viewport: { width: 390, height: 1400 } });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;
        for (const id of ['sidebar', 'rail', 'row_nav']) {
          const nav = await edges(page, id);
          assert.deepEqual([nav.right, nav.bottom], [0, 1], `${label}: ${id} reflows to a ruled row`);
          assert.ok(nav.width <= 390, `${label}: ${id} fits the phone`);
        }
        assert.ok(await overflow(page) <= 0, `${label}: no horizontal overflow`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
