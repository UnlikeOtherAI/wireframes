'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const playwright = require('playwright');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

// A `form` renders a real <form>, so its buttons are native submit buttons.
// A native submission reloads the page before the prototype's own submit
// interaction can show its result; the runtime must never let that happen.
const html = renderWireframeMarkup({
  roots: [{ id: 'main', kind: 'container', nodes: [
    { id: 'signup', component: 'form', props: { title: 'Sign up', submit: 'Create account' }, children: [
      { id: 'email', component: 'input', props: { label: 'Email', value: 'ada@example.com' } },
      { id: 'send', component: 'button', props: { label: 'Send', variant: 'primary' },
        interaction: [{ type: 'submit', formId: 'signup' }] },
    ] },
  ] }],
  pageViewport: { device: 'web', width: 1280, height: 900 },
  rendering: { mode: 'card' },
  deviceChrome: false,
});

async function withPage(run) {
  const browser = await launchChromium(playwright, { headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent(html);
    await run(page);
  } finally {
    await browser.close();
  }
}

test('a submit interaction inside a form runs without a native page submission', async () => {
  await withPage(async (page) => {
    const marker = await page.evaluate(() => { window.__wfStay = 'kept'; return document.URL; });
    await page.locator('#send button, #send').first().click();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__wfStay), 'kept', 'the page must not reload');
    assert.equal(page.url(), marker);
    const toast = await page.locator('.wf-runtime-toast').last().textContent();
    assert.match(toast, /Form submitted: .*ada@example\.com/);
  });
});

test('the form footer button and Enter in a field never submit the page natively', async () => {
  await withPage(async (page) => {
    await page.evaluate(() => { window.__wfStay = 'kept'; });
    await page.locator('.wf-form-actions button').click();
    await page.locator('#email input').press('Enter');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__wfStay), 'kept', 'the page must not reload');
  });
});
