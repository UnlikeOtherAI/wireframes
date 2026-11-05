'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { skinProject, acme } = require('./fixtures/skin-project');
const { updateDesignSystem, getDesignSystem } = require('../../engine/design-system');
const { safeLogoSource } = require('../../engine/design-system/logos');
const { renderPage } = require('../../engine/build');
const { validateProject } = require('../../engine/validate');

function image(width = 40, height = 20) {
  const png = new PNG({ width, height });
  png.data.fill(128);
  return 'data:image/png;base64,' + PNG.sync.write(png).toString('base64');
}
function project() {
  const logos = Object.fromEntries([1, 2, 3].map((n) => ['logo_' + n, { name: 'Logo ' + n, src: image() }]));
  const edited = updateDesignSystem(skinProject(), { skin: { id: 'acme', value: { ...acme, logos } }, activeSkin: 'acme' });
  assert.equal(edited.ok, true, JSON.stringify(edited));
  const map = edited.documentMap;
  map.pages.get('home').page.slots[0].content.push({
    id: 'company_logo', component: 'image', props: { kind: 'logo', slot: 'logo_1', width: 240, height: 96 },
  });
  return map;
}

test('three named logo slots survive a colour edit and copied skin', () => {
  const map = project();
  const skin = getDesignSystem(map).skins.acme;
  const changed = updateDesignSystem(map, { skin: { id: 'acme', value: { ...skin, defaults: { colors: { text: '#112233' } } } } });
  assert.equal(changed.ok, true);
  assert.deepEqual(getDesignSystem(changed.documentMap).skins.acme.logos, skin.logos);
  const copied = updateDesignSystem(changed.documentMap, { skin: { id: 'copy', value: { ...skin, name: 'Copy' } }, activeSkin: 'copy' });
  assert.deepEqual(getDesignSystem(copied.documentMap).skins.copy.logos, skin.logos);
  assert.equal(validateProject(copied.documentMap).ok, true);
});

test('invalid company logo payloads and fourth slots fail without echoing image bytes', () => {
  for (const src of ['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.test/logo.png', image(1025, 1),
    'data:image/png;base64,' + 'A'.repeat(350000), 'data:image/png;base64,AAAA']) {
    assert.equal(safeLogoSource(src), null);
    const result = updateDesignSystem(skinProject(), { skin: { id: 'acme', value: { ...acme, logos: { logo_1: { name: 'Logo', src } } } } });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result.details.errors).includes(src), false);
  }
  const result = updateDesignSystem(skinProject(), { skin: { id: 'acme', value: { ...acme, logos: { logo_4: { name: 'Fourth', src: image() } } } } });
  assert.equal(result.ok, false);
});

test('logo slot rendering follows the active skin and preserves a missing slot box', () => {
  const map = project();
  const rendered = renderPage(map, 'home', { annotateSource: true });
  assert.equal(rendered.ok, true);
  assert.match(rendered.html, /data-wf-component="image"/);
  assert.match(rendered.html, /data-wf-logo-slot="logo_1"/);
  assert.match(rendered.html, /width:240px;height:96px/);
  assert.match(rendered.html, /object-fit:contain/);
  const wireframe = updateDesignSystem(map, { activeSkin: 'wireframe' });
  const missing = renderPage(wireframe.documentMap, 'home');
  assert.equal(missing.ok, true);
  assert.match(missing.html, /data-wf-logo-slot="logo_1"/);
  assert.match(missing.html, /width:240px;height:96px/);
  assert.doesNotMatch(missing.html, /src="data:image\/png/);
  assert.doesNotMatch(missing.html, /data-wf-component=/);
});

test('a slot without logo kind or invalid container dimensions fails validation', () => {
  for (const props of [{ slot: 'logo_1' }, { kind: 'logo', slot: 'logo_1', width: 0 },
    { kind: 'logo', slot: 'logo_1', width: '100%' }, { kind: 'logo', slot: 'logo_1', height: 4097 }]) {
    const map = project();
    map.pages.get('home').page.slots[0].content.at(-1).props = props;
    assert.equal(validateProject(map).ok, false);
  }
});
