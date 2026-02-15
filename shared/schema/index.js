'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { SUPPORTED_SPEC_VERSION } = require('./constants');
const { validateDocumentAgainstSchema } = require('./validator');

const SUPPORTED_DOCUMENT_TYPES = new Set([
  'manifest',
  'sitemap',
  'templates',
  'components',
  'page',
  'dataset',
]);

class SchemaLoadError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SchemaLoadError';
    this.code = code;
    this.details = details;
  }
}

function parseVersion(version, filePath) {
  if (typeof version !== 'string') {
    throw new SchemaLoadError(`Invalid spec version in ${filePath}`, 'INVALID_SPEC_VERSION', { specVersion: version });
  }

  const normalized = version.trim();
  if (!/^\d+(\.\d+){0,2}$/.test(normalized)) {
    throw new SchemaLoadError(`Invalid spec version in ${filePath}`, 'INVALID_SPEC_VERSION', { specVersion: version });
  }

  return normalized.split('.').map((part) => Number.parseInt(part, 10));
}

function compareVersions(left, right, filePath) {
  const leftParts = parseVersion(left, filePath);
  const rightParts = parseVersion(right, filePath);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let i = 0; i < maxLength; i += 1) {
    const leftValue = leftParts[i] || 0;
    const rightValue = rightParts[i] || 0;

    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
  }

  return 0;
}

function detectDocumentType(document, filePath) {
  const documentType = document?.documentType;

  if (documentType == null) {
    throw new SchemaLoadError(`Missing documentType in ${filePath}`, 'MISSING_DOCUMENT_TYPE', { filePath });
  }
  if (typeof documentType !== 'string' || documentType.trim() === '') {
    throw new SchemaLoadError(`Invalid documentType in ${filePath}`, 'INVALID_DOCUMENT_TYPE', { filePath });
  }

  const normalizedType = documentType.trim();
  if (!SUPPORTED_DOCUMENT_TYPES.has(normalizedType)) {
    throw new SchemaLoadError(`Unsupported documentType "${normalizedType}" in ${filePath}`, 'UNSUPPORTED_DOCUMENT_TYPE', {
      filePath,
      documentType: normalizedType,
    });
  }

  return normalizedType;
}

function validateDocumentId(document, filePath) {
  const id = document?.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new SchemaLoadError(`Invalid or missing id in ${filePath}`, 'INVALID_DOCUMENT_ID', { filePath });
  }
  return id.trim();
}

function validateSpecVersion(document, filePath, supportedSpecVersion = SUPPORTED_SPEC_VERSION) {
  if (document?.specVersion == null) {
    throw new SchemaLoadError(`Missing specVersion in ${filePath}`, 'MISSING_SPEC_VERSION', { filePath });
  }

  const specVersion = String(document.specVersion);
  parseVersion(specVersion, filePath);

  if (compareVersions(specVersion, supportedSpecVersion, filePath) > 0) {
    throw new SchemaLoadError(
      `Unsupported specVersion "${specVersion}" in ${filePath}; supported maximum is ${supportedSpecVersion}`,
      'UNSUPPORTED_SPEC_VERSION',
      { filePath, specVersion, supportedSpecVersion },
    );
  }

  return specVersion;
}

function validateManifestSchemaVersion(document, filePath, supportedSpecVersion = SUPPORTED_SPEC_VERSION) {
  const schemaVersion = document?.manifest?.schemaVersion;

  if (schemaVersion == null) {
    throw new SchemaLoadError(
      `Missing manifest.schemaVersion in ${filePath}`,
      'MISSING_MANIFEST_SCHEMA_VERSION',
      { filePath },
    );
  }

  const normalized = String(schemaVersion);
  parseVersion(normalized, filePath);

  if (compareVersions(normalized, supportedSpecVersion, filePath) > 0) {
    throw new SchemaLoadError(
      `manifest.schemaVersion "${normalized}" in ${filePath} exceeds CLI supported version ${supportedSpecVersion}`,
      'UNSUPPORTED_MANIFEST_SCHEMA_VERSION',
      { filePath, schemaVersion: normalized, supportedSpecVersion },
    );
  }

  return normalized;
}

function parseDocumentText(content, filePath) {
  try {
    return yaml.load(content);
  } catch (error) {
    throw new SchemaLoadError(`Invalid YAML in ${filePath}: ${error.message}`, 'INVALID_YAML', { filePath });
  }
}

function validateDocument(document, filePath, supportedSpecVersion = SUPPORTED_SPEC_VERSION, options = {}) {
  const { skipSchemaValidation = false } = options;

  if (document == null || typeof document !== 'object' || Array.isArray(document)) {
    throw new SchemaLoadError(`Invalid document in ${filePath}`, 'INVALID_DOCUMENT', { filePath });
  }

  const documentType = detectDocumentType(document, filePath);
  const specVersion = validateSpecVersion(document, filePath, supportedSpecVersion);
  const id = validateDocumentId(document, filePath);

  if (documentType === 'manifest') {
    validateManifestSchemaVersion(document, filePath, supportedSpecVersion);
  }

  if (!skipSchemaValidation) {
    const schemaErrors = validateDocumentAgainstSchema(document, filePath);
    if (schemaErrors.length > 0) {
      throw new SchemaLoadError(
        `Document in ${filePath} does not match schema.json`,
        'SCHEMA_VALIDATION',
        {
          filePath,
          schemaPath: '#',
          errors: schemaErrors,
        },
      );
    }
  }

  return { documentType, specVersion, id };
}

function loadDocumentFromFile(filePath, options = {}) {
  const { supportedSpecVersion = SUPPORTED_SPEC_VERSION } = options;
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const parsedDocument = parseDocumentText(content, absolutePath);

  const { documentType, specVersion, id } = validateDocument(parsedDocument, absolutePath, supportedSpecVersion, options);

  return {
    absolutePath,
    documentType,
    specVersion,
    id,
    document: parsedDocument,
  };
}

function detectDocumentTypeFromFile(filePath, options = {}) {
  const { documentType } = loadDocumentFromFile(filePath, options);
  return documentType;
}

module.exports = {
  SchemaLoadError,
  SUPPORTED_DOCUMENT_TYPES,
  compareVersions,
  detectDocumentTypeFromFile,
  loadDocumentFromFile,
  validateDocument,
};
