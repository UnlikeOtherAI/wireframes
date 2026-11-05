'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');
function fixture(defaults = {}) {return renderWireframeMarkup({
  roots: [{id: 'main', kind: 'container', nodes: [
    {id: 'text', component: 'input', props: {label: 'Button text', value: 'Ask us anything'}, stateBindings: {value: '{{state.launcher_text}}'}},
    {id: 'launcher', component: 'button', props: {label: '{{state.launcher_text}}', icon: 'comment'}},
    {id: 'colour', component: 'input', props: {label: 'Colour', inputType: 'color', value: '#123456'}, stateBindings: {value: '{{state.colour}}'}},
    {id: 'saved', component: 'input', props: {label: 'Saved text', value: 'Default'}, stateBindings: {value: '{{appState.saved}}'}}
  ]}], pageViewport: {device: 'web', width: 1280, height: 800}, pageStateDefaults: defaults, deviceChrome: false
});}
test('bound controls initialize missing state from authored defaults without overriding state', async () => {
 const browser = await chromium.launch({headless: true});
 try {
  const context = await browser.newContext();await context.route('https://prototype.test/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
  const page = await context.newPage();await page.goto('https://prototype.test/');
  await page.setContent(fixture());
  assert.equal(await page.getByRole('button', {name: 'Ask us anything', exact: true}).count(), 1);
  await page.getByRole('textbox', {name: 'Button text', exact: true}).fill('Hello');
  assert.equal(await page.getByRole('button', {name: 'Hello', exact: true}).count(), 1);
  await page.getByRole('textbox', {name: 'Saved text', exact: true}).fill('Remember');
  await page.setContent(fixture({launcher_text: 'Configured', colour: '#abcdef'}));
  assert.equal(await page.getByRole('textbox', {name: 'Button text', exact: true}).inputValue(), 'Configured');
  assert.equal(await page.getByRole('button', {name: 'Configured', exact: true}).count(), 1);
  assert.equal(await page.getByRole('textbox', {name: 'Colour hex', exact: true}).inputValue(), '#abcdef');
  assert.equal(await page.getByRole('textbox', {name: 'Saved text', exact: true}).inputValue(), 'Remember');
 } finally {await browser.close();}
});
