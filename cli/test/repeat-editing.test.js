'use strict';

// A repeat row is addressed by its public id. The address resolves to the item
// with that id wherever it now sits, so inserting, reordering or removing items
// never retargets it, and a stale id fails.

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { inspectAddress } = require('../../engine/introspection');
const { addNode, removeNode, renameRepeatItem, updateNode } = require('../../engine/node');
const { PEOPLE, createRepeatProject, readYaml, writeYaml } = require('./fixtures/repeat-project');

const WF = path.join(__dirname, '..', 'bin', 'wf.js');
const wf = (projectPath, ...args) => spawnSync(process.execPath, [WF, ...args], { cwd: projectPath, encoding: 'utf8' });

const team = () => ({ id: 'team', component: 'grid', layout: { type: 'grid', columns: 3 }, repeat: { cell: 'person_card', items: structuredClone(PEOPLE) } });
const ROW = (id) => `wf://page/home#main.team.team__${id}`;

function project(content = [team()]) {
  return createRepeatProject(content);
}

function items(projectPath) {
  return readYaml(path.join(projectPath, 'pages', 'home.yaml')).page.slots[0].content[0].repeat.items;
}

function reorder(projectPath, order) {
  const file = path.join(projectPath, 'pages', 'home.yaml');
  const doc = readYaml(file);
  const list = doc.page.slots[0].content[0].repeat.items;
  doc.page.slots[0].content[0].repeat.items = order.map((id) => list.find((item) => item.id === id));
  writeYaml(file, doc);
}

test('wf inspect shows a row as its repeat item, at its current index', () => {
  const projectPath = project();
  const before = inspectAddress({ projectPath, address: ROW('grace') });
  assert.equal(before.ok, true, before.error);
  assert.deepEqual(before.repeatItem, {
    host: 'team', hostAddress: 'wf://page/home#main.team', cell: 'person_card', item: 'grace', index: 1,
    file: 'pages/home.yaml', renderedId: 'team__grace',
  });
  assert.deepEqual(before.node, { id: 'team__grace', use: 'person_card', props: { name: 'Grace Hopper', role: 'Editor' } });

  reorder(projectPath, ['grace', 'alan', 'ada']);
  assert.equal(inspectAddress({ projectPath, address: ROW('grace') }).repeatItem.index, 0);
  assert.match(inspectAddress({ projectPath, address: ROW('linus') }).error, /team__linus/);
});

test('update --props merges into the item and keeps its id, after a reorder too', () => {
  const projectPath = project();
  assert.equal(updateNode({ projectPath, address: ROW('grace'), props: '{"role":"Owner"}' }).ok, true);
  reorder(projectPath, ['alan', 'ada', 'grace']);
  const result = updateNode({ projectPath, address: ROW('grace'), props: '{"name":"Rear Admiral Grace Hopper"}' });
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(items(projectPath), [
    { id: 'alan', name: 'Alan Turing', role: 'Viewer' },
    { id: 'ada', name: 'Ada Lovelace', role: 'Admin' },
    { id: 'grace', name: 'Rear Admiral Grace Hopper', role: 'Owner' },
  ]);
  const renamed = updateNode({ projectPath, address: ROW('grace'), props: '{"id":"hopper"}' });
  assert.equal(renamed.ok, false);
  assert.match(renamed.error, /wf node rename/);
});

test('remove takes the item out of the array; its address is then stale', () => {
  const projectPath = project();
  reorder(projectPath, ['alan', 'grace', 'ada']);
  const removed = removeNode({ projectPath, address: ROW('grace') });
  assert.equal(removed.ok, true, removed.error);
  assert.equal(removed.nodeId, 'team__grace');
  assert.deepEqual(items(projectPath).map((item) => item.id), ['alan', 'ada']);
  assert.equal(removeNode({ projectPath, address: ROW('grace') }).ok, false);
  assert.equal(updateNode({ projectPath, address: ROW('grace'), props: '{"role":"x"}' }).ok, false);
});

test('rename changes the item id, so the row id changes with it', () => {
  const projectPath = project();
  const renamed = renameRepeatItem({ projectPath, address: ROW('alan'), itemId: 'turing' });
  assert.equal(renamed.ok, true, renamed.error);
  assert.equal(renamed.nodeId, 'team__turing');
  assert.deepEqual(items(projectPath)[2], { id: 'turing', name: 'Alan Turing', role: 'Viewer' });
  assert.equal(inspectAddress({ projectPath, address: ROW('alan') }).ok, false);
  assert.match(renameRepeatItem({ projectPath, address: ROW('ada'), itemId: 'grace' }).error, /already/);
  assert.match(renameRepeatItem({ projectPath, address: ROW('ada'), itemId: 'Bad Id' }).error, /Invalid/);
  assert.match(renameRepeatItem({ projectPath, address: 'wf://page/home#main.team', itemId: 'x' }).error, /repeat row/);
});

test('operations that would turn a row into a different node are refused', () => {
  const projectPath = project();
  const before = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  for (const attempt of [
    updateNode({ projectPath, address: ROW('ada'), component: 'text' }),
    updateNode({ projectPath, address: ROW('ada'), layout: '{"type":"row"}' }),
    addNode({ projectPath, component: 'text', inside: ROW('ada'), nodeId: 'note' }),
    addNode({ projectPath, component: 'text', below: ROW('ada'), nodeId: 'note' }),
  ]) {
    assert.equal(attempt.ok, false);
    assert.match(attempt.error, /repeat row/);
  }
  assert.deepEqual(readYaml(path.join(projectPath, 'pages', 'home.yaml')), before);
});

test('add --inside the host still adds an authored static child, and a row id is taken', () => {
  const projectPath = project();
  const added = addNode({ projectPath, component: 'heading', inside: 'wf://page/home#main.team', nodeId: 'team_title', props: '{"text":"Team"}' });
  assert.equal(added.ok, true, added.error);
  const host = readYaml(path.join(projectPath, 'pages', 'home.yaml')).page.slots[0].content[0];
  assert.deepEqual(host.children, [{ id: 'team_title', component: 'heading', props: { text: 'Team' } }]);
  assert.equal(host.repeat.items.length, 3);
  const clash = addNode({ projectPath, component: 'text', inside: 'wf://page/home#main.team', nodeId: 'team__ada' });
  assert.match(clash.error, /already exists/);
});

test('a row of a component-owned repeat is edited in the definition', () => {
  const projectPath = project([{ id: 'core', use: 'team_section' }]);
  const address = 'wf://component/team_section#team_section.team.team__grace';
  const inspected = inspectAddress({ projectPath, address });
  assert.equal(inspected.ok, true, inspected.error);
  assert.equal(inspected.repeatItem.file, 'components.yaml');
  assert.equal(inspected.repeatItem.cell, 'person_form');
  assert.equal(updateNode({ projectPath, address, props: '{"name":"Grace B. Hopper"}' }).ok, true);
  const items = readYaml(path.join(projectPath, 'components.yaml')).components.team_section.root.children[0].repeat.items;
  assert.deepEqual(items[1], { id: 'grace', name: 'Grace B. Hopper' });
});

test('wf inspect and wf node run on a row from the command line', () => {
  const projectPath = project();
  const inspected = wf(projectPath, 'inspect', ROW('ada'));
  assert.equal(inspected.status, 0, inspected.stderr);
  assert.match(inspected.stdout, /Repeat item: "ada" of repeat on "team" \(wf:\/\/page\/home#main\.team\), index 0, cell person_card/);
  assert.match(inspected.stdout, /Rendered id: team__ada/);
  assert.match(inspected.stdout, /File: pages\/home\.yaml/);
  assert.equal(wf(projectPath, 'node', 'update', ROW('ada'), '--props', '{"role":"Owner"}').status, 0);
  assert.equal(wf(projectPath, 'node', 'rename', ROW('ada'), 'lovelace').status, 0);
  assert.equal(wf(projectPath, 'node', 'remove', ROW('lovelace')).status, 0);
  assert.deepEqual(items(projectPath).map((item) => item.id), ['grace', 'alan']);
  const refused = wf(projectPath, 'node', 'update', ROW('grace'), '--component', 'text');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /repeat row/);
});
