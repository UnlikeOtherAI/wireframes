'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { validatePresentation } = require('../validate/presentation');
const { validateIconReferences } = require('../icons/validate');
const {
  SUPPORTED_SPEC_VERSION,
} = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema', 'loader'));
const {
  loadComponentRegistryForDocuments,
  loadProjectComponentRegistry,
} = require(path.resolve(__dirname, '..', 'component-registry'));
const { addDiagnostic, checkProject } = require('./project-checks');

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

    const appearance = validatePresentation(loaded.document);
    result.errors.push(...appearance.errors.map((d) => ({ ...d, message: filePath + ': ' + d.message })));
    result.warnings.push(...appearance.warnings, ...validateIconReferences(loaded.document, require('../icons/catalogue')));
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

/** `{ components, sources }` for what these documents import, or `fallback` when that fails. */
function loadScopedComponentDefinitions(root, result, entries, contextLabel, fallback) {
  const registryResult = loadComponentRegistryForDocuments(root, entries);
  if (!registryResult.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load component imports for ${contextLabel}: ${registryResult.error}`,
    );
    return fallback;
  }

  return registryResult.registry;
}

/** `onRenderedPage` sees each page as it renders (see `checkProject`). */
function runDoctor({ projectPath, onRenderedPage } = {}) {
  const result = {
    ok: true,
    errors: [],
    warnings: [],
    info: [],
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

  const pageMap = new Map();
  const datasetIds = new Set();

  const pagesDir = path.join(root, 'pages');
  if (fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    const pageFiles = fs.readdirSync(pagesDir).filter((name) => isYamlFile(name)).sort();
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
    const datasetFiles = fs.readdirSync(dataDir).filter((name) => isYamlFile(name)).sort();
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
  }

  const projectComponentRegistry = loadProjectComponentRegistry(root);
  if (!projectComponentRegistry.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load project component registry: ${projectComponentRegistry.error}`,
    );
  }
  const templatesEntry = templates?.absolutePath && templates?.document
    ? [{ documentPath: templates.absolutePath, document: templates.document }]
    : [];
  const pageEntry = (pageLoaded) => (pageLoaded?.absolutePath && pageLoaded?.document
    ? [{ documentPath: pageLoaded.absolutePath, document: pageLoaded.document }]
    : []);

  checkProject({
    result,
    onRenderedPage,
    manifest,
    sitemap,
    templates,
    components,
    pages: pageMap,
    datasetIds,
    componentMap: projectComponentRegistry.ok ? projectComponentRegistry.registry.components : {},
    componentSources: projectComponentRegistry.ok ? projectComponentRegistry.registry.sources : {},
    // A document on disk can import components from other files by path.
    componentsFor(scope) {
      const fallback = { components: scope.components, sources: scope.sources };
      return scope.kind === 'template'
        ? loadScopedComponentDefinitions(root, result, templatesEntry, `template "${scope.id}"`, fallback)
        : loadScopedComponentDefinitions(root, result, pageEntry(scope.page), `page "${scope.page.id}"`, fallback);
    },
    resolveComponentsForPage(pageLoaded) {
      const registryResult = loadComponentRegistryForDocuments(root, [...templatesEntry, ...pageEntry(pageLoaded)]);
      if (!registryResult.ok) {
        return {
          ok: false,
          error: `Unable to load component imports for page "${pageLoaded?.id || '<unknown>'}": ${registryResult.error}`,
        };
      }

      return {
        ok: true,
        components: registryResult.registry.components,
        sources: registryResult.registry.sources,
      };
    },
  });

  result.ok = result.errors.length === 0;

  return result;
}

module.exports = {
  runDoctor,
};
