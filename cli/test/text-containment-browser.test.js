'use strict';

// Text never paints outside its card, tile, stat or list row (render polish item 2).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

// An explicit column count is the author's choice; a phone gets two, as eight
// 30 px tracks could not hold a stat's own padding (adaptive mode reflows them).
const content = (columns) => [
  { id: 'fixed', component: 'row', props: { align: 'start' }, children: [
    { id: 'word', component: 'card', size: { width: 120 }, props: { title: 'Supercalifragilistic', description: 'https://example.com/a/very/long/path' } },
    { id: 'kpi', component: 'stat', size: { width: 120 }, props: { label: 'Monthly recurring revenue', value: '1500000', delta: '+12%' } },
    { id: 'price', component: 'card', size: { width: 120 }, props: { title: 'Enterprise', description: '$500/month' } },
    { id: 'rows', component: 'list', size: { width: 140 }, props: { items: [
      { title: 'Internationalisation', text: 'Configuration of every locale' },
      { title: 'Notifications', text: 'Everything' },
    ] } },
  ] },
  { id: 'kpis', component: 'grid', props: { columns }, repeat: { cell: 'stat', items: [
    { id: 'visitors', label: 'Visitors', value: '1000000' },
    { id: 'rate', label: 'Conversion rate', value: '12.5%' },
    { id: 'revenue', label: 'Revenue', value: '$1,250,000', delta: '+4%' },
    { id: 'neighbour', label: 'Next', value: '7' },
  ] } },
  { id: 'team', component: 'grid', repeat: { cell: 'card', items: [
    { id: 'katherine', title: 'Katherine', description: 'Developer' },
    { id: 'alan', title: 'Alan', description: 'Set up notifications for changes' },
  ] } },
];

function spills(page) {
  return page.evaluate(() => {
    const out = [];
    for (const box of document.querySelectorAll('[data-wf-frame="surface"], .wf-list-row')) {
      const edge = box.getBoundingClientRect();
      const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        // Text past an overflow:hidden ancestor inside the box is not painted,
        // so what must stay inside is that ancestor.
        let clip = node.parentElement;
        while (clip && clip !== box && getComputedStyle(clip).overflowX === 'visible') clip = clip.parentElement;
        const painted = clip && clip !== box ? [clip.getBoundingClientRect()] : [...range.getClientRects()];
        for (const rect of painted) {
          if (rect.right > edge.right + 0.5 || rect.left < edge.left - 0.5) {
            out.push(`${box.id || box.className}: "${node.textContent.trim()}" ${Math.round(rect.right - edge.right)}px`);
            break;
          }
        }
      }
    }
    return out;
  });
}

for (const engine of engines()) {
  test(`text stays inside its box in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [device, width] of [['web', 1280], ['mobile', 390]]) {
          const result = renderPage(polishProject(content(device === 'web' ? 8 : 2), { mode, device }), 'home', { deviceChrome: false });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${device}`;
          assert.deepEqual(await spills(page), [], `${label}: text paints outside its box`);
          const grid = await page.evaluate(() => {
            const el = document.getElementById('kpis');
            return { scroll: el.scrollWidth, client: el.clientWidth, overflow: document.documentElement.scrollWidth - innerWidth };
          });
          assert.ok(grid.scroll <= grid.client + 0.5, `${label}: a fixed-column grid grew around its content`);
          assert.ok(grid.overflow <= 0, `${label}: the page overflows by ${grid.overflow}px`);
          // A list title too long for its row ends in a drawn ellipsis, not a mid-glyph clip.
          const title = await page.locator('#rows .wf-list-title').first().evaluate((el) => ({
            truncated: el.scrollWidth > el.clientWidth, overflow: getComputedStyle(el).textOverflow,
          }));
          assert.deepEqual(title, { truncated: true, overflow: 'ellipsis' }, `${label}: list title`);
          // The stat label wraps rather than collapsing to a two-letter stub.
          const stat = await page.locator('#kpi .wf-stat-label').evaluate((el) => ({
            clipped: el.scrollWidth > el.clientWidth + 1, ellipsis: getComputedStyle(el).textOverflow === 'ellipsis',
          }));
          assert.deepEqual(stat, { clipped: false, ellipsis: false }, `${label}: stat label`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
