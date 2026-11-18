'use strict';

// What is checked once a project's documents are in memory: versions, references
// between documents, unused and circular components, and what nodes do. It reads no
// files, so `wf doctor` runs it after loading from disk and `lintSources` runs it
// on text.

const { SUPPORTED_SPEC_VERSION } = require('../schema/constants');
const { compareVersions } = require('../schema');
const { appendPath } = require('../schema/validator');
const { runSemanticValidation } = require('./semantic-validator');
const {
  collectComponentUseGraph,
  collectUsedComponents,
  detectCircularUse,
} = require('./component-graph');
const {
  collectTemplateReferences,
  collectPageReferences,
  collectPageRouteDiagnostics,
} = require('./reference-checks');

/** `at` says where the finding is. Only a result that sets `locations` keeps it. */
function addDiagnostic(result, severity, code, message, at) {
  result[severity].push(at && result.locations ? { code, message, at } : { code, message });
}

/**
 * @param {object} input
 * @param {object} input.result               `{ errors, warnings }`, added to in place
 * @param {object|null} input.manifest        a loaded document: `{ document, absolutePath? }`
 * @param {object|null} input.sitemap
 * @param {object|null} input.templates
 * @param {Map<string, object>} input.pages   page id to `{ id, document, absolutePath? }`
 * @param {Set<string>} input.datasetIds
 * @param {object} input.componentMap         component id to its definition
 * @param {(scope: object) => Set<string>} [input.componentIdsFor]
 *   The component ids one template or page may use. A project on disk can import more
 *   by file path; in memory every document sees the project's components.
 * @param {(page: object) => object} [input.resolveComponentsForPage]
 */
function checkProject({
  result,
  manifest,
  sitemap,
  templates,
  pages,
  datasetIds,
  componentMap,
  componentIdsFor,
  resolveComponentsForPage,
}) {
  if (manifest && manifest.document?.manifest?.schemaVersion) {
    const schemaVersion = manifest.document.manifest.schemaVersion;
    const at = { document: 'manifest', path: '$.manifest.schemaVersion' };

    try {
      if (compareVersions(String(schemaVersion), SUPPORTED_SPEC_VERSION, manifest.absolutePath) > 0) {
        addDiagnostic(
          result,
          'errors',
          'INCOMPATIBLE_SCHEMA_VERSION',
          `manifest.schemaVersion "${schemaVersion}" exceeds CLI-supported version "${SUPPORTED_SPEC_VERSION}".`,
          at,
        );
      }
    } catch (error) {
      addDiagnostic(result, 'errors', 'INVALID_MANIFEST_SCHEMA_VERSION', error.message, at);
    }
  }

  const templateMap = new Map();
  const templateDefinitions = templates?.document?.templates || {};
  const componentIds = new Set(Object.keys(componentMap));
  const idsFor = typeof componentIdsFor === 'function' ? componentIdsFor : () => componentIds;
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
    const templateComponentIds = idsFor({ kind: 'template', id: templateId, componentIds });
    collectTemplateReferences(
      templateDocument,
      result,
      templateComponentIds,
      templateInfo.slotIds,
      templateInfo.injectableIds,
      componentUsages,
      addDiagnostic,
      { document: 'templates', path: appendPath('$.templates', templateId) },
    );
  }

  const unwrappedRoutes = sitemap?.document?.routes;
  const routeEntries = unwrappedRoutes || sitemap?.document?.sitemap?.routes || [];
  collectPageRouteDiagnostics(routeEntries, result, pages, templateMap, addDiagnostic, {
    document: 'sitemap',
    path: unwrappedRoutes ? '$.routes' : '$.sitemap.routes',
  });

  for (const pageLoaded of pages.values()) {
    const pageComponentIds = idsFor({ kind: 'page', page: pageLoaded, componentIds });
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
        { document: 'components', path: appendPath('$.components', componentId) },
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
        { document: `dataset:${datasetId}`, path: '$.id' },
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
    pages: Array.from(pages.values()),
    resolveComponentsForPage,
  });
}

module.exports = {
  addDiagnostic,
  checkProject,
};
