'use strict';

// Navigation chrome in tight places: a standalone sidebar never overflows a
// narrow slot or grid track, a narrow menu row keeps its parts inside it, and
// an adaptive phone sidebar faces the content in either region order.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject, ROUTE_TABLE } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const items = [{ label: 'Overview', route: 'home' }, { label: 'Reports', route: 'docs' }];
const sidebar = (id, extra = {}) => ({ id, component: 'nav', props: { variant: 'sidebar', items }, ...extra });
const MENU_ITEMS = [{ label: 'Rename', icon: 'pen', shortcut: 'Ctrl+Shift+Alt+F12' }, { label: 'Duplicate', icon: 'copy' }];
const CONTENT = [
  { id: 'narrow', component: 'stack', size: { width: 120 }, children: [sidebar('narrow_nav')] },
  { id: 'tracks', component: 'grid', props: { columns: 8 }, children: [sidebar('track_nav'), { id: 'track_two', component: 'text', props: { text: 'Two' } }] },
  { id: 'wide', component: 'stack', children: [sidebar('authored_nav', { size: { width: 300 } })] },
  { id: 'menu_box', component: 'stack', size: { width: 120 }, children: [{ id: 'narrow_menu', component: 'menu', props: { items: MENU_ITEMS } }] },
  { id: 'roomy_box', component: 'stack', size: { width: 400 }, children: [{ id: 'roomy_menu', component: 'menu', props: { items: MENU_ITEMS } }] },
];

const fits = (page, id) => page.locator(`#${id}`).evaluate((el) => {
  const box = el.getBoundingClientRect();
  const parent = el.parentElement.closest('.wf-node').getBoundingClientRect();
  return { width: box.width, parent: parent.width, right: box.right, parentRight: parent.right };
});

// Every descendant of every menu row, against the row's own box.
const rowParts = (page, id) => page.locator(`#${id} .wf-menu-item`).evaluateAll((rows) => rows.map((row) => {
  const box = row.getBoundingClientRect();
  const parts = [...row.querySelectorAll('*')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
  const part = (selector) => row.querySelector(selector);
  const shortcut = part('.wf-menu-shortcut');
  return {
    inside: parts.every((r) => r.left >= box.left - 0.5 && r.right <= box.right + 0.5),
    scroll: row.scrollWidth - row.clientWidth,
    icon: part('.wf-icon-glyph') ? part('.wf-icon-glyph').getBoundingClientRect().width : null,
    label: { width: part('.wf-menu-label').clientWidth, full: part('.wf-menu-label').scrollWidth },
    shortcut: shortcut ? { width: shortcut.clientWidth, full: shortcut.scrollWidth, overflow: getComputedStyle(shortcut).textOverflow } : null,
  };
}));

for (const engine of engines()) {
  test(`a standalone sidebar fits a narrow slot and grid track and keeps an authored width in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(CONTENT, { mode, routes: ['docs', 'settings'] }), 'home', { deviceChrome: false, routeTable: ROUTE_TABLE });
        assert.equal(result.ok, true, result.error);
        const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;
        for (const id of ['narrow_nav', 'track_nav']) {
          const m = await fits(page, id);
          assert.ok(m.width <= m.parent + 0.5 && m.right <= m.parentRight + 0.5, `${label}: ${id} ${m.width}px fits its ${m.parent}px container`);
        }
        assert.equal(Math.round((await fits(page, 'authored_nav')).width), 300, `${label}: an authored width is kept`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${label}: no page overflow`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  test(`a narrow menu row shrinks its label, then its shortcut, and keeps its icons in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, options] of [['web', {}], ['adaptive phone', { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }]]) {
          const result = renderPage(polishProject(CONTENT, { mode, routes: ['docs', 'settings'] }), 'home', { deviceChrome: false, routeTable: ROUTE_TABLE, ...options });
          const page = await browser.newPage({ viewport: { width: name === 'web' ? 1280 : 390, height: 1200 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${name}`;
          const [narrow] = await rowParts(page, 'narrow_menu');
          assert.equal(narrow.inside, true, `${label}: every part of the narrow row stays inside it`);
          assert.ok(narrow.scroll <= 0, `${label}: the narrow row does not overflow (${narrow.scroll}px)`);
          assert.equal(Math.round(narrow.icon), 16, `${label}: the icon keeps its size`);
          assert.ok(narrow.label.width < narrow.label.full, `${label}: the label shrank first`);
          assert.equal(narrow.shortcut.overflow, 'ellipsis', `${label}: the shortcut truncates with an ellipsis`);
          assert.ok(narrow.shortcut.width < narrow.shortcut.full, `${label}: the shortcut gave way once the label had`);
          const [roomy] = await rowParts(page, 'roomy_menu');
          assert.ok(roomy.label.width >= roomy.label.full && roomy.shortcut.width >= roomy.shortcut.full, `${label}: with room nothing truncates`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`an adaptive phone sidebar slot faces the content before and after main in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      const side = { id: 'side', kind: 'slot', role: 'sidebar', layout: { type: 'stack', padding: 0 } };
      const main = { id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } };
      for (const mode of ['card', 'line']) {
        for (const [order, regions, expected] of [['before', [side, main], [0, 1]], ['after', [main, side], [1, 0]]]) {
          const map = polishProject([{ id: 'title', component: 'heading', props: { text: 'Main' } }], { mode, regions, routes: ['docs', 'settings'] });
          map.pages.get('home').page.slots.push({ slotId: 'side', content: [sidebar('side_nav')] });
          const result = renderPage(map, 'home', { deviceChrome: false, routeTable: ROUTE_TABLE, adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } });
          const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
          await page.setContent(result.html);
          const edge = await page.locator('#side').evaluate((el) => {
            const s = getComputedStyle(el);
            const width = (name) => (s[`border${name}Style`] === 'none' ? 0 : parseFloat(s[`border${name}Width`]));
            return [width('Top'), width('Bottom'), width('Left'), width('Right')];
          });
          assert.deepEqual(edge, [...expected, 0, 0], `${engine.name} ${mode}: a sidebar ${order} main draws its rule facing the content`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
