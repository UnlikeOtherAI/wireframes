import test from 'node:test';
import assert from 'node:assert/strict';
import { assertComponentExpansion, createWireframe, parseProject, renderProject, serializeWf } from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, SITEMAP_BASIC, TEMPLATES_YAML } from './fixtures.mjs';

const doc = (value) => JSON.stringify({ specVersion: '1.1', ...value });

// No components document anywhere: every `std.*` comes from the bundle.
const page = (content) => doc({
  documentType: 'page', id: 'home',
  page: { template: 'main', viewport: { device: 'web' }, slots: [{ slotId: 'body', content }] },
});

const files = (content) => ({
  'manifest.yaml': MANIFEST_YAML,
  'sitemap.yaml': SITEMAP_BASIC,
  'templates.yaml': TEMPLATES_YAML,
  'pages/home.yaml': page(content),
});

test('std patterns resolve in the browser bundle for a project with no component file', () => {
  const html = renderProject(files([
    { id: 'top', use: 'std.site_header', props: { brand: 'Northwind' } },
    { id: 'hero', use: 'std.hero', props: { title: 'Plan the launch' },
      slots: { media: [{ id: 'hero_chart', component: 'chart', props: { chartType: 'line' } }] } },
    { id: 'customers', use: 'std.data_page' },
    { id: 'orders', use: 'std.data_page', props: { title: 'Orders' }, slots: { filters: [] } },
    { id: 'sign_in', use: 'std.login', slots: { alternatives: [] } },
  ])).pages.get('home');

  assert.match(html, /Northwind/, 'props reach the pattern');
  assert.match(html, /wf-nav-top/, 'the site header draws nav variant top');
  assert.match(html, /Plan the launch/);
  assert.match(html, /id="hero_chart"/, 'a page fill replaces the media fallback');
  assert.doesNotMatch(html, /id="hero__media_image"/, 'the fallback is not drawn when the slot is filled');
  assert.match(html, /id="customers__filter_bar"/, 'an omitted fill draws the fallback');
  assert.doesNotMatch(html, /id="orders__filter_bar"/, 'an empty fill leaves the slot empty');
  assert.match(html, /id="customers__table"/);
  assert.match(html, /id="orders__table"/, 'the same pattern twice gets separate ids');
  assert.match(html, /Orders/);
  assert.match(html, /id="sign_in__email"/);
  assert.doesNotMatch(html, /single sign-on/, 'alternatives: [] removes the SSO fallback');
});

test('a .wf project with no components document mounts a std pattern', () => {
  const saved = { document: globalThis.document, window: globalThis.window };
  const frame = {
    style: {}, setAttribute() {}, addEventListener() {}, remove() {},
    set srcdoc(html) { this.html = html; },
  };
  globalThis.document = { createElement: () => frame };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const wfText = serializeWf(files([{ id: 'lost', use: 'std.not_found', props: { title: 'Nothing here' } }]));
    assert.doesNotMatch(wfText, /documentType: components/);
    const wf = createWireframe({ appendChild() {} }, wfText);
    assert.match(wf.html(), /Nothing here/);
    assert.match(wf.html(), /id="lost__home"/, 'the fallback actions are drawn');
  } finally {
    globalThis.document = saved.document;
    globalThis.window = saved.window;
  }
});

test('the project wins over a built-in std pattern of the same id', () => {
  const source = files([{ id: 'sign_in', use: 'std.login' }]);
  source['components.yaml'] = doc({ documentType: 'components', id: 'components', components: {}, imports: { std: './mine.yaml' } });
  source['mine.yaml'] = doc({ documentType: 'components', id: 'mine', components: {
    login: { root: { id: 'login', component: 'text', props: { text: 'Our own login' } } },
  } });
  const html = renderProject(source).pages.get('home');
  assert.match(html, /Our own login/);
  assert.doesNotMatch(html, /sign_in__email/);
});

test('the expansion guard knows the built-ins', () => {
  assert.ok(assertComponentExpansion([{ id: 'x', use: 'std.settings_page' }], {}) > 10);
  assert.throws(() => assertComponentExpansion([{ id: 'x', use: 'std.nope' }], {}), /Unknown component: std\.nope/);
});

// `kit` imports its own `std` alias, which defines only `badge`.
const nestedStd = (content) => ({
  ...files(content),
  'components/kit.yaml': doc({ documentType: 'components', id: 'kit', imports: { std: './mine.yaml' }, components: {
    landing: { root: { id: 'landing', component: 'section', children: [
      { id: 'tag', use: 'std.badge' },
      { id: 'banner', use: 'std.hero', props: { title: 'Kit hero' } },
    ] } },
  } }),
  'components/mine.yaml': doc({ documentType: 'components', id: 'mine', components: {
    badge: { root: { id: 'badge', component: 'text', props: { text: 'Kit badge' } } },
  } }),
});

test('a module std alias shadows only its own ids in the browser bundle', () => {
  const rooted = nestedStd([{ id: 'promo', use: 'kit.landing' }]);
  rooted['components.yaml'] = doc({ documentType: 'components', id: 'components', components: {}, imports: { kit: './components/kit.yaml' } });
  const html = renderProject(rooted).pages.get('home');
  assert.match(html, /Kit badge/, 'the module alias wins for badge');
  assert.match(html, /id="promo__banner__title"[^>]*><h1>Kit hero/, 'std.hero falls back to the built-in');

  const paged = nestedStd([{ id: 'promo', use: 'kit.landing' }]);
  paged['pages/home.yaml'] = paged['pages/home.yaml'].replace('"documentType":"page"', '"documentType":"page","imports":{"kit":"../components/kit.yaml"}');
  assert.match(renderProject(paged).pages.get('home'), /Kit hero/, 'the same through a page import');

  const registry = parseProject(rooted).documentMap.componentRegistriesByFile.get('components/kit.yaml');
  assert.deepEqual(registry.components[`${registry.namespace}.landing`].root.children.map((node) => node.use),
    [`${registry.namespace}.std.badge`, 'builtin:std.hero'], 'the per-file registry an editor previews with resolves the same way');
});

test('a module std alias that lacks an id reaches the built-in, not the project std alias', () => {
  const shadow = doc({ documentType: 'components', id: 'global', components: {
    hero: { root: { id: 'hero', component: 'text', props: { text: 'Root shadow' } } },
  } });
  const rooted = nestedStd([{ id: 'promo', use: 'kit.landing' }, { id: 'own', use: 'std.hero' }]);
  rooted['components.yaml'] = doc({ documentType: 'components', id: 'components', components: {},
    imports: { kit: './components/kit.yaml', std: './components/global.yaml' } });
  rooted['components/global.yaml'] = shadow;
  const html = renderProject(rooted).pages.get('home');
  assert.match(html, /Kit badge/);
  assert.match(html, /id="promo__banner__title"[^>]*><h1>Kit hero/, 'the module std.hero is the built-in');
  assert.equal(html.match(/Root shadow/g)?.length, 1, 'only the page std.hero is the project shadow');

  const paged = nestedStd([{ id: 'promo', use: 'kit.landing' }, { id: 'own', use: 'std.hero' }]);
  paged['components.yaml'] = doc({ documentType: 'components', id: 'components', components: {},
    imports: { std: './components/global.yaml' } });
  paged['components/global.yaml'] = shadow;
  paged['pages/home.yaml'] = paged['pages/home.yaml'].replace('"documentType":"page"', '"documentType":"page","imports":{"kit":"../components/kit.yaml"}');
  const pagedHtml = renderProject(paged).pages.get('home');
  assert.match(pagedHtml, /id="promo__banner__title"[^>]*><h1>Kit hero/, 'the same through a page import');
  assert.equal(pagedHtml.match(/Root shadow/g)?.length, 1);
});
