'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadDocumentFromFile } = require('../schema/loader');
const { SUPPORTED_SPEC_VERSION } = require('../schema/constants');
const { createComponentRegistryResolver } = require('./core');

const COMPONENTS_FILE_NAME = 'components.yaml';
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const componentsFilePath = (projectPath) => path.join(projectPath, COMPONENTS_FILE_NAME);
const { createEmptyRegistry, mergeComponentRegistry, loadComponentsDocumentRegistry,
  loadImportedComponentRegistry } = createComponentRegistryResolver({
  canonicalPath: (value) => path.resolve(value),
  formatPath: (value) => path.relative(process.cwd(), value) || value,
  loadDocument: (filename) => {
    if (!fs.existsSync(filename)) throw new Error(`Imported components file does not exist: ${filename}`);
    return loadDocumentFromFile(filename, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  },
  resolveImportPath: (filename, imported) => path.resolve(path.dirname(filename), imported),
});

function loadProjectComponentRegistry(projectPath) {
  const filePath = componentsFilePath(projectPath);
  if (!fs.existsSync(filePath)) {
    return {
      ok: true,
      registry: createEmptyRegistry(),
    };
  }

  return loadComponentsDocumentRegistry(filePath, '');
}

function loadComponentRegistryForDocuments(projectPath, documents = []) {
  const projectRegistry = loadProjectComponentRegistry(projectPath);
  if (!projectRegistry.ok) {
    return projectRegistry;
  }

  const combined = createEmptyRegistry();
  const mergeProjectResult = mergeComponentRegistry(combined, projectRegistry.registry);
  if (!mergeProjectResult.ok) {
    return mergeProjectResult;
  }

  for (const entry of documents) {
    const documentPath = typeof entry?.documentPath === 'string' ? entry.documentPath : '';
    const document = entry?.document;
    if (!documentPath || !isObject(document)) {
      continue;
    }

    const importedRegistry = loadImportedComponentRegistry(documentPath, document);
    if (!importedRegistry.ok) {
      return importedRegistry;
    }

    const mergeResult = mergeComponentRegistry(combined, importedRegistry.registry);
    if (!mergeResult.ok) {
      return mergeResult;
    }
  }

  return {
    ok: true,
    registry: combined,
  };
}

module.exports = {
  componentsFilePath,
  createEmptyRegistry,
  loadComponentRegistryForDocuments,
  loadImportedComponentRegistry,
  loadProjectComponentRegistry,
};
