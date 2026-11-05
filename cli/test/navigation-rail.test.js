'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { skinProject } = require('./fixtures/skin-project');
const { renderPage } = require('../../engine/build');
const { renderNode } = require('../../engine/renderer/primitives');
const { catalogueModel } = require('../../engine/catalogue/model');

function fixture() {
  const map = skinProject();
  map.manifest.specVersion = '1.2';
  map.manifest.manifest.schemaVersion = '1.2';
  const page = map.pages.get('home').page;
  page.slots[0].content = [{
    id: 'shell', component: 'row', layout: { type: 'row', align: 'stretch', gap: 0 },
    children: [
      { id: 'rail', component: 'nav', role: 'nav', props: { variant: 'rail', items: [
        {label: 'Channels', icon: 'comment', route: 'channels'},
        {label: 'Mail', icon: 'envelope', iconStyle: 'regular', route: 'mail'},
        {label: 'GitHub', icon: 'github', iconStyle: 'brands', route: 'github'},
        {label: 'A long readable caption', route: 'caption'},
        {label: 'Admin', icon: 'gear', route: 'home'},
      ]}},
      { id: 'main_content', component: 'stack', pane: { side: 'center' }, children: [
        {id: 'title', component: 'heading', props: {text: 'Channels'}},
      ]},
    ],
  }];
  map.manifest.manifest.designSystem = {activeSkin: 'acme', skins: {acme: {
    name: 'Acme',
    defaults: {colors: {background: '#FFFFFF', text: '#172033'}},
    roles: {'nav.rail': {colors: {background: '#0B172A', text: '#FFFFFF', accent: '#1457D9'}}},
  }}};
  return map;
}

test('legacy nav keeps transparent defaults; explicit panel backgrounds are exposed and painted', () => {
  const node = {id: 'legacy', component: 'nav', props: {items: [{label: 'Home', route: 'home'}]}};
  const options = {routeTable: {home: '#home'}, skin: {defaults: {colors: {background: '#FAE5F2'}}}};
  const legacy = renderNode(node, options);
  assert.doesNotMatch(legacy.slice(0, legacy.indexOf('>')), /background-color/);
  assert.doesNotMatch(legacy, /wf-nav-rail|wf-nav-sidebar/);
  const named = renderNode(node, {...options, skin: {...options.skin, roles: {nav: {colors: {background: '#242848'}}}}});
  assert.match(named.slice(0, named.indexOf('>')), /background-color:#242848/);
  const header = renderNode({id: 'bar', component: 'app_bar', props: {title: 'Header'}},
    {skin: {roles: {app_bar: {colors: {background: '#0B172A'}}}}});
  assert.match(header.slice(0, header.indexOf('>')), /background-color:#0B172A/);
  for (const name of ['nav', 'app_bar']) assert.ok(catalogueModel().find((entry) => entry.component === name).colors.includes('background'));
  assert.ok(!catalogueModel().find((entry) => entry.component === 'nav').colors.includes('border'));
});

for (const width of [1280, 390]) {
  test('rail keeps clickable labelled targets, styles and explicit sizes at ' + width + 'px', async () => {
    const map = fixture();
    const routes = {home: '#home', channels: '#channels', mail: '#mail', github: '#github', caption: '#caption'};
    const options = {routeTable: routes, deviceChrome: false, viewportOverride: {
      device: width < 600 ? 'mobile' : 'web', platform: 'ios', width, height: 800,
    }};
    const html = renderPage(map, 'home', options);
    assert.equal(html.ok, true, html.error);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-navigation-rail-'));
    const show = async (page, markup) => {
      const css = pathToFileURL(require.resolve('@fortawesome/fontawesome-free/css/all.min.css',
        {paths: [path.resolve(__dirname, '../../engine')]})).href;
      fs.writeFileSync(path.join(temp, 'index.html'), markup.replace(/<link[^>]*fa\/css\/all.min.css[^>]*>/,
        '<link rel="stylesheet" href="' + css + '">'));
      await page.goto(pathToFileURL(path.join(temp, 'index.html')).href);
      await page.evaluate(() => document.fonts.ready);
    };
    const browser = await chromium.launch({headless: true});
    try {
      const page = await browser.newPage({viewport: {width, height: 800}});
      await show(page, html.html);
      const rail = await page.locator('#rail').boundingBox();
      assert.ok(Math.abs(rail.width - 64) <= 1, JSON.stringify(rail));
      for (const label of ['Channels', 'Mail', 'GitHub', 'A long readable caption', 'Admin']) {
        const box = await page.getByRole('link', {name: label, exact: true}).boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, label + ': ' + JSON.stringify(box));
      }
      const icon = await page.getByRole('link', {name: 'Channels', exact: true}).locator('.wf-ico').boundingBox();
      const caption = await page.getByRole('link', {name: 'Channels', exact: true}).locator('.wf-nav-label').boundingBox();
      assert.ok(icon.y + icon.height <= caption.y + 1, 'icon is above the visible label');
      assert.equal(await page.locator('#rail .fa-regular.fa-envelope').count(), 1);
      assert.equal(await page.locator('#rail .fa-brands.fa-github').count(), 1);
      for (const [selector, family, weight] of [
        ['.fa-solid.fa-comment', 'Font Awesome 7 Free', 900],
        ['.fa-regular.fa-envelope', 'Font Awesome 7 Free', 400],
        ['.fa-brands.fa-github', 'Font Awesome 7 Brands', 400],
      ]) {
        const glyph = await page.locator('#rail ' + selector).evaluate((el) => {
          const style = getComputedStyle(el, '::before');
          return {family: style.fontFamily, content: style.content,
            loaded: document.fonts.check(style.fontWeight + ' 20px ' + style.fontFamily)};
        });
        assert.ok(glyph.family.includes(family), JSON.stringify(glyph));
        assert.ok(glyph.loaded && glyph.content !== 'none', JSON.stringify(glyph));
      }
      assert.equal(await page.locator('#rail').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(11, 23, 42)');
      const active = page.getByRole('link', {name: 'Admin', exact: true});
      assert.equal(await active.locator('.wf-ico').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(20, 87, 217)');
      assert.equal(await active.locator('.wf-icon-glyph').evaluate((el) => getComputedStyle(el).color), 'rgb(255, 255, 255)');
      const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
      const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
      assert.ok(contrast([255, 255, 255], [20, 87, 217]) >= 4.5);
      assert.ok(contrast([255, 255, 255], [11, 23, 42]) >= 4.5);
      await page.getByRole('link', {name: 'Mail', exact: true}).click();
      assert.equal(await page.evaluate(() => location.hash), '#mail');
      map.pages.get('home').page.slots[0].content[0].children[0].size = {width: 96};
      await show(page, renderPage(map, 'home', options).html);
      assert.ok(Math.abs((await page.locator('#rail').boundingBox()).width - 96) <= 1);
      map.pages.get('home').page.slots[0].content[0].children[0].props.collapsed = true;
      await show(page, renderPage(map, 'home', options).html);
      assert.equal(await page.getByRole('link', {name: 'Mail', exact: true}).count(), 1, 'collapsed rail retains its name');
    } finally { await browser.close(); fs.rmSync(temp, {recursive: true, force: true}); }
  });
}
