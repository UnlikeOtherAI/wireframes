'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {renderWireframeMarkup} = require('../../engine/screenshots/renderer');

const fmt = (value) => String(Math.round(Math.abs(value) * 10) / 10);

function fixture(mode = 'card', device = 'web') {
  return renderWireframeMarkup({
    roots: [{id: 'main', kind: 'container', nodes: [
      {id: 'col', component: 'stack', layout: {gap: 16, padding: 24}, children: [
        {id: 'title', component: 'heading', props: {text: 'Measure me'}},
        {id: 'locked', component: 'button', props: {label: 'Locked action', disabled: true}},
        {id: 'name', component: 'input', props: {label: 'Name', placeholder: 'Type here'}},
      ]},
      {id: 'pair', component: 'row', layout: {gap: 16}, children: [
        {id: 'left_card', component: 'card', props: {title: 'Left'}, interaction: [{type: 'action', actionId: 'card'}]},
        {id: 'right_card', component: 'card', props: {title: 'Right'}},
      ]},
      {id: 'go', component: 'button', props: {label: 'Go next'}, interaction: [{type: 'navigation', targetRoute: 'next'}]},
      {id: 'menu', component: 'nav', props: {items: [{label: 'Next page', route: 'next'}]}},
      {id: 'act', component: 'button', props: {label: 'Run action'}, interaction: [{type: 'action', actionId: 'run'}]},
      {id: 'press', component: 'card', props: {title: 'Long press me'}, interaction: [{type: 'gesture', gestureType: 'long_press'}]},
      {id: 'open', component: 'button', props: {label: 'Open dialog'}, interaction: [{type: 'open_overlay', targetOverlay: 'dlg'}]},
    ]}, {id: 'dlg', kind: 'overlay', type: 'modal', trigger: 'open', props: {title: 'Dialog title'},
      dismissOn: ['outside', 'escape'], nodes: [{id: 'dlg_body', component: 'paragraph', props: {text: 'Dialog body'}}]}],
    pageViewport: {device, width: 1280, height: 800}, pageRouteId: 'home',
    routeTable: {home: '#home', next: '#next'}, rendering: {mode}, deviceChrome: false,
  });
}

const labels = (scope) => scope.locator('[data-wf-measure-label]').evaluateAll((els) =>
  Object.fromEntries(els.map((el) => [el.getAttribute('data-wf-measure-label'), el.textContent])));
const rectOf = (scope, selector) => scope.locator(selector).evaluate((el) => {
  const r = el.getBoundingClientRect();
  return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
});
async function hover(page, selector, dx = 6, dy = 6) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.move(box.x + dx, box.y + dy);
}
async function click(page, selector, dx = 6, dy = 6) {
  const box = await page.locator(selector).boundingBox();
  await page.mouse.click(box.x + dx, box.y + dy);
}

async function withPage(run, options = {}) {
  const browser = await chromium.launch({headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 800}, ...options});
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await run(page);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

for (const mode of ['card', 'line']) test(mode + ': hover, pins, gaps, Escape and switching off on a standalone page', async () => {
  await withPage(async (page) => {
    await page.setContent(fixture(mode));
    const before = await page.evaluate(() => document.documentElement.outerHTML);
    assert.equal(await page.locator('[data-wf-measure]').count(), 0, 'inert until switched on');

    await page.keyboard.press('m');
    assert.equal(await page.locator('[data-wf-measure]').count(), 1);
    await hover(page, '#title');
    const title = await rectOf(page, '#title');
    let seen = await labels(page);
    assert.equal(seen.width, fmt(title.width));
    assert.equal(seen.height, fmt(title.height));
    assert.equal(seen['padding-top'], undefined, 'padding bands are for layout containers only');

    await hover(page, '#col', 3, 3);
    seen = await labels(page);
    assert.equal(seen.width, fmt((await rectOf(page, '#col')).width));
    for (const side of ['top', 'right', 'bottom', 'left']) assert.equal(seen['padding-' + side], '24');
    assert.equal(seen['gap-row'], '16');
    const between = await rectOf(page, '#left_card');
    await page.mouse.move(between.right + 8, between.top + 8);
    assert.equal((await labels(page))['gap-column'], '16', 'hovering the gap measures the row');

    await hover(page, '#locked', 10, 10);
    assert.equal((await labels(page)).width, fmt((await rectOf(page, '#locked')).width), 'disabled controls are measurable');
    await click(page, '#locked', 10, 10);
    const pinned = await page.locator('[data-wf-measure-box="pin"]').evaluate((el) => el.getBoundingClientRect().width);
    assert.equal(fmt(pinned), fmt((await rectOf(page, '#locked')).width), 'a disabled control can be pinned');
    await click(page, '#locked', 10, 10);
    assert.equal(await page.locator('[data-wf-measure-box="pin"]').count(), 0, 'clicking the pin again releases it');

    await click(page, '#left_card');
    assert.equal(await page.locator('.wf-runtime-toast').count(), 0, 'clicking pins instead of running the action');
    await hover(page, '#right_card');
    const left = await rectOf(page, '#left_card'), right = await rectOf(page, '#right_card');
    seen = await labels(page);
    assert.equal(seen['gap-x'], fmt(right.left - left.right));
    assert.equal(await page.locator('[data-wf-measure-box="pin"]').count(), 1);

    await click(page, '#title');
    await hover(page, '#locked', 10, 10);
    const locked = await rectOf(page, '#locked');
    seen = await labels(page);
    assert.equal(seen['gap-y'], fmt(locked.top - title.bottom));
    assert.equal(seen['inset-right'], fmt(title.right - locked.right));
    assert.equal(seen['inset-left'], undefined, 'aligned edges draw no inset');

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-wf-measure-box="pin"]').count(), 0, 'Escape unpins');
    assert.equal(await page.locator('[data-wf-measure]').count(), 1, 'Escape keeps measuring');

    await page.keyboard.press('m');
    assert.equal(await page.locator('[data-wf-measure]').count(), 0, 'switching off removes the layer');
    assert.equal(await page.evaluate(() => document.documentElement.outerHTML), before, 'serialization is unchanged');
  });
});

test('while measuring nothing navigates, dismisses, fires or reacts to keys', async () => {
  await withPage(async (page) => {
    await page.setContent(fixture());
    const url = page.url();
    await page.getByRole('button', {name: 'Open dialog'}).click();
    await page.locator('#dlg').waitFor({state: 'visible'});
    await page.locator('#left_card').focus();
    await page.keyboard.press('m');

    await page.mouse.click(4, 4);
    assert.equal(await page.locator('#dlg').isVisible(), true, 'outside clicks pin instead of dismissing');
    await page.locator('#dlg .wf-overlay-title').hover();
    const content = await rectOf(page, '#dlg .wf-overlay-content');
    assert.equal((await labels(page)).width, fmt(content.width), 'an overlay is measured by its content');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#dlg').isVisible(), true, 'Escape is handled once, by measurement');
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    await page.keyboard.press('m');
    await page.locator('#dlg .wf-overlay-close').click();
    await page.keyboard.press('m');

    for (const selector of ['#go a', '#menu a', '#act button', '#open button']) await click(page, selector, 4, 4);
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    assert.equal(page.url(), url, 'no navigation');
    assert.equal(await page.locator('.wf-runtime-toast').count(), 0, 'no interaction fired');
    assert.equal(await page.locator('#dlg').isVisible(), false, 'no overlay opened');

    await page.keyboard.press('m');
    await page.locator('#name input').click();
    await page.keyboard.type('mm');
    assert.equal(await page.locator('#name input').inputValue(), 'mm', 'm types in a text field');
    assert.equal(await page.locator('[data-wf-measure]').count(), 0);
  });
});

test('pending and new gestures do not fire while measuring', async () => {
  await withPage(async (page) => {
    await page.setContent(fixture('card', 'mobile'));
    const touch = (type) => page.locator('#press').evaluate((node, eventType) => {
      const r = node.getBoundingClientRect();
      const t = new Touch({identifier: 1, target: node, clientX: r.left + 8, clientY: r.top + 8});
      node.dispatchEvent(new TouchEvent(eventType, {bubbles: true, cancelable: true,
        touches: eventType === 'touchstart' ? [t] : [], changedTouches: [t]}));
    }, type);
    await touch('touchstart');
    await page.keyboard.press('m');
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 650)));
    assert.equal(await page.locator('.wf-runtime-toast').count(), 0, 'a pending long press is gated');
    await touch('touchend');
    await touch('touchstart');
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 650)));
    await touch('touchend');
    assert.equal(await page.locator('.wf-runtime-toast').count(), 0, 'new touches are stopped');
    await page.keyboard.press('m');
    await touch('touchstart');
    await page.locator('.wf-runtime-toast').waitFor({state: 'attached'});
  }, {hasTouch: true, isMobile: true, viewport: {width: 390, height: 844}});
});

test('a tap pins, a second tap measures to it, and tapping the pin releases it', async () => {
  await withPage(async (page) => {
    await page.setContent(fixture());
    await page.keyboard.press('m');
    const tap = async (selector) => {
      const box = await page.locator(selector).boundingBox();
      await page.touchscreen.tap(box.x + 6, box.y + 6);
    };
    await tap('#left_card');
    assert.equal(await page.locator('[data-wf-measure-box="pin"]').count(), 1);
    await tap('#right_card');
    const left = await rectOf(page, '#left_card'), right = await rectOf(page, '#right_card');
    assert.equal((await labels(page))['gap-x'], fmt(right.left - left.right));
    await tap('#left_card');
    assert.equal(await page.locator('[data-wf-measure-box]').count(), 0);
    assert.equal(await page.locator('.wf-runtime-toast').count(), 0);
  }, {hasTouch: true});
});

test('an embedded page follows its parent only, and measures in its own pixels under host zoom', async () => {
  await withPage(async (page) => {
    await page.setContent('<iframe id="host" style="width:1280px;height:800px;border:0;transform:scale(.5);transform-origin:0 0"></iframe>');
    await page.evaluate(() => { window.navigations = []; window.addEventListener('message', (e) => { if (e.data && e.data.type === 'wf:navigate') window.navigations.push(e.data.routeId); }); });
    await page.locator('#host').evaluate((frame, html) => new Promise((resolve) => {
      frame.addEventListener('load', resolve, {once: true});
      frame.srcdoc = html;
    }), fixture());
    const frame = page.frameLocator('#host');
    const inner = page.frames()[1];
    const layerCount = () => frame.locator('[data-wf-measure]').count();
    const post = (data) => page.evaluate((message) => document.getElementById('host').contentWindow.postMessage(message, '*'), data);

    await inner.evaluate(() => window.postMessage({type: 'wf:measure', on: true}, '*'));
    for (const on of ['true', 1, null]) await post({type: 'wf:measure', on});
    await post({type: 'wf:other', on: true});
    await inner.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    assert.equal(await layerCount(), 0, 'non-parent and non-boolean messages are ignored');

    await frame.locator('#title').click();
    await page.keyboard.press('m');
    assert.equal(await layerCount(), 0, 'm is ignored when embedded');

    await post({type: 'wf:measure', on: true});
    await frame.locator('[data-wf-measure]').waitFor({state: 'attached'});
    await page.keyboard.press('m');
    assert.equal(await layerCount(), 1, 'm cannot switch an embedded page off either');

    const box = await frame.locator('#right_card').boundingBox();
    await page.mouse.move(box.x + 4, box.y + 4);
    const inside = await rectOf(frame, '#right_card');
    assert.ok(Math.abs(box.width - inside.width / 2) < 1, 'the host zooms the frame');
    assert.equal((await labels(frame)).width, fmt(inside.width), 'labels use the page’s own pixels');
    await page.mouse.click(box.x + 4, box.y + 4);
    const go = await frame.locator('#go a').boundingBox();
    await page.mouse.click(go.x + 4, go.y + 4);
    await inner.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
    assert.deepEqual(await page.evaluate(() => window.navigations), [], 'no wf:navigate while measuring');

    await post({type: 'wf:measure', on: false});
    await frame.locator('[data-wf-measure]').waitFor({state: 'detached'});
    await page.mouse.click(go.x + 4, go.y + 4);
    await page.waitForFunction(() => window.navigations.includes('next'));
  });
});
