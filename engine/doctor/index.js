'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  SUPPORTED_SPEC_VERSION,
} = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { compareVersions, loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));
const {
  loadComponentRegistryForDocuments,
  loadProjectComponentRegistry,
} = require(path.resolve(__dirname, '..', 'component-registry'));
const { runSemanticValidation } = require(path.resolve(__dirname, 'semantic-validator'));
const {
  collectComponentUseGraph,
  collectUsedComponents,
  detectCircularUse,
} = require(path.resolve(__dirname, 'component-graph'));
const {
  collectTemplateReferences,
  collectPageReferences,
  collectPageRouteDiagnostics,
} = require(path.resolve(__dirname, 'reference-checks'));

function addDiagnostic(result, severity, code, message) {
  result[severity].push({
    code,
    message,
  });
}

function isYamlFile(fileName) {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}

function parseYamlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return yaml.load(content);
  } catch (error) {
    return {
      error: `Invalid YAML in ${filePath}: ${error.message}`,
    };
  }
}

function loadDocument(filePath, result, expectedType) {
  try {
    const loaded = loadDocumentFromFile(filePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });

    if (expectedType && loaded.documentType !== expectedType) {
      addDiagnostic(
        result,
        'errors',
        'INVALID_DOCUMENT_TYPE',
        `Expected documentType "${expectedType}" in ${filePath}, found "${loaded.documentType}".`,
      );
      return null;
    }

    return loaded;
  } catch (error) {
    if (
      error.code === 'SCHEMA_VALIDATION'
      && error.details != null
      && Array.isArray(error.details.errors)
    ) {
      for (const schemaError of error.details.errors) {
        const location = schemaError.path ? ` at ${schemaError.path}` : '';
        addDiagnostic(
          result,
          'errors',
          schemaError.code || 'SCHEMA_VALIDATION',
          `Schema validation error${location}: ${schemaError.message}`,
        );
      }
      return null;
    }

    addDiagnostic(result, 'errors', error.code || 'DOCUMENT_LOAD_ERROR', error.message);
    return null;
  }
}

function loadScopedComponentIds(root, result, entries, contextLabel, fallbackIds) {
  const registryResult = loadComponentRegistryForDocuments(root, entries);
  if (!registryResult.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load component imports for ${contextLabel}: ${registryResult.error}`,
    );
    return fallbackIds;
  }

  return new Set(Object.keys(registryResult.registry.components));
}

function runDoctor({ projectPath } = {}) {
  const result = {
    ok: true,
    errors: [],
    warnings: [],
    projectPath: path.resolve(projectPath || process.cwd()),
  };

  const root = result.projectPath;

  const requiredFiles = [
    { path: 'manifest.yaml', type: 'file' },
    { path: '.wfrc.yaml', type: 'file' },
    { path: 'sitemap.yaml', type: 'file' },
    { path: 'templates.yaml', type: 'file' },
    { path: 'components.yaml', type: 'file' },
    { path: 'pages', type: 'dir' },
    { path: 'data', type: 'dir' },
  ];

  for (const item of requiredFiles) {
    const abs = path.join(root, item.path);
    if (!fs.existsSync(abs)) {
      addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', `Required path is missing: ${item.path}`);
      continue;
    }

    const stats = fs.statSync(abs);
    if (item.type === 'file' && !stats.isFile()) {
      addDiagnostic(result, 'errors', 'INVALID_REQUIRED_PATH', `Expected file at ${item.path}.`);
    }
    if (item.type === 'dir' && !stats.isDirectory()) {
      addDiagnostic(result, 'errors', 'INVALID_REQUIRED_PATH', `Expected directory at ${item.path}.`);
    }
  }

  const manifest = loadDocument(path.join(root, 'manifest.yaml'), result, 'manifest');
  const sitemap = loadDocument(path.join(root, 'sitemap.yaml'), result, 'sitemap');
  const templates = loadDocument(path.join(root, 'templates.yaml'), result, 'templates');
  const components = loadDocument(path.join(root, 'components.yaml'), result, 'components');

  const wfrcPath = path.join(root, '.wfrc.yaml');
  if (fs.existsSync(wfrcPath)) {
    const parsed = parseYamlFile(wfrcPath);
    if (parsed && parsed.error) {
      addDiagnostic(result, 'errors', 'INVALID_YAML', parsed.error);
    }
  }

  const templateMap = new Map();
  const pageMap = new Map();
  const datasetIds = new Set();

  const pagesDir = path.join(root, 'pages');
  if (fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    const pageFiles = fs.readdirSync(pagesDir).filter((name) => isYamlFile(name));
    for (const pageFile of pageFiles) {
      const abs = path.join(pagesDir, pageFile);
      const loaded = loadDocument(abs, result, 'page');
      if (!loaded) {
        continue;
      }
      const pageId = loaded.document?.page?.id;
      if (typeof pageId === 'string') {
        if (pageMap.has(pageId)) {
          addDiagnostic(result, 'errors', 'DUPLICATE_PAGE_ID', `Duplicate page id "${pageId}" in ${abs}.`);
        } else {
          pageMap.set(pageId, loaded);
        }
      } else {
        addDiagnostic(result, 'errors', 'INVALID_PAGE_ID', `Page document at ${abs} has no valid id.`);
      }
    }
  } else {
    addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', 'pages directory is missing required page sources.');
  }

  const dataDir = path.join(root, 'data');
  if (fs.existsSync(dataDir) && fs.statSync(dataDir).isDirectory()) {
    const datasetFiles = fs.readdirSync(dataDir).filter((name) => isYamlFile(name));
    for (const datasetFile of datasetFiles) {
      const abs = path.join(dataDir, datasetFile);
      const loaded = loadDocument(abs, result, 'dataset');
      if (!loaded) {
        continue;
      }
      const datasetId = loaded.id;
      if (typeof datasetId === 'string') {
        if (datasetIds.has(datasetId)) {
          addDiagnostic(result, 'errors', 'DUPLICATE_DATASET_ID', `Duplicate dataset id "${datasetId}" in ${abs}.`);
        } else {
          datasetIds.add(datasetId);
        }
      } else {
        addDiagnostic(result, 'errors', 'INVALID_DATASET_ID', `Dataset document at ${abs} has no valid id.`);
      }
    }
  } else {
    addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', 'data directory is missing required dataset sources.');
  }

  if (manifest && manifest.document?.manifest?.schemaVersion) {
    const schemaVersion = manifest.document.manifest.schemaVersion;
    const supportedSchemaVersion = SUPPORTED_SPEC_VERSION;

    try {
      if (compareVersions(String(schemaVersion), supportedSchemaVersion, manifest.absolutePath) > 0) {
        addDiagnostic(
          result,
          'errors',
          'INCOMPATIBLE_SCHEMA_VERSION',
          `manifest.schemaVersion "${schemaVersion}" exceeds CLI-supported version "${supportedSchemaVersion}".`,
        );
      }
    } catch (error) {
      addDiagnostic(result, 'errors', 'INVALID_MANIFEST_SCHEMA_VERSION', error.message);
    }
  }

  const templateDefinitions = templates?.document?.templates || {};
  const projectComponentRegistry = loadProjectComponentRegistry(root);
  if (!projectComponentRegistry.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load project component registry: ${projectComponentRegistry.error}`,
    );
  }
  const componentMap = projectComponentRegistry.ok ? projectComponentRegistry.registry.components : {};
  const componentIds = new Set(Object.keys(componentMap));
  const componentUsages = {
    componentsUsed: new Set(),
    datasetsUsed: new Set(),
  };

  for (const [templateId, templateDocument] of Object.entries(templateDefinitions)) {
    if (!templateMap.has(templateId)) {
      templateMap.set(templateId, {
        slotIds: new Set(),
        injectableIds: new Set(),
      });
    }
    const templateInfo = templateMap.get(templateId);
    const templateComponentIds = loadScopedComponentIds(
      root,
      result,
      templates?.absolutePath && templates?.document
        ? [{ documentPath: templates.absolutePath, document: templates.document }]
        : [],
      `template "${templateId}"`,
      componentIds,
    );
    collectTemplateReferences(templateDocument, result, templateComponentIds, templateInfo.slotIds, templateInfo.injectableIds, componentUsages, addDiagnostic);
  }

  const routeEntries = sitemap?.document?.routes || sitemap?.document?.sitemap?.routes || [];
  collectPageRouteDiagnostics(routeEntries, result, pageMap, templateMap, addDiagnostic);

  for (const pageLoaded of pageMap.values()) {
    const pageComponentIds = loadScopedComponentIds(
      root,
      result,
      pageLoaded?.absolutePath && pageLoaded?.document
        ? [{ documentPath: pageLoaded.absolutePath, document: pageLoaded.document }]
        : [],
      `page "${pageLoaded.id}"`,
      componentIds,
    );
    collectPageReferences(
      pageLoaded.document?.page ? pageLoaded : { id: pageLoaded.id, document: pageLoaded.document },
      result,
      templateMap,
      pageComponentIds,
      datasetIds,
      componentUsages,
      addDiagnostic,
    );
  }

  const componentGraph = collectComponentUseGraph(componentMap, result, addDiagnostic);
  const usedComponents = collectUsedComponents(componentGraph, componentUsages.componentsUsed);

  for (const componentId of Object.keys(componentMap)) {
    if (!usedComponents.has(componentId)) {
      addDiagnostic(
        result,
        'warnings',
        'UNUSED_COMPONENT',
        `Component "${componentId}" is not referenced by any page or template.`,
      );
    }
  }

  for (const datasetId of datasetIds) {
    if (!componentUsages.datasetsUsed.has(datasetId)) {
      addDiagnostic(
        result,
        'warnings',
        'UNUSED_DATASET',
        `Dataset "${datasetId}" is not referenced by any page.`,
      );
    }
  }

  detectCircularUse(componentGraph, result, addDiagnostic);

  runSemanticValidation({
    result,
    manifest: manifest?.document?.manifest || {},
    sitemap: sitemap?.document?.sitemap || sitemap?.document || {},
    templates: templates?.document?.templates || {},
    components: componentMap,
    pages: Array.from(pageMap.values()),
    resolveComponentsForPage(pageLoaded) {
      const entries = [];
      if (templates?.absolutePath && templates?.document) {
        entries.push({
          documentPath: templates.absolutePath,
          document: templates.document,
        });
      }
      if (pageLoaded?.absolutePath && pageLoaded?.document) {
        entries.push({
          documentPath: pageLoaded.absolutePath,
          document: pageLoaded.document,
        });
      }

      const registryResult = loadComponentRegistryForDocuments(root, entries);
      if (!registryResult.ok) {
        return {
          ok: false,
          error: `Unable to load component imports for page "${pageLoaded?.id || '<unknown>'}": ${registryResult.error}`,
        };
      }

      return {
        ok: true,
        components: registryResult.registry.components,
      };
    },
  });

  result.ok = result.errors.length === 0;

  return result;
}

module.exports = {
  runDoctor,
};
