'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { runValidate } = require(path.resolve(__dirname, '..', 'validate', 'cli-adapter'));
const {
  datasetFilePath,
  getDatasetDocument,
  writeYaml,
  parseDatasetId,
  parseFields,
  parsePrimaryKeyValue,
  listDatasetsRaw,
  parseDataFile,
  parseItemPayload,
  findItemIndexByPrimaryKey,
  collectPagesWithStateMatches,
  collectSitemapStateMatches,
  ensureDatasetState,
  isValidPrimaryKeyValue,
  buildDatasetDocument,
  listDataUsages,
  isObject,
  isPrimaryKeyMatch,
  stringifyPrimaryKey,
} = require(path.resolve(__dirname, 'utils'));
const { validateDataset, dataStats, dataKeys } = require(path.resolve(__dirname, 'analysis'));

function mutateDatasetAndValidate(projectPath, filePath, mutate) {
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;

  try {
    mutate();
  } catch (error) {
    if (previous !== null) {
      fs.writeFileSync(filePath, previous, 'utf8');
    } else if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return {
      ok: false,
      error: error.message,
    };
  }

  const validateResult = runValidate({ projectPath });
  if (!validateResult.ok) {
    if (previous !== null) {
      fs.writeFileSync(filePath, previous, 'utf8');
    } else {
      fs.unlinkSync(filePath);
    }
    return {
      ok: false,
      error: 'Validation failed after mutation.',
      details: {
        errors: validateResult.errors,
        warnings: validateResult.warnings,
      },
    };
  }

  return { ok: true };
}

function addDataset({ projectPath, datasetId, primaryKey, fields }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }
  if (typeof primaryKey !== 'string' || primaryKey.trim() === '') {
    return { ok: false, error: '--primaryKey is required.' };
  }

  const parsedFields = parseFields(fields);
  if (!parsedFields.ok) {
    return parsedFields;
  }

  const filePath = datasetFilePath(projectPath, parsedId.value);
  if (fs.existsSync(filePath)) {
    return { ok: false, error: `Dataset "${parsedId.value}" already exists.` };
  }

  const dataset = buildDatasetDocument(parsedId.value, primaryKey, parsedFields.value, []);
  const result = mutateDatasetAndValidate(projectPath, filePath, () => {
    writeYaml(filePath, dataset);
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
  };
}

function removeDataset({ projectPath, datasetId }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const filePath = datasetFilePath(projectPath, parsedId.value);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Dataset "${parsedId.value}" does not exist.` };
  }

  const usages = listDataUsages(projectPath, parsedId.value);
  if (usages.length > 0) {
    return {
      ok: false,
      error: `Dataset "${parsedId.value}" is in use and cannot be removed.`,
      details: {
        usages,
      },
    };
  }

  const result = mutateDatasetAndValidate(projectPath, filePath, () => {
    fs.unlinkSync(filePath);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
  };
}

function listDatasets(projectPath) {
  return listDatasetsRaw(projectPath);
}

function importData({ projectPath, datasetId, from, overwrite = false }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }
  if (!from) {
    return { ok: false, error: '--from is required.' };
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const filePath = loaded.filePath;
  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;

  const parsedData = parseDataFile(from, '--from');
  if (!parsedData.ok) {
    return parsedData;
  }

  const importItems = parsedData.value;
  if (!Array.isArray(importItems)) {
    return { ok: false, error: 'Import data must be an array.' };
  }

  const incomingItems = [];
  const seenIncoming = {};
  for (const item of importItems) {
    if (!isObject(item)) {
      return { ok: false, error: 'Each imported item must be an object.' };
    }
    if (!Object.prototype.hasOwnProperty.call(item, primaryKey)) {
      return { ok: false, error: `Imported item is missing primary key "${primaryKey}".` };
    }
    const keyValue = item[primaryKey];
    if (!isValidPrimaryKeyValue(keyValue)) {
      return {
        ok: false,
        error: `Imported item has invalid primary key value "${String(keyValue)}" for "${primaryKey}".`,
      };
    }
    const normalized = stringifyPrimaryKey(keyValue);
    if (Object.prototype.hasOwnProperty.call(seenIncoming, normalized)) {
      return { ok: false, error: `Duplicate primary key "${String(keyValue)}" in import payload.` };
    }
    seenIncoming[normalized] = true;
    incomingItems.push(item);
  }

  const existing = Array.isArray(dataset.items) ? [...dataset.items] : [];
  const existingIndex = new Map();
  for (let index = 0; index < existing.length; index += 1) {
    const existingItem = existing[index];
    if (isObject(existingItem) && Object.prototype.hasOwnProperty.call(existingItem, primaryKey)) {
      existingIndex.set(stringifyPrimaryKey(existingItem[primaryKey]), index);
    }
  }

  const conflicts = [];
  for (const item of incomingItems) {
    if (!overwrite && existingIndex.has(stringifyPrimaryKey(item[primaryKey]))) {
      conflicts.push(item[primaryKey]);
    }
  }
  if (conflicts.length > 0) {
    return {
      ok: false,
      error: `Import data contains primary key collisions: ${conflicts.map((entry) => String(entry)).join(', ')}`,
      details: { collisions: conflicts },
    };
  }

  const nextItems = existing;
  for (const item of incomingItems) {
    const key = stringifyPrimaryKey(item[primaryKey]);
    if (existingIndex.has(key)) {
      const nextIndex = existingIndex.get(key);
      nextItems[nextIndex] = item;
      continue;
    }
    existingIndex.set(key, nextItems.length);
    nextItems.push(item);
  }

  loaded.document.dataset.items = nextItems;
  const stateCheck = ensureDatasetState(projectPath, parsedId.value, loaded.document);
  if (!stateCheck.ok) {
    return stateCheck;
  }

  const result = mutateDatasetAndValidate(projectPath, filePath, () => {
    writeYaml(filePath, loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    imported: incomingItems.length,
  };
}

function addDataItem({ projectPath, datasetId, item, from }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }
  if (!item && !from) {
    return { ok: false, error: 'An item JSON payload is required for data item add.' };
  }

  const parsedItem = parseItemPayload(item, from, '--from');
  if (!parsedItem.ok) {
    return parsedItem;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }
  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;

  if (!Object.prototype.hasOwnProperty.call(parsedItem.value, primaryKey)) {
    return { ok: false, error: `Item is missing primary key "${primaryKey}".` };
  }
  if (!isValidPrimaryKeyValue(parsedItem.value[primaryKey])) {
    return { ok: false, error: `Item has invalid primary key value "${String(parsedItem.value[primaryKey])}" for "${primaryKey}".` };
  }

  const items = Array.isArray(dataset.items) ? [...dataset.items] : [];
  const target = parsedItem.value[primaryKey];
  if (items.findIndex((entry) => isObject(entry) && isPrimaryKeyMatch(entry[primaryKey], target)) !== -1) {
    return { ok: false, error: `Item with primary key "${String(target)}" already exists.` };
  }

  items.push(parsedItem.value);
  loaded.document.dataset.items = items;
  const stateCheck = ensureDatasetState(projectPath, parsedId.value, loaded.document);
  if (!stateCheck.ok) {
    return stateCheck;
  }

  const result = mutateDatasetAndValidate(projectPath, loaded.filePath, () => {
    writeYaml(loaded.filePath, loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    primaryKey: target,
  };
}

function updateDataItem({ projectPath, datasetId, primaryKeyValue, item, from }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const parsedKey = parsePrimaryKeyValue(primaryKeyValue);
  if (!parsedKey.ok) {
    return parsedKey;
  }

  const parsedItem = parseItemPayload(item, from, 'item');
  if (!parsedItem.ok) {
    return parsedItem;
  }
  if (!isObject(parsedItem.value)) {
    return { ok: false, error: 'item must be an object.' };
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }
  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;
  if (!Object.prototype.hasOwnProperty.call(parsedItem.value, primaryKey)) {
    return { ok: false, error: `Item is missing primary key "${primaryKey}".` };
  }
  if (!isValidPrimaryKeyValue(parsedItem.value[primaryKey])) {
    return { ok: false, error: `Item has invalid primary key value "${String(parsedItem.value[primaryKey])}" for "${primaryKey}".` };
  }

  if (!isPrimaryKeyMatch(parsedItem.value[primaryKey], parsedKey.value)) {
    return {
      ok: false,
      error: `Primary key value "${String(parsedItem.value[primaryKey])}" does not match target "${String(parsedKey.value)}".`,
    };
  }

  const items = Array.isArray(dataset.items) ? [...dataset.items] : [];
  const index = findItemIndexByPrimaryKey(items, primaryKey, parsedKey.value);
  if (index === -1) {
    return { ok: false, error: `Item with primary key "${String(parsedKey.value)}" does not exist.` };
  }

  items[index] = parsedItem.value;
  loaded.document.dataset.items = items;
  const stateCheck = ensureDatasetState(projectPath, parsedId.value, loaded.document);
  if (!stateCheck.ok) {
    return stateCheck;
  }

  const result = mutateDatasetAndValidate(projectPath, loaded.filePath, () => {
    writeYaml(loaded.filePath, loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    primaryKey: parsedKey.value,
  };
}

function removeDataItem({ projectPath, datasetId, primaryKeyValue }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const parsedKey = parsePrimaryKeyValue(primaryKeyValue);
  if (!parsedKey.ok) {
    return parsedKey;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;
  const items = Array.isArray(dataset.items) ? [...dataset.items] : [];
  const index = findItemIndexByPrimaryKey(items, primaryKey, parsedKey.value);
  if (index === -1) {
    return { ok: false, error: `Item with primary key "${String(parsedKey.value)}" does not exist.` };
  }

  const refs = [
    ...collectSitemapStateMatches(projectPath, parsedKey.value),
    ...collectPagesWithStateMatches(projectPath, parsedKey.value),
  ];
  if (refs.length > 0) {
    return {
      ok: false,
      error: `Item "${String(parsedKey.value)}" is referenced in state and cannot be removed.`,
      details: {
        references: refs,
      },
    };
  }

  items.splice(index, 1);
  loaded.document.dataset.items = items;
  const stateCheck = ensureDatasetState(projectPath, parsedId.value, loaded.document);
  if (!stateCheck.ok) {
    return stateCheck;
  }

  const result = mutateDatasetAndValidate(projectPath, loaded.filePath, () => {
    writeYaml(loaded.filePath, loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    primaryKey: parsedKey.value,
  };
}

function getDataItem({ projectPath, datasetId, primaryKeyValue }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const parsedKey = parsePrimaryKeyValue(primaryKeyValue);
  if (!parsedKey.ok) {
    return parsedKey;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;
  const item = Array.isArray(dataset.items)
    ? dataset.items.find((entry) => isObject(entry) && isPrimaryKeyMatch(entry[primaryKey], parsedKey.value))
    : null;

  if (!item) {
    return { ok: false, error: `Item with primary key "${String(parsedKey.value)}" does not exist.` };
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    item,
    primaryKey: parsedKey.value,
  };
}

function listDataItems({ projectPath, datasetId }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  const primaryKey = dataset.primaryKey;
  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const values = items
    .map((entry) => (isObject(entry) ? entry[primaryKey] : undefined))
    .filter((entry) => entry !== undefined);

  return {
    ok: true,
    datasetId: parsedId.value,
    items: values,
  };
}

module.exports = {
  addDataset,
  removeDataset,
  listDatasets,
  importData,
  addDataItem,
  updateDataItem,
  removeDataItem,
  getDataItem,
  listDataItems,
  validateDataset,
  dataStats,
  dataKeys,
};
