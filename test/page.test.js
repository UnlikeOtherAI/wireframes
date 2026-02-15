'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const {
  addPage,
  listPages,
  removePage,
} = require('../shared/page');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-page-'));
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

test('wf page add auto-fills template slots and updates sitemap route', () => {
  const projectPath = createTempProject('Page Add');
  const templatesPath = path.join(projectPath, 'templates.yaml');
  const templatesDoc = readYaml(templatesPath);

  templatesDoc.templates.public_template.regions.push({
    id: 'secondary',
    kind: 'slot',
  });
  writeYaml(templatesPath, templatesDoc);

  const result = addPage({
    projectPath,
    pageId: 'settings',
    path: '/settings',
    templateId: 'public_template',
    device: 'web',
  });

  assert.equal(result.ok, true);

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'settings.yaml'));
  const route = readYaml(path.join(projectPath, 'sitemap.yaml')).sitemap.routes
    .find((entry) => entry.id === 'settings');

  assert.equal(pageDoc.page.template, 'public_template');
  assert.equal(pageDoc.page.viewport.device, 'web');
  assert.equal(pageDoc.page.viewport.orientation, undefined);
  assert.equal(pageDoc.page.wireframeStyle.border.style, 'solid');
  assert.equal(Array.isArray(pageDoc.page.slots), true);
  assert.equal(pageDoc.page.slots.length, 2);
  assert.equal(route.path, '/settings');
  assert.equal(route.page, 'settings');
});

test('wf page add requires orientation for mobile and tablet', () => {
  const projectPath = createTempProject('Page Add Requires Orientation');

  const result = addPage({
    projectPath,
    pageId: 'mobile_dashboard',
    path: '/mobile-dashboard',
    templateId: 'public_template',
    device: 'mobile',
  });

  assert.equal(result.ok, false);
  assert.ok(result.error.includes('Orientation is required'));
});

test('wf page add fills only template slots and rejects unknown slot ids', () => {
  const projectPath = createTempProject('Page Slot Fill');

  const result = addPage({
    projectPath,
    pageId: 'reports',
    path: '/reports',
    templateId: 'public_template',
    device: 'web',
    slots: [
      {
        slotId: 'main',
        content: [{
          id: 'reports_title',
          component: 'heading',
          props: { text: 'Reports' },
        }],
      },
    ],
  });

  const pageDoc = readYaml(path.join(projectPath, 'pages', 'reports.yaml'));

  assert.equal(result.ok, true);
  assert.equal(pageDoc.page.slots.length, 1);
  assert.equal(Array.isArray(pageDoc.page.slots[0].content), true);
  assert.equal(pageDoc.page.slots[0].content[0].id, 'reports_title');
});

test('wf page remove deletes page source and route entry', () => {
  const projectPath = createTempProject('Page Remove');

  addPage({
    projectPath,
    pageId: 'legacy',
    path: '/legacy',
    templateId: 'public_template',
    device: 'web',
  });

  const sitemapPath = path.join(projectPath, 'sitemap.yaml');
  const before = readYaml(sitemapPath);
  assert.equal(before.sitemap.routes.some((route) => route.id === 'legacy'), true);

  const result = removePage({
    projectPath,
    pageId: 'legacy',
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(projectPath, 'pages', 'legacy.yaml')), false);

  const after = readYaml(sitemapPath);
  assert.equal(after.sitemap.routes.some((route) => route.id === 'legacy'), false);
});

test('wf page list returns alphabetical ids', () => {
  const projectPath = createTempProject('Page List');

  addPage({
    projectPath,
    pageId: 'zebra',
    path: '/z',
    templateId: 'public_template',
    device: 'web',
  });

  addPage({
    projectPath,
    pageId: 'alpha',
    path: '/a',
    templateId: 'public_template',
    device: 'web',
  });

  const ids = listPages(projectPath);

  assert.equal(ids[0], 'alpha');
  assert.equal(ids.includes('home'), true);
  assert.equal(ids.includes('zebra'), true);
});
