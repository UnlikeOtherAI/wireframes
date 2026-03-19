'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { addNode, updateNode, removeNode } = require('../../engine/node');
const { addComponent } = require('../../engine/component');
const { initProject } = require('../../engine/init');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-node-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function getMainSlot(pageDoc) {
  return pageDoc.page.slots.find((slot) => slot.slotId === 'main');
}

function getTemplateHeaderRegion(templateDoc) {
  return templateDoc.templates.public_template.regions.find((region) => region.id === 'page_header');
}

test('wf node add inserts after sibling in page tree', () => {
  const projectPath = createTempProject('Node Add Below');

  const result = addNode({
    projectPath,
    component: 'button',
    below: 'wf://page/home#main.hero.page_title',
    nodeId: 'save_button',
    props: '{"label":"Save"}',
  });

  assert.equal(result.ok, true);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const mainSlot = getMainSlot(pageDoc);
  const heroNode = mainSlot.content.find((node) => node.id === 'hero');

  assert.equal(heroNode.children[1].id, 'save_button');
});

test('wf node add inserts as first child with --inside', () => {
  const projectPath = createTempProject('Node Add Inside');

  const result = addNode({
    projectPath,
    component: 'section',
    inside: 'wf://page/home#main.hero',
    nodeId: 'hero_pinned',
  });

  assert.equal(result.ok, true);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const mainSlot = getMainSlot(pageDoc);
  const heroNode = mainSlot.content.find((node) => node.id === 'hero');

  assert.equal(heroNode.children[0].id, 'hero_pinned');
});

test('wf node add inserts inside template region', () => {
  const projectPath = createTempProject('Node Add Template');

  const result = addNode({
    projectPath,
    component: 'text',
    inside: 'wf://template/public_template#page_header',
    nodeId: 'header_banner',
    props: '{"text":"Header banner"}',
  });

  assert.equal(result.ok, true);

  const templateDoc = readYaml(path.join(projectPath, 'templates.yaml'));
  const header = getTemplateHeaderRegion(templateDoc);

  assert.equal(header.children[0].id, 'header_banner');
});

test('wf node update merges props and updates layout', () => {
  const projectPath = createTempProject('Node Update');

  const result = updateNode({
    projectPath,
    address: 'wf://page/home#main.hero',
    props: '{"className":"card"}',
    layout: '{"type":"row","gap":12}',
  });

  assert.equal(result.ok, true);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const heroNode = getMainSlot(pageDoc).content.find((node) => node.id === 'hero');

  assert.equal(heroNode.layout.type, 'row');
  assert.equal(heroNode.layout.gap, 12);
  assert.equal(heroNode.props.className, 'card');
});

test('wf node remove deletes target node', () => {
  const projectPath = createTempProject('Node Remove');

  const addResult = addNode({
    projectPath,
    component: 'button',
    inside: 'wf://page/home#main',
    nodeId: 'remove_me',
  });
  assert.equal(addResult.ok, true);

  const removeResult = removeNode({
    projectPath,
    address: 'wf://page/home#main.remove_me',
  });
  assert.equal(removeResult.ok, true);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const mainSlot = getMainSlot(pageDoc);
  const ids = mainSlot.content.map((node) => node.id);

  assert.equal(ids.includes('remove_me'), false);
});

test('wf node add rejects duplicate node id in resolved tree', () => {
  const projectPath = createTempProject('Node Reject Duplicate');

  const result = addNode({
    projectPath,
    component: 'button',
    below: 'wf://page/home#main.hero.page_title',
    nodeId: 'page_title',
  });

  assert.equal(result.ok, false);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const ids = getMainSlot(pageDoc).content.flatMap((node) => [node.id, ...(node.children || []).map((child) => child.id)]);

  const count = ids.filter((entry) => entry === 'page_title').length;
  assert.equal(count, 1);
});

test('wf node add/update/remove supports component addresses', () => {
  const projectPath = createTempProject('Node Component Address');

  const componentResult = addComponent({
    projectPath,
    componentId: 'metric_card',
  });
  assert.equal(componentResult.ok, true);

  const addResult = addNode({
    projectPath,
    component: 'button',
    inside: 'wf://component/metric_card#root',
    nodeId: 'metric_button',
    props: '{"label":"Metric"}',
  });
  assert.equal(addResult.ok, true);

  const componentsPath = path.join(projectPath, 'components.yaml');
  const componentsDoc = yaml.load(fs.readFileSync(componentsPath, 'utf8'));
  const root = componentsDoc.components.metric_card.root;
  assert.equal(root.children[0].id, 'metric_button');

  const updateResult = updateNode({
    projectPath,
    address: 'wf://component/metric_card#metric_button',
    props: '{"label":"Updated Metric"}',
  });
  assert.equal(updateResult.ok, true);

  const updatedComponents = yaml.load(fs.readFileSync(componentsPath, 'utf8'));
  const updatedRoot = updatedComponents.components.metric_card.root;
  assert.equal(updatedRoot.children[0].props.label, 'Updated Metric');

  const removeResult = removeNode({
    projectPath,
    address: 'wf://component/metric_card#metric_button',
  });
  assert.equal(removeResult.ok, true);
  assert.equal(removeResult.nodeId, 'metric_button');
});
