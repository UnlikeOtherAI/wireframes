'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { SUPPORTED_CLI_VERSION } = require('../shared/schema/constants');
const { initProject } = require('../shared/init');
const { getProjectInfo } = require('../shared/info');
const { runDoctor } = require('../shared/doctor');

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
