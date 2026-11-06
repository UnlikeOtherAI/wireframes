'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { skinProject } = require('./fixtures/skin-project');
const { renderPage } = require('../../engine/build');

const when = (key, equals) => ({ condition: { type: 'state_equals', scope: 'page', key, equals } });
const stat = (id, label) => ({ id, component: 'stat', props: { label, value: '1' }, stateBindings: { 'style.flex': '1' } });

function billingProject() {
  const map = skinProject();
  const home = map.pages.get('home');
  home.page.viewport = { device: 'web' };
  home.page.pageState = { page: 'billing' };
  home.page.slots[0].content = [{
    id: 'billing',
    component: 'stack',
    props: { gap: 16 },
    visibility: when('page', 'billing'),
    children: [
      { id: 'stats', component: 'row', props: { gap: 16, align: 'stretch' }, children: [stat('s0', 'Plan'), stat('s1', 'Seats'), stat('s2', 'Month')] },
      { id: 'alert', component: 'alert', props: { title: 'Storage almost full', message: 'You are using 92% of your quota.' } },
      { id: 'invoices', component: 'card', props: { title: 'Invoices' }, children: [{ id: 'inv', component: 'text', props: { text: 'INV-1' } }] },
      { id: 'cancel', component: 'card', props: { title: 'Cancel subscription' }, children: [{ id: 'can', component: 'text', props: { text: 'Cancel' } }] },
    ],
  }, {
    id: 'other', component: 'stack', props: { gap: 16 }, visibility: when('page', 'other'),
    children: [{ id: 'o1', component: 'card', props: { title: 'One' } }, { id: 'o2', component: 'card', props: { title: 'Two' } }],
  }];
  return map;
}

const verticalGaps = (page, ids) => page.evaluate((list) => {
  const boxes = list.map((id) => document.getElementById(id).getBoundingClientRect());
  return boxes.slice(1).map((box, i) => Math.round(box.top - boxes[i].bottom));
}, ids);

test('a stack shown by a visibility rule keeps its layout and the gap between stacked cards', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const result = renderPage(billingProject(), 'home', { deviceChrome: false });
    assert.equal(result.ok, true, result.error);
    await page.setContent(result.html);

    assert.equal(await page.locator('#billing').evaluate((n) => getComputedStyle(n).display), 'flex');
    assert.deepEqual(await verticalGaps(page, ['stats', 'alert', 'invoices', 'cancel']), [16, 16, 16]);

    assert.equal(await page.locator('#other').isVisible(), false, 'a false rule still hides the node');
  } finally { await browser.close(); }
});

test('switching state hides one stack and shows the other with its gaps intact', async () => {
  const browser = await chromium.launch();
  try {
    const map = billingProject();
    const go = (id, value) => ({ id, component: 'button', props: { label: id }, interaction: [{ type: 'set_state', scope: 'page', stateKey: 'page', value }] });
    map.pages.get('home').page.slots[0].content.push(go('go_other', 'other'), go('go_billing', 'billing'));
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const result = renderPage(map, 'home', { deviceChrome: false });
    assert.equal(result.ok, true, result.error);
    await page.setContent(result.html);

    await page.locator('#go_other').click();
    assert.equal(await page.locator('#billing').isVisible(), false);
    assert.equal(await page.locator('#other').evaluate((n) => getComputedStyle(n).display), 'flex');
    assert.deepEqual(await verticalGaps(page, ['o1', 'o2']), [16]);

    await page.locator('#go_billing').click();
    assert.equal(await page.locator('#other').isVisible(), false);
    assert.equal(await page.locator('#billing').evaluate((n) => getComputedStyle(n).display), 'flex');
    assert.deepEqual(await verticalGaps(page, ['stats', 'alert', 'invoices', 'cancel']), [16, 16, 16]);
  } finally { await browser.close(); }
});
