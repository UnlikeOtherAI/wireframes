'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { pathToFileURL } = require('node:url');
const { skinProject, acme } = require('./fixtures/skin-project');
const { updateDesignSystem } = require('../../engine/design-system');
const { buildCataloguePage } = require('../../engine/catalogue');
const { PRIMITIVES } = require('../../engine/schema/primitive-registry');
const { renderPage } = require('../../engine/build');
const { runBuild } = require('../../engine/build/fs-writer');
const { fileNameFor } = require('../../engine/wf-format');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');

let browser;
const evidence = process.env.WF_SKIN_EVIDENCE;
test.before(async () => {
  browser = await launchChromium(require('playwright'), { headless: true });
  if (evidence) fs.mkdirSync(evidence, { recursive: true });
});
test.after(async () => { await browser?.close(); });
function project(mode = 'card') {
  const map = updateDesignSystem(skinProject(), { skin: { id: 'acme', value: acme }, activeSkin: 'acme' }).documentMap;
  map.pages.get('home').page.rendering = { mode };
  return map;
}
async function inspect(page) {
  return page.evaluate(() => {
    const painted = (selector) => {
      const el = document.querySelector(selector);
      const css = getComputedStyle(el);
      return { text: css.color, fill: css.backgroundColor, border: css.borderTopColor, radius: css.borderTopLeftRadius };
    };
    return {
      card: painted('#card'), primary: painted('#primary button'), local: painted('#local button'),
      icon: painted('#primary .wf-icon-glyph'), secondary: painted('#secondary button'),
      input: painted('#email .wf-control'), invalid: painted('#invalid .wf-control'),
      error: painted('#invalid .wf-field-error'), danger: painted('#danger button'),
      action: painted('#card .wf-act'), toggle: painted('#toggle .wf-toggle-track'),
      progress: painted('#progress .wf-progress-fill'), status: painted('#status .wf-badge-body'),
      radio: getComputedStyle(document.querySelector('#radio .wf-radio-mark'), '::after').backgroundColor,
      disabled: document.querySelector('#disabled button').disabled,
    };
  });
}
function expected(result) {
  assert.equal(result.card.fill, 'rgb(250, 229, 242)');
  assert.equal(result.card.radius, '24px');
  assert.equal(result.primary.fill, 'rgb(20, 87, 217)');
  assert.equal(result.primary.text, 'rgb(255, 255, 255)');
  assert.equal(result.icon.text, result.primary.text);
  assert.equal(result.primary.radius, '9999px');
  assert.equal(result.local.radius, '8px');
  assert.equal(result.secondary.radius, '12px');
  assert.equal(result.input.radius, '10px');
  assert.equal(result.input.fill, 'rgb(255, 255, 255)');
  assert.equal(result.invalid.border, 'rgb(192, 68, 60)');
  assert.equal(result.error.text, 'rgb(192, 68, 60)');
  assert.equal(result.danger.text, 'rgb(192, 68, 60)');
  assert.equal(result.action.fill, result.primary.fill);
  assert.equal(result.action.text, result.primary.text);
  assert.equal(result.action.radius, result.primary.radius);
  assert.equal(result.toggle.fill, 'rgb(20, 87, 217)');
  assert.equal(result.progress.fill, 'rgb(20, 87, 217)');
  assert.equal(result.radio, 'rgb(20, 87, 217)');
  assert.equal(result.status.text, 'rgb(47, 143, 85)');
  assert.equal(result.disabled, true);
}
for (const mode of ['card', 'line']) {
  test('iOS ' + mode + ': local corners, company colours, nested controls and state cues', async () => {
    const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
    await page.route('**/*', (route) => route.abort());
    try {
      const output = renderPage(project(mode), 'home', { deviceChrome: false });
      assert.equal(output.ok, true, output.error);
      await page.setContent(output.html, { waitUntil: 'domcontentloaded' });
      expected(await inspect(page));
      await page.locator('#email input').fill('person@example.com');
      assert.equal(await page.locator('#email input').inputValue(), 'person@example.com');
      await page.locator('#email input').focus();
      assert.equal(await page.locator('#email input').evaluate((el) => getComputedStyle(el).outlineColor), 'rgb(20, 87, 217)');
      if (evidence) await page.screenshot({ path: path.join(evidence, 'skins-ios-' + mode + '.png'), fullPage: true });
    } finally { await page.close(); }
  });
}
test('real disk build resolves exactly the same skinned appearance as the browser renderer', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-skin-build-'));
  const source = path.join(base, 'source');
  const output = path.join(base, 'output');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, '.wfrc.yaml'), yaml.dump({ cli: { build: { outputDir: './build', basePath: '..' } } }));
  const map = project();
  const docs = [map.manifest, map.sitemap, map.templates, map.components, ...map.pages.values()];
  for (const document of docs) {
    const file = path.join(source, fileNameFor(document, new Map()));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, yaml.dump(document));
  }
  const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
  try {
    const built = runBuild({ projectPath: source, output, platform: 'tablet', clean: true });
    assert.equal(built.ok, true, JSON.stringify(built));
    assert.equal(built.pages.length, 1);
    await page.goto(pathToFileURL(path.join(output, built.pages[0])).href, { waitUntil: 'domcontentloaded' });
    expected(await inspect(page));
  } finally {
    await page.close();
    fs.rmSync(base, { recursive: true, force: true });
  }
});
test('every registry sample renders and exposes selection while the chosen variant previews', async () => {
  const page = await browser.newPage({ viewport: { width: 1024, height: 1366 } });
  await page.route('**/*', (route) => route.abort());
  try {
    await page.setContent(buildCataloguePage({ documentMap: project(), platform: 'ios', sample: { component: 'button', variant: 'primary' } }), { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('[data-wf-catalogue-component]').count(), PRIMITIVES.length);
    for (const entry of PRIMITIVES) {
      const sample = page.locator('[data-wf-catalogue-component="' + entry.name + '"] .cat-demo');
      const bounds = await sample.boundingBox();
      assert.ok(bounds?.width > 0 && bounds.height > 0, entry.name);
    }
    const button = page.locator('#demo_button button');
    assert.equal(await button.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(20, 87, 217)');
    assert.equal(await page.locator('#el-button').getAttribute('data-wf-catalogue-variant'), 'primary');
    await page.locator('#el-button').scrollIntoViewIfNeeded();
    if (evidence) await page.screenshot({ path: path.join(evidence, 'skins-catalogue-controls.png') });
  } finally { await page.close(); }
});

test('direct rendering rejects hostile appearance CSS and unknown-component attributes', async () => {
  const { renderNode } = require('../../engine/renderer/primitives');
  const { paintMarkup } = require('../../engine/design-system/paint');
  const attack = '\" onmouseover=\"window.skinInjected=true\"><img data-skin-injected src=x onerror=\"window.skinInjected=true\">';
  const style = {
    colors: { text: attack, background: 'url(https://invalid.test/track)', border: attack, accent: attack },
    border: { style: attack, width: attack }, corner: { style: 'rounded', radius: attack },
  };
  const map = project();
  const pageData = map.pages.get('home').page;
  pageData.wireframeStyle = style;
  pageData.slots[0].content.push(
    { id: 'hostile', component: 'button', props: { label: 'Safe button' }, wireframeStyle: style },
    { id: 'unknown', component: attack, wireframeStyle: style },
  );
  const output = renderPage(map, 'home', { deviceChrome: false });
  assert.equal(output.ok, true, output.error);
  const direct = renderNode({ id: 'direct', component: 'button', props: { label: 'Direct' }, wireframeStyle: style },
    { skin: { defaults: style }, pageStyle: style });
  // Escaping remains necessary even if an internal caller supplies unresolved CSS.
  const painted = paintMarkup('<button>Painted</button>', { component: 'button' },
    { colors: { text: attack } }, {});
  const page = await browser.newPage();
  await page.route('**/*', (route) => route.abort());
  try {
    await page.setContent(output.html + direct + painted, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('[data-skin-injected]').count(), 0);
    assert.equal(await page.locator('[onmouseover], [onerror]').count(), 0);
    assert.equal(await page.locator('#unknown').getAttribute('data-wf-skin-role'), '');
    assert.equal(await page.locator('#hostile button').innerText(), 'Safe button');
    assert.equal(await page.locator('#direct button').innerText(), 'Direct');
    assert.equal(await page.evaluate(() => window.skinInjected), undefined);
    assert.equal(await page.locator('#hostile button').evaluate((el) => getComputedStyle(el).backgroundImage), 'none');
  } finally { await page.close(); }
});
