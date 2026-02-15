'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const childProcess = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { runExport } = require('../shared/export');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-export-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function listZipEntries(zipPath) {
  const result = childProcess.spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, `unzip failed for ${zipPath}: ${result.stderr}`);
  return result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

test('wf export creates a zip and excludes .wfrc.yaml', () => {
  const projectPath = createTempProject('Export Basic');
  const assetPath = path.join(projectPath, 'assets', 'logo.png');
  fs.writeFileSync(assetPath, 'test-logo');
  const result = runExport({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.outputPath, path.resolve(projectPath, 'build.zip'));
  assert.equal(fs.existsSync(result.outputPath), true);

  const entries = listZipEntries(result.outputPath);
  assert.equal(entries.some((entry) => entry.endsWith('manifest.yaml')), true);
  assert.equal(entries.some((entry) => entry.endsWith('sitemap.yaml')), true);
  assert.equal(entries.some((entry) => entry.endsWith('pages/home.yaml')), true);
  assert.equal(entries.some((entry) => entry.endsWith('assets/logo.png')), true);
  assert.equal(entries.some((entry) => entry.endsWith('.wfrc.yaml')), false);
});

test('wf export honors includeAssets=false in .wfrc', () => {
  const projectPath = createTempProject('Export No Assets');
  const outputPath = path.join(projectPath, 'artifacts', 'export.zip');
  const assetPath = path.join(projectPath, 'assets', 'logo.png');
  fs.writeFileSync(assetPath, 'test-logo');
  writeYaml(path.join(projectPath, '.wfrc.yaml'), {
    cli: {
      strictValidation: false,
      failOnWarnings: false,
      export: {
        includeAssets: false,
      },
    },
  });

  const result = runExport({ projectPath, output: outputPath });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(outputPath), true);

  const entries = listZipEntries(outputPath);
  assert.equal(entries.some((entry) => entry.endsWith('assets/logo.png')), false);
});

test('wf export blocks when validation fails', () => {
  const projectPath = createTempProject('Export Validation Gate');
  const outputPath = path.join(projectPath, 'build.zip');
  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = readYaml(homePath);
  homeDoc.page.slots[0].content.push({
    id: 'invalid_node',
    component: 'missing_component',
  });
  writeYaml(homePath, homeDoc);

  const result = runExport({ projectPath, output: outputPath });

  assert.equal(result.ok, false);
  assert.equal(result.error.includes('Project validation failed'), true);
  assert.equal(fs.existsSync(outputPath), false);
});
