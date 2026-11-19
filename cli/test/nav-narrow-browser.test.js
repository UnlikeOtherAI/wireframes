'use strict';

// Navigation chrome in tight places: a standalone sidebar never overflows a
// narrow slot or grid track, a narrow menu row keeps its parts inside it, and
// an adaptive phone sidebar faces the content in either region order.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');

const { renderPage } = require('../../engine/build');
const { polishProject, ROUTE_TABLE } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const items = [{ label: 'Overview', route: 'home' }, { label: 'Reports', route: 'docs' }];
const sidebar = (id, extra = {}) => ({ id, component: 'nav', props: { variant: 'sidebar', items }, ...extra });
const MENU_ITEMS = [{ label: 'Rename', icon: 'pen', shortcut: 'Ctrl+Shift+Alt+F12' }, { label: 'Duplicate', icon: 'copy' }];
const LONG_ITEMS = [{ label: 'Rename every file in this folder', icon: 'pen', shortcut: 'Ctrl+Shift+Alt+F12' }];
const menuIn = (id, width, items = MENU_ITEMS) => ({ id: `${id}_box`, component: 'stack', size: { width }, children: [{ id, component: 'menu', props: { items } }] });
const CONTENT = [
  { id: 'narrow', component: 'stack', size: { width: 120 }, children: [sidebar('narrow_nav')] },
  { id: 'tracks', component: 'grid', props: { columns: 8 }, children: [sidebar('track_nav'), { id: 'track_two', component: 'text', props: { text: 'Two' } }] },
  { id: 'wide', component: 'stack', children: [sidebar('authored_nav', { size: { width: 300 } })] },
  menuIn('narrow_menu', 120),
  menuIn('mid_menu', 180),
  menuIn('long_menu', 180, LONG_ITEMS),
  menuIn('roomy_menu', 400),
  // A shortcut narrower than two letters that fits is drawn whole.
  menuIn('short_menu', 180, [{ label: 'Rename', icon: 'pen', shortcut: '⌘R' }]),
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
    shortcut: shortcut ? {
      width: shortcut.clientWidth, full: shortcut.scrollWidth, overflow: getComputedStyle(shortcut).textOverflow,
      twoLetters: 2 * parseFloat(getComputedStyle(shortcut).fontSize),
    } : null,
  };
}));

// Drawn pixels between the label and the row's end, where the shortcut sits.
async function shortcutInk(page, id) {
  const clip = await page.locator(`#${id} .wf-menu-item`).first().evaluate((row) => {
    const r = row.getBoundingClientRect();
    const label = row.querySelector('.wf-menu-label').getBoundingClientRect();
    return { x: Math.ceil(label.right) + 1, y: Math.ceil(r.top) + 2, width: Math.floor(r.right) - Math.ceil(label.right) - 2, height: Math.floor(r.height) - 4 };
  });
  if (clip.width <= 0) return 0;
  const { data } = PNG.sync.read(await page.screenshot({ clip }));
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - data[0]) + Math.abs(data[i + 1] - data[1]) + Math.abs(data[i + 2] - data[2]) > 30) ink += 1;
  }
  return ink;
}

// Parts stay inside the row, the icon keeps its size, a cut shortcut ends in an
// ellipsis, and the label is cut only once the shortcut is gone.
function labelFirst(row, label) {
  assert.equal(row.inside, true, `${label}: every part of the row stays inside it`);
  assert.ok(row.scroll <= 0, `${label}: the row does not overflow (${row.scroll}px)`);
  assert.equal(Math.round(row.icon), 16, `${label}: the icon keeps its size`);
  assert.equal(row.shortcut.overflow, 'ellipsis', `${label}: a cut shortcut ends in an ellipsis`);
  if (row.label.width < row.label.full) assert.equal(row.shortcut.width, 0, `${label}: the label is cut only once the shortcut is gone`);
}

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

  test(`a narrow menu row gives up its shortcut before its label and keeps its icons in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, options] of [['web', {}], ['adaptive phone', { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }]]) {
          const result = renderPage(polishProject(CONTENT, { mode, routes: ['docs', 'settings'] }), 'home', { deviceChrome: false, routeTable: ROUTE_TABLE, ...options });
          const page = await browser.newPage({ viewport: { width: name === 'web' ? 1280 : 390, height: 1200 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${name}`;
          const [mid] = await rowParts(page, 'mid_menu');
          labelFirst(mid, `${label} 180px`);
          assert.ok(mid.label.width >= mid.label.full, `${label} 180px: "Rename" reads in full (${mid.label.width} of ${mid.label.full}px)`);
          assert.ok(mid.shortcut.width < mid.shortcut.full, `${label} 180px: the shortcut is the part that gave way`);
          assert.ok(await shortcutInk(page, 'mid_menu') > 0, `${label} 180px: the truncated shortcut is drawn`);
          const [narrow] = await rowParts(page, 'narrow_menu');
          labelFirst(narrow, `${label} 120px`);
          assert.ok(narrow.shortcut.width < mid.shortcut.width || narrow.shortcut.width === 0, `${label} 120px: less room leaves less shortcut`);
          // Too narrow for two letters, the shortcut draws nothing rather than a sliver.
          const narrowInk = await shortcutInk(page, 'narrow_menu');
          if (narrow.shortcut.width < narrow.shortcut.twoLetters) assert.equal(narrowInk, 0, `${label} 120px: a ${narrow.shortcut.width}px shortcut leaves no mark`);
          else assert.ok(narrowInk > 0, `${label} 120px: the truncated shortcut is drawn`);
          // Only with the shortcut gone does the label shorten, and never to nothing.
          const [long] = await rowParts(page, 'long_menu');
          assert.equal(long.inside && long.scroll <= 0, true, `${label} long label: the row keeps its parts inside it`);
          assert.equal(long.shortcut.width, 0, `${label} long label: the shortcut is hidden`);
          assert.equal(await shortcutInk(page, 'long_menu'), 0, `${label} long label: the hidden shortcut leaves no mark`);
          assert.ok(long.label.width < long.label.full && long.label.width > 20, `${label} long label: the label ends in an ellipsis (${long.label.width}px)`);
          assert.equal(Math.round(long.icon), 16, `${label} long label: the icon keeps its size`);
          const [roomy] = await rowParts(page, 'roomy_menu');
          assert.ok(roomy.label.width >= roomy.label.full && roomy.shortcut.width >= roomy.shortcut.full, `${label}: with room nothing truncates`);
          const [short] = await rowParts(page, 'short_menu');
          assert.ok(short.shortcut.width >= short.shortcut.full && short.shortcut.full < short.shortcut.twoLetters, `${label} ⌘R: the short shortcut fits whole`);
          assert.ok(await shortcutInk(page, 'short_menu') > 0, `${label} ⌘R: a short shortcut that fits is drawn`);
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
