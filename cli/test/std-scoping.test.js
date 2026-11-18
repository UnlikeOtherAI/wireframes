'use strict';

// Where a `std.<name>` id resolves, is inspected and is edited when a project or
// one of its modules imports components under the alias `std`.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { buildTreeTargets } = require('../../engine/tree');
const { loadProjectComponentRegistry } = require('../../engine/component-registry');
const { createStdProject, readYaml, writeYaml } = require('./fixtures/std-project');

const WF = path.join(__dirname, '..', 'bin', 'wf.js');

function wf(projectPath, ...args) {
  return spawnSync(process.execPath, [WF, ...args], { cwd: projectPath, encoding: 'utf8' });
}

function homeNodes(projectPath) {
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  assert.equal(tree.ok, true, tree.error);
  const ids = new Map();
  const visit = (node) => { ids.set(node.id, node); for (const child of node.children || []) visit(child); };
  tree.trees[0].roots.forEach(visit);
  return ids;
}

const componentsDoc = (id, components, imports) => ({
  documentType: 'components', specVersion: '1.1', id, ...(imports ? { imports } : {}), components,
});
const label = (id, text) => ({ root: { id, component: 'text', props: { text } } });

function importFromRoot(projectPath, imports) {
  const filePath = path.join(projectPath, 'components.yaml');
  const components = readYaml(filePath);
  components.imports = imports;
  writeYaml(filePath, components);
}

/** `kit` imports its own `std` alias, which defines only `badge`. */
function nestedStdProject(content, kitImports = { std: './mine.yaml' }) {
  const projectPath = createStdProject(content);
  writeYaml(path.join(projectPath, 'components', 'kit.yaml'), componentsDoc('kit', {
    landing: { root: { id: 'landing', component: 'section', children: [
      { id: 'tag', use: 'std.badge' },
      { id: 'banner', use: 'std.hero', props: { title: 'Kit hero' } },
    ] } },
  }, kitImports));
  writeYaml(path.join(projectPath, 'components', 'mine.yaml'), componentsDoc('mine', {
    badge: label('badge', 'Kit badge'),
  }));
  return projectPath;
}

test('#6 a module std alias wins for the ids it defines and the built-ins stay reachable', () => {
  const projectPath = nestedStdProject([{ id: 'promo', use: 'kit.landing' }]);
  importFromRoot(projectPath, { kit: './components/kit.yaml' });

  const registry = loadProjectComponentRegistry(projectPath);
  assert.equal(registry.ok, true, registry.error);
  assert.deepEqual(registry.registry.components['kit.landing'].root.children.map((node) => node.use),
    ['kit.std.badge', 'std.hero'], 'the module alias qualifies what it defines; the rest keeps the authored built-in id');
  assert.deepEqual(Object.keys(registry.registry.components).sort(), ['kit.landing', 'kit.std.badge'],
    'the built-in never joins the registry');

  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  const nodes = homeNodes(projectPath);
  assert.equal(nodes.get('promo__tag').props.text, 'Kit badge', 'the module std alias wins');
  assert.equal(nodes.get('promo__banner__title').props.text, 'Kit hero', 'std.hero falls back to the built-in');

  const build = wf(projectPath, 'build');
  assert.equal(build.status, 0, build.stderr);
});

test('#6 the module fallback also works for page imports, and the module still reaches its own std hero', () => {
  const projectPath = nestedStdProject([{ id: 'promo', use: 'kit.landing' }]);
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const page = readYaml(pagePath);
  page.imports = { kit: '../components/kit.yaml' };
  writeYaml(pagePath, page);
  assert.deepEqual(runValidate({ projectPath }).errors, []);
  assert.equal(homeNodes(projectPath).get('promo__banner__title').props.text, 'Kit hero');

  const minePath = path.join(projectPath, 'components', 'mine.yaml');
  const mine = readYaml(minePath);
  mine.components.hero = label('hero', 'Module hero');
  writeYaml(minePath, mine);
  assert.deepEqual(runValidate({ projectPath }).errors, []);
  assert.equal(homeNodes(projectPath).get('promo__banner').props.text, 'Module hero', 'the module alias hero wins');
});

test('#6 an id neither the module alias nor the built-ins define is still unknown under its qualified id', () => {
  const projectPath = nestedStdProject([{ id: 'promo', use: 'kit.landing' }]);
  const kitPath = path.join(projectPath, 'components', 'kit.yaml');
  const kit = readYaml(kitPath);
  kit.components.landing.root.children.push({ id: 'odd', use: 'std.nope' });
  writeYaml(kitPath, kit);
  importFromRoot(projectPath, { kit: './components/kit.yaml' });
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  assert.equal(tree.ok, false);
  assert.match(tree.error, /Unknown component reference "kit\.std\.nope"/);
  const build = wf(projectPath, 'build');
  assert.notEqual(build.status, 0);
  assert.match(`${build.stdout}${build.stderr}`, /kit\.std\.nope/);
});
