'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { buildTreeTargets } = require('../../engine/tree');
const { builtinComponentDefinition } = require('../../engine/stdlib');
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

const codes = (entries) => entries.map((entry) => entry.code);

test('a file project validates, trees and builds std patterns, the same one twice included', () => {
  const projectPath = createStdProject([
    { id: 'top', use: 'std.site_header' },
    { id: 'first', use: 'std.data_page' },
    { id: 'second', use: 'std.data_page', props: { title: 'Invoices' } },
    { id: 'bottom', use: 'std.site_footer', slots: { columns: [] } },
  ]);
  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(codes(result.warnings), []);
  assert.deepEqual(codes(result.info), []);

  const nodes = homeNodes(projectPath);
  assert.equal(nodes.get('top__menu').props.variant, 'top');
  assert.equal(nodes.get('second__header').props.title, 'Invoices');
  assert.ok(nodes.has('first__table') && nodes.has('second__table'));
  assert.ok(!nodes.has('bottom__product'), 'columns: [] drops the link columns');

  const build = wf(projectPath, 'build');
  assert.equal(build.status, 0, build.stderr);
  const html = fs.readFileSync(path.join(projectPath, 'wireframes', 'build', 'web', 'home.html'), 'utf8');
  assert.match(html, /id="second__table"/);
});

test('unused-component reports and plain list output are unchanged by the built-ins', () => {
  const plain = createStdProject([{ id: 'hello', component: 'text', props: { text: 'Hi' } }]);
  const withStd = createStdProject([{ id: 'sign_in', use: 'std.login' }, { id: 'lost', use: 'std.not_found' }]);
  for (const projectPath of [plain, withStd]) {
    const components = readYaml(path.join(projectPath, 'components.yaml'));
    components.components = { spare: { root: { id: 'spare', component: 'section' } } };
    writeYaml(path.join(projectPath, 'components.yaml'), components);
  }
  const unused = (projectPath) => runValidate({ projectPath }).warnings.filter((entry) => entry.code === 'UNUSED_COMPONENT');
  assert.deepEqual(unused(withStd), unused(plain));
  assert.deepEqual(unused(withStd).map((entry) => entry.message), ['Component "spare" is not referenced by any page or template.']);
  assert.equal(wf(withStd, 'component', 'list').stdout, 'spare\n');
  assert.equal(wf(withStd, 'component', 'list').stdout, wf(plain, 'component', 'list').stdout);
  assert.equal(wf(plain, 'component', 'list', '--std').stdout, [
    'std.data_page', 'std.hero', 'std.login', 'std.not_found',
    'std.settings_page', 'std.signup', 'std.site_footer', 'std.site_header', '',
  ].join('\n'));
});

test('a project std alias wins per id and reports STD_ALIAS_SHADOWED', () => {
  const projectPath = createStdProject([{ id: 'sign_in', use: 'std.login' }, { id: 'banner', use: 'std.hero' }]);
  writeYaml(path.join(projectPath, 'shared', 'std.yaml'), {
    documentType: 'components', specVersion: '1.1', id: 'mine',
    components: { login: { root: { id: 'login', component: 'text', props: { text: 'Our login' } } } },
  });
  const components = readYaml(path.join(projectPath, 'components.yaml'));
  components.imports = { std: './shared/std.yaml' };
  writeYaml(path.join(projectPath, 'components.yaml'), components);

  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  const info = result.info.filter((entry) => entry.code === 'STD_ALIAS_SHADOWED');
  assert.equal(info.length, 1);
  assert.match(info[0].message, /components\.yaml imports components as "std"/);
  assert.match(info[0].message, /shadowed: std\.login\)/);

  const nodes = homeNodes(projectPath);
  assert.equal(nodes.get('sign_in').component, 'text', 'the project definition wins');
  assert.equal(nodes.get('sign_in').props.text, 'Our login');
  assert.ok(nodes.has('banner__title'), 'an id the alias lacks falls back to the built-in');
  assert.equal(wf(projectPath, 'component', 'list').stdout, '', 'imported ids stay out of the plain list, as before');
});

test('a page-level std alias is reported against that page', () => {
  const projectPath = createStdProject([{ id: 'sign_in', use: 'std.login' }]);
  writeYaml(path.join(projectPath, 'pages', 'kit.yaml'), {
    documentType: 'components', specVersion: '1.1', id: 'kit', components: {},
  });
  const page = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  page.imports = { std: './kit.yaml' };
  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), page);
  fs.renameSync(path.join(projectPath, 'pages', 'kit.yaml'), path.join(projectPath, 'kit.yaml'));
  page.imports = { std: '../kit.yaml' };
  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), page);

  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  const info = result.info.filter((entry) => entry.code === 'STD_ALIAS_SHADOWED');
  assert.equal(info.length, 1);
  assert.match(info[0].message, /^page "home" imports components as "std"/);
  assert.ok(homeNodes(projectPath).has('sign_in__email'), 'an empty alias shadows nothing');
});

test('wf component copy writes into components.yaml, refuses collisions, and the copy builds and edits', () => {
  const projectPath = createStdProject([{ id: 'lost', use: 'lost_page', props: { title: 'Gone fishing' } }]);
  const copied = wf(projectPath, 'component', 'copy', 'std.not_found', '--as', 'lost_page');
  assert.equal(copied.status, 0, copied.stderr);
  assert.equal(copied.stdout, 'Copied std.not_found to components.yaml as "lost_page".\nUse it with: use: lost_page\n');

  const again = wf(projectPath, 'component', 'copy', 'std.not_found', '--as', 'lost_page');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /Component "lost_page" already exists in components\.yaml\. Pick another id with --as <id>\./);

  const componentsPath = path.join(projectPath, 'components.yaml');
  const components = readYaml(componentsPath);
  const copy = components.components.lost_page;
  assert.equal(copy.root.id, 'lost_page');
  const builtin = structuredClone(builtinComponentDefinition('std.not_found'));
  builtin.root.id = 'lost_page';
  assert.deepEqual(copy, builtin, 'the copy is the built-in definition');

  copy.root.children[0].props.icon = 'ghost';
  copy.propDefaults.homeAction = 'Take me home';
  writeYaml(componentsPath, components);
  assert.deepEqual(runValidate({ projectPath }).errors, []);
  assert.ok(homeNodes(projectPath).has('lost__home'));

  const build = wf(projectPath, 'build');
  assert.equal(build.status, 0, build.stderr);
  const html = fs.readFileSync(path.join(projectPath, 'wireframes', 'build', 'web', 'home.html'), 'utf8');
  assert.match(html, /Gone fishing/);
  assert.match(html, /Take me home/, 'the edited copy renders, not the built-in');
  assert.match(html, /fa-ghost/);
});

test('wf component copy creates a missing components.yaml and writes into a --file document', () => {
  const projectPath = createStdProject([]);
  fs.rmSync(path.join(projectPath, 'components.yaml'));
  const created = wf(projectPath, 'component', 'copy', 'std.login');
  assert.equal(created.status, 0, created.stderr);
  assert.match(created.stdout, /^Copied std\.login to components\.yaml \(created\) as "login"\./);
  const fresh = readYaml(path.join(projectPath, 'components.yaml'));
  assert.equal(fresh.documentType, 'components');
  assert.deepEqual(Object.keys(fresh.components), ['login']);

  writeYaml(path.join(projectPath, 'components', 'marketing.yaml'), {
    documentType: 'components', specVersion: '1.1', id: 'marketing', components: {},
  });
  fresh.imports = { mk: './components/marketing.yaml' };
  writeYaml(path.join(projectPath, 'components.yaml'), fresh);
  const intoFile = wf(projectPath, 'component', 'copy', 'std.hero', '--as', 'landing_hero', '--file', 'components/marketing.yaml');
  assert.equal(intoFile.status, 0, intoFile.stderr);
  assert.equal(intoFile.stdout, 'Copied std.hero to components/marketing.yaml as "landing_hero".\nUse it with: use: mk.landing_hero\n');
  assert.deepEqual(Object.keys(readYaml(path.join(projectPath, 'components', 'marketing.yaml')).components), ['landing_hero']);

  const page = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  page.page.slots = [{ slotId: 'main', content: [{ id: 'hero', use: 'mk.landing_hero' }, { id: 'sign_in', use: 'login' }] }];
  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), page);
  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(codes(result.warnings), []);
});

test('wf component copy refuses what it cannot copy or where it cannot write', () => {
  const projectPath = createStdProject([]);
  const cases = [
    [['std.missing'], /"std\.missing" is not a built-in std pattern/],
    [['std.login', '--as', 'Bad-Id'], /Invalid component id "Bad-Id"/],
    [['std.login', '--file', 'nowhere.yaml'], /nowhere\.yaml does not exist/],
    [['std.login', '--file', 'templates.yaml'], /templates\.yaml is a templates document, not a components document/],
  ];
  const before = fs.readFileSync(path.join(projectPath, 'components.yaml'), 'utf8');
  for (const [args, message] of cases) {
    const result = wf(projectPath, 'component', 'copy', ...args);
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, message);
  }
  assert.equal(wf(projectPath, 'component', 'copy').status, 2);
  assert.equal(wf(projectPath, 'component', 'copy', 'std.login', '--as').status, 2);
  assert.equal(fs.readFileSync(path.join(projectPath, 'components.yaml'), 'utf8'), before, 'nothing was written');
});

test('built-ins are read-only, and every refusal points to wf component copy', () => {
  const projectPath = createStdProject([{ id: 'sign_in', use: 'std.login' }]);
  const hint = /std\.login" is a built-in std pattern and is read-only\. Run `wf component copy std\.login`/;

  const removed = wf(projectPath, 'component', 'remove', 'std.login');
  assert.equal(removed.status, 1);
  assert.match(removed.stderr, hint);

  const updated = wf(projectPath, 'node', 'update', 'wf://component/std.login#login.card', '--props', '{"title":"Hi"}');
  assert.notEqual(updated.status, 0);
  assert.match(updated.stderr, hint);

  const inspected = wf(projectPath, 'inspect', 'wf://component/std.login#login.card.form.email');
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.match(inspected.stdout, /"inputType": "email"/);

  const shown = wf(projectPath, 'component', 'show', 'std.login');
  assert.equal(shown.status, 0, shown.stderr);
  assert.match(shown.stdout, /^Component: std\.login\nCentred sign-in card/);
  assert.match(shown.stdout, /Source: built-in, read-only \(edit a copy: wf component copy std\.login\)/);
  assert.match(shown.stdout, /alternatives\s+fallback: or \(component:divider\), sso_row \(component:row\)/);

  const tree = wf(projectPath, 'tree', 'component', 'std.hero');
  assert.equal(tree.status, 0, tree.stderr);
  assert.match(tree.stdout, /media_image \(component:image\)/);
});

test('wf node add can place a std pattern by id', () => {
  const projectPath = createStdProject([{ id: 'holder', component: 'section', children: [] }]);
  const added = wf(projectPath, 'node', 'add', 'std.hero', '--inside', 'wf://page/home#main.holder', '--id', 'promo');
  assert.equal(added.status, 0, added.stderr);
  assert.ok(homeNodes(projectPath).has('promo__title'));
});
