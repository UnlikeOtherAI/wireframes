'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const { runOverlay } = require('../commands/commands/overlay');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-overlay-command-'));
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

test('wf overlay add command creates a page overlay scaffold with empty content', () => {
  const projectPath = createTempProject('Overlay Command Add Page');
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay(['add', 'home', 'cmd_modal', '--type', 'modal'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 0);
  const homeDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const overlay = homeDoc?.page?.overlays?.find((entry) => entry?.id === 'cmd_modal');

  assert.ok(overlay);
  assert.equal(overlay.type, 'modal');
  assert.deepEqual(overlay.content, []);
});

test('wf overlay add command supports --template and writes template overlay', () => {
  const projectPath = createTempProject('Overlay Command Add Template');
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay([
      'add',
      'public_template',
      'cmd_dropdown',
      '--type',
      'dropdown',
      '--template',
      '--trigger',
      'page_title',
      '--placement',
      'bottom',
    ], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 0);
  const templatesDoc = readYaml(path.join(projectPath, 'templates.yaml'));
  const overlay = templatesDoc?.templates?.public_template?.overlays?.find((entry) => entry?.id === 'cmd_dropdown');

  assert.ok(overlay);
  assert.equal(overlay.type, 'dropdown');
  assert.equal(overlay.trigger, 'page_title');
  assert.equal(overlay.placement, 'bottom');
  assert.deepEqual(overlay.content, []);
});

test('wf overlay remove command removes overlay from page target', () => {
  const projectPath = createTempProject('Overlay Command Remove Page');
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay(['add', 'home', 'remove_me', '--type', 'toast'], { cwd: projectPath });
  });
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay(['remove', 'home', 'remove_me'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 0);
  const homeDoc = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const overlay = homeDoc?.page?.overlays?.find((entry) => entry?.id === 'remove_me');

  assert.equal(overlay, undefined);
});

test('wf overlay list command shows template and page overlays with --template', () => {
  const projectPath = createTempProject('Overlay Command List');
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay(['add', 'public_template', 'global_menu', '--type', 'modal', '--template'], { cwd: projectPath });
  });
  process.exitCode = 0;
  runWithCapture(() => {
    runOverlay(['add', 'home', 'page_menu', '--type', 'toast'], { cwd: projectPath });
  });

  process.exitCode = 0;
  const pageOutput = runWithCapture(() => {
    runOverlay(['list', 'home'], { cwd: projectPath });
  });
  const joinedPageOutput = pageOutput.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(joinedPageOutput.includes('page_menu'), true);
  assert.equal(joinedPageOutput.includes('global_menu'), true);

  process.exitCode = 0;
  const templateOutput = runWithCapture(() => {
    runOverlay(['list', 'public_template', '--template'], { cwd: projectPath });
  });
  const joinedTemplateOutput = templateOutput.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(joinedTemplateOutput.includes('global_menu'), true);
  assert.equal(joinedTemplateOutput.includes('page_menu'), false);
});
