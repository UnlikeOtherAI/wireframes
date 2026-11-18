'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

const pageFor = (nodes, extra = {}) => renderWireframeMarkup({
  roots: [{ id: 'main', kind: 'container', nodes }],
  pageViewport: { device: 'web', width: 1280, height: 900 },
  rendering: { mode: 'card' },
  deviceChrome: false,
  ...extra,
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

const state = (page, selector) => page.locator(selector).evaluate((el) => ({
  pressed: el.getAttribute('aria-pressed'),
  checked: el.getAttribute('aria-checked'),
  selected: el.getAttribute('data-wf-selected'),
  dataPressed: el.getAttribute('data-wf-pressed'),
  dataChecked: el.getAttribute('data-wf-checked'),
}));

const payloadOf = async (page) => {
  const toast = await page.locator('.wf-runtime-toast').last().textContent();
  return JSON.parse(toast.replace(/^Form submitted: /, ''));
};

test('help plus error and readonly plus disabled render and submit through the runtime', async () => {
  const html = pageFor([
    { id: 'profile', component: 'card', props: { title: 'Profile' }, children: [
      { id: 'ref', component: 'input', props: { label: 'Reference', value: 'INV-1', help: 'On invoices', error: 'Already used' } },
      { id: 'code', component: 'input', props: { label: 'Code', value: 'ABC', readonly: true } },
      { id: 'locked', component: 'input', props: { label: 'Locked', value: 'LOCK', disabled: true } },
      { id: 'both', component: 'input', props: { label: 'Both', value: 'BOTH', readonly: true, disabled: true } },
      { id: 'status', component: 'select', props: { label: 'Status', options: ['Draft', 'Live'], value: 'Live', readonly: true } },
      { id: 'tags', component: 'select', props: { label: 'Tags', options: ['A', 'B', 'C'], value: ['A', 'C'], multiple: true } },
      { id: 'notes', component: 'textarea', props: { label: 'Notes', readonly: true, help: 'Set by the system' } },
      // Drawn controls submit under their node id, from the state they show.
      { id: 'agree', component: 'checkbox', props: { label: 'Agree', checked: true } },
      { id: 'kept', component: 'checkbox', props: { label: 'Kept', checked: true, readonly: true } },
      { id: 'gone', component: 'checkbox', props: { label: 'Gone', checked: true, disabled: true } },
      { id: 'partly', component: 'checkbox', props: { label: 'Partly', indeterminate: true } },
      { id: 'annual', component: 'radio', props: { label: 'Annual', checked: true } },
      { id: 'monthly', component: 'radio', props: { label: 'Monthly', disabled: true } },
      { id: 'sync', component: 'toggle', props: { label: 'Sync' } },
      { id: 'period', component: 'segmented', props: { options: ['Day', 'Week'], value: 'Week' } },
      { id: 'billing', component: 'segmented', props: { label: 'Billing', options: [{ label: 'Monthly', value: 'm' }, { label: 'Yearly', value: 'y' }], value: 'y', readonly: true } },
      { id: 'layout', component: 'segmented', props: { options: ['Grid', 'List'], value: 'List', disabled: true } },
      { id: 'plan', component: 'choice_group', props: { label: 'Plan', kind: 'radio', options: ['Free', { label: 'Pro', value: 'pro' }], value: 'pro' } },
      { id: 'alerts', component: 'choice_group', props: { label: 'Alerts', options: ['Mail', 'SMS', 'Push'], value: ['Mail', 'Push'], readonly: true } },
      { id: 'quiet', component: 'choice_group', props: { label: 'Quiet', options: ['Night'], value: 'Night', disabled: true } },
      { id: 'repeat', component: 'picker', props: { options: ['Never', { label: 'Daily', value: 'd' }, 'Weekly'], value: 'd' } },
      { id: 'blank', component: 'picker', props: { options: ['One', 'Two'] } },
      { id: 'frozen', component: 'picker', props: { options: ['X', 'Y'], value: 'Y', disabled: true } },
    ] },
    { id: 'send', component: 'button', props: { label: 'Send' }, interaction: [{ type: 'submit', formId: 'profile' }] },
  ]);
  await withPage(html, async (page) => {
    const ref = page.locator('#ref__input');
    assert.equal(await ref.getAttribute('aria-describedby'), 'ref__error');
    assert.equal(await ref.getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#ref__error').textContent(), 'Already used');
    assert.equal(await page.getByText('On invoices').count(), 0, 'the error replaces the help');
    assert.equal(await page.locator('#notes textarea').getAttribute('aria-describedby'), 'notes__help');

    assert.equal(await page.locator('#code__input').isEditable(), false);
    assert.equal(await page.locator('#code__input').isEnabled(), true);
    assert.equal(await page.locator('#both__input').isEnabled(), false);
    assert.equal(await page.locator('#both__input').getAttribute('readonly'), '');

    // A read-only select puts back any change.
    await page.locator('#status select').selectOption('Draft');
    assert.equal(await page.locator('#status select').inputValue(), 'Live');

    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const payload = await payloadOf(page);
    assert.equal(payload.ref__input, 'INV-1');
    assert.equal(payload.code__input, 'ABC', 'read-only values are submitted');
    assert.equal(Object.hasOwn(payload, 'locked__input'), false, 'disabled values are not');
    assert.equal(Object.hasOwn(payload, 'both__input'), false, 'disabled wins over read-only');
    assert.equal(payload.status, 'Live');
    assert.deepEqual(payload.tags, ['A', 'C']);
    assert.equal(payload.notes, '');

    const drawn = ['agree', 'kept', 'partly', 'annual', 'sync', 'period', 'billing', 'plan', 'alerts', 'repeat', 'blank'];
    assert.deepEqual(Object.fromEntries(drawn.map((key) => [key, payload[key]])), {
      agree: true,
      kept: true,
      partly: 'mixed',
      annual: true,
      sync: false,
      period: 'Week',
      billing: 'y',
      plan: 'pro',
      alerts: ['Mail', 'Push'],
      repeat: 'd',
      blank: 'One',
    });
    for (const key of ['gone', 'monthly', 'layout', 'quiet', 'frozen']) {
      assert.equal(Object.hasOwn(payload, key), false, `disabled ${key} is not submitted`);
    }
    const order = Object.keys(payload);
    assert.ok(order.indexOf('notes') < order.indexOf('agree') && order.indexOf('agree') < order.indexOf('repeat'), 'fields go in document order');

    // What the user changes is what goes.
    await page.getByText('Sync', { exact: true }).click();
    await page.getByText('Agree', { exact: true }).click();
    await page.getByText('Partly', { exact: true }).click();
    await page.locator('#period').getByRole('button', { name: 'Day', exact: true }).click();
    await page.locator('#plan').getByText('Free', { exact: true }).click();
    await page.locator('#alerts').getByText('SMS', { exact: true }).click();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const changed = await payloadOf(page);
    assert.deepEqual([changed.sync, changed.agree, changed.partly, changed.period, changed.plan, changed.alerts],
      [true, false, true, 'Day', 'Free', ['Mail', 'Push']]);
  });
});

test('a selected option that is itself disabled is not submitted, as in HTML', async () => {
  const html = pageFor([
    { id: 'opts', component: 'card', props: { title: 'Options' }, children: [
      { id: 'boxes', component: 'choice_group', props: { kind: 'checkbox', options: [
        { label: 'Never', value: 'never', selected: true, disabled: true }, { label: 'Yes', value: 'yes', selected: true }, 'No',
      ] } },
      { id: 'radios', component: 'choice_group', props: { kind: 'radio', options: [
        { label: 'Locked', value: 'locked', selected: true, disabled: true }, 'Open',
      ] } },
      { id: 'many', component: 'select', props: { multiple: true, options: [
        { label: 'Gone', value: 'gone', selected: true, disabled: true }, { label: 'Kept', value: 'kept', selected: true },
      ] } },
      { id: 'one', component: 'select', props: { options: [{ label: 'Gone', value: 'gone', selected: true, disabled: true }, 'Other'] } },
    ] },
    { id: 'send', component: 'button', props: { label: 'Send' }, interaction: [{ type: 'submit', formId: 'opts' }] },
  ]);
  await withPage(html, async (page) => {
    const checked = (id) => page.locator(`#${id} [role]`).evaluateAll((els) => els
      .filter((el) => el.matches('[role=checkbox],[role=radio]'))
      .map((el) => [el.getAttribute('aria-checked'), el.hasAttribute('data-wf-disabled')]));
    assert.deepEqual(await checked('boxes'), [['true', true], ['true', false], ['false', false]], 'the disabled option shows as selected');
    assert.deepEqual(await checked('radios'), [['true', true], ['false', false]]);

    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const payload = await payloadOf(page);
    assert.deepEqual(payload.boxes, ['yes']);
    assert.equal(payload.radios, '', 'a radio group whose choice is disabled submits no choice');
    assert.deepEqual(payload.many, ['kept']);
    assert.equal(payload.one, '');

    // An enabled choice the user makes goes as usual.
    await page.locator('#boxes').getByText('No', { exact: true }).click();
    await page.locator('#radios').getByText('Open', { exact: true }).click();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const changed = await payloadOf(page);
    assert.deepEqual([changed.boxes, changed.radios], [['yes', 'No'], 'Open']);
  });
});

test('pressed buttons and toolbar items toggle with their ARIA and data attributes', async () => {
  const html = pageFor([
    { id: 'bold', component: 'button', props: { label: 'Bold', pressed: false } },
    { id: 'italic', component: 'button', props: { label: 'Italic', icon: 'italic', iconOnly: true, pressed: true } },
    { id: 'tools', component: 'toolbar', props: { items: [
      { label: 'Underline', icon: 'underline', pressed: true },
      { label: 'Wrap', icon: 'paragraph', checked: false },
      { type: 'separator' },
      { label: 'Delete', icon: 'trash', pressed: false, disabled: true },
    ] } },
  ]);
  await withPage(html, async (page) => {
    const bold = page.getByRole('button', { name: 'Bold', exact: true });
    await bold.click();
    assert.deepEqual(await state(page, '#bold button'), { pressed: 'true', checked: null, selected: null, dataPressed: '', dataChecked: null });
    await bold.click();
    assert.deepEqual(await state(page, '#bold button'), { pressed: 'false', checked: null, selected: null, dataPressed: null, dataChecked: null });
    await page.getByRole('button', { name: 'Italic', exact: true }).click();
    assert.equal((await state(page, '#italic button')).pressed, 'false');

    assert.equal(await page.getByRole('toolbar').count(), 1);
    await page.getByRole('button', { name: 'Underline', exact: true }).click();
    assert.deepEqual(await state(page, '#tools [aria-label="Underline"]'), { pressed: 'false', checked: null, selected: null, dataPressed: null, dataChecked: null });
    const wrap = page.getByRole('checkbox', { name: 'Wrap', exact: true });
    await wrap.click();
    assert.deepEqual(await state(page, '#tools [aria-label="Wrap"]'), { pressed: null, checked: 'true', selected: null, dataPressed: null, dataChecked: '' });
    await page.getByRole('button', { name: 'Delete', exact: true }).click({ force: true });
    assert.equal((await state(page, '#tools [aria-label="Delete"]')).pressed, 'false', 'a disabled item does not toggle');
    assert.equal(await page.getByRole('separator').count(), 1);
  });
});

test('checkboxes, toggles, radios and choice groups toggle; read-only and disabled ones do not', async () => {
  const html = pageFor([
    { id: 'agree', component: 'checkbox', props: { label: 'Agree' } },
    { id: 'some', component: 'checkbox', props: { label: 'Some', indeterminate: true } },
    { id: 'fixed', component: 'checkbox', props: { label: 'Fixed', checked: true, readonly: true } },
    { id: 'off', component: 'checkbox', props: { label: 'Off', disabled: true } },
    { id: 'sync', component: 'toggle', props: { label: 'Sync' } },
    { id: 'annual', component: 'radio', props: { label: 'Annual' } },
    { id: 'bound', component: 'checkbox', props: { label: 'Bound' }, stateBindings: { checked: '{{state.accepted}}' } },
    { id: 'plan', component: 'choice_group', props: { label: 'Plan', kind: 'radio', options: ['Free', 'Pro'], value: 'Pro' } },
    { id: 'frozen', component: 'choice_group', props: { label: 'Frozen', kind: 'radio', options: ['X', 'Y'], value: 'Y', readonly: true } },
    { id: 'alerts', component: 'choice_group', props: { label: 'Alerts', kind: 'checkbox', options: ['Mail', 'SMS'] } },
  ], { pageStateDefaults: { accepted: false } });
  await withPage(html, async (page) => {
    const mark = (id) => `#${id} [role]`;
    await page.getByText('Agree', { exact: true }).click();
    assert.deepEqual(await state(page, mark('agree')), { pressed: null, checked: 'true', selected: null, dataPressed: null, dataChecked: '' });
    assert.equal(await page.locator('#agree .wf-choice').evaluate((el) => el.classList.contains('wf-choice-on')), true);
    await page.getByText('Some', { exact: true }).click();
    assert.equal((await state(page, mark('some'))).checked, 'true', 'a mixed checkbox becomes checked');
    assert.equal((await state(page, mark('some'))).dataChecked, '');
    await page.getByText('Fixed', { exact: true }).click();
    assert.equal((await state(page, mark('fixed'))).checked, 'true', 'read-only ignores the click');
    await page.getByText('Off', { exact: true }).click();
    assert.equal((await state(page, mark('off'))).checked, 'false', 'disabled ignores the click');
    await page.getByText('Sync', { exact: true }).click();
    assert.equal(await page.locator('#sync .wf-toggle-track').evaluate((el) => el.classList.contains('wf-toggle-on') && el.getAttribute('aria-checked')), 'true');
    await page.getByText('Annual', { exact: true }).click();
    await page.getByText('Annual', { exact: true }).click();
    assert.equal((await state(page, mark('annual'))).checked, 'true', 'a radio stays on');
    // A bound checkbox writes its state, and the refresh redraws it from state.
    await page.getByText('Bound', { exact: true }).click();
    assert.equal((await state(page, mark('bound'))).checked, 'true');

    await page.locator('#plan').getByText('Free', { exact: true }).click();
    assert.deepEqual(await page.locator('#plan [role=radio]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked'))), ['true', 'false']);
    assert.deepEqual(await page.locator('#plan [role=radio]').evaluateAll((els) => els.map((el) => el.hasAttribute('data-wf-checked'))), [true, false]);
    await page.locator('#frozen').getByText('X', { exact: true }).click();
    assert.deepEqual(await page.locator('#frozen [role=radio]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked'))), ['false', 'true']);
    await page.locator('#alerts').getByText('SMS', { exact: true }).click();
    assert.deepEqual(await page.locator('#alerts [role=checkbox]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-checked'))), ['false', 'true']);
  });
});

test('segment selection moves data-wf-selected with aria-pressed; a read-only one stays', async () => {
  const html = pageFor([
    { id: 'period', component: 'segmented', props: { options: ['Day', 'Week'], value: 'Day' } },
    { id: 'fixed', component: 'segmented', props: { label: 'Fixed', options: ['On', 'Off'], value: 'On', readonly: true } },
    { id: 'hex', component: 'input', props: { label: 'Accent', inputType: 'color', value: '#112233', readonly: true } },
  ]);
  await withPage(html, async (page) => {
    await page.locator('#period').getByRole('button', { name: 'Week', exact: true }).click();
    assert.deepEqual(await page.locator('#period button').evaluateAll((els) => els.map((el) => [el.getAttribute('aria-pressed'), el.hasAttribute('data-wf-selected')])),
      [['false', false], ['true', true]]);
    const group = page.getByRole('group', { name: 'Fixed' });
    await group.getByRole('button', { name: 'Off', exact: true }).click();
    assert.deepEqual(await page.locator('#fixed button').evaluateAll((els) => els.map((el) => el.getAttribute('aria-pressed'))), ['true', 'false']);
    const picker = page.getByLabel('Accent picker', { exact: true });
    await picker.evaluate((el) => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await picker.inputValue(), '#112233', 'a read-only colour puts the picker back');
  });
});
