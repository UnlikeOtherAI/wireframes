'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../shared/init');
const { runValidate } = require('../shared/validate');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-validate-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

test('validate command surfaces schema path errors', () => {
  const projectPath = createTempProject('Validate Test');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.wireframeStyle.border = {};
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((entry) => entry.code === 'SCHEMA_REQUIRED' && entry.message.includes('wireframeStyle.border.style')),
  );
});
