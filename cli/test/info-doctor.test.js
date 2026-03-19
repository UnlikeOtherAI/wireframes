'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { SUPPORTED_CLI_VERSION } = require('../../engine/schema/constants');
const { initProject } = require('../../engine/init');
const { getProjectInfo } = require('../../engine/info');
const { runDoctor } = require('../../engine/doctor');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-cli-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function loadYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

test('wf info reads and reports manifest metadata', () => {
  const projectPath = createTempProject('Info Project');
  const info = getProjectInfo(projectPath);

  assert.equal(info.projectName, 'Info Project');
  assert.equal(info.schemaVersion, '1.1');
  assert.equal(info.createdWithCLI, `wf ${SUPPORTED_CLI_VERSION}`);
  assert.equal(info.defaultGridColumns, 12);
  assert.equal(typeof info.defaultWireframeStyle, 'object');
});

test('wf doctor passes on a valid initialized project', () => {
  const projectPath = createTempProject('Doctor Valid');

  const result = runDoctor({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('wf doctor detects broken references', () => {
  const projectPath = createTempProject('Doctor Broken');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = loadYaml(homePath);

  homeDoc.page.slots[0].content.push({
    id: 'unknown_button',
    component: 'missing_component',
  });
  homeDoc.page.dataSources = [
    { id: 'products_source', dataset: 'missing_dataset' },
  ];
  writeYaml(homePath, homeDoc);

  const result = runDoctor({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === 'BROKEN_COMPONENT_REFERENCE'));
  assert.ok(result.errors.some((entry) => entry.code === 'MISSING_DATASET_REFERENCE'));
});

test('wf doctor validates interaction semantics', () => {
  const projectPath = createTempProject('Doctor Semantic Interactions');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = loadYaml(homePath);
  const hero = homeDoc.page.slots[0].content[0];

  homeDoc.page.actions = { save: {} };
  hero.children.push({
    id: 'navigation_btn',
    component: 'button',
    props: { label: 'Navigation' },
    interaction: [{ type: 'navigation' }],
  });
  hero.children.push({
    id: 'bad_form',
    component: 'button',
    props: { label: 'Submit' },
    interaction: [{ type: 'submit', formId: 'missing_form' }],
  });
  hero.children.push({
    id: 'action_btn',
    component: 'button',
    props: { label: 'Action' },
    interaction: [{ type: 'action', actionId: 'missing_action' }],
  });
  hero.children.push({
    id: 'overlay_btn',
    component: 'button',
    props: { label: 'Open Overlay' },
    interaction: [{ type: 'open_overlay', targetOverlay: 'missing_overlay' }],
  });
  hero.children.push({
    id: 'toggle_state',
    component: 'toggle',
    props: { label: 'Toggle' },
    interaction: [{ type: 'toggle', scope: 'page', stateKey: 'missing_state' }],
  });
  hero.children.push({
    id: 'page_title',
    component: 'text',
    props: { text: 'Duplicate ID' },
  });

  homeDoc.page.overlays = [
    {
      id: 'menu_dropdown',
      type: 'dropdown',
      content: [],
    },
  ];
  homeDoc.page.slots[0].content.push({
    id: 'route_bad',
    component: 'button',
    props: { label: 'Bad Route' },
    interaction: [{ type: 'navigation', targetRoute: 'missing_route' }],
  });

  writeYaml(homePath, homeDoc);

  const result = runDoctor({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === 'INTERACTION_MISSING_REQUIRED_FIELD'));
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_TARGET_ROUTE'));
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_TARGET_OVERLAY'));
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_ACTION_REFERENCE'));
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_FORM_REFERENCE'));
  assert.ok(result.errors.some((entry) => entry.code === 'MISSING_STATE_KEY'));
  assert.ok(result.errors.some((entry) => entry.code === 'OVERLAY_MISSING_TRIGGER'));
  assert.ok(result.errors.some((entry) => entry.code === 'OVERLAY_MISSING_PLACEMENT'));
  assert.ok(result.errors.some((entry) => entry.code === 'DUPLICATE_NODE_ID'));
});

test('wf doctor validates overlay constraints with template/page inheritance', () => {
  const projectPath = createTempProject('Doctor Overlay Inheritance');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const templatesPath = path.join(projectPath, 'templates.yaml');
  const homeDoc = loadYaml(homePath);
  const templatesDoc = loadYaml(templatesPath);

  templatesDoc.templates.public_template.overlays = [{
    id: 'shared_overlay',
    type: 'dropdown',
    trigger: 'missing_template_trigger',
    placement: 'top',
    content: [],
  }];
  homeDoc.page.overlays = [{
    id: 'shared_overlay',
    type: 'modal',
    content: [],
  }];

  writeYaml(templatesPath, templatesDoc);
  writeYaml(homePath, homeDoc);

  const result = runDoctor({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === 'DUPLICATE_OVERLAY_ID'));
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_OVERLAY_TRIGGER'));
});

test('wf doctor validates grid span constraints', () => {
  const projectPath = createTempProject('Doctor Grid Span');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = loadYaml(homePath);

  homeDoc.page.slots[0].content.push({
    id: 'bad_grid',
    component: 'section',
    layout: { type: 'grid', columns: 2 },
    children: [{
      id: 'bad_grid_item',
      component: 'text',
      props: { text: 'Overflow' },
      gridItem: { span: 3 },
      size: { width: 120 },
    }],
  });

  writeYaml(homePath, homeDoc);

  const result = runDoctor({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === 'INVALID_GRID_SPAN'));
});
