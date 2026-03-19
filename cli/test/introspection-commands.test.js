'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const { addComponent } = require('../../engine/component');
const { addPage } = require('../../engine/page');
const { addNode } = require('../../engine/node');
const { addDataset, addDataItem } = require('../../engine/data');
const { runInspect } = require('../commands/commands/inspect');
const { runRoutes } = require('../commands/commands/routes');
const { runWhereUsed } = require('../commands/commands/where-used');
const { runStats } = require('../commands/commands/stats');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-introspection-command-'));
  const projectPath = path.join(base, 'project');
  initProject({
    projectName,
    projectPath,
  });
  return projectPath;
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function runWithCapture(callback) {
  const logs = [];
  const errors = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    logs.push(args.join(' '));
  };
  console.error = (...args) => {
    errors.push(args.join(' '));
  };

  try {
    callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { logs, errors };
}

test('wf inspect command reports origin, source, resolved path, children and layout', () => {
  const projectPath = createTempProject('Inspect Command');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runInspect(['wf://page/home#main.hero.page_title'], { cwd: projectPath });
  });

  const lines = output.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(lines.includes('Origin: page'), true);
  assert.equal(lines.includes('Source: wf://page/home#main'), true);
  assert.equal(lines.includes('Resolved path: wf://page/home#main.hero.page_title'), true);
  assert.equal(lines.includes('"id": "page_title"'), true);
  assert.equal(lines.includes('Children: <none>'), true);
});

test('wf inspect command requires an address', () => {
  const projectPath = createTempProject('Inspect Missing Address');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runInspect([], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.equal(output.errors.join('\n').includes('wf inspect requires <address>'), true);
});

test('wf where-used command reports component and dataset usage locations', () => {
  const projectPath = createTempProject('Where Used Command');

  process.exitCode = 0;
  assert.equal(
    addComponent({
      projectPath,
      componentId: 'metric_card',
    }).ok,
    true,
  );
  process.exitCode = 0;
  assert.equal(
    addComponent({
      projectPath,
      componentId: 'unused_card',
    }).ok,
    true,
  );

  addNode({
    projectPath,
    component: 'metric_card',
    inside: 'wf://page/home#main',
    nodeId: 'metric_home_card',
  });
  addNode({
    projectPath,
    component: 'metric_card',
    inside: 'wf://template/public_template#page_header',
    nodeId: 'metric_template_card',
  });

  addDataset({
    projectPath,
    datasetId: 'users',
    primaryKey: 'id',
  });
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = readYaml(pagePath);
  pageDoc.page = pageDoc.page || {};
  pageDoc.page.dataSources = [{ dataset: 'users' }];
  writeYaml(pagePath, pageDoc);

  process.exitCode = 0;
  const componentOutput = runWithCapture(() => {
    runWhereUsed(['metric_card'], { cwd: projectPath });
  });
  const componentLines = componentOutput.logs.join('\n');
  assert.equal(process.exitCode, 0);
  assert.equal(componentLines.includes('Component metric_card:'), true);
  assert.equal(componentLines.includes('page:home'), true);
  assert.equal(componentLines.includes('template:public_template'), true);

  process.exitCode = 0;
  const datasetOutput = runWithCapture(() => {
    runWhereUsed(['users'], { cwd: projectPath });
  });
  const datasetLines = datasetOutput.logs.join('\n');
  assert.equal(process.exitCode, 0);
  assert.equal(datasetLines.includes('Dataset users:'), true);
  assert.equal(datasetLines.includes('page:home'), true);
});

test('wf where-used command fails for unknown IDs', () => {
  const projectPath = createTempProject('Where Used Missing');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runWhereUsed(['does_not_exist'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 1);
  assert.equal(output.errors.join('\n').includes('wf where-used failed'), true);
});

test('wf routes command lists route mappings', () => {
  const projectPath = createTempProject('Routes Command');

  addPage({
    projectPath,
    pageId: 'settings',
    path: '/settings',
    templateId: 'public_template',
    device: 'web',
  });

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runRoutes([], { cwd: projectPath });
  });
  const lines = output.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(lines.includes('home / -> page home / template public_template'), true);
  assert.equal(lines.includes('settings /settings -> page settings / template public_template'), true);
});

test('wf stats command reports project totals and dataset sizes', () => {
  const projectPath = createTempProject('Stats Command');

  addComponent({
    projectPath,
    componentId: 'metric_card',
  });
  addComponent({
    projectPath,
    componentId: 'unused_card',
  });
  addNode({
    projectPath,
    component: 'metric_card',
    inside: 'wf://page/home#main',
    nodeId: 'metric_home_card',
  });

  addDataset({
    projectPath,
    datasetId: 'users',
    primaryKey: 'id',
  });
  addDataItem({
    projectPath,
    datasetId: 'users',
    item: '{"id":"u1","name":"Alice"}',
  });
  addDataItem({
    projectPath,
    datasetId: 'users',
    item: '{"id":"u2","name":"Bob"}',
  });

  addPage({
    projectPath,
    pageId: 'settings',
    path: '/settings',
    templateId: 'public_template',
    device: 'web',
  });

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runStats([], { cwd: projectPath });
  });
  const lines = output.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(lines.includes('Total pages: 2'), true);
  assert.equal(lines.includes('Total templates: 2'), true);
  assert.equal(lines.includes('Total components: 2'), true);
  assert.equal(lines.includes('Unused components (1):'), true);
  assert.equal(lines.includes('unused_card'), true);
  assert.equal(lines.includes('users: 2 items, '), true);
});
