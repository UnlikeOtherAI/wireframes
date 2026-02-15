'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { runLint } = require('../shared/lint');
const { runValidate } = require('../shared/validate');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-cli-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

test('wf lint warns on non-snake and ambiguous ids', () => {
  const projectPath = createTempProject('Lint Naming');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = loadYaml(homePath);

  homeDoc.page.slots[0].content[0].children[0].id = 'bad__id';

  writeYaml(homePath, homeDoc);

  const result = runLint({ projectPath });

  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((entry) => entry.code === 'AMBIGUOUS_ID'));

  const strictResult = runLint({ projectPath, strict: true });
  assert.equal(strictResult.ok, false);
  assert.ok(strictResult.errors.some((entry) => entry.code === 'STRICT_AMBIGUOUS_ID'));
});

test('wf validate strict fails on unused dataset and component usage', () => {
  const projectPath = createTempProject('Lint Validate Warnings');
  const componentsPath = path.join(projectPath, 'components.yaml');
  const componentsDoc = loadYaml(componentsPath);
  componentsDoc.components.orphan_card = {
    root: {
      id: 'orphan_card',
      component: 'section',
      children: [],
    },
  };
  writeYaml(componentsPath, componentsDoc);

  const datasetPath = path.join(projectPath, 'data', 'users.yaml');
  fs.writeFileSync(datasetPath, `${yaml.dump({
    documentType: 'dataset',
    specVersion: '1.1',
    id: 'users',
    dataset: {
      id: 'users',
      primaryKey: 'user_id',
      items: [],
    },
  })}\n`, 'utf8');

  const strictResult = runValidate({ projectPath, strict: true });

  assert.equal(strictResult.ok, false);
  assert.ok(strictResult.errors.some((entry) => entry.code === 'STRICT_UNUSED_COMPONENT'));
  assert.ok(strictResult.errors.some((entry) => entry.code === 'STRICT_UNUSED_DATASET'));
});
