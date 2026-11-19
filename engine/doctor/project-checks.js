'use strict';

// What is checked once a project's documents are in memory: versions, references
// between documents, unused and circular components, and what nodes do. It reads no
// files, so `wf doctor` runs it after loading from disk and `lintSources` runs it
// on text.

const { SUPPORTED_SPEC_VERSION } = require('../schema/constants');
const { compareVersions } = require('../schema');
const { appendPath } = require('../schema/validator');
const { runSemanticValidation } = require('./semantic-validator');
const { checkComponentSlots } = require('./component-slots');
const { checkRepeats } = require('./repeat-checks');
const { checkStdAlias } = require('./std-alias');
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

/** A document's file name on disk, or its document map label in memory. */
function nameOf(loaded, label) {
  return typeof loaded?.absolutePath === 'string' ? loaded.absolutePath.split(/[\\/]/).pop() : label;
}

/**
 * @param {object} input
 * @param {object} input.result               `{ errors, warnings, info }`, added to in place
 * @param {object|null} input.manifest        a loaded document: `{ document, absolutePath? }`
 * @param {object|null} input.sitemap
 * @param {object|null} input.templates
 * @param {object|null} [input.components]    the project's own components document
 * @param {Map<string, object>} input.pages   page id to `{ id, document, absolutePath? }`
 * @param {Set<string>} input.datasetIds
 * @param {object} input.componentMap         component id to its definition
 * @param {object} [input.componentSources]   component id to where it is written, `{ sourcePath, localId }`
 * @param {(scope: object) => object} [input.componentsFor]
 *   The components one template or page may use, `{ components, sources }`. A project
 *   can import more by path; without imports every document sees the project's
 *   components. Built-in `std.*` patterns are never in it: lookups fall back to them.
 * @param {(page: object) => object} [input.resolveComponentsForPage]
 *   `{ ok, components, sources }` for a page with its template's imports, or `{ ok: false, error }`
 * @param {(page: object) => void} [input.onRenderedPage]
 *   Called with `{ pageId, roots, sources }` for each page as it renders, stamped, for lint.
 */
function checkProject({
  result,
  manifest,
  sitemap,
  templates,
  components,
  pages,
  datasetIds,
  componentMap,
  componentSources = {},
  componentsFor,
  resolveComponentsForPage,
  onRenderedPage,
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
  const projectScope = { components: componentMap, sources: componentSources };
  const definitionsFor = typeof componentsFor === 'function' ? componentsFor : () => projectScope;
  let templateScope = projectScope;
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
    templateScope = definitionsFor({ kind: 'template', id: templateId, ...projectScope });
    collectTemplateReferences(
      templateDocument,
      result,
      templateScope.components,
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
    const pageDefinitions = definitionsFor({ kind: 'page', page: pageLoaded, ...projectScope }).components;
    collectPageReferences(
      pageLoaded.document?.page ? pageLoaded : { id: pageLoaded.id, document: pageLoaded.document },
      result,
      templateMap,
      pageDefinitions,
      datasetIds,
      componentUsages,
      addDiagnostic,
    );
  }

  const componentGraph = collectComponentUseGraph(componentMap, result, addDiagnostic);
  const usedComponents = collectUsedComponents(componentGraph, componentUsages.componentsUsed);

  for (const componentId of Object.keys(componentMap)) {
    if (!usedComponents.has(componentId)) {
      // An imported definition is written in its own file, under the id it has there.
      const source = componentSources[componentId];
      addDiagnostic(
        result,
        'warnings',
        'UNUSED_COMPONENT',
        `Component "${componentId}" is not referenced by any page or template.`,
        source
          ? { document: 'components', file: source.sourcePath, path: appendPath('$.components', source.localId) }
          : { document: 'components', path: appendPath('$.components', componentId) },
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

  // Each page's registry is loaded once, for the node walk and the slot rules.
  const pageScopes = new Map();
  const scopeFor = typeof resolveComponentsForPage === 'function'
    ? (pageLoaded) => {
      if (!pageScopes.has(pageLoaded)) pageScopes.set(pageLoaded, resolveComponentsForPage(pageLoaded));
      return pageScopes.get(pageLoaded);
    }
    : null;

  runSemanticValidation({
    result,
    manifest: manifest?.document?.manifest || {},
    sitemap: sitemap?.document?.sitemap || sitemap?.document || {},
    templates: templateDefinitions,
    components: componentMap,
    componentSources,
    pages: Array.from(pages.values()),
    resolveComponentsForPage: scopeFor,
    onRenderedPage,
  });

  const pageEntries = Array.from(pages.values()).map((pageLoaded) => {
    const scoped = scopeFor ? scopeFor(pageLoaded) : null;
    return {
      id: pageLoaded.id,
      document: pageLoaded.document,
      page: pageLoaded.document?.page,
      definitions: scoped?.ok ? scoped.components : componentMap,
      sources: scoped?.ok ? scoped.sources : componentSources,
    };
  });
  const authoredScopes = {
    definitions: componentMap,
    sources: componentSources,
    templates: templateDefinitions,
    templateDefinitions: templateScope.components,
    templateSources: templateScope.sources,
    pages: pageEntries,
  };
  const slotDiagnostics = [...checkComponentSlots(authoredScopes), ...checkRepeats(authoredScopes)];
  const stdAliasDiagnostics = checkStdAlias([
    { label: nameOf(components, 'components'), document: components?.document, definitions: componentMap, documentLabel: 'components' },
    { label: nameOf(templates, 'templates'), document: templates?.document, definitions: templateScope.components, documentLabel: 'templates' },
    ...pageEntries.map((entry) => ({
      label: `page "${entry.id}"`, document: entry.document, definitions: entry.definitions, documentLabel: `page:${entry.id}`,
    })),
  ]);
  for (const diagnostic of [...slotDiagnostics, ...stdAliasDiagnostics]) {
    addDiagnostic(result, diagnostic.severity, diagnostic.code, diagnostic.message, diagnostic.at);
  }
}

module.exports = {
  addDiagnostic,
  checkProject,
};
