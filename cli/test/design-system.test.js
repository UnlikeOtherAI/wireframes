'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { skinProject, acme } = require('./fixtures/skin-project');
const { getDesignSystem, updateDesignSystem } = require('../../engine/design-system');
const { validateDesignSystem } = require('../../engine/design-system/validate');
const { documentAppearance, resolveAppearance } = require('../../engine/design-system/resolve');
const { validateDocument } = require('../../engine/schema');
const { validateProject } = require('../../engine/validate');
const { renderPage } = require('../../engine/build');
const { buildCataloguePage } = require('../../engine/catalogue');
const { PRIMITIVES } = require('../../engine/schema/primitive-registry');

function freeze(value) {
  if (value instanceof Map) for (const entry of value.values()) freeze(entry);
  else if (value && typeof value === 'object') Object.values(value).forEach(freeze);
  if (value && typeof value === 'object') Object.freeze(value);
  return value;
}
const named = () => updateDesignSystem(skinProject(), { skin: { id: 'acme', value: acme }, activeSkin: 'acme' }).documentMap;

test('skin save promotes only the manifest and leaves frozen source and edits untouched', () => {
  const original = freeze(skinProject());
  const change = freeze({ skin: { id: 'acme', value: acme }, activeSkin: 'acme' });
  const result = updateDesignSystem(original, change);
  assert.equal(result.ok, true, result.error);
  assert.equal(original.manifest.specVersion, '1.1');
  assert.equal(original.manifest.manifest.designSystem, undefined);
  assert.equal(result.documentMap.manifest.specVersion, '1.2');
  assert.equal(result.documentMap.pages.get('home').specVersion, '1.1');
  assert.notEqual(result.documentMap.pages, original.pages);
  assert.equal(validateProject(result.documentMap).ok, true);
  assert.throws(() => validateDocument(result.documentMap.manifest, 'old-reader', '1.1'), /Unsupported specVersion/);
  const read = getDesignSystem(result.documentMap);
  read.skins.acme.name = 'Uncommitted';
  assert.equal(result.documentMap.manifest.manifest.designSystem.skins.acme.name, 'Acme');
});

test('ordinary projects retain 1.1 and the built-in selection does not create skin data', () => {
  const source = skinProject();
  const result = updateDesignSystem(source, { activeSkin: 'wireframe' });
  assert.deepEqual(result.documentMap, source);
  const withSkin = named();
  const restored = updateDesignSystem(withSkin, { activeSkin: 'wireframe' }).documentMap;
  assert.equal(restored.manifest.specVersion, '1.2');
  assert.equal(renderPage(restored, 'home').html, renderPage(source, 'home').html);
});

test('schema and semantic validation refuse malformed skin changes atomically', () => {
  const cases = [
    ['bad-id', acme], ['wireframe', acme], ['Acme', acme],
    ['acme', { name: '' }], ['acme', { name: 'Bad', roles: { 'button.custom': {} } }],
    ['acme', { name: 'Bad', defaults: { colors: { text: 'red' } } }],
    ['acme', { name: 'Bad', defaults: { colors: { text: 'transparent' } } }],
    ['acme', { name: 'Bad', defaults: { colors: { accent: { token: 'brand' } } } }],
    ['acme', { name: 'Bad', defaults: { css: 'body{}' } }],
  ];
  for (const [id, value] of cases) {
    const source = skinProject();
    const result = updateDesignSystem(source, { skin: { id, value }, activeSkin: id });
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.ok(result.details.errors.length);
    assert.equal(source.manifest.manifest.designSystem, undefined);
  }
  assert.equal(updateDesignSystem(named(), { activeSkin: 'missing' }).ok, false);
  const wrongVersion = named();
  wrongVersion.manifest.specVersion = '1.1';
  assert.ok(validateDesignSystem(wrongVersion.manifest).some((error) => error.code === 'SKIN_VERSION'));
});

test('metadata covers exactly the registry, all standard variants and defaults', () => {
  const info = getDesignSystem(skinProject());
  assert.deepEqual(info.components.map((entry) => entry.component), PRIMITIVES.map((entry) => entry.name));
  for (const entry of PRIMITIVES) {
    const component = info.components.find((item) => item.component === entry.name);
    assert.deepEqual(component.variants, entry.props?.variant?.enum || []);
    if (component.variants.length) assert.ok(component.variants.includes(component.defaultVariant), entry.name);
  }
  assert.deepEqual(info.components.find((entry) => entry.component === 'spacer').colors, []);
});

test('local numeric corner equal to page still wins over role pill; nested nodes resolve independently', () => {
  const context = documentAppearance(named());
  const primary = resolveAppearance({ component: 'button', props: { variant: 'primary' } }, context);
  const local = resolveAppearance({ component: 'button', props: { variant: 'primary' }, wireframeStyle: { corner: { style: 'rounded', radius: 8 } } }, context);
  assert.equal(primary.corner.style, 'pill');
  assert.deepEqual(local.corner, { style: 'rounded', radius: 8 });
  assert.equal(resolveAppearance({ component: 'input' }, context).corner.radius, 10);
  assert.equal(resolveAppearance({ component: 'card' }, context).corner.radius, 24);
});

test('state colours survive defaults, while explicit danger-role colours are deliberate', () => {
  const context = documentAppearance(named());
  assert.equal(resolveAppearance({ component: 'input', props: { error: 'Required' } }, context).colors.border, undefined);
  assert.equal(resolveAppearance({ component: 'button', props: { variant: 'danger' } }, context).colors.text, undefined);
  assert.equal(resolveAppearance({ component: 'badge', props: { tone: 'success' } }, context).colors.text, undefined);
  context.skin.roles['button.danger'] = { colors: { text: '#A00000' } };
  assert.equal(resolveAppearance({ component: 'button', props: { variant: 'danger' } }, context).colors.text, '#A00000');
});

test('catalogue without a project remains byte-identical; a project exposes all selectable samples', () => {
  assert.equal(buildCataloguePage({ mode: 'card', platform: 'web' }), fs.readFileSync(path.join(__dirname, '../../docs/catalogue/index.html'), 'utf8'));
  const html = buildCataloguePage({ documentMap: named(), sample: { component: 'button', variant: 'link' }, platform: 'ios' });
  for (const entry of PRIMITIVES) assert.ok(html.includes('data-wf-catalogue-component="' + entry.name + '"'), entry.name);
  assert.ok(html.includes('data-wf-catalogue-variant="link"'));
  assert.ok(html.includes('data-wf-skin-role="button.link"'));
  assert.throws(() => buildCataloguePage({ documentMap: named(), sample: { component: 'button', variant: 'custom' } }), /variant/);
});

test('render output carries the same role on standalone and composite buttons without touching content', () => {
  const map = named();
  const output = renderPage(map, 'home');
  assert.equal(output.ok, true, output.error);
  assert.equal((output.html.match(/data-wf-skin-role="button.primary"/g) || []).length, 3);
  assert.ok(output.html.includes('Save action'));
  assert.ok(output.html.includes('Enter an email'));
  const copied = updateDesignSystem(skinProject(), { skin: { id: 'copied', value: getDesignSystem(map).skins.acme }, activeSkin: 'copied' }).documentMap;
  copied.manifest.manifest.designSystem.skins.copied.name = 'Copy';
  assert.equal(getDesignSystem(map).skins.acme.name, 'Acme');
});
