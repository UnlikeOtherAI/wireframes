'use strict';

// Bound controls keep the field semantics they render with once the runtime
// mounts and every time their state changes: a multiple select keeps its
// list, numbers stay inside their bounds, a mixed checkbox stays mixed until
// its state changes or the user activates it, and a segment keeps its place
// when several segments share a label.

const test = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

const pageFor = (nodes, pageStateDefaults) => renderWireframeMarkup({
  roots: [{ id: 'main', kind: 'container', nodes }],
  pageViewport: { device: 'web', width: 1280, height: 900 },
  rendering: { mode: 'card' },
  deviceChrome: false,
  pageStateDefaults,
});

const setter = (id, stateKey, value) => ({
  id, component: 'button', props: { label: id }, interaction: [{ type: 'set_state', stateKey, value }],
});

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

const click = (page, label) => page.getByRole('button', { name: label, exact: true }).click();
const chosen = (page, id) => page.locator(`#${id} select`).evaluate((el) => Array.from(el.selectedOptions, (option) => option.value));

test('a bound multiple select keeps its list after mount and on later changes', async () => {
  const html = pageFor([
    { id: 'tags', component: 'select', props: { label: 'Tags', options: ['a', 'b', 'c'], multiple: true, readonly: true, value: '{{state.tags}}' } },
    { id: 'open', component: 'select', props: { label: 'Open', options: ['a', ' b ', 'c'], multiple: true, value: '{{state.open}}' } },
    setter('pick_b', 'tags', ['b']),
    setter('pick_one', 'tags', 'c'),
  ], { tags: ['a', 'c'], open: ['b'] });
  await withPage(html, async (page) => {
    assert.deepEqual(await chosen(page, 'tags'), ['a', 'c']);
    assert.deepEqual(await chosen(page, 'open'), [' b '], 'option values match as trimmed strings');
    await click(page, 'pick_b');
    assert.deepEqual(await chosen(page, 'tags'), ['b']);
    await click(page, 'pick_one');
    assert.deepEqual(await chosen(page, 'tags'), ['c'], 'a single value selects that one option');
    // A read-only select still puts back a change, to its current selection.
    await page.locator('#tags select').selectOption(['a']);
    assert.deepEqual(await chosen(page, 'tags'), ['c']);
  });
});

test('a bound select keeps an explicit item selected over its value, across groups, after mount and on later changes', async () => {
  const optedOut = [
    { type: 'group', label: 'First', items: [{ label: 'Opted out', value: 'off', selected: false }, 'state'] },
    { type: 'group', label: 'Second', items: [{ label: 'Other', value: 'other' }, { label: 'Off again', value: 'off' }] },
  ];
  const pinned = [
    { type: 'group', label: 'First', items: [{ label: 'Explicit', value: 'explicit', selected: true }] },
    { type: 'group', label: 'Second', items: [{ label: 'Opted out', value: 'off', selected: false }, 'state'] },
  ];
  const single = [{ label: 'A out', value: 'a', selected: false }, { label: 'A', value: 'a' }, { label: 'Blank value', value: '' }];
  const html = pageFor([
    { id: 'literal_out', component: 'select', props: { options: optedOut, multiple: true, value: ['off', 'state'] } },
    { id: 'bound_out', component: 'select', props: { options: optedOut, multiple: true, value: '{{state.values}}' } },
    { id: 'literal_pin', component: 'select', props: { options: pinned, multiple: true, value: ['off', 'state'] } },
    { id: 'bound_pin', component: 'select', props: { options: pinned, multiple: true, value: '{{state.values}}' } },
    { id: 'literal_one', component: 'select', props: { options: single, value: 'a' } },
    { id: 'bound_one', component: 'select', props: { options: single, value: '{{state.one}}' } },
    { id: 'bound_one_pin', component: 'select', props: { options: ['x', { label: 'Pinned', value: 'p', selected: true }], value: '{{state.one}}' } },
    setter('values_later', 'values', ['off', 'other']),
    setter('one_blank', 'one', 'Blank value'),
  ], { values: ['off', 'state'], one: 'a' });
  await withPage(html, async (page) => {
    const labels = (id) => page.locator(`#${id} select`).evaluate((el) => Array.from(el.selectedOptions, (option) => option.textContent));
    assert.deepEqual(await labels('literal_out'), ['state', 'Off again']);
    assert.deepEqual(await labels('bound_out'), ['state', 'Off again'], 'selected: false skips that match after mount');
    assert.deepEqual(await labels('literal_pin'), ['Explicit']);
    assert.deepEqual(await labels('bound_pin'), ['Explicit'], 'selected: true beats the value after mount');
    assert.deepEqual(await labels('literal_one'), ['A']);
    assert.deepEqual(await labels('bound_one'), ['A'], 'a single select skips an opted-out first match');
    assert.deepEqual(await labels('bound_one_pin'), ['Pinned']);

    await click(page, 'values_later');
    assert.deepEqual(await labels('bound_out'), ['Other', 'Off again']);
    assert.deepEqual(await labels('bound_pin'), ['Explicit'], 'a later value still loses to selected: true');
    await click(page, 'one_blank');
    assert.deepEqual(await labels('bound_one'), ['Blank value'], 'an option with a blank value is identified by its label');
    assert.deepEqual(await labels('bound_one_pin'), ['Pinned']);
  });
});

test('a stepper bound to disabled keeps both buttons disabled when its value changes', async () => {
  const html = pageFor([
    { id: 'qty', component: 'input', props: { inputType: 'stepper', min: 1, max: 5, value: '{{state.qty}}' }, stateBindings: { disabled: '{{state.off}}' } },
    { id: 'fixed', component: 'input', props: { inputType: 'stepper', min: 1, max: 5, value: 5 }, stateBindings: { disabled: '{{state.off}}' } },
    { id: 'literal', component: 'input', props: { inputType: 'stepper', min: 1, max: 5, value: 5, disabled: true } },
    setter('disable', 'off', true),
    setter('enable', 'off', false),
    setter('qty_3', 'qty', 3),
  ], { qty: 2, off: false });
  await withPage(html, async (page) => {
    const stepper = (id) => page.locator(`#${id} .wf-numstepper`).evaluate((el) => ({
      off: el.hasAttribute('data-wf-disabled'),
      text: el.querySelector('.wf-numstepper-value').textContent,
      buttons: Array.from(el.querySelectorAll('button'), (button) => [button.disabled, button.hasAttribute('data-wf-disabled')]),
    }));
    const enabled = [[false, false], [false, false]];
    const disabled = [[true, true], [true, true]];
    assert.deepEqual(await stepper('qty'), { off: false, text: '2', buttons: enabled });

    await click(page, 'disable');
    assert.deepEqual(await stepper('qty'), { off: true, text: '2', buttons: disabled });
    assert.deepEqual(await stepper('fixed'), await stepper('literal'), 'a bound disabled draws what a literal one does');
    await click(page, 'qty_3');
    assert.deepEqual(await stepper('qty'), { off: true, text: '3', buttons: disabled }, 'a value change keeps the binding');

    await click(page, 'enable');
    assert.deepEqual(await stepper('qty'), { off: false, text: '3', buttons: enabled });
    assert.deepEqual(await stepper('fixed'), { off: false, text: '5', buttons: [[false, false], [true, true]] }, 'enabled again, the end it sits at stays disabled');
  });
});

test('bound number fields and steppers respect min, max and step after mount and on later changes', async () => {
  const html = pageFor([
    { id: 'qty', component: 'input', props: { label: 'Qty', inputType: 'number', max: 100, value: '{{state.qty}}' } },
    { id: 'rate', component: 'input', props: { label: 'Rate', inputType: 'number', step: 0.5, value: '{{state.rate}}' } },
    { id: 'free', component: 'input', props: { label: 'Free', inputType: 'number', value: '{{state.free}}' } },
    { id: 'guests', component: 'input', props: { label: 'Guests', inputType: 'stepper', min: 1, max: 5, value: '{{state.guests}}' } },
    setter('qty_30', 'qty', 30),
    setter('qty_low', 'qty', -5),
    setter('guests_1', 'guests', 1),
    setter('guests_3', 'guests', 3),
  ], { qty: 150, rate: 3, free: 250, guests: 9 });
  await withPage(html, async (page) => {
    const qty = page.locator('#qty input');
    const stepper = async () => page.locator('#guests .wf-numstepper').evaluate((el) => ({
      text: el.querySelector('.wf-numstepper-value').textContent,
      buttons: Array.from(el.querySelectorAll('button'), (button) => [button.disabled, button.hasAttribute('data-wf-disabled')]),
    }));
    assert.equal(await qty.inputValue(), '100', 'clamped to max after mount');
    assert.equal(await page.locator('#rate input').inputValue(), '3.0', 'step sets the decimals');
    assert.equal(await page.locator('#free input').inputValue(), '250', 'unbounded numbers keep any value');
    assert.deepEqual(await stepper(), { text: '5', buttons: [[false, false], [true, true]] });

    await click(page, 'qty_30');
    assert.equal(await qty.inputValue(), '30');
    await click(page, 'qty_low');
    assert.equal(await qty.inputValue(), '0', 'min defaults to 0 once a bound is set');
    await click(page, 'guests_1');
    assert.deepEqual(await stepper(), { text: '1', buttons: [[true, true], [false, false]] });
    await click(page, 'guests_3');
    assert.deepEqual(await stepper(), { text: '3', buttons: [[false, false], [false, false]] });

    // What the user types is left alone while they type it.
    await qty.fill('150');
    assert.equal(await qty.inputValue(), '150');
  });
});

test('an indeterminate checkbox stays mixed until its state changes or the user activates it', async () => {
  const html = pageFor([
    { id: 'all', component: 'checkbox', props: { label: 'All', indeterminate: true }, stateBindings: { checked: '{{state.all}}' } },
    { id: 'some', component: 'checkbox', props: { label: 'Some', indeterminate: true }, stateBindings: { checked: '{{state.some}}' } },
    setter('other', 'unrelated', 1),
    setter('all_off', 'all', false),
    setter('all_on', 'all', true),
  ], { all: true, some: false });
  await withPage(html, async (page) => {
    const mark = (id) => page.locator(`#${id} [role=checkbox]`).evaluate((el) => [el.getAttribute('aria-checked'), el.getAttribute('data-wf-checked')]);
    assert.deepEqual(await mark('all'), ['mixed', 'mixed'], 'mixed after mount');
    await click(page, 'other');
    assert.deepEqual(await mark('all'), ['mixed', 'mixed'], 'other state leaves it mixed');
    await click(page, 'all_off');
    assert.deepEqual(await mark('all'), ['false', null]);
    await click(page, 'all_on');
    assert.deepEqual(await mark('all'), ['true', '']);

    assert.deepEqual(await mark('some'), ['mixed', 'mixed']);
    await page.getByText('Some', { exact: true }).click();
    assert.deepEqual(await mark('some'), ['true', ''], 'activating a mixed checkbox checks it');
  });
});

test('segments sharing a label keep the selected one', async () => {
  const same = [{ label: 'Same', value: 'a' }, { label: 'Same', value: 'b' }, { label: 'Other', value: 'c' }];
  const html = pageFor([
    { id: 'local', component: 'segmented', props: { options: same, value: 'b' } },
    { id: 'keyed', component: 'segmented', props: { options: same, value: 'b' }, selection: { scope: 'page', stateKey: 'view' } },
    setter('view_other', 'view', 'Other'),
    setter('view_same', 'view', 'Same'),
  ]);
  await withPage(html, async (page) => {
    const pressed = (id) => page.locator(`#${id} button`).evaluateAll((els) => els.map((el) => [el.getAttribute('aria-pressed'), el.hasAttribute('data-wf-selected')]));
    const on = [['false', false], ['true', true], ['false', false]];
    assert.deepEqual(await pressed('local'), on, 'the value-selected segment survives mount');
    assert.deepEqual(await pressed('keyed'), on);
    const segment = (id, index) => page.locator(`#${id} button`).nth(index).click();

    await segment('local', 0);
    assert.deepEqual((await pressed('local')).map(([value]) => value), ['true', 'false', 'false']);
    await segment('local', 1);
    assert.deepEqual((await pressed('local')).map(([value]) => value), ['false', 'true', 'false'], 'the clicked one lights');
    await segment('keyed', 0);
    await segment('keyed', 1);
    assert.deepEqual((await pressed('keyed')).map(([value]) => value), ['false', 'true', 'false']);
    assert.equal(await page.evaluate(() => document.getElementById('keyed').getAttribute('data-selection-key')), 'view');

    // State set elsewhere still selects by label: the first match.
    await click(page, 'view_other');
    assert.deepEqual((await pressed('keyed')).map(([value]) => value), ['false', 'false', 'true']);
    await click(page, 'view_same');
    assert.deepEqual((await pressed('keyed')).map(([value]) => value), ['true', 'false', 'false']);
  });
});

test('a bound number or stepper shows exactly what the same literal value renders', async () => {
  const values = [150, -5, 3, '3.25', '', 'abc', 1e-7, '007'];
  const limits = [{}, { max: 100 }, { min: 5 }, { min: 10, max: 1 }, { step: 0.5 }, { min: 0, max: 10, step: 0.25 }, { step: 1e-7 }];
  const nodes = [];
  const state = {};
  values.forEach((value, v) => limits.forEach((limit, l) => ['number', 'stepper'].forEach((inputType) => {
    const key = `${inputType}_${v}_${l}`;
    state[key] = value;
    nodes.push({ id: `lit_${key}`, component: 'input', props: { inputType, ...limit, value } });
    nodes.push({ id: `bound_${key}`, component: 'input', props: { inputType, ...limit, value: `{{state.${key}}}` } });
  })));
  await withPage(pageFor(nodes, state), async (page) => {
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('.wf-input'), (node) => {
      const stepper = node.querySelector('.wf-numstepper');
      return [node.id, stepper
        ? [stepper.querySelector('.wf-numstepper-value').textContent, ...Array.from(stepper.querySelectorAll('button'), (b) => b.disabled)]
        : [node.querySelector('input').value]];
    }));
    const byId = Object.fromEntries(shown);
    const mismatches = Object.keys(state).filter((key) => JSON.stringify(byId[`lit_${key}`]) !== JSON.stringify(byId[`bound_${key}`]))
      .map((key) => `${key}: ${JSON.stringify(byId[`lit_${key}`])} vs ${JSON.stringify(byId[`bound_${key}`])}`);
    assert.deepEqual(mismatches, []);
  });
});
