'use strict';

// A repeat cell is classified once, as written: an element name or alias wins,
// and anything else is a component reference qualified as `use:` is, so a
// module's cell names the module's component and its `std` misses stay built-in.

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTreeTargets } = require('../../engine/tree');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { createRepeatProject, writeYaml } = require('./fixtures/repeat-project');

const componentsDoc = (id, components, imports) => ({
  documentType: 'components', specVersion: '1.1', id, ...(imports ? { imports } : {}), components,
});
const label = (id, text) => ({ root: { id, component: 'text', props: { text } } });
const crew = (cell) => ({
  root: { id: 'crew', component: 'stack', repeat: { cell, items: [{ id: 'one' }] } },
});

function homeNodes(projectPath) {
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  assert.equal(tree.ok, true, tree.error);
  const ids = new Map();
  const visit = (node) => { ids.set(node.id, node); for (const child of node.children || []) visit(child); };
  tree.trees[0].roots.forEach(visit);
  return ids;
}

/** The project imports `kit`; `kit` holds `crew` with `cell`, and imports what `kitImports` names. */
function kitProject(cell, { kitImports, rootImports = {}, rootComponents = {}, extra = {} } = {}) {
  const projectPath = createRepeatProject([{ id: 'team', use: 'kit.crew' }]);
  writeYaml(path.join(projectPath, 'components.yaml'), componentsDoc('components', {
    person: label('person', 'Project person'),
    ...rootComponents,
  }, { kit: 'components/kit.yaml', ...rootImports }));
  writeYaml(path.join(projectPath, 'components', 'kit.yaml'), componentsDoc('kit', {
    crew: crew(cell),
    person: label('person', 'Kit person'),
  }, kitImports));
  for (const [file, doc] of Object.entries(extra)) writeYaml(path.join(projectPath, 'components', file), doc);
  return projectPath;
}

test("a module's cell names the module's own component, not the project's", () => {
  const nodes = homeNodes(kitProject('person'));
  assert.equal(nodes.get('team__crew__one').props.text, 'Kit person');
  assert.equal(runValidate({ projectPath: kitProject('person') }).ok, true);
});

test("a module's alias.id cell is qualified through the module's import", () => {
  const projectPath = kitProject('ui.badge', {
    kitImports: { ui: './ui.yaml' },
    extra: { 'ui.yaml': componentsDoc('ui', { badge: label('badge', 'Kit badge') }) },
  });
  assert.equal(homeNodes(projectPath).get('team__crew__one').props.text, 'Kit badge');
});

test("a module's std miss stays the built-in under a competing project std alias", () => {
  const projectPath = kitProject('std.hero', {
    kitImports: { std: './mine.yaml' },
    rootImports: { std: 'components/theirs.yaml' },
    extra: {
      'mine.yaml': componentsDoc('mine', { badge: label('badge', 'Mine') }),
      'theirs.yaml': componentsDoc('theirs', { hero: label('hero', 'Project hero') }),
    },
  });
  const row = homeNodes(projectPath).get('team__crew__one');
  assert.notEqual(row.props?.text, 'Project hero');
  assert.equal(row.component, 'row', 'the built-in std.hero renders');
  assert.ok(homeNodes(projectPath).has('team__crew__one__title'));
});

test("a project's std alias wins for a page cell it defines", () => {
  const projectPath = createRepeatProject([{ id: 'heroes', component: 'stack', repeat: { cell: 'std.hero', items: [{ id: 'one' }] } }]);
  writeYaml(path.join(projectPath, 'components.yaml'), componentsDoc('components', {}, { std: 'components/mine.yaml' }));
  writeYaml(path.join(projectPath, 'components', 'mine.yaml'), componentsDoc('mine', { hero: label('hero', 'Project hero') }));
  assert.equal(homeNodes(projectPath).get('heroes__one').props.text, 'Project hero');
});

test('an element name wins over a component with the same id; a qualified reference reaches the component', () => {
  const projectPath = kitProject('stat', { rootComponents: {} });
  writeYaml(path.join(projectPath, 'components', 'kit.yaml'), componentsDoc('kit', {
    crew: { root: { id: 'crew', component: 'stack', children: [
      { id: 'plain', component: 'stack', repeat: { cell: 'stat', items: [{ id: 'one', label: 'Users' }] } },
      { id: 'own', component: 'stack', repeat: { cell: 'local.stat', items: [{ id: 'one' }] } },
    ] } },
  }, { local: './local.yaml' }));
  writeYaml(path.join(projectPath, 'components', 'local.yaml'), componentsDoc('local', { stat: label('stat', 'Component stat') }));
  const nodes = homeNodes(projectPath);
  assert.equal(nodes.get('team__plain__one').component, 'stat');
  assert.equal(nodes.get('team__own__one').props.text, 'Component stat');
});
