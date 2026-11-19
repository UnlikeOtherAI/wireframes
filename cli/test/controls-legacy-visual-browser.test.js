'use strict';

// Legacy-only controls must look as they did before the field contract. Each
// control is drawn twice in Chromium: as rendered now, and with the frozen
// legacy markup and stylesheet swapped in. The pixels must match. Controls
// that gained `disabled` on this branch fade the way legacy disabled controls
// always did: one layer at half opacity.

const test = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const { PNG } = require('pngjs');

const lib = require('@wireframes/engine/renderer/render-lib');
const { controlStyles } = require('@wireframes/engine/renderer/styles/controls');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');
const { legacyRenderers, legacySelectOptions } = require('./helpers/legacy-controls');
const { legacyControlStyles } = require('./helpers/legacy-control-styles');

const legacyLib = { ...lib, renderSelectOptions: legacySelectOptions };

// Only props these controls had before the field contract.
const LEGACY = [
  { id: 'in_disabled', component: 'input', props: { label: 'Locked', value: 'LOCK-1', disabled: true } },
  { id: 'in_disabled_help', component: 'input', props: { label: 'Ref', placeholder: 'INV', help: 'Set by billing', disabled: true } },
  { id: 'in_plain', component: 'input', props: { label: 'Name', placeholder: 'Ada' } },
  { id: 'in_number_disabled', component: 'input', props: { label: 'Seats', inputType: 'number', value: '12', disabled: true } },
  { id: 'in_colour_disabled', component: 'input', props: { label: 'Accent', inputType: 'color', value: '#0b172a', disabled: true } },
  { id: 'ta_disabled', component: 'textarea', props: { label: 'Notes', rows: 2, placeholder: 'Locked', disabled: true } },
  { id: 'sel_disabled', component: 'select', props: { label: 'Status', options: ['Draft', 'Live'], placeholder: 'Choose', disabled: true } },
  { id: 'sel_multi_disabled', component: 'select', props: { label: 'Owners', options: ['Ada', 'Grace'], multiple: true, disabled: true } },
  { id: 'sel_plain', component: 'select', props: { label: 'Role', options: ['A', 'B'] } },
  { id: 'cb_disabled', component: 'checkbox', props: { label: 'Managed', description: 'By your admin', disabled: true } },
  { id: 'cb_checked', component: 'checkbox', props: { label: 'Remember me', checked: true } },
  { id: 'cb_checked_disabled', component: 'checkbox', props: { label: 'Locked on', checked: true, disabled: true } },
  { id: 'rd_disabled', component: 'radio', props: { label: 'Annual', checked: true, disabled: true } },
  { id: 'tg_disabled', component: 'toggle', props: { label: 'Sync', checked: true, disabled: true } },
  { id: 'tg_off', component: 'toggle', props: { label: 'Public' } },
  { id: 'btn_disabled', component: 'button', props: { label: 'Disabled', disabled: true } },
  { id: 'btn_primary_disabled', component: 'button', props: { label: 'Save', variant: 'primary', disabled: true } },
  { id: 'btn_danger_disabled', component: 'button', props: { label: 'Delete', variant: 'danger', disabled: true } },
  { id: 'pk_blank', component: 'picker', props: { options: ['A', '', 'B'] } },
  { id: 'pk_value', component: 'picker', props: { options: ['Never', 'Daily', 'Weekly'], value: 'Daily' } },
  { id: 'pk_none', component: 'picker', props: { options: ['One', 'Two', 'Three'] } },
  { id: 'st_plain', component: 'input', props: { label: 'Guests', inputType: 'stepper', value: 3 } },
  { id: 'seg', component: 'segmented', props: { options: ['Day', 'Week', 'Month'], value: 'Week' } },
  { id: 'cg_plain', component: 'choice_group', props: { label: 'Plan', kind: 'radio', options: ['Free', 'Pro'] } },
  { id: 'rng', component: 'input', props: { label: 'Budget', inputType: 'range', value: 65 } },
  { id: 'tags', component: 'tags_input', props: { label: 'Labels', tags: ['urgent'], placeholder: 'Add' } },
];
// Stepper help is a deliberate change (design §10): authored help used to be dropped.
const STEPPER_HELP = { id: 'st_help', component: 'input', props: { label: 'Rooms', inputType: 'stepper', value: 2, help: 'Per night' } };
// Single selects restyled on purpose: their box keeps its size, the drawing inside it changed.
const RESTYLED_SELECTS = new Set(['sel_plain', 'sel_disabled']);

// Controls that gained `disabled` on this branch, plus the legacy drawn ones.
const DISABLED = [
  { id: 'g_range', component: 'input', props: { label: 'Budget', inputType: 'range', value: 30, disabled: true } },
  { id: 'g_otp', component: 'input', props: { label: 'Code', inputType: 'otp', length: 4, disabled: true } },
  { id: 'g_stepper', component: 'input', props: { label: 'Guests', inputType: 'stepper', value: 3, disabled: true } },
  { id: 'g_picker', component: 'picker', props: { options: ['A', 'B', 'C'], value: 'B', disabled: true } },
  { id: 'g_editor', component: 'editor', props: { label: 'Body', rows: 2, disabled: true } },
  { id: 'g_choices', component: 'choice_group', props: { label: 'Plan', kind: 'radio', options: ['Free', { label: 'Pro', disabled: true }], disabled: true } },
  { id: 'g_choice_row', component: 'choice_group', props: { label: 'Alerts', options: ['Mail', { label: 'SMS', disabled: true }] } },
  { id: 'g_segmented', component: 'segmented', props: { options: ['Grid', 'List'], value: 'List', disabled: true } },
  { id: 'g_tags', component: 'tags_input', props: { label: 'Labels', tags: ['a'], disabled: true } },
  { id: 'g_upload', component: 'upload', props: { label: 'Drop files', disabled: true } },
  { id: 'g_toolbar', component: 'toolbar', props: { items: [{ label: 'Bold', icon: 'bold' }, { label: 'Cut', icon: 'scissors', disabled: true }] } },
  { id: 'l_checkbox', component: 'checkbox', props: { label: 'Managed', disabled: true } },
  { id: 'l_button', component: 'button', props: { label: 'Off', disabled: true } },
];
// Native fields keep the native disabled look and never fade.
const NATIVE_DISABLED = ['in_disabled', 'in_disabled_help', 'in_number_disabled', 'in_colour_disabled', 'ta_disabled', 'sel_disabled', 'sel_multi_disabled'];

function grid(id, children) {
  return { id, component: 'card', props: { title: id }, layout: { type: 'grid', columns: 4, gap: 16 }, children };
}

function pageFor(mode) {
  return renderWireframeMarkup({
    roots: [{ id: 'main', kind: 'container', nodes: [grid('legacy', LEGACY), grid('gained', DISABLED), grid('help', [STEPPER_HELP])] }],
    pageViewport: { device: 'web', width: 1280, height: 900 },
    rendering: { mode },
    deviceChrome: false,
  });
}

function legacyInner(node) {
  const ctx = {
    bindingContext: { routeId: '', props: node.props || {}, item: {}, itemVar: 'item' },
    stateBindings: {},
    routeTable: {},
    navigationTarget: null,
    navAttrs: () => '',
  };
  return legacyRenderers[node.component](node, ctx, legacyLib).inner;
}

function differentPixels(a, b) {
  const left = PNG.sync.read(a);
  const right = PNG.sync.read(b);
  if (left.width !== right.width || left.height !== right.height) return Infinity;
  let count = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    const delta = Math.abs(left.data[i] - right.data[i]) + Math.abs(left.data[i + 1] - right.data[i + 1])
      + Math.abs(left.data[i + 2] - right.data[i + 2]) + Math.abs(left.data[i + 3] - right.data[i + 3]);
    if (delta > 24) count += 1;
  }
  return count;
}

async function withPage(html, run) {
  const browser = await launchChromium(playwright, { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(html);
    await run(page);
  } finally {
    await browser.close();
  }
}

/** Swap the legacy markup into each control and the legacy stylesheet into the page. */
function useLegacy(page, nodes) {
  const inner = Object.fromEntries(nodes.map((node) => [node.id, legacyInner(node)]));
  return page.evaluate(({ markup, current, legacy }) => {
    for (const [id, html] of Object.entries(markup)) document.getElementById(id).innerHTML = html;
    for (const style of document.querySelectorAll('style')) {
      if (style.textContent.includes(current)) style.textContent = style.textContent.replace(current, legacy);
    }
  }, { markup: inner, current: controlStyles, legacy: legacyControlStyles });
}

for (const mode of ['card', 'line']) {
  test(`legacy-only controls draw the pixels they did before, ${mode} mode`, async () => {
    await withPage(pageFor(mode), async (page) => {
      const shots = {};
      for (const node of LEGACY) shots[node.id] = await page.locator(`#${node.id}`).screenshot();
      const stepperNow = await page.locator('#st_help .wf-numstepper').screenshot();
      assert.equal(await page.locator('#st_help .wf-field-help').textContent(), 'Per night', 'stepper help is shown');

      await useLegacy(page, [...LEGACY, STEPPER_HELP]);
      const changed = [];
      for (const node of LEGACY) {
        const diff = differentPixels(shots[node.id], await page.locator(`#${node.id}`).screenshot());
        // A single select now draws its own chevron, with its text on the inputs'
        // inset (rendering-controls.md), so only its box must stay the same size.
        if (RESTYLED_SELECTS.has(node.id) ? diff === Infinity : diff > 0) changed.push(node.id);
      }
      assert.deepEqual(changed, [], 'these legacy controls look different now');
      assert.equal(await page.locator('#st_help .wf-field-help').count(), 0, 'the legacy stepper dropped its help');
      assert.equal(differentPixels(stepperNow, await page.locator('#st_help .wf-numstepper').screenshot()), 0,
        'apart from its help line, the stepper looks the same');
    });
  });

  test(`disabled controls fade once, to half opacity, or keep the native look, ${mode} mode`, async () => {
    await withPage(pageFor(mode), async (page) => {
      // Every element inside a control that is not fully opaque, with the opacity it has.
      // A native field's own opacity is the browser's disabled look (Chromium dims a disabled select).
      const fades = (id) => page.locator(`#${id}`).evaluate((root) => {
        const out = [];
        for (const el of [root, ...root.querySelectorAll('*')]) {
          const opacity = Number(getComputedStyle(el).opacity);
          if (opacity === 1 || el.matches('input:disabled,select:disabled,textarea:disabled')) continue;
          let nested = false;
          for (let up = el.parentElement; up && up !== root.parentElement; up = up.parentElement) {
            if (Number(getComputedStyle(up).opacity) !== 1) nested = true;
          }
          out.push({ opacity, nested });
        }
        return out;
      });
      for (const node of DISABLED) {
        const found = await fades(node.id);
        assert.ok(found.length > 0, `${node.id} shows that it is disabled`);
        assert.deepEqual(found.filter((fade) => fade.opacity !== 0.5 || fade.nested), [], `${node.id} fades once, to 0.5`);
      }
      for (const id of NATIVE_DISABLED) assert.deepEqual(await fades(id), [], `${id} keeps the native disabled look`);
    });
  });
}
