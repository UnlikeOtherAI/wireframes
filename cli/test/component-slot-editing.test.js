'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { addNode, removeNode, updateNode } = require('../../engine/node');
const { inspectAddress } = require('../../engine/introspection/inspect');
const { renderPage } = require('../../engine/build');
const { loadComponentRegistryForDocuments } = require('../../engine/component-registry');
const { createSlotsProject, readYaml } = require('./fixtures/slots-project');

const homeContent = (projectPath) => readYaml(path.join(projectPath, 'pages', 'home.yaml')).page.slots[0].content;

function loadDocumentMap(projectPath) {
  const read = (relative) => yaml.load(fs.readFileSync(path.join(projectPath, relative), 'utf8'));
  const templates = read('templates.yaml');
  const home = read('pages/home.yaml');
  const registry = loadComponentRegistryForDocuments(projectPath, [
    { documentPath: path.join(projectPath, 'templates.yaml'), document: templates },
    { documentPath: path.join(projectPath, 'pages', 'home.yaml'), document: home },
  ]);
  assert.equal(registry.ok, true, registry.error);
  return {
    manifest: read('manifest.yaml'),
    sitemap: read('sitemap.yaml'),
    templates,
    components: read('components.yaml'),
    pages: new Map([['home', home]]),
    datasets: new Map(),
    componentRegistriesByPage: new Map([['home', registry.registry.components]]),
  };
}

function annotatedHtml(projectPath) {
  const rendered = renderPage(loadDocumentMap(projectPath), 'home', { annotateSource: true, deviceChrome: false });
  assert.equal(rendered.ok, true, rendered.error);
  return rendered.html;
}

const escape = (value) => value.replace(/[.[\]]/g, '\\$&');
function assertStamp(html, id, source, sourcePath) {
  const pattern = new RegExp(`id="${id}"[^>]*data-wf-source="${escape(source)}" data-wf-source-path="${escape(sourcePath)}"`);
  assert.match(html, pattern, `${id} should be stamped ${source} at ${sourcePath}`);
}

test('wf node updates, adds beside and removes nodes in page fills', () => {
  const projectPath = createSlotsProject();

  const update = updateNode({
    projectPath,
    address: 'wf://page/home#main.first_checkout.first_extra',
    props: '{"label":"Keep for later"}',
  });
  assert.equal(update.ok, true, JSON.stringify(update));
  assert.equal(homeContent(projectPath)[0].slots.actions[0].props.label, 'Keep for later');

  const add = addNode({
    projectPath,
    component: 'button',
    below: 'wf://page/home#main.first_checkout.first_extra',
    nodeId: 'share',
    props: '{"label":"Share"}',
  });
  assert.equal(add.ok, true, JSON.stringify(add));
  assert.deepEqual(homeContent(projectPath)[0].slots.actions.map((node) => node.id), ['first_extra', 'share']);

  const inside = addNode({
    projectPath,
    component: 'text',
    inside: 'wf://page/home#main.first_checkout',
    nodeId: 'lead',
    props: '{"text":"Lead"}',
  });
  assert.equal(inside.ok, true, JSON.stringify(inside));
  assert.deepEqual(homeContent(projectPath)[0].children.map((node) => node.id), ['lead', 'page_summary'], '--inside a use: node fills the default slot');

  const duplicate = addNode({
    projectPath,
    component: 'text',
    inside: 'wf://page/home#main.plain_panel',
    nodeId: 'share',
  });
  assert.equal(duplicate.ok, false, 'an id already used inside a fill is taken');
  assert.match(duplicate.error, /already exists/);

  const removal = removeNode({ projectPath, address: 'wf://page/home#main.first_checkout.page_summary' });
  assert.equal(removal.ok, true, JSON.stringify(removal));
  assert.deepEqual(homeContent(projectPath)[0].children.map((node) => node.id), ['lead']);
});

test('wf inspect resolves a node inside a named fill', () => {
  const projectPath = createSlotsProject();
  const result = inspectAddress({ projectPath, address: 'wf://page/home#main.first_checkout.first_extra' });
  assert.equal(result.ok, true, result.error);
  assert.equal(result.node.props.label, 'Save for later');
  assert.equal(result.resolvedAddress, 'wf://page/home#main.first_checkout.first_extra');
});

test('source stamps carry the authoring document and the authored path', () => {
  const html = annotatedHtml(createSlotsProject());

  // Page fills: the page document, through children and through a named slot.
  assertStamp(html, 'page_summary', 'page:home#page_summary', 'page.slots[0].content[0].children[0]');
  assertStamp(html, 'first_extra', 'page:home#first_extra', 'page.slots[0].content[0].slots.actions[0]');
  // A fallback from an imported component file.
  assertStamp(html, 'plain_panel__close', 'component:kit.panel#close', 'root.children[1].children[0]');
  // A fill the forwarding component writes for its nested panel.
  assertStamp(html, 'first_checkout__pay', 'component:kit.checkout#pay', 'root.children[1].slots.footer[0]');
  assertStamp(html, 'second_checkout__pay', 'component:kit.checkout#pay', 'root.children[1].slots.footer[0]');
  // The instance root keeps the page as its source and names its definition.
  assert.match(html, /id="first_checkout"[^>]*data-wf-source="page:home#first_checkout" data-wf-source-path="page\.slots\[0\]\.content\[0\]" data-wf-definition="component:kit\.checkout"/);
});

test('every page-authored stamp addresses its node through the engine', () => {
  const projectPath = createSlotsProject();
  const html = annotatedHtml(projectPath);
  const ids = [...html.matchAll(/id="([a-z0-9_]+)"[^>]*data-wf-source="page:home#\1"/g)].map((match) => match[1]);
  assert.ok(ids.includes('first_extra') && ids.includes('page_summary'), ids.join(','));

  const content = homeContent(projectPath);
  const addressOf = (id) => {
    for (const node of content) {
      if (node.id === id) return `wf://page/home#main.${id}`;
      const lists = [node.children || [], ...Object.values(node.slots || {})];
      if (lists.some((list) => list.some((child) => child.id === id))) return `wf://page/home#main.${node.id}.${id}`;
    }
    return null;
  };
  for (const id of ['first_checkout', 'page_summary', 'first_extra', 'plain_panel']) {
    const result = inspectAddress({ projectPath, address: addressOf(id) });
    assert.equal(result.ok, true, `${id}: ${result.error}`);
    assert.equal(result.node.id, id);
  }
});
