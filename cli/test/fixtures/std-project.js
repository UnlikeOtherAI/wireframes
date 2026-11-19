'use strict';

// Projects that use the built-in std patterns: a file project made by
// `wf init`, and an in-memory document map with no components document.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { initProject } = require('../../../engine/init');

function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value), 'utf8');
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

/** A `wf init` project whose home page `main` slot holds `content`. */
function createStdProject(content) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-std-'));
  const projectPath = path.join(base, 'project');
  initProject({ projectName: 'Std', projectPath });
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const page = readYaml(pagePath);
  page.page.slots = [{ slotId: 'main', content }];
  writeYaml(pagePath, page);
  return projectPath;
}

/** An in-memory document map, no components document, one page `home` in `mode`. */
function memoryProject(content, mode = 'card') {
  return {
    manifest: { documentType: 'manifest', specVersion: '1.1', id: 'manifest', manifest: { projectId: 'std', name: 'Std', schemaVersion: '1.1' } },
    sitemap: { documentType: 'sitemap', specVersion: '1.1', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main' }] },
    templates: {
      documentType: 'templates', specVersion: '1.1', id: 'templates',
      templates: { main: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot', role: 'main' }] } },
    },
    components: null,
    pages: new Map([['home', {
      documentType: 'page', specVersion: '1.1', id: 'home',
      page: { id: 'home', template: 'main', viewport: { device: 'web' }, renderMode: mode, slots: [{ slotId: 'main', content }] },
    }]]),
    datasets: new Map(),
  };
}

module.exports = { createStdProject, memoryProject, readYaml, writeYaml };
