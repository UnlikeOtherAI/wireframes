'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { addNode } = require('../shared/node');
const {
  addComponent,
  listComponents,
  removeComponent,
} = require('../shared/component');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-component-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function readComponents(projectPath) {
  return yaml.load(fs.readFileSync(path.join(projectPath, 'components.yaml'), 'utf8'));
}

test('wf component add creates scaffold with propDefaults and propHints', () => {
  const projectPath = createTempProject('Component Add');

  const result = addComponent({
    projectPath,
    componentId: 'metric_card',
  });

  assert.equal(result.ok, true);

  const components = readComponents(projectPath);
  const component = components.components.metric_card;

  assert.equal(component.root.id, 'metric_card');
  assert.equal(component.root.component, 'section');
  assert.deepEqual(component.propDefaults, {});
  assert.deepEqual(component.propHints, {});
});

test('wf component list reports ids in alphabetical order', () => {
  const projectPath = createTempProject('Component List');

  addComponent({ projectPath, componentId: 'zzz_component' });
  addComponent({ projectPath, componentId: 'aaa_component' });

  const ids = listComponents(projectPath);
  assert.equal(ids[0], 'aaa_component');
  assert.equal(ids.includes('aaa_component'), true);
  assert.equal(ids.includes('zzz_component'), true);
  assert.equal(ids[ids.length - 1], 'zzz_component');
});

test('wf component remove blocks removal when component is in use', () => {
  const projectPath = createTempProject('Component Remove In Use');

  addComponent({ projectPath, componentId: 'chip' });
  addNode({
    projectPath,
    component: 'chip',
    inside: 'wf://page/home#main',
    nodeId: 'chip_node',
    props: '{"text":"Used chip"}',
  });

  const result = removeComponent({
    projectPath,
    componentId: 'chip',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.includes('is in use'), true);
  assert.equal(Array.isArray(result.details.usages), true);
  assert.ok(result.details.usages.includes('page:home'));
});

test('wf component remove deletes unused component', () => {
  const projectPath = createTempProject('Component Remove Unused');

  addComponent({ projectPath, componentId: 'temp_card' });
  const result = removeComponent({ projectPath, componentId: 'temp_card' });

  assert.equal(result.ok, true);

  const components = readComponents(projectPath);
  assert.equal(components.components.temp_card, undefined);
});
