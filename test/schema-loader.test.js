'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { SchemaLoadError, loadDocumentFromFile, validateDocument } = require('../shared/schema');

function writeTempFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-loader-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${content}\n`, 'utf8');
  return filePath;
}

test('loads valid documents with detected type', () => {
  const docPath = writeTempFile('manifest.yaml', `
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  projectId: sample_app
  name: Sample
  schemaVersion: "1.1"
`);

  const loaded = loadDocumentFromFile(docPath);

  assert.equal(loaded.documentType, 'manifest');
  assert.equal(loaded.specVersion, '1.1');
  assert.equal(loaded.id, 'manifest');
  assert.equal(loaded.document.manifest.projectId, 'sample_app');
});

test('throws when documentType is missing', () => {
  const docPath = writeTempFile('missing-type.yaml', `
specVersion: "1.1"
id: homepage
`);

  assert.throws(() => {
    loadDocumentFromFile(docPath);
  }, (error) => error instanceof SchemaLoadError && error.code === 'MISSING_DOCUMENT_TYPE');
});

test('throws when documentType is unsupported', () => {
  const docPath = writeTempFile('bad-type.yaml', `
documentType: bad-kind
specVersion: "1.1"
id: bad
`);

  assert.throws(() => {
    loadDocumentFromFile(docPath);
  }, (error) => error instanceof SchemaLoadError && error.code === 'UNSUPPORTED_DOCUMENT_TYPE');
});

test('throws when specVersion is missing', () => {
  const docPath = writeTempFile('missing-spec.yaml', `
documentType: page
id: home
page:
  id: home
  template: main
  viewport:
    device: web
  wireframeStyle:
    border:
      style: solid
    corner:
      style: rounded
  slots: []
`);

  assert.throws(() => {
    loadDocumentFromFile(docPath);
  }, (error) => error instanceof SchemaLoadError && error.code === 'MISSING_SPEC_VERSION');
});

test('throws when manifest schemaVersion exceeds supported version', () => {
  const docPath = writeTempFile('newer-manifest.yaml', `
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  projectId: sample_app
  name: Sample
  schemaVersion: "99.0"
`);

  assert.throws(() => {
    loadDocumentFromFile(docPath, { supportedSpecVersion: '1.1' });
  }, (error) => error instanceof SchemaLoadError && error.code === 'UNSUPPORTED_MANIFEST_SCHEMA_VERSION');
});

test('validateDocument can be used directly', () => {
  assert.throws(() => {
    validateDocument({}, '/tmp/invalid.yaml', '1.1');
  }, (error) => error instanceof SchemaLoadError && error.code === 'MISSING_DOCUMENT_TYPE');
});
