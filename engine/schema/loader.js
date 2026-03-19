'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const { validateDocument, SchemaLoadError } = require('./index');
const { SUPPORTED_SPEC_VERSION } = require('./constants');

function parseDocumentText(content, filePath) {
  try {
    return yaml.load(content);
  } catch (error) {
    throw new SchemaLoadError(`Invalid YAML in ${filePath}: ${error.message}`, 'INVALID_YAML', { filePath });
  }
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
  loadDocumentFromFile,
  detectDocumentTypeFromFile,
};
