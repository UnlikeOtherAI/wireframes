'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const {
  addTemplate,
  listTemplates,
  removeTemplate,
} = require('../shared/template');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-template-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function readTemplates(projectPath) {
  return yaml.load(fs.readFileSync(path.join(projectPath, 'templates.yaml'), 'utf8'));
}

test('wf template add creates persistent-slot scaffolding', () => {
  const projectPath = createTempProject('Template Add');

  const result = addTemplate({
    projectPath,
    templateId: 'admin_shell',
  });

  assert.equal(result.ok, true);

  const templates = readTemplates(projectPath);
  const template = templates.templates.admin_shell;

  assert.equal(template.layout.type, 'stack');
  assert.equal(Array.isArray(template.regions), true);
  assert.equal(template.regions.length, 2);

  const persistent = template.regions.find((region) => region.id === 'app_header');
  const slot = template.regions.find((region) => region.id === 'main_content');
  const pageActionNode = Array.isArray(persistent.children)
    ? persistent.children.find((node) => node.id === 'page_actions')
    : null;

  assert.equal(persistent.kind, 'persistent');
  assert.equal(Array.isArray(persistent.children), true);
  assert.equal(pageActionNode.injectable, true);
  assert.equal(slot.kind, 'slot');
});

test('wf template list reports ids in alphabetical order', () => {
  const projectPath = createTempProject('Template List');

  addTemplate({
    projectPath,
    templateId: 'zzz_template',
  });
  addTemplate({
    projectPath,
    templateId: 'aaa_template',
  });

  const ids = listTemplates(projectPath);

  assert.deepEqual(ids[0], 'aaa_template');
  assert.deepEqual(ids.includes('public_template'), true);
  assert.deepEqual(ids.includes('zzz_template'), true);
  assert.deepEqual(ids[ids.length - 1], 'zzz_template');
});

test('wf template remove blocks when template is in use', () => {
  const projectPath = createTempProject('Template Remove In Use');

  const result = removeTemplate({
    projectPath,
    templateId: 'public_template',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.includes('in use'), true);
  assert.equal(Array.isArray(result.details.usages), true);
  assert.ok(result.details.usages.length > 0);
});

test('wf template remove blocks when template is defaultTemplate in sitemap', () => {
  const projectPath = createTempProject('Template Remove Default Template');
  const sitemapPath = path.join(projectPath, 'sitemap.yaml');

  addTemplate({
    projectPath,
    templateId: 'default_shell',
  });

  const sitemap = yaml.load(fs.readFileSync(sitemapPath, 'utf8'));
  if (sitemap.sitemap && typeof sitemap.sitemap === 'object') {
    sitemap.sitemap.defaultTemplate = 'default_shell';
  } else {
    sitemap.defaultTemplate = 'default_shell';
  }
  fs.writeFileSync(sitemapPath, `${yaml.dump(sitemap)}\n`, 'utf8');

  const result = removeTemplate({
    projectPath,
    templateId: 'default_shell',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.includes('in use'), true);
  assert.equal(Array.isArray(result.details.usages), true);
  assert.equal(result.details.usages.includes('defaultTemplate'), true);
});

test('wf template remove deletes unused template', () => {
  const projectPath = createTempProject('Template Remove Unused');

  addTemplate({
    projectPath,
    templateId: 'unused_shell',
  });

  const result = removeTemplate({
    projectPath,
    templateId: 'unused_shell',
  });

  assert.equal(result.ok, true);

  const templates = readTemplates(projectPath);
  assert.equal(templates.templates.unused_shell, undefined);
});
