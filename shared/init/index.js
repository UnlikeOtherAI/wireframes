'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_SPEC_VERSION, SUPPORTED_CLI_VERSION } = require('../schema/constants');

function quote(value) {
  return JSON.stringify(String(value));
}

function projectIdFromName(name) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return /^[a-z]/.test(normalized) ? normalized : `wireframe_${normalized || 'project'}`;
}

function buildManifestDocument({ projectName, projectId }) {
  return `documentType: manifest\nspecVersion: ${quote(SUPPORTED_SPEC_VERSION)}\nid: manifest\nmanifest:\n  projectId: ${quote(projectId)}\n  name: ${quote(projectName)}\n  schemaVersion: ${quote(SUPPORTED_SPEC_VERSION)}\n  createdWithCLI: ${quote(`wf ${SUPPORTED_CLI_VERSION}`)}\n  defaultGridColumns: 12\n  defaultWireframeStyle:\n    border:\n      style: solid\n      width: thin\n    corner:\n      style: rounded\n      radius: 8\n`;
}

function buildConfigDocument() {
  return 'cli:\n  strictValidation: true\n  failOnWarnings: false\n  export:\n    includeAssets: true\n    compressLevel: 9\n  build:\n    outputDir: ./wireframes/build\n    clean: false\n    basePath: /\n  serve:\n    port: 8080\n    open: false\n    hotReload: true\n';
}

function buildSitemapDocument() {
  return `documentType: sitemap\nspecVersion: ${quote(SUPPORTED_SPEC_VERSION)}\nid: sitemap\ndefaultTemplate: public_template\nroutes:\n  - id: home\n    path: /\n    page: home\n    template: public_template\n`;
}

function buildTemplatesDocument() {
  return `documentType: templates\nspecVersion: ${quote(SUPPORTED_SPEC_VERSION)}\nid: templates\ntemplates:\n  public_template:\n    layout:\n      type: stack\n    regions:\n      - id: page_header\n        kind: persistent\n        children:\n          - id: app_logo\n            component: image\n            props:\n              src: assets/logo.png\n              alt: App logo\n          - id: page_actions\n            injectable: true\n      - id: main\n        kind: slot\n  editor_template:\n    layout:\n      type: row\n    regions:\n      - id: editor_sidebar\n        kind: persistent\n        layout:\n          type: stack\n        children:\n          - id: editor_title\n            component: heading\n            props:\n              text: Editor\n          - id: editor_navigation\n            component: text\n            props:\n              text: Navigation\n      - id: editor_content\n        kind: slot\n`;
}

function buildComponentsDocument() {
  return `documentType: components\nspecVersion: ${quote(SUPPORTED_SPEC_VERSION)}\nid: components\ncomponents: {}\n`;
}

function buildStarterPageDocument() {
  return `documentType: page\nspecVersion: ${quote(SUPPORTED_SPEC_VERSION)}\nid: home\npage:\n  id: home\n  template: public_template\n  viewport:\n    device: web\n  wireframeStyle:\n    border:\n      style: solid\n      width: thin\n    corner:\n      style: rounded\n      radius: 8\n  slots:\n    - slotId: main\n      content:\n        - id: hero\n          component: section\n          children:\n            - id: page_title\n              component: heading\n              props:\n                text: Welcome\n            - id: page_intro\n              component: paragraph\n              props:\n                text: Your starter page is ready.\n`;
}

function ensureDirectory(filePath) {
  fs.mkdirSync(filePath, { recursive: true });
}

function writeYAML(filePath, content) {
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
}

function initProject({ projectName, projectPath }) {
  const normalizedProjectId = projectIdFromName(projectName);
  const safePath = path.resolve(projectPath);

  if (fs.existsSync(safePath)) {
    throw new Error(`Target already exists: ${safePath}`);
  }

  ensureDirectory(safePath);
  ensureDirectory(path.join(safePath, 'pages'));
  ensureDirectory(path.join(safePath, 'data'));
  ensureDirectory(path.join(safePath, 'assets'));

  writeYAML(path.join(safePath, 'manifest.yaml'), buildManifestDocument({ projectName, projectId: normalizedProjectId }));
  writeYAML(path.join(safePath, '.wfrc.yaml'), buildConfigDocument());
  writeYAML(path.join(safePath, 'sitemap.yaml'), buildSitemapDocument());
  writeYAML(path.join(safePath, 'templates.yaml'), buildTemplatesDocument());
  writeYAML(path.join(safePath, 'components.yaml'), buildComponentsDocument());
  writeYAML(path.join(safePath, 'pages', 'home.yaml'), buildStarterPageDocument());

  return {
    projectPath: safePath,
    starterPageId: 'home',
    schemaVersion: SUPPORTED_SPEC_VERSION,
  };
}

module.exports = {
  initProject,
  SUPPORTED_SPEC_VERSION,
  SUPPORTED_CLI_VERSION,
};
