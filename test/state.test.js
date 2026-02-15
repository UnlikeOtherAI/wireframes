'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { addPage } = require('../shared/page');
const { listStateKeys } = require('../shared/state');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-state-'));
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

test('wf state list defaults to appState and all pageState keys', () => {
  const projectPath = createTempProject('State List All');
  setAppState(projectPath, {
    current_user: {
      id: 'user-1',
    },
    theme: 'light',
  });

  setPageState(projectPath, 'home', {
    welcome: true,
    form: {
      step: 1,
      values: {
        email: '',
      },
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
    local: {
      section: 'general',
    },
    form: {
      step: 2,
    },
  });

  const result = listStateKeys({ projectPath });
  assert.equal(result.ok, true);
  assert.equal(result.keys.includes('theme'), true);
  assert.equal(result.keys.includes('current_user'), true);
  assert.equal(result.keys.includes('current_user.id'), true);
  assert.equal(result.keys.includes('welcome'), true);
  assert.equal(result.keys.includes('form'), true);
  assert.equal(result.keys.includes('form.step'), true);
  assert.equal(result.keys.includes('form.values'), true);
  assert.equal(result.keys.includes('form.values.email'), true);
  assert.equal(result.keys.includes('local'), true);
  assert.equal(result.keys.includes('local.section'), true);
});

test('wf state list with scope app only returns appState keys', () => {
  const projectPath = createTempProject('State List App');
  setAppState(projectPath, {
    selected_tab: 'home',
    user: {
      id: 'u001',
    },
  });

  setPageState(projectPath, 'home', {
    pageOnly: true,
  });

  const result = listStateKeys({ projectPath, scope: 'app' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.keys, ['selected_tab', 'user', 'user.id'].sort());
});

test('wf state list with scope page returns only that page state', () => {
  const projectPath = createTempProject('State List Page');
  setAppState(projectPath, {
    global: true,
  });
  setPageState(projectPath, 'home', {
    page_state: {
      token: '',
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
    other: false,
  });

  const result = listStateKeys({ projectPath, scope: 'page', page: 'settings' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.keys, ['other']);
});

test('wf state list page scope requires an existing page', () => {
  const projectPath = createTempProject('State List Page Missing');
  const result = listStateKeys({ projectPath, scope: 'page', page: 'missing_page' });
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('does not exist'));
});
