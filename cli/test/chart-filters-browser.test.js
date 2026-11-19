'use strict';

// Two iPad review items: gantt bars start and end on the gridlines of the
// tick bands they name, and std.data_page filters sit inline at their natural
// width instead of spanning the page.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const ROADMAP = {
  id: 'roadmap', component: 'chart',
  props: {
    chartType: 'gantt', title: 'Release Timeline', ticks: ['Q1', 'Q2', 'Q3', 'Q4'],
    data: [
      { label: 'Feature Alpha', start: 0, end: 1 },
      { label: 'Feature Beta', start: 1, end: 2 },
      { label: 'Feature Release', start: 2, end: 3 },
      { label: 'Feature Final', start: 3, end: 4 },
    ],
  },
};
const select = (id, label, options) => ({ id, component: 'select', props: { label, options } });
const FILTERED = {
  id: 'customers', use: 'std.data_page',
  slots: { filters: [select('status_filter', 'Status', ['Active', 'Pending', 'Inactive']), select('plan_filter', 'Plan', ['Free', 'Pro'])] },
};
const PLAIN = { id: 'plain', use: 'std.data_page' };
const CASES = [
  ['web', 1280, {}],
  ['adaptive phone', 390, { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }],
];

async function open(browser, content, mode, width, options) {
  const result = renderPage(polishProject(content, { mode }), 'home', { deviceChrome: false, ...options });
  assert.equal(result.ok, true, result.error);
  const page = await browser.newPage({ viewport: { width, height: 1400 } });
  await page.setContent(result.html);
  return page;
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const engine of engines()) {
  test(`gantt bars start and end on the gridlines of the tick bands in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const page = await open(browser, [ROADMAP], mode, width, options);
          const m = await page.evaluate(() => {
            const rects = (selector) => [...document.querySelectorAll(`#roadmap ${selector}`)].map((el) => el.getBoundingClientRect());
            return {
              gridlines: rects('.wf-gantt-gridline').map((r) => r.left),
              bars: rects('.wf-gantt-bar').map((r) => [r.left, r.right]),
              ticks: [...document.querySelectorAll('#roadmap .wf-gantt-tick')].map((el) => {
                const r = el.getBoundingClientRect();
                const text = document.createRange();
                text.selectNodeContents(el);
                const t = text.getBoundingClientRect();
                return { left: r.left, right: r.right, textCentre: (t.left + t.right) / 2, label: el.textContent };
              }),
            };
          });
          const label = `${engine.name} ${mode} ${name}`;
          assert.equal(m.gridlines.length, 5, `${label}: a gridline at every band edge`);
          m.bars.forEach(([left, right], i) => {
            assert.ok(Math.abs(left - m.gridlines[i]) <= 1, `${label}: bar ${i + 1} starts on its band's left gridline (${left} vs ${m.gridlines[i]})`);
            assert.ok(Math.abs(right - m.gridlines[i + 1]) <= 1, `${label}: bar ${i + 1} ends on its band's right gridline (${right} vs ${m.gridlines[i + 1]})`);
          });
          m.ticks.forEach((tick, i) => {
            assert.equal(tick.label, `Q${i + 1}`);
            assert.ok(tick.left >= m.gridlines[i] - 1 && tick.right <= m.gridlines[i + 1] + 1, `${label}: ${tick.label} stays in its band`);
            assert.ok(Math.abs(tick.textCentre - (m.gridlines[i] + m.gridlines[i + 1]) / 2) <= 1, `${label}: ${tick.label} is centred in its band`);
          });
          assert.ok(await overflow(page) <= 0, `${label}: no horizontal overflow`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`std.data_page filters sit inline at their natural width and wrap in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const page = await open(browser, [FILTERED, PLAIN], mode, width, options);
          const box = (id) => page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().toJSON());
          const label = `${engine.name} ${mode} ${name}`;
          const table = await box('customers__table');
          const [status, plan] = [await box('status_filter'), await box('plan_filter')];
          const natural = await page.locator('#status_filter select').evaluate((el) => {
            el.style.width = 'max-content';
            const w = el.getBoundingClientRect().width;
            el.style.width = '';
            return w;
          });
          assert.ok(status.width < table.width / 2, `${label}: Status is ${status.width}px, not the page's ${table.width}px`);
          assert.ok(status.width <= Math.max(natural, 60) + 8, `${label}: Status is its natural width (${status.width} vs ${natural}px)`);
          assert.ok(Math.abs(status.left - table.left) <= 1, `${label}: the filter bar starts at the content edge`);
          // The bar aligns its controls at the bottom (align: end), so one row shares a bottom edge.
          assert.ok(Math.abs(status.bottom - plan.bottom) <= 1 && plan.left > status.right, `${label}: the filters sit inline on one row`);
          // The default filters keep their authored widths and wrap when the row is too narrow.
          const search = await box('plain__search');
          const defaults = [search, await box('plain__status'), await box('plain__plan')];
          assert.equal(Math.round(search.width), 280, `${label}: the default search keeps 280px`);
          const plainTable = await box('plain__table');
          for (const filter of defaults) assert.ok(filter.right <= plainTable.right + 1, `${label}: a default filter stays inside the content`);
          if (name === 'web') {
            assert.ok(defaults.every((f) => Math.abs(f.bottom - search.bottom) <= 1), `${label}: the defaults share one row`);
            assert.ok(defaults[1].left > defaults[0].right && defaults[2].left > defaults[1].right, `${label}: the defaults run left to right`);
          } else {
            assert.ok(defaults[2].top >= search.bottom - 1, `${label}: the defaults wrap on a phone`);
          }
          assert.ok(await overflow(page) <= 0, `${label}: no horizontal overflow`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`an empty filters slot draws no filter bar and adds no gap in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const page = await open(browser, [{ id: 'orders', use: 'std.data_page', slots: { filters: [] } }], mode, 1280, {});
        const m = await page.evaluate(() => {
          const rect = (id) => document.getElementById(id).getBoundingClientRect();
          return { header: rect('orders__header').bottom, table: rect('orders__table').top, bar: getComputedStyle(document.getElementById('orders__filter_bar')).display };
        });
        assert.equal(m.bar, 'none', `${engine.name} ${mode}: the empty filter bar is not drawn`);
        assert.ok(Math.abs(m.table - m.header - 16) <= 1, `${engine.name} ${mode}: one 16px gap between header and table (${m.table - m.header}px)`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
