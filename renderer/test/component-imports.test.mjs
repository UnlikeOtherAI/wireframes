import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProject, renderProject } from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, TEMPLATES_YAML, simplePage } from './fixtures.mjs';

const components = (id, definitions, imports = {}) => JSON.stringify({
  documentType: 'components', specVersion: '1.1', id, components: definitions, imports,
});
const text = (label) => ({ root: { id: 'label', component: 'text', props: { text: label } } });
const source = () => ({
  'manifest.yaml': MANIFEST_YAML,
  'sitemap.yaml': JSON.stringify({ documentType: 'sitemap', specVersion: '1.1', id: 'sitemap', routes: [
    { id: 'home', path: '/', page: 'home' }, { id: 'about', path: '/about', page: 'about' },
  ] }),
  'templates.yaml': TEMPLATES_YAML,
  'components.yaml': components('components', {}, { shared: 'components/footer.yaml' }),
  'components/footer.yaml': components('footer', {
    footer: { root: { id: 'footer', component: 'section', children: [{ id: 'caption', use: 'copy.caption' }] } },
  }, { copy: './copy.yaml' }),
  'components/copy.yaml': components('copy', { caption: text('Shared across pages') }),
  ...Object.fromEntries(['home', 'about'].map(id => [`pages/${id}.yaml`,
    simplePage(id, id).replace('- component: text\n          id: t1\n          props:\n            text: '+id,
      '- id: footer\n          use: shared.footer') ])),
});

test('browser rendering imports nested component files and reflects a shared edit on both pages', () => {
  const files = source();
  const original = JSON.stringify(files);
  const rendered = renderProject(files);
  assert.match(rendered.pages.get('home'), /Shared across pages/);
  assert.match(rendered.pages.get('about'), /Shared across pages/);
  assert.equal(JSON.stringify(files), original, 'resolution must not rewrite the source files');
  files['components/copy.yaml'] = components('copy', { caption: text('Updated footer') });
  const next = renderProject(files);
  for (const page of next.pages.values()) {
    assert.match(page, /Updated footer/);
    assert.doesNotMatch(page, /Shared across pages/);
  }
});

test('page imports with the same alias resolve independently', () => {
  const files = source();
  for (const id of ['home', 'about']) {
    files[`components/${id}.yaml`] = components(id, { note: text(`${id} only`) });
    files[`pages/${id}.yaml`] = JSON.stringify({ documentType: 'page', specVersion: '1.1', id,
      imports: { local: `../components/${id}.yaml` },
      page: { template: 'main', viewport: { device: 'web' },
        slots: [{ slotId: 'body', content: [{ id: 'note', use: 'local.note' }] }] },
    });
  }
  const rendered = renderProject(files);
  assert.match(rendered.pages.get('home'), /home only/);
  assert.doesNotMatch(rendered.pages.get('home'), /about only/);
  assert.match(rendered.pages.get('about'), /about only/);
  assert.doesNotMatch(rendered.pages.get('about'), /home only/);
});

test('template imports are available to the page renderer', () => {
  const files = source();
  files['templates.yaml'] = JSON.stringify({ documentType: 'templates', specVersion: '1.1', id: 'templates',
    imports: { header: 'components/header.yaml' }, templates: { main: { regions: [
      { id: 'header', kind: 'persistent', children: [{ id: 'site_header', use: 'header.title' }] },
      { id: 'body', kind: 'slot' },
    ] } },
  });
  files['components/header.yaml'] = components('header', { title: text('Imported header') });
  assert.match(renderProject(files).pages.get('home'), /Imported header/);
});

for (const [path, message] of [
  ['components/missing.yaml', /does not exist/], ['../outside.yaml', /escapes the project/],
  ['/outside.yaml', /relative project path/], ['https://example.invalid/module.yaml', /relative project path/],
  ['pages/home.yaml', /must be a components document/],
]) test(`browser imports refuse ${path}`, () => {
  const files = source();
  files['components.yaml'] = components('components', {}, { shared: path });
  assert.throws(() => parseProject(files), message);
});

test('browser imports refuse circular modules, bad aliases and conflicting definitions', () => {
  const files = source();
  files['components/copy.yaml'] = components('copy', { caption: text('Cycle') }, { cycle: '../components.yaml' });
  assert.throws(() => parseProject(files), /Circular component import/);
  files['components/copy.yaml'] = components('copy', { caption: text('Copy') });
  files['components.yaml'] = components('components', {}, { 'Bad-alias': 'components/footer.yaml' });
  assert.throws(() => parseProject(files), /Invalid import alias/);
  files['components.yaml'] = components('components', {}, { shared: 'components/copy.yaml' });
  files['templates.yaml'] = JSON.stringify({ documentType: 'templates', id: 'templates',
    imports: { shared: 'components/other.yaml' }, templates: {} });
  files['components/other.yaml'] = components('other', { caption: text('Other') });
  assert.throws(() => parseProject(files), /Duplicate component id/);
});

test('virtual import expansion has a finite budget even without a cycle', () => {
  const files = source();
  files['components.yaml'] = components('components', {}, { shared: 'components/0.yaml' });
  for (let index = 0; index < 14; index++) files[`components/${index}.yaml`] = components(`module${index}`, {},
    index === 13 ? {} : { left: `./${index + 1}.yaml`, right: `./${index + 1}.yaml` });
  assert.throws(() => parseProject(files), /expansion is too large/);
});

test('recursive YAML aliases are refused before component cloning', () => {
  const files = source();
  files['components/copy.yaml'] = 'documentType: components\nid: copy\ncomponents:\n  caption:\n    root: &loop {id: recursive, component: section, children: [*loop]}\n';
  assert.throws(() => parseProject(files), /recursive YAML aliases/);
});

test('source annotations survive imported page registries', async () => {
  const { createRequire } = await import('node:module');
  const { renderPage } = createRequire(import.meta.url)('../../engine/build/index.js');
  const { documentMap } = parseProject(source());
  const before = JSON.stringify([...documentMap.componentRegistriesByPage]);
  const { html } = renderPage(documentMap, 'home', { annotateSource: true });
  assert.match(html, /data-wf-definition="component:shared.footer"/);
  assert.match(html, /data-wf-definition="component:shared.copy.caption"/);
  assert.equal(JSON.stringify([...documentMap.componentRegistriesByPage]), before);
});

test('legacy singleton component documents retain arbitrary paths and yml suffixes', () => {
  for (const path of ['library.yaml', 'shared/library.yml']) {
    const files = source();
    delete files['components.yaml'];
    files[path] = components('library', { 'shared.footer': text('Legacy footer') });
    assert.match(renderProject(files).pages.get('home'), /Legacy footer/);
  }
});

test('unused module registries are available for bounded previews without polluting pages', async () => {
  const files = source();
  files['components/unused.yaml'] = components('unused', { note: text('Unused module') });
  const { documentMap } = parseProject(files);
  assert.ok(documentMap.componentRegistriesByFile.get('components/unused.yaml').note);
  assert.equal(documentMap.componentRegistriesByPage.get('home').note, undefined);
  const { assertComponentExpansion } = await import('../bundle/wireframe-renderer.min.js');
  const definitions = { leaf: text('Leaf') };
  for (let i = 0; i < 18; i++) definitions[`level${i}`] = { root: { id: `node${i}`, component: 'section',
    children: [0, 1].map(n => ({ id: `use${n}`, use: i ? `level${i - 1}` : 'leaf' })) } };
  assert.throws(() => assertComponentExpansion(Object.values(definitions), definitions), /too large/);
});

test('module preview guards retain global and template context with module-local shadowing', async () => {
  const { assertComponentExpansion } = await import('../bundle/wireframe-renderer.min.js');
  const files = source();
  const root = JSON.parse(files['components.yaml']);
  root.components.global_label = text('Global label');
  files['components.yaml'] = JSON.stringify(root);
  files['components/footer.yaml'] = components('footer', { footer: { root: { id: 'footer', use: 'global_label' } } });
  const { documentMap } = parseProject(files);
  const definitions = documentMap.componentRegistriesByFile.get('components/footer.yaml');
  assert.ok(assertComponentExpansion([definitions.footer], definitions) > 0);
  assert.match(renderProject(files).pages.get('home'), /Global label/);
  files['components/footer.yaml'] = components('footer', {
    footer: { root: { id: 'footer', use: 'global_label' } }, global_label: text('Module label'),
  });
  const local = parseProject(files).documentMap.componentRegistriesByFile.get('components/footer.yaml');
  assert.equal(local.global_label.root.props.text, 'Module label');
  assert.match(renderProject(files).pages.get('home'), /Module label/);
});
