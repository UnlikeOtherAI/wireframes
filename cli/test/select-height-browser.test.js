'use strict';

// A select is as tall as an input in every engine. WebKit's native menulist
// (the iPad's web view) ignores min-height, so a settings form with Email then
// Plan used to draw the select shorter than the input above it.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const select = (id, props) => ({ id, component: 'select', props: { label: 'Plan', options: ['Free', 'Pro', 'Team'], ...props } });
const FORM = {
  id: 'settings', component: 'card', props: { title: 'Settings' }, layout: { type: 'stack', gap: 12 },
  children: [
    { id: 'email', component: 'input', props: { label: 'Email', placeholder: 'ada@example.com' } },
    select('plan'),
    select('plan_ro', { value: 'Pro', readonly: true }),
    select('plan_off', { value: 'Pro', disabled: true }),
    select('country', { label: 'Country', searchable: true }),
    select('tags', { label: 'Tags', multiple: true }),
  ],
};
const CASES = [
  ['web', 1280, {}],
  ['adaptive phone', 390, { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }],
];

// Each field's box and element height, its chevron, its opacity and its appearance.
const measure = (page) => page.evaluate(() => Object.fromEntries(['email', 'plan', 'plan_ro', 'plan_off', 'country', 'tags'].map((id) => {
  const control = document.querySelector(`#${id} .wf-control`);
  const field = control.querySelector('input, select');
  const chevron = getComputedStyle(control, '::after');
  return [id, {
    box: control.getBoundingClientRect().height,
    field: field.getBoundingClientRect().height,
    chevron: chevron.content !== 'none' && chevron.display !== 'none',
    opacity: Number(getComputedStyle(field).opacity),
    appearance: getComputedStyle(field).webkitAppearance || getComputedStyle(field).appearance,
  }];
})));

for (const engine of engines()) {
  test(`a select is as tall as an input, with its own chevron, in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const result = renderPage(polishProject([FORM], { mode }), 'home', { deviceChrome: false, ...options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 1000 } });
          await page.setContent(result.html);
          const m = await measure(page);
          const label = `${engine.name} ${mode} ${name}`;
          for (const id of ['plan', 'plan_ro', 'plan_off', 'country']) {
            assert.ok(Math.abs(m[id].box - m.email.box) < 0.5, `${label}: ${id} box ${m[id].box}px equals the input's ${m.email.box}px`);
            assert.ok(Math.abs(m[id].field - m.email.field) < 0.5, `${label}: ${id} select ${m[id].field}px equals the input's ${m.email.field}px`);
          }
          for (const id of ['plan', 'plan_off', 'country']) assert.equal(m[id].chevron, true, `${label}: ${id} draws its chevron`);
          assert.equal(m.plan_ro.chevron, false, `${label}: a read-only select draws no chevron`);
          assert.equal(m.plan_off.opacity, 0.7, `${label}: a disabled select dims`);
          assert.equal(m.plan.opacity, 1, `${label}: an enabled select does not`);
          assert.notEqual(m.tags.appearance, 'none', `${label}: a multiple select stays a native list box`);
          assert.equal(m.tags.chevron, false, `${label}: a multiple select draws no chevron`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`a select stays keyboard-operable and its box shows focus in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject([FORM], { mode }), 'home', { deviceChrome: false });
        const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
        await page.setContent(result.html);
        await page.focus('#email input');
        // Safari moves focus between form controls with Tab, as other engines do.
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.closest('.wf-node').id), 'plan', `${engine.name} ${mode}: Tab reaches the select`);
        const ring = await page.locator('#plan .wf-control').evaluate((el) => getComputedStyle(el).outlineStyle);
        assert.notEqual(ring, 'none', `${engine.name} ${mode}: the focused select's box shows a ring`);
        await page.keyboard.press('p');
        assert.equal(await page.locator('#plan select').inputValue(), 'Pro', `${engine.name} ${mode}: typing picks an option`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
