'use strict';

// Read-only controls look read-only, consistently and distinct from disabled,
// and keep the field contract's semantics (render polish item 4, plan §9.2).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { runBuild } = require('../../engine/build/fs-writer');
const { polishProject, writePolishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const ro = { readonly: true };
const CONTROLS = [
  { id: 'email', component: 'input', props: { label: 'Email', value: 'ada@example.com', ...ro } },
  { id: 'notes', component: 'textarea', props: { label: 'Notes', ...ro } },
  { id: 'plan', component: 'select', props: { label: 'Plan', options: ['Free', 'Pro'], value: 'Free', ...ro } },
  { id: 'view', component: 'segmented', props: { label: 'View', options: ['List', 'Grid'], value: 'List', ...ro } },
  { id: 'subscribe', component: 'checkbox', props: { label: 'Subscribe', checked: true, ...ro } },
  { id: 'monthly', component: 'radio', props: { label: 'Monthly', checked: true, ...ro } },
  { id: 'dark', component: 'toggle', props: { label: 'Dark mode', checked: true, ...ro } },
  { id: 'size', component: 'choice_group', props: { label: 'Size', kind: 'radio', options: ['S', 'M'], value: 'M', ...ro } },
  { id: 'tags', component: 'tags_input', props: { label: 'Tags', tags: ['alpha'], ...ro } },
  { id: 'when', component: 'input', props: { label: 'Date', inputType: 'date', value: '2026-11-19', ...ro } },
  { id: 'volume', component: 'input', props: { label: 'Volume', inputType: 'range', value: 40, ...ro } },
  { id: 'seats', component: 'input', props: { label: 'Seats', inputType: 'stepper', value: 3, ...ro } },
  { id: 'code', component: 'input', props: { label: 'Code', inputType: 'otp', ...ro } },
  { id: 'accent', component: 'input', props: { label: 'Accent', inputType: 'color', value: '#3366ff', ...ro } },
  { id: 'repeat', component: 'picker', props: { label: 'Repeat', options: ['Never', 'Daily'], value: 'Daily', ...ro } },
  { id: 'files', component: 'upload', props: { label: 'Drop files', fieldLabel: 'Attachment', ...ro } },
  { id: 'body', component: 'editor', props: { label: 'Body', rows: 3, ...ro } },
];
const EXTRA = [
  { id: 'wrong', component: 'input', props: { label: 'Reference', value: 'INV-1', error: 'Already used', ...ro } },
  { id: 'both', component: 'input', props: { label: 'Both', value: 'BOTH', disabled: true, ...ro } },
  { id: 'off', component: 'input', props: { label: 'Off', value: 'OFF', disabled: true } },
  { id: 'open', component: 'input', props: { label: 'Open', value: 'OPEN' } },
];
const CONTENT = [
  { id: 'profile', component: 'form', children: [...CONTROLS, ...EXTRA] },
  { id: 'send', component: 'button', props: { label: 'Send' }, interaction: [{ type: 'submit', formId: 'profile' }] },
];
// Where each control's read-only state lives (rendering-controls.md, field contract).
const OWNERS = [
  ['#email input', 'readonly', ''], ['#notes textarea', 'readonly', ''],
  ['#plan select', 'aria-readonly', 'true'], ['#subscribe [role=checkbox]', 'aria-readonly', 'true'],
  ['#dark [role=switch]', 'aria-readonly', 'true'], ['#monthly [role=radio]', 'data-wf-readonly', ''],
  ['#size [role=radiogroup]', 'aria-readonly', 'true'], ['#view .wf-segment-track', 'data-wf-readonly', ''],
  ['#volume .wf-range', 'data-wf-readonly', ''], ['#seats .wf-numstepper', 'data-wf-readonly', ''],
  ['#code .wf-otp', 'data-wf-readonly', ''], ['#repeat .wf-picker-wheel', 'data-wf-readonly', ''],
  ['#body .wf-editor-body', 'data-wf-readonly', ''], ['#tags input', 'readonly', ''],
];
// The edge that shows the field box is read-only.
const EDGES = ['#email .wf-control', '#notes textarea', '#plan .wf-control', '#view .wf-segment-track', '#tags .wf-control',
  '#when .wf-control', '#seats .wf-numstepper', '#code .wf-otp-box', '#accent .wf-color'];

// Every control the design lists, and the part a user would press or type into.
const MUTATIONS = [
  ['email', 'input'], ['notes', 'textarea'], ['plan', 'select'], ['view', '.wf-segment:not(.wf-segment-on)'],
  ['subscribe', '.wf-choice'], ['monthly', '.wf-choice'], ['dark', '.wf-choice'], ['size', '.wf-choice:not(.wf-radio-on)'],
  ['tags', '.wf-tags'], ['when', 'input'], ['volume', '.wf-range'], ['seats', '.wf-numstepper'], ['code', '.wf-otp'],
  ['accent', '[data-wf-color-hex]'], ['repeat', '.wf-picker-wheel'], ['files', '.wf-upload-zone'], ['body', '.wf-editor-body'],
];

// The control's markup and the live values of its native fields.
const snapshot = (page, id) => page.locator(`#${id}`).evaluate((node) => ({
  html: node.innerHTML,
  values: [...node.querySelectorAll('input,textarea,select')].map((field) => (field.tagName === 'SELECT'
    ? [...field.options].map((option) => option.selected) : field.value)),
}));

function luminance(value) {
  return value.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const PAGE_BG = { card: 'rgb(243, 244, 246)', line: 'rgb(255, 255, 255)' };

for (const engine of engines()) {
  test(`read-only controls look read-only and keep their semantics in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(CONTENT, { mode }), 'home', { deviceChrome: false });
        assert.equal(result.ok, true, result.error);
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, hasTouch: true });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;

        for (const [selector, attr, value] of OWNERS) {
          assert.equal(await page.locator(selector).first().getAttribute(attr), value, `${label}: ${selector} ${attr}`);
        }
        // The lock is decorative: each real control is named exactly by its label.
        for (const [role, name] of [['textbox', 'Email'], ['textbox', 'Notes'], ['combobox', 'Plan'], ['textbox', 'Tags'],
          ['textbox', 'Date'], ['checkbox', 'Subscribe'], ['switch', 'Dark mode'], ['radio', 'Monthly'], ['radiogroup', 'Size'],
          ['group', 'View']]) {
          assert.equal(await page.getByRole(role, { name, exact: true, includeHidden: true }).count(), 1, `${label}: ${role} "${name}" is named`);
        }

        const classes = await page.evaluate(() => Object.fromEntries(['email', 'both', 'off', 'open', 'wrong']
          .map((id) => [id, document.getElementById(id).classList.contains('wf-field-readonly')])));
        assert.deepEqual(classes, { email: true, both: false, off: false, open: false, wrong: true }, `${label}: disabled wins`);
        for (const id of [...CONTROLS.map((c) => c.id), 'wrong']) {
          assert.equal(await page.locator(`#${id} .wf-field-lock`).count(), 1, `${label}: ${id} has a lock`);
        }
        for (const id of ['both', 'off', 'open']) assert.equal(await page.locator(`#${id} .wf-field-lock`).count(), 0, `${label}: ${id} has no lock`);

        // A dashed edge that reaches 3:1 against the page and the field fill.
        for (const selector of EDGES) {
          const edge = await page.locator(selector).first().evaluate((el) => {
            const s = getComputedStyle(el);
            return { style: s.borderTopStyle, color: s.borderTopColor, fill: s.backgroundColor };
          });
          assert.equal(edge.style, 'dashed', `${label}: ${selector} edge`);
          assert.ok(contrast(edge.color, PAGE_BG[mode]) >= 3, `${label}: ${selector} edge contrast ${edge.color}`);
          if (!/rgba\(0, 0, 0, 0\)/.test(edge.fill)) assert.ok(contrast(edge.color, edge.fill) >= 3, `${label}: ${selector} against its fill`);
        }
        const lock = await page.locator('#email .wf-field-lock').evaluate((el) => getComputedStyle(el).color);
        assert.ok(contrast(lock, PAGE_BG[mode]) >= 3, `${label}: lock contrast ${lock}`);
        const invalid = await page.locator('#wrong .wf-control').evaluate((el) => getComputedStyle(el).borderTopColor);
        assert.equal(invalid, 'rgb(192, 68, 60)', `${label}: read-only keeps the invalid edge`);
        // No affordance suggests the value can change.
        assert.equal(await page.locator('#plan select').evaluate((el) => getComputedStyle(el).appearance), 'none');
        assert.equal(await page.locator('#notes textarea').evaluate((el) => getComputedStyle(el).resize), 'none');
        assert.equal(await page.locator('#seats .wf-numstepper-btn').first().isVisible(), false);
        assert.equal(await page.locator('#off .wf-control input').evaluate((el) => getComputedStyle(el.closest('.wf-control')).borderTopStyle), 'solid');

        // Pointer, touch and keyboard leave every control as it was.
        for (const [id, target] of MUTATIONS) {
          const before = await snapshot(page, id);
          const part = page.locator(`#${id} ${target}`).first();
          await part.scrollIntoViewIfNeeded();
          await part.tap({ force: true });
          await part.click({ force: true });
          // A select's click opens its popup; close it before the keys.
          await page.keyboard.press('Escape');
          await part.focus().catch(() => {});
          await page.keyboard.press('Space');
          await page.keyboard.press('ArrowDown');
          await page.keyboard.type('x');
          if (id === 'accent') {
            await page.locator('#accent [data-wf-color-picker]').evaluate((el) => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
          }
          assert.deepEqual(await snapshot(page, id), before, `${label}: ${id} is unchanged by click, tap and keys`);
        }
        assert.equal(await page.locator('#plan select').inputValue(), 'Free');

        // Read-only values are submitted, with an error too; disabled wins over read-only.
        await page.getByRole('button', { name: 'Send', exact: true }).click();
        const toast = await page.locator('.wf-runtime-toast').last().textContent();
        const payload = JSON.parse(toast.replace(/^Form submitted: /, ''));
        assert.equal(payload.email__input, 'ada@example.com');
        assert.equal(payload.wrong__input, 'INV-1');
        assert.equal(payload.plan, 'Free');
        assert.equal(payload.subscribe, true);
        assert.equal(payload.size, 'M');
        assert.equal(Object.hasOwn(payload, 'both__input'), false);
        assert.equal(Object.hasOwn(payload, 'off__input'), false);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  // The lock is drawn inline, so it shows with the icon font (a built page) and
  // without it (an in-memory page, as the bundle's default mount renders).
  test(`the lock draws with and without the icon font in ${engine.name}`, { skip: engine.skip }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-lock-'));
    const browser = await engine.launch();
    try {
      const project = writePolishProject(path.join(root, 'project'), CONTENT);
      const built = runBuild({ projectPath: project, output: path.join(root, 'build'), platform: 'web', clean: true });
      assert.equal(built.ok, true, built.error);
      for (const mode of ['card', 'line']) {
        const fontless = renderPage(polishProject(CONTENT, { mode }), 'home', { deviceChrome: false });
        for (const [source, open] of [
          ['built', (page) => page.goto(pathToFileURL(path.join(root, 'build', 'web', 'home.html')).href, { waitUntil: 'load' })],
          ['fontless', (page) => page.setContent(fontless.html.replace(/<link rel="stylesheet" href="[^"]*fa\/css\/all\.min\.css"\s*\/>/, ''))],
        ]) {
          if (source === 'built' && mode === 'line') continue;
          const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
          await open(page);
          for (const id of ['plan', 'subscribe', 'view', 'files']) {
            const lock = await page.locator(`#${id} .wf-field-lock`).evaluate((el) => ({
              width: el.getBoundingClientRect().width,
              drawn: [...el.querySelectorAll('path, rect')].some((part) => part.getBBox().width > 0),
            }));
            assert.ok(lock.width >= 8 && lock.drawn, `${engine.name} ${mode} ${source}: ${id} lock draws (${lock.width}px)`);
          }
          await page.close();
        }
      }
    } finally {
      await browser.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
