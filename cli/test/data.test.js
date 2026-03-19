'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const {
  addDataItem,
  addDataset,
  getDataItem,
  dataKeys,
  importData,
  listDataItems,
  listDatasets,
  dataStats,
  validateDataset,
  removeDataItem,
  removeDataset,
  updateDataItem,
} = require('../../engine/data');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-data-'));
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

test('wf data add creates dataset file and list shows it', () => {
  const projectPath = createTempProject('Data Add');

  const result = addDataset({
    projectPath,
    datasetId: 'users',
    primaryKey: 'user_id',
    fields: 'name,role',
  });
  assert.equal(result.ok, true);
  assert.equal(result.datasetId, 'users');

  const datasetPath = path.join(projectPath, 'data', 'users.yaml');
  const dataset = readYaml(datasetPath);

  assert.equal(dataset.documentType, 'dataset');
  assert.equal(dataset.dataset.primaryKey, 'user_id');
  assert.deepEqual(dataset.dataset.fields, ['name', 'role']);
  assert.deepEqual(dataset.dataset.items, []);

  const ids = listDatasets(projectPath);
  assert.ok(ids.includes('users'));
});

test('wf data remove blocks dataset with page dataSource usage', () => {
  const projectPath = createTempProject('Data Remove Blocked');
  const addResult = addDataset({
    projectPath,
    datasetId: 'products',
    primaryKey: 'sku',
  });
  assert.equal(addResult.ok, true);

  const homePath = path.join(projectPath, 'pages', 'home.yaml');
  const homeDoc = readYaml(homePath);
  homeDoc.page.dataSources = [{ id: 'product_source', dataset: 'products' }];
  writeYaml(homePath, homeDoc);

  const removeResult = removeDataset({
    projectPath,
    datasetId: 'products',
  });

  assert.equal(removeResult.ok, false);
  assert.ok(removeResult.error.includes('cannot be removed'));
  assert.equal(removeResult.details.usages.includes('home'), true);
});

test('wf data import supports json and csv payloads', () => {
  const projectPath = createTempProject('Data Import');
  const addResult = addDataset({
    projectPath,
    datasetId: 'tasks',
    primaryKey: 'id',
  });
  assert.equal(addResult.ok, true);

  const importDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-data-import-'));
  const jsonFile = path.join(importDir, 'tasks.json');
  const csvFile = path.join(importDir, 'tasks.csv');

  fs.writeFileSync(jsonFile, JSON.stringify([
    { id: 'task-1', name: 'Plan' },
    { id: 'task-2', name: 'Ship' },
  ]), 'utf8');
  fs.writeFileSync(csvFile, 'id,name\ntask-3,Review\n', 'utf8');

  const jsonImport = importData({ projectPath, datasetId: 'tasks', from: jsonFile, overwrite: false });
  assert.equal(jsonImport.ok, true);
  assert.equal(jsonImport.imported, 2);

  const csvImport = importData({ projectPath, datasetId: 'tasks', from: csvFile, overwrite: false });
  assert.equal(csvImport.ok, true);
  assert.equal(csvImport.imported, 1);

  const duplicateJsonFile = path.join(importDir, 'duplicate.json');
  fs.writeFileSync(duplicateJsonFile, JSON.stringify([{ id: 'task-1', name: 'Duplicate' }]), 'utf8');

  const failed = importData({ projectPath, datasetId: 'tasks', from: duplicateJsonFile, overwrite: false });
  assert.equal(failed.ok, false);

  const forced = importData({ projectPath, datasetId: 'tasks', from: duplicateJsonFile, overwrite: true });
  assert.equal(forced.ok, true);
});

test('wf data item add/update/get/list/remove works with whole object payload', () => {
  const projectPath = createTempProject('Data Item CRUD');
  const addResult = addDataset({
    projectPath,
    datasetId: 'users',
    primaryKey: 'user_id',
  });
  assert.equal(addResult.ok, true);

  const addItem = addDataItem({
    projectPath,
    datasetId: 'users',
    item: JSON.stringify({ user_id: 'u003', name: 'Alice' }),
  });
  assert.equal(addItem.ok, true);

  const updateItem = updateDataItem({
    projectPath,
    datasetId: 'users',
    primaryKeyValue: 'u003',
    item: JSON.stringify({ user_id: 'u003', name: 'Alice Chen' }),
  });
  assert.equal(updateItem.ok, true);

  const getResult = getDataItem({
    projectPath,
    datasetId: 'users',
    primaryKeyValue: 'u003',
  });
  assert.equal(getResult.ok, true);
  assert.equal(getResult.item.user_id, 'u003');
  assert.equal(getResult.item.name, 'Alice Chen');

  const listResult = listDataItems({ projectPath, datasetId: 'users' });
  assert.deepEqual(listResult.items, ['u003']);

  const removeItem = removeDataItem({
    projectPath,
    datasetId: 'users',
    primaryKeyValue: 'u003',
  });
  assert.equal(removeItem.ok, true);

  const afterList = listDataItems({ projectPath, datasetId: 'users' });
  assert.equal(Array.isArray(afterList.items), true);
  assert.equal(afterList.items.length, 0);
});

test('wf data item remove fails when default state references value', () => {
  const projectPath = createTempProject('Data Item Remove Blocked');
  const addResult = addDataset({
    projectPath,
    datasetId: 'users',
    primaryKey: 'user_id',
  });
  assert.equal(addResult.ok, true);

  addDataItem({
    projectPath,
    datasetId: 'users',
    item: JSON.stringify({ user_id: 'u003', name: 'Alice' }),
  });

  const sitemapPath = path.join(projectPath, 'sitemap.yaml');
  const sitemap = readYaml(sitemapPath);
  sitemap.sitemap = sitemap.sitemap || {};
  sitemap.sitemap.appState = { selectedUser: 'u003' };
  writeYaml(sitemapPath, sitemap);

  const blocked = removeDataItem({
    projectPath,
    datasetId: 'users',
    primaryKeyValue: 'u003',
  });

  assert.equal(blocked.ok, false);
  assert.ok(blocked.error.includes('referenced in state'));
});

test('wf data validate checks primary key, declared fields, nulls, and type consistency', () => {
  const projectPath = createTempProject('Data Validate');

  const datasetPath = path.join(projectPath, 'data', 'users.yaml');
  writeYaml(datasetPath, {
    documentType: 'dataset',
    specVersion: '1.1',
    id: 'users',
    dataset: {
      id: 'users',
      primaryKey: 'user_id',
      fields: ['user_id', 'name', 'age'],
      items: [
        { user_id: 'u001', name: 'Alice', age: 28 },
        { user_id: 'u001', name: 'Bob', age: 30 },
        { user_id: 'u002', age: 31 },
        { user_id: 'u003', name: 'Cara', age: null },
        { user_id: 'u004', name: 42, age: '30' },
      ],
    },
  });

  const result = validateDataset({ projectPath, datasetId: 'users' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.includes('duplicate primary key')));
  assert.ok(result.errors.some((entry) => entry.includes('missing declared field "name"')));
  assert.ok(result.errors.some((entry) => entry.includes('null value for field "age"')));
  assert.ok(result.errors.some((entry) => entry.includes('inconsistent types in dataset "users"')));
});

test('wf data stats reports item count, field summary, and byte size', () => {
  const projectPath = createTempProject('Data Stats');

  addDataset({
    projectPath,
    datasetId: 'products',
    primaryKey: 'sku',
    fields: 'sku,name,price',
  });

  const statsTarget = path.join(projectPath, 'data', 'products.yaml');
  const statDoc = readYaml(statsTarget);
  statDoc.dataset.items = [
    { sku: 'sku-1', name: 'A', price: 10 },
    { sku: 'sku-2', name: 'B', price: 11.5 },
  ];
  writeYaml(statsTarget, statDoc);

  const result = dataStats({ projectPath, datasetId: 'products' });
  assert.equal(result.ok, true);
  assert.equal(result.itemCount, 2);
  assert.equal(result.fieldSummary.find((entry) => entry.field === 'sku').count, 2);
  assert.equal(typeof result.byteSize, 'number');
  assert.ok(result.byteSize > 0);
});

test('wf data keys lists primary key values', () => {
  const projectPath = createTempProject('Data Keys');
  const addResult = addDataset({
    projectPath,
    datasetId: 'roles',
    primaryKey: 'code',
  });
  assert.equal(addResult.ok, true);

  addDataItem({
    projectPath,
    datasetId: 'roles',
    item: JSON.stringify({ code: 'admin', name: 'Admin' }),
  });
  addDataItem({
    projectPath,
    datasetId: 'roles',
    item: JSON.stringify({ code: 'viewer', name: 'Viewer' }),
  });

  const result = dataKeys({ projectPath, datasetId: 'roles' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.keys, ['admin', 'viewer']);
});
