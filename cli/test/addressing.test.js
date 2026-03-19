'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const {
  addComponent,
} = require('../../engine/component');
const {
  parseAddress,
  resolveAddressInRoots,
} = require('../../engine/addressing');
const {
  resolveTarget,
} = require('../../engine/addressing/fs-resolver');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-addressing-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

test('parseAddress validates wf:// canonical structure', () => {
  const result = parseAddress('wf://page/home#main.hero.page_title');

  assert.equal(result.ok, true);
  assert.equal(result.doctype, 'page');
  assert.equal(result.documentId, 'home');
  assert.deepEqual(result.pathSegments, ['main', 'hero', 'page_title']);
});

test('parseAddress rejects non-wf addresses', () => {
  const result = parseAddress('http://bad');
  assert.equal(result.ok, false);
  assert.equal(result.error.includes('Address must start with wf://'), true);
});

test('resolveTarget resolves page/template/component addresses with origin metadata', () => {
  const projectPath = createTempProject('Addressing Origins');

  const pageTarget = resolveTarget(projectPath, 'wf://page/home#main.hero.page_title');
  assert.equal(pageTarget.ok, true);

  const pageResolved = resolveAddressInRoots(pageTarget.roots, pageTarget.segments);
  assert.equal(pageResolved.ok, true);
  assert.equal(pageResolved.origin, 'page');
  assert.equal(pageResolved.sourceRef, 'wf://page/home#main');
  assert.equal(pageResolved.resolvedAddress, 'wf://page/home#main.hero.page_title');

  const templateTarget = resolveTarget(projectPath, 'wf://template/public_template#page_header');
  assert.equal(templateTarget.ok, true);

  const templateResolved = resolveAddressInRoots(templateTarget.roots, templateTarget.segments, { allowContainerFinal: true });
  assert.equal(templateResolved.ok, true);
  assert.equal(templateResolved.targetType, 'container');
  assert.equal(templateResolved.origin, 'template');
  assert.equal(templateResolved.sourceRef, 'wf://template/public_template#page_header');

  const componentResult = addComponent({ projectPath, componentId: 'metric_card' });
  assert.equal(componentResult.ok, true);

  const componentsPath = path.join(projectPath, 'components.yaml');
  const components = yaml.load(fs.readFileSync(componentsPath, 'utf8'));
  components.components.metric_card.root.children = [
    {
      id: 'value',
      component: 'text',
      props: {
        text: 'Metric',
      },
    },
  ];
  writeYaml(componentsPath, components);

  const componentTarget = resolveTarget(projectPath, 'wf://component/metric_card#root.value');
  assert.equal(componentTarget.ok, true);

  const componentResolved = resolveAddressInRoots(componentTarget.roots, componentTarget.segments);
  assert.equal(componentResolved.ok, true);
  assert.equal(componentResolved.origin, 'component');
  assert.equal(componentResolved.sourceRef, 'wf://component/metric_card#metric_card');
  assert.equal(componentResolved.resolvedAddress, 'wf://component/metric_card#metric_card.value');
  assert.equal(componentResolved.node.id, 'value');
});
