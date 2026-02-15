'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { addPage } = require('../shared/page');
const { runState } = require('../cli/commands/state');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-state-command-'));
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

  console.log = (...args) => logs.push(args.join(' '));
  console.error = (...args) => errors.push(args.join(' '));

  try {
    callback();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return { logs, errors };
}

function setAppState(projectPath, appState) {
  const sitemapPath = path.join(projectPath, 'sitemap.yaml');
  const sitemap = readYaml(sitemapPath);
  sitemap.appState = appState;
  writeYaml(sitemapPath, sitemap);
}

function setPageState(projectPath, pageId, pageState) {
  const pagePath = path.join(projectPath, 'pages', `${pageId}.yaml`);
  const pageDoc = readYaml(pagePath);
  pageDoc.page = pageDoc.page || {};
  if (pageState == null) {
    delete pageDoc.page.pageState;
  } else {
    pageDoc.page.pageState = pageState;
  }
  writeYaml(pagePath, pageDoc);
}

test('wf state list command prints state keys with default scope', () => {
  const projectPath = createTempProject('State Command List');
  setAppState(projectPath, { appMode: 'edit' });
  setPageState(projectPath, 'home', {
    home_state: {
      count: 1,
    },
  });

  addPage({
    projectPath,
    pageId: 'settings',
    path: '/settings',
    templateId: 'public_template',
    device: 'web',
  });
  setPageState(projectPath, 'settings', {
    mode: 'review',
  });

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runState(['list'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 0);
  const lines = output.logs.filter(Boolean);
  assert.ok(lines.includes('appMode'));
  assert.ok(lines.includes('home_state'));
  assert.ok(lines.includes('home_state.count'));
  assert.ok(lines.includes('mode'));
});

test('wf state list command respects --scope page', () => {
  const projectPath = createTempProject('State Command List Page');
  setAppState(projectPath, { appMode: 'edit' });
  setPageState(projectPath, 'home', {
    home_state: {
      count: 1,
    },
  });

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runState(['list', '--scope', 'page', '--page', 'home'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 0);
  const lines = output.logs.filter(Boolean);
  assert.ok(lines.includes('home_state'));
  assert.ok(lines.includes('home_state.count'));
  assert.ok(lines.includes('appMode') === false);
});

test('wf state list command errors when page scope is missing page id', () => {
  const projectPath = createTempProject('State Command Missing Page');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runState(['list', '--scope', 'page'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.ok(output.errors.join('\n').includes('--scope page requires --page'));
  process.exitCode = 0;
});
