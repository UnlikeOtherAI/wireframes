'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { runTree } = require('../cli/commands/tree');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-tree-command-'));
  const projectPath = path.join(base, 'project');
  initProject({
    projectName,
    projectPath,
  });
  return projectPath;
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

test('wf tree command prints resolved page and template trees by default', () => {
  const projectPath = createTempProject('Tree Command All');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runTree([], { cwd: projectPath });
  });

  const lines = output.logs.join('\n');
  assert.equal(process.exitCode, 0);
  assert.equal(lines.includes('page:home'), true);
  assert.equal(lines.includes('template:public_template'), true);
  assert.equal(lines.includes('template:editor_template'), true);
  assert.equal(lines.includes('hero (component:section)'), true);
});

test('wf tree command supports page depth and filter options', () => {
  const projectPath = createTempProject('Tree Command Depth Filter');

  process.exitCode = 0;
  const shallow = runWithCapture(() => {
    runTree(['page', 'home', '--depth', '1'], { cwd: projectPath });
  });
  const shallowOutput = shallow.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(shallowOutput.includes('page:home'), true);
  assert.equal(shallowOutput.includes('hero (component:section)'), true);
  assert.equal(shallowOutput.includes('page_title (component:heading)'), false);

  process.exitCode = 0;
  const filtered = runWithCapture(() => {
    runTree(['page', 'home', '--depth', '3', '--filter', 'welcome'], { cwd: projectPath });
  });
  const filteredOutput = filtered.logs.join('\n');

  assert.equal(process.exitCode, 0);
  assert.equal(filteredOutput.includes('page_title (component:heading)'), true);
  assert.equal(filteredOutput.includes('hero (component:section)'), true);
});

test('wf tree command validates --depth value', () => {
  const projectPath = createTempProject('Tree Command Depth Validation');

  process.exitCode = 0;
  const output = runWithCapture(() => {
    runTree(['page', 'home', '--depth', 'abc'], { cwd: projectPath });
  });

  assert.equal(process.exitCode, 2);
  assert.equal(output.errors.join('\n').includes('Invalid value for --depth'), true);
  process.exitCode = 0;
});
