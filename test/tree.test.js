'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { addComponent } = require('../shared/component');
const { addNode } = require('../shared/node');
const { addOverlay } = require('../shared/overlay');
const { buildTreeReport } = require('../shared/tree');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-tree-'));
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

test('buildTreeReport returns resolved page trees and respects depth', () => {
  const projectPath = createTempProject('Tree Shared Depth');

  const result = buildTreeReport({
    projectPath,
    targetType: 'page',
    targetId: 'home',
    depth: 1,
  });

  assert.equal(result.ok, true);
  const lines = result.lines.join('\n');

  assert.equal(lines.includes('page:home'), true);
  assert.equal(lines.includes('hero (component:section)'), true);
  assert.equal(lines.includes('page_title (component:heading)'), false);
});

test('buildTreeReport filters by props.text and includes matching descendants', () => {
  const projectPath = createTempProject('Tree Shared Filter');

  const result = buildTreeReport({
    projectPath,
    targetType: 'page',
    targetId: 'home',
    depth: 3,
    filter: 'welcome',
  });

  assert.equal(result.ok, true);
  const lines = result.lines.join('\n');

  assert.equal(lines.includes('page_title (component:heading)'), true);
  assert.equal(lines.includes('app_logo'), false);
});

test('buildTreeReport includes resolved component and overlay roots', () => {
  const projectPath = createTempProject('Tree Shared Overlay Component');

  const componentResult = addComponent({
    projectPath,
    componentId: 'metric_card',
  });
  assert.equal(componentResult.ok, true);

  const nodeResult = addNode({
    projectPath,
    component: 'metric_card',
    inside: 'wf://page/home#main.hero',
    nodeId: 'metric_instance',
  });
  assert.equal(nodeResult.ok, true);

  const overlayResult = addOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'welcome_overlay',
    type: 'toast',
  });
  assert.equal(overlayResult.ok, true);

  const overlayPagePath = path.join(projectPath, 'pages', 'home.yaml');
  const overlayDoc = readYaml(overlayPagePath);
  overlayDoc.page.overlays = overlayDoc.page.overlays || [];
  overlayDoc.page.overlays.find((overlay) => overlay.id === 'welcome_overlay').content.push({
    id: 'overlay_notice',
    component: 'text',
    props: {
      text: 'Hello overlay',
    },
  });
  writeYaml(overlayPagePath, overlayDoc);

  const allResult = buildTreeReport({
    projectPath,
    targetType: 'all',
  });

  assert.equal(allResult.ok, true);
  const lines = allResult.lines.join('\n');

  assert.equal(lines.includes('component:metric_card'), true);
  assert.equal(lines.includes('metric_instance (component:section)'), true);
  assert.equal(lines.includes('page overlay: welcome_overlay'), true);
  assert.equal(lines.includes('overlay_notice (component:text)'), true);
});
