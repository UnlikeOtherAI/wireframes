'use strict';

const fs = require('node:fs');
const {
  parseDatasetId,
  getDatasetDocument,
  isObject,
  isValidPrimaryKeyValue,
  stringifyPrimaryKey,
} = require('./utils');

function valueType(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function sortFieldSummary(fieldSummary) {
  return Object.keys(fieldSummary)
    .sort()
    .map((field) => ({
      field,
      count: fieldSummary[field].count,
      types: Array.from(fieldSummary[field].types).sort(),
    }));
}

function collectFieldSummary(items) {
  const summary = Object.create(null);
  for (const item of items) {
    if (!isObject(item)) {
      continue;
    }
    for (const [field, value] of Object.entries(item)) {
      if (!Object.prototype.hasOwnProperty.call(summary, field)) {
        summary[field] = { count: 0, types: new Set() };
      }
      summary[field].count += 1;
      const nextType = valueType(value);
      if (nextType !== 'null') {
        summary[field].types.add(nextType);
      }
    }
  }

  return summary;
}

function validatePrimaryKey(datasetId, items, primaryKey, errors) {
  const seen = new Set();
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isObject(item)) {
      errors.push(`Item at index ${index} is not an object.`);
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(item, primaryKey)) {
      errors.push(`Item at index ${index} is missing primary key "${primaryKey}".`);
      continue;
    }
    const value = item[primaryKey];
    if (!isValidPrimaryKeyValue(value)) {
      errors.push(`Item at index ${index} has invalid primary key value for "${primaryKey}".`);
      continue;
    }

    const normalized = stringifyPrimaryKey(value);
    if (seen.has(normalized)) {
      errors.push(`Dataset "${datasetId}" has duplicate primary key "${String(value)}".`);
      continue;
    }
    seen.add(normalized);
  }
}

function validateDataset({ projectPath, datasetId }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  if (!isObject(dataset)) {
    return { ok: false, error: `Dataset "${parsedId.value}" has invalid payload.` };
  }
  if (typeof dataset.primaryKey !== 'string' || dataset.primaryKey.trim() === '') {
    return {
      ok: false,
      error: `Dataset "${parsedId.value}" has invalid primaryKey name "${String(dataset.primaryKey)}".`,
      details: { errors: [`Dataset "${parsedId.value}" has invalid primaryKey name "${String(dataset.primaryKey)}".`] },
    };
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const errors = [];
  const fields = Array.isArray(dataset.fields) ? dataset.fields : [];

  validatePrimaryKey(parsedId.value, items, dataset.primaryKey, errors);
  const fieldSummary = collectFieldSummary(items);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isObject(item)) {
      continue;
    }
    for (const field of fields) {
      if (typeof field !== 'string' || field.trim() === '') {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(item, field)) {
        errors.push(`Item at index ${index} is missing declared field "${field}".`);
      }
    }
    for (const [field, value] of Object.entries(item)) {
      if (value === null || value === undefined) {
        errors.push(`Item at index ${index} has null value for field "${field}".`);
      }
    }
  }

  for (const [field, info] of Object.entries(fieldSummary)) {
    if (info.types.size > 1) {
      errors.push(`Field "${field}" has inconsistent types in dataset "${parsedId.value}".`);
    }
  }

  return {
    ok: errors.length === 0,
    datasetId: parsedId.value,
    errors,
    summary: {
      itemCount: items.length,
      fieldSummary: sortFieldSummary(fieldSummary),
    },
  };
}

function dataStats({ projectPath, datasetId }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  if (!isObject(dataset)) {
    return { ok: false, error: `Dataset "${parsedId.value}" has invalid payload.` };
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const fileSize = fs.existsSync(loaded.filePath) ? fs.statSync(loaded.filePath).size : 0;

  return {
    ok: true,
    datasetId: parsedId.value,
    itemCount: items.length,
    byteSize: fileSize,
    fieldSummary: sortFieldSummary(collectFieldSummary(items)),
  };
}

function dataKeys({ projectPath, datasetId }) {
  const parsedId = parseDatasetId(datasetId);
  if (!parsedId.ok) {
    return parsedId;
  }

  const loaded = getDatasetDocument({ projectPath, datasetId: parsedId.value });
  if (!loaded.ok) {
    return loaded;
  }

  const dataset = loaded.document.dataset;
  const primaryKey = dataset?.primaryKey;
  if (typeof primaryKey !== 'string' || primaryKey.trim() === '') {
    return { ok: false, error: `Dataset "${parsedId.value}" has an invalid primary key.` };
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const keys = [];
  const errors = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!isObject(item)) {
      errors.push(`Item at index ${index} is not an object.`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(item, primaryKey)) {
      errors.push(`Item at index ${index} is missing primary key "${primaryKey}".`);
      continue;
    }
    if (!isValidPrimaryKeyValue(item[primaryKey])) {
      errors.push(`Item at index ${index} has invalid primary key value for "${primaryKey}".`);
      continue;
    }
    keys.push(item[primaryKey]);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Dataset "${parsedId.value}" has invalid keys.`,
      details: {
        errors,
      },
      datasetId: parsedId.value,
    };
  }

  return {
    ok: true,
    datasetId: parsedId.value,
    keys,
  };
}

module.exports = {
  validateDataset,
  dataStats,
  dataKeys,
};
