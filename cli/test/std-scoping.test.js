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

/** The root `components.yaml` imports `components/auth.yaml` as `std`; its login has its own root id. */
function shadowingProject() {
  const projectPath = createStdProject([{ id: 'sign_in', use: 'std.login' }, { id: 'banner', use: 'std.hero' }]);
  writeYaml(path.join(projectPath, 'components', 'auth.yaml'), componentsDoc('auth', {
    login: { root: { id: 'custom_login', component: 'section', children: [
      { id: 'heading', component: 'text', props: { text: 'Our login' } },
    ] } },
  }));
  importFromRoot(projectPath, { std: './components/auth.yaml' });
  return projectPath;
}

test('#7 wf inspect reads the project definition a std alias shadows, not the built-in', () => {
  const projectPath = shadowingProject();
  const local = wf(projectPath, 'inspect', 'wf://component/std.login#custom_login.heading');
  assert.equal(local.status, 0, local.stderr);
  assert.match(local.stdout, /Our login/);

  const builtinPath = wf(projectPath, 'inspect', 'wf://component/std.login#login.card.form.email');
  assert.notEqual(builtinPath.status, 0, 'the built-in tree is not what std.login means here');

  const unshadowed = wf(projectPath, 'inspect', 'wf://component/std.hero#hero.copy.title');
  assert.equal(unshadowed.status, 0, unshadowed.stderr);
});

test('#7 node writes edit the shadowing definition in its own file; unshadowed built-ins stay read-only', () => {
  const projectPath = shadowingProject();
  const authPath = path.join(projectPath, 'components', 'auth.yaml');
  const updated = wf(projectPath, 'node', 'update', 'wf://component/std.login#custom_login.heading', '--props', '{"text":"Hello again"}');
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(readYaml(authPath).components.login.root.children[0].props.text, 'Hello again');
  assert.equal(homeNodes(projectPath).get('sign_in__heading').props.text, 'Hello again');

  const added = wf(projectPath, 'node', 'add', 'text', '--below', 'wf://component/std.login#custom_login.heading', '--id', 'note');
  assert.equal(added.status, 0, added.stderr);
  assert.deepEqual(readYaml(authPath).components.login.root.children.map((node) => node.id), ['heading', 'note']);

  const hero = wf(projectPath, 'node', 'update', 'wf://component/std.hero#hero.copy.title', '--props', '{"text":"x"}');
  assert.notEqual(hero.status, 0);
  assert.match(hero.stderr, /std\.hero" is a built-in std pattern and is read-only/);
});

test('#7 remove only refuses a std id as built-in when the project does not define it', () => {
  const projectPath = shadowingProject();
  const removed = wf(projectPath, 'component', 'remove', 'std.login');
  assert.equal(removed.status, 1);
  assert.doesNotMatch(removed.stderr, /built-in/);
  assert.match(removed.stderr, /components\/auth\.yaml/);

  const hero = wf(projectPath, 'component', 'remove', 'std.hero');
  assert.equal(hero.status, 1);
  assert.match(hero.stderr, /std\.hero" is a built-in std pattern and is read-only/);
});

test('#7 wf node add accepts a component only the project std alias defines', () => {
  const projectPath = shadowingProject();
  const authPath = path.join(projectPath, 'components', 'auth.yaml');
  const auth = readYaml(authPath);
  auth.components.badge = label('badge', 'Alias badge');
  writeYaml(authPath, auth);
  const added = wf(projectPath, 'node', 'add', 'std.badge', '--below', 'wf://page/home#main.sign_in', '--id', 'flag');
  assert.equal(added.status, 0, added.stderr);
  assert.equal(homeNodes(projectPath).get('flag').props.text, 'Alias badge');
});

test('#7 an imported component is edited in the file that defines it, unless that file is outside the project', () => {
  const projectPath = createStdProject([{ id: 'cta', use: 'kit.cta' }, { id: 'far', use: 'ext.far' }]);
  const card = (id, text) => ({ root: { id, component: 'section', children: [{ id: 'copy', component: 'text', props: { text } }] } });
  const kitPath = path.join(projectPath, 'components', 'kit.yaml');
  const extPath = path.join(path.dirname(projectPath), 'shared', 'ext.yaml');
  writeYaml(kitPath, componentsDoc('kit', { cta: card('cta', 'Kit CTA') }));
  writeYaml(extPath, componentsDoc('ext', { far: card('far', 'Far away') }));
  importFromRoot(projectPath, { kit: './components/kit.yaml', ext: '../shared/ext.yaml' });
  assert.deepEqual(runValidate({ projectPath }).errors, []);

  const edited = wf(projectPath, 'node', 'update', 'wf://component/kit.cta#cta.copy', '--props', '{"text":"Edited"}');
  assert.equal(edited.status, 0, edited.stderr);
  assert.equal(readYaml(kitPath).components.cta.root.children[0].props.text, 'Edited');

  const inspected = wf(projectPath, 'inspect', 'wf://component/ext.far#far.copy');
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.match(inspected.stdout, /Far away/);
  const before = fs.readFileSync(extPath, 'utf8');
  const refused = wf(projectPath, 'node', 'update', 'wf://component/ext.far#far.copy', '--props', '{"text":"x"}');
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /defined in \.\.\/shared\/ext\.yaml, outside the project/);
  assert.equal(fs.readFileSync(extPath, 'utf8'), before);
});
