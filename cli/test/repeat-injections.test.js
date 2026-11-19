'use strict';

// A component may expand to an injectable marker. Before `repeat`, a second
// pass over resolved children gave such a marker its injection; the marker now
// takes it where expansion produces it, like a written one, and each injected
// node is still expanded once.

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { renderPage } = require('../../engine/build');
const { resolveTemplatePage } = require('../../engine/resolver');
const { resolvePageTargets } = require('../../engine/screenshots');
const { documentMap } = require('./fixtures/repeat-project');

const text = (id, value) => ({ id, component: 'text', props: { text: value } });
const HOOK = { hook_def: { root: { id: 'hook_root', injectable: true } } };

function hookMap(content, components = {}) {
  const map = documentMap(content, {
    components: { ...HOOK, ...components },
    page: { injectables: [{ injectableId: 'hook', content: [text('visible', 'Injected')] }] },
  });
  map.templates.templates.main.regions[0].children = [{ id: 'hook', injectable: true }];
  return map;
}

function resolvedMain(map) {
  const result = resolveTemplatePage({
    template: map.templates.templates.main, page: map.pages.get('home').page, components: map.components.components,
  });
  assert.equal(result.ok, true, result.error);
  return result.roots[0].children;
}

test('a marker a component expands to takes its injection, as before repeat', () => {
  const map = hookMap([{ id: 'nest', component: 'stack', children: [{ id: 'hook', use: 'hook_def' }] }]);
  assert.deepEqual(resolvedMain(map), [{ id: 'nest', component: 'stack', children: [text('visible', 'Injected')] }]);
  const result = renderPage(map, 'home');
  assert.equal(result.ok, true, result.error);
  assert.match(result.html, /id="visible"/);
  assert.doesNotMatch(result.html, /id="hook"/);
});

test('a marker produced inside a definition or a fill is resolved where it lands', () => {
  const components = {
    wrap: { root: { id: 'wrap', component: 'stack', children: [{ id: 'hook', use: 'hook_def' }] } },
    frame: { root: { id: 'frame', component: 'card', children: [{ id: 'body', slot: 'default' }] } },
  };
  const [wrapped, framed] = resolvedMain(hookMap([
    { id: 'w', use: 'wrap' },
    { id: 'f', use: 'frame', children: [{ id: 'hook', use: 'hook_def' }] },
  ], components));
  assert.deepEqual(wrapped.children, [], 'a namespaced marker with no injection renders nothing');
  assert.deepEqual(framed.children, [text('visible', 'Injected')]);
});

test('an injection that reaches its own marker does not recurse', () => {
  for (const content of [[{ id: 'hook', injectable: true }], [{ id: 'hook', use: 'hook_def' }]]) {
    const result = resolveTemplatePage({
      template: { regions: [{ id: 'main', kind: 'slot', children: [{ id: 'hook', injectable: true }] }] },
      page: { injectables: [{ injectableId: 'hook', content }] },
      components: HOOK,
    });
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(result.roots[0].children, []);
  }
});

function allNodes(nodes, found = []) {
  for (const node of nodes || []) {
    if (node && typeof node === 'object') {
      found.push(node);
      allNodes([...(node.children || []), ...(node.nodes || []), ...(node.content || [])], found);
    }
  }
  return found;
}

for (const project of [path.join(__dirname, 'fixtures', 'showcase-project'), path.join(__dirname, '..', '..', 'wireframe_studio')]) {
  test(`every injection in ${path.basename(project)} renders, and no marker survives`, () => {
    const targets = resolvePageTargets(project);
    assert.equal(targets.ok, true, targets.error);
    let injected = 0;
    for (const target of targets.targets) {
      const page = yaml.load(fs.readFileSync(path.join(project, 'pages', `${target.pageId}.yaml`), 'utf8')).page;
      const nodes = allNodes(target.roots);
      assert.deepEqual(nodes.filter((node) => node.injectable === true).map((node) => node.id), [], target.pageId);
      const ids = new Set(nodes.map((node) => node.id));
      for (const injection of page.injectables || []) {
        for (const node of injection.content || []) {
          assert.ok(ids.has(node.id), `${target.pageId}: ${injection.injectableId} > ${node.id}`);
          injected += 1;
        }
      }
    }
    assert.ok(injected > 0, 'the project injects content');
  });
}
