'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const { runLint } = require('../../engine/lint');
const { runValidate } = require('../../engine/validate/cli-adapter');

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

test('wf lint reports primitive prop contract diagnostics without failing info', () => {
  const projectPath = createTempProject('Lint Primitive Props');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = loadYaml(homePath);

  homeDoc.page.slots[0].content = [
    {
      id: 'alias_title',
      component: 'heading',
      props: { label: 'Alias title', mystery: true },
    },
    {
      id: 'empty_text',
      component: 'text',
      props: {},
    },
    {
      id: 'email_field',
      component: 'input',
      props: { placeholder: 'Email' },
    },
    {
      id: 'nested_parent',
      component: 'section',
      children: [
        {
          id: 'nested_tile',
          component: 'section',
          size: { width: 160 },
        },
      ],
    },
  ];
  writeYaml(homePath, homeDoc);

  const result = runLint({ projectPath });

  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((entry) => entry.code === 'UNKNOWN_PROP'));
  assert.ok(result.info.some((entry) => entry.code === 'TEXT_PROP_ALIAS'));
  assert.ok(result.info.some((entry) => entry.code === 'MISSING_TEXT'));
  assert.ok(result.info.some((entry) => entry.code === 'UNLABELED_FIELD'));
  assert.ok(result.info.some((entry) => entry.code === 'NESTED_SURFACE'));

  const strictResult = runLint({ projectPath, strict: true });
  assert.equal(strictResult.ok, false);
  assert.ok(strictResult.errors.some((entry) => entry.code === 'STRICT_UNKNOWN_PROP'));
  assert.ok(!strictResult.errors.some((entry) => entry.code === 'STRICT_MISSING_TEXT'));
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
