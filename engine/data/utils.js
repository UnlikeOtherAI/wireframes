'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { SUPPORTED_SPEC_VERSION, DEFAULT_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema', 'loader'));
const { ensureObject, parseJson } = require(path.resolve(__dirname, '..', 'node', 'support'));

const DATASET_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const DATA_DIR = 'data';
const ALLOWED_IMPORT_EXTENSIONS = new Set(['.json', '.csv']);

function dataDirPath(projectPath) {
  return path.join(projectPath, DATA_DIR);
}

function datasetFilePath(projectPath, datasetId) {
  return path.join(dataDirPath(projectPath), `${datasetId}.yaml`);
}

function pagesDirPath(projectPath) {
  return path.join(projectPath, 'pages');
}

function sitemapFilePath(projectPath) {
  return path.join(projectPath, 'sitemap.yaml');
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function readText(filePath, context) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { ok: false, error: `Missing ${context}: ${filePath}` };
  }
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitive(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function isValidPrimaryKeyValue(value) {
  return value !== null && ['string', 'number', 'boolean'].includes(typeof value);
}

function parseDatasetId(datasetId) {
  if (typeof datasetId !== 'string' || !DATASET_ID_REGEX.test(datasetId.trim())) {
    return {
      ok: false,
      error: `Invalid dataset id "${datasetId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  return { ok: true, value: datasetId.trim() };
}

function stringifyPrimaryKey(value) {
  try {
    return `v:${JSON.stringify(value)}`;
  } catch (error) {
    return `v:${String(value)}`;
  }
}

function isPrimaryKeyMatch(itemValue, lookupValue) {
  if (itemValue === lookupValue) {
    return true;
  }

  return stringifyPrimaryKey(itemValue) === stringifyPrimaryKey(lookupValue);
}

function parsePrimaryKeyValue(rawValue) {
  if (rawValue == null || String(rawValue).trim() === '') {
    return {
      ok: false,
      error: 'Primary key value is required.',
    };
  }

  const trimmed = String(rawValue).trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (isObject(parsed)) {
      return {
        ok: false,
        error: 'Primary key value must be a primitive.',
      };
    }
    if (parsed === null || ['string', 'number', 'boolean'].includes(typeof parsed)) {
      return { ok: true, value: parsed };
    }
  } catch {
    // fall through
  }

  return { ok: true, value: trimmed };
}

function parseFields(rawFields) {
  if (rawFields == null) {
    return { ok: true, value: [] };
  }
  if (typeof rawFields !== 'string') {
    return { ok: false, error: '--fields must be a comma-separated list.' };
  }

  const split = rawFields
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return { ok: true, value: split };
}

function getDatasetDocument({ projectPath, datasetId }) {
  const resolvedPath = datasetFilePath(projectPath, datasetId);
  try {
    const loaded = loadDocumentFromFile(resolvedPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    if (loaded.documentType !== 'dataset') {
      return { ok: false, error: 'Expected dataset document type.' };
    }
    return {
      ok: true,
      filePath: resolvedPath,
      document: loaded.document,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function readYamlFile(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listDatasetsRaw(projectPath) {
  const dirPath = dataDirPath(projectPath);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }

  const datasetFiles = fs.readdirSync(dirPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml'));
  const ids = [];

  for (const fileName of datasetFiles) {
    const parsed = readYamlFile(path.join(dirPath, fileName));
    const candidate = parsed?.id;
    if (typeof candidate === 'string' && DATASET_ID_REGEX.test(candidate)) {
      ids.push(candidate);
      continue;
    }

    const fallback = fileName.replace(/\.ya?ml$/, '');
    if (DATASET_ID_REGEX.test(fallback)) {
      ids.push(fallback);
    }
  }

  return [...new Set(ids)].sort();
}

function listDataUsages(projectPath, datasetId) {
  const pagesPath = pagesDirPath(projectPath);
  const usages = [];

  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return usages;
  }

  const pageFiles = fs.readdirSync(pagesPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml')).sort();
  for (const pageFile of pageFiles) {
    const pagePath = path.join(pagesPath, pageFile);
    const pageDoc = readYamlFile(pagePath);
    const pageData = pageDoc?.page;
    const pageId = pageData?.id || pageFile;
    const dataSources = Array.isArray(pageData?.dataSources) ? pageData.dataSources : [];

    if (dataSources.some((source) => source && source.dataset === datasetId)) {
      usages.push(pageId);
    }
  }

  return usages;
}

function collectPagesWithStateMatches(projectPath, targetValue) {
  const pagesPath = pagesDirPath(projectPath);
  const matches = [];

  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return matches;
  }

  const pageFiles = fs.readdirSync(pagesPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml')).sort();
  for (const pageFile of pageFiles) {
    const pagePath = path.join(pagesPath, pageFile);
    const pageDoc = readYamlFile(pagePath);
    const pageId = pageDoc?.page?.id || pageFile;
    const pageState = pageDoc?.page?.pageState;

    if (containsPrimaryKeyValue(pageState, targetValue)) {
      matches.push(`page:${pageId}.pageState`);
    }
  }

  return matches;
}

function collectSitemapStateMatches(projectPath, targetValue) {
  const sitemapDoc = readYamlFile(sitemapFilePath(projectPath));
  const appState = sitemapDoc?.sitemap?.appState ?? sitemapDoc?.appState;

  if (containsPrimaryKeyValue(appState, targetValue)) {
    return ['sitemap.appState'];
  }

  return [];
}

function containsPrimaryKeyValue(value, targetValue) {
  if (isPrimitive(value)) {
    return isPrimaryKeyMatch(value, targetValue);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (containsPrimaryKeyValue(entry, targetValue)) {
        return true;
      }
    }
    return false;
  }

  if (!isObject(value)) {
    return false;
  }

  for (const fieldValue of Object.values(value)) {
    if (containsPrimaryKeyValue(fieldValue, targetValue)) {
      return true;
    }
  }

  return false;
}

function ensureDatasetState(projectPath, datasetId, datasetDocument) {
  const dataset = datasetDocument?.dataset;
  if (!isObject(dataset)) {
    return { ok: false, error: 'Invalid dataset payload.' };
  }

  const primaryKey = dataset.primaryKey;
  if (typeof primaryKey !== 'string' || primaryKey.trim() === '') {
    return { ok: false, error: `Dataset "${datasetId}" is missing a valid primaryKey.` };
  }

  const items = Array.isArray(dataset.items) ? dataset.items : [];
  const seen = new Set();
  for (const item of items) {
    if (!isObject(item)) {
      return { ok: false, error: `Dataset "${datasetId}" contains a non-object item.` };
    }
    if (!Object.prototype.hasOwnProperty.call(item, primaryKey)) {
      return { ok: false, error: `Item in dataset "${datasetId}" is missing primary key "${primaryKey}".` };
    }
    if (!isValidPrimaryKeyValue(item[primaryKey])) {
      return {
        ok: false,
        error: `Dataset "${datasetId}" contains invalid primary key value "${String(item[primaryKey])}" for "${primaryKey}".`,
      };
    }

    const normalized = stringifyPrimaryKey(item[primaryKey]);
    if (seen.has(normalized)) {
      return { ok: false, error: `Dataset "${datasetId}" has duplicate primary key "${String(item[primaryKey])}".` };
    }
    seen.add(normalized);
  }

  return { ok: true };
}

function buildDatasetDocument(datasetId, primaryKey, fields = [], items = []) {
  const dataset = {
    id: datasetId,
    primaryKey,
    items,
  };

  if (fields.length > 0) {
    dataset.fields = fields;
  }

  return {
    documentType: 'dataset',
    specVersion: DEFAULT_SPEC_VERSION,
    id: datasetId,
    dataset,
  };
}

function parseCsvFile(raw) {
  const rows = splitCsvRows(raw);
  if (rows.length === 0) {
    return { ok: false, error: 'CSV import file is empty.' };
  }

  const headerRow = rows[0];
  if (headerRow.length === 0) {
    return { ok: false, error: 'CSV import file must include a header row.' };
  }

  const items = [];
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length === 0 || row.every((value) => String(value).trim() === '')) {
      continue;
    }

    const item = {};
    for (let column = 0; column < headerRow.length; column += 1) {
      const key = headerRow[column];
      item[key] = row[column] !== undefined ? row[column] : '';
    }
    items.push(item);
  }

  return { ok: true, value: items };
}

function splitCsvRows(raw) {
  const rows = [];
  let currentRow = [];
  let currentValue = '';
  let insideQuote = false;

  for (let index = 0; index <= raw.length; index += 1) {
    const char = raw[index];

    if (char === '"' ) {
      const next = raw[index + 1];
      if (insideQuote && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        insideQuote = !insideQuote;
      }
      continue;
    }

    if (char === ',' && !insideQuote) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r' || index === raw.length) && !insideQuote) {
      if (!(char === '\r' && raw[index + 1] === '\n')) {
        currentRow.push(currentValue);
        if (!(currentRow.length === 1 && currentRow[0] === '' && rows.length > 0 && index === raw.length)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentValue = '';
      }
      if (char === '\r' && raw[index + 1] === '\n') {
        index += 1;
      }
      continue;
    }

    if (char === undefined) {
      currentRow.push(currentValue);
      rows.push(currentRow);
      continue;
    }

    currentValue += char;
  }

  return rows
    .map((row) => row.map((value) => value.trim()))
    .map((row) => row.map((value) => value.replace(/^\\"|\\"$/g, '')))
    .filter((row, rowIndex) => row.length > 1 || row[0] !== '' || rowIndex === 0);
}

function parseDataFile(filePath, fromArg) {
  const content = readText(filePath, fromArg);
  if (typeof content !== 'string') {
    return content;
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
    return { ok: false, error: `Unsupported file type "${extension}" for ${fromArg}.` };
  }

  if (extension === '.json') {
    const parsed = parseJson(content, fromArg);
    if (!parsed.ok) {
      return parsed;
    }

    if (Array.isArray(parsed.value)) {
      return { ok: true, value: parsed.value };
    }

    if (parsed.value && Array.isArray(parsed.value?.items)) {
      return { ok: true, value: parsed.value.items };
    }

    return { ok: false, error: `${fromArg} JSON must be an array of item objects.` };
  }

  const parsed = parseCsvFile(content);
  if (!parsed.ok) {
    return parsed;
  }
  return parsed;
}

function parseItemPayload(rawInput, fromFile, fromArg) {
  if (fromFile != null) {
    const content = readText(fromFile, fromArg);
    if (typeof content !== 'string') {
      return content;
    }
    const parsed = parseJson(content, fromArg);
    if (!parsed.ok) {
      return parsed;
    }
    return ensureObject(parsed.value, fromArg);
  }

  const parsed = parseJson(rawInput, fromArg);
  if (!parsed.ok) {
    return parsed;
  }
  return ensureObject(parsed.value, fromArg);
}

function findItemIndexByPrimaryKey(items, primaryKey, targetValue) {
  return items.findIndex((item) => isObject(item) && isPrimaryKeyMatch(item[primaryKey], targetValue));
}

module.exports = {
  datasetFilePath,
  getDatasetDocument,
  writeYaml,
  readText,
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
  isPrimitive,
  isPrimaryKeyMatch,
  stringifyPrimaryKey,
  readYamlFile,
};
