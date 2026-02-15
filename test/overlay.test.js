'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const {
  addOverlay,
  listOverlays,
  removeOverlay,
} = require('../shared/overlay');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-overlay-'));
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

function getPageOverlay(pageDoc, overlayId) {
  return pageDoc?.page?.overlays?.find((overlay) => overlay?.id === overlayId) || null;
}

test('wf overlay add creates overlay scaffold with empty content on page', () => {
  const projectPath = createTempProject('Overlay Add Page');

  const result = addOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'help_modal',
    type: 'modal',
  });

  assert.equal(result.ok, true);
  const homeDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const overlay = getPageOverlay(homeDoc, 'help_modal');

  assert.equal(overlay.type, 'modal');
  assert.deepEqual(overlay.content, []);
});

test('wf overlay add supports template target with --template behavior', () => {
  const projectPath = createTempProject('Overlay Add Template');

  const result = addOverlay({
    projectPath,
    targetId: 'public_template',
    overlayId: 'top_nav_dropdown',
    type: 'dropdown',
    template: true,
    trigger: 'page_title',
    placement: 'bottom',
  });

  assert.equal(result.ok, true);

  const templates = readYaml(path.join(projectPath, 'templates.yaml'));
  const overlay = templates.templates.public_template.overlays.find((entry) => entry?.id === 'top_nav_dropdown');

  assert.equal(overlay.type, 'dropdown');
  assert.deepEqual(overlay.content, []);
  assert.equal(overlay.trigger, 'page_title');
  assert.equal(overlay.placement, 'bottom');
});

test('wf overlay list on page includes template overlays', () => {
  const projectPath = createTempProject('Overlay List Page');

  const templateResult = addOverlay({
    projectPath,
    targetId: 'public_template',
    overlayId: 'global_menu',
    type: 'modal',
    template: true,
  });
  assert.equal(templateResult.ok, true);

  const pageResult = addOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'page_menu',
    type: 'toast',
  });
  assert.equal(pageResult.ok, true);

  const listResult = listOverlays({
    projectPath,
    targetId: 'home',
  });

  assert.equal(listResult.ok, true);
  assert.equal(listResult.pageOverlays.some((entry) => entry.id === 'page_menu'), true);
  assert.equal(listResult.templateOverlays.some((entry) => entry.id === 'global_menu'), true);
  assert.equal(listResult.overlays.length >= 2, true);
});

test('wf overlay add blocks duplicate overlay id against resolved page overlays', () => {
  const projectPath = createTempProject('Overlay Duplicate Check');
  addOverlay({
    projectPath,
    targetId: 'public_template',
    overlayId: 'shared_modal',
    type: 'modal',
    template: true,
  });

  const conflict = addOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'shared_modal',
    type: 'toast',
  });

  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.includes('already exists'), true);
});

test('wf overlay remove fails when page node references overlay', () => {
  const projectPath = createTempProject('Overlay Remove Blocked');

  const addResult = addOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'info_modal',
    type: 'modal',
  });
  assert.equal(addResult.ok, true);

  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = readYaml(homePath);
  const mainSlot = homeDoc.page.slots.find((slot) => slot.slotId === 'main');
  const hero = mainSlot.content.find((node) => node.id === 'hero');
  hero.interaction = [{
    type: 'open_overlay',
    targetOverlay: 'info_modal',
  }];
  writeYaml(homePath, homeDoc);

  const result = removeOverlay({
    projectPath,
    targetId: 'home',
    overlayId: 'info_modal',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.includes('Validation failed after mutation'), true);
  const after = readYaml(homePath);
  const stillThere = getPageOverlay(after, 'info_modal');
  assert.equal(stillThere != null, true);
});

test('wf overlay remove deletes template overlay when no references exist', () => {
  const projectPath = createTempProject('Overlay Remove Template');

  addOverlay({
    projectPath,
    targetId: 'public_template',
    overlayId: 'to_remove',
    type: 'toast',
    template: true,
  });

  const result = removeOverlay({
    projectPath,
    targetId: 'public_template',
    overlayId: 'to_remove',
    template: true,
  });

  assert.equal(result.ok, true);

  const templates = readYaml(path.join(projectPath, 'templates.yaml'));
  assert.equal(Array.isArray(templates.templates.public_template.overlays), true);
  assert.equal(
    templates.templates.public_template.overlays.some((overlay) => overlay?.id === 'to_remove'),
    false,
  );
});
