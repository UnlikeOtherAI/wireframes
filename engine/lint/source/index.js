'use strict';

// Lint for an editor: YAML text in, findings out, each with the range it is about.
//
// It applies the rules `wf lint` applies, to text instead of a folder, and needs no
// file system. See docs/cli/source-lint.md.

const { validateDocument } = require('../../schema');
const { SUPPORTED_SPEC_VERSION } = require('../../schema/constants');
const { validatePresentation } = require('../../validate/presentation');
const { validateIconReferences } = require('../../icons/validate');
const { validateLogoReferences } = require('../../design-system/logo-references');
const { checkProject } = require('../../doctor/project-checks');
const { lintDocuments } = require('../rules/documents');
const { FORMAT } = require('../../wf-format');
const { splitSource, readDocuments } = require('./read');
const { createComponentScopes } = require('./components');
const { createLocator } = require('./locate');

// Part of a `.wf`, but outside the schema: listed, never validated.
const UNCHECKED_TYPES = new Set(['config', 'asset']);
const SINGLE_TYPES = ['manifest', 'sitemap', 'templates'];

// Findings that can only be trusted when every document was read: each names
// something that may live in a document that did not parse.
const NEEDS_EVERY_DOCUMENT = new Set([
  'MISSING_MANIFEST', 'ORPHAN_ROUTE', 'MISSING_TEMPLATE_REFERENCE', 'BROKEN_COMPONENT_REFERENCE',
  'MISSING_DATASET_REFERENCE', 'MISSING_SLOT_REFERENCE', 'MISSING_INJECTABLE_REFERENCE', 'EMPTY_SLOT',
  'INVALID_TARGET_ROUTE', 'INVALID_ROUTE_REFERENCE', 'INVALID_TARGET_OVERLAY', 'INVALID_OVERLAY_TRIGGER',
  'INVALID_FORM_REFERENCE', 'MISSING_STATE_KEY', 'UNUSED_COMPONENT', 'UNUSED_DATASET', 'COMPONENT_IMPORT_ERROR',
]);

// Where a document-level failure is, when the loader names only the document.
const LOAD_ERROR_PATHS = {
  INVALID_DOCUMENT_TYPE: '$.documentType',
  UNSUPPORTED_DOCUMENT_TYPE: '$.documentType',
  INVALID_SPEC_VERSION: '$.specVersion',
  UNSUPPORTED_SPEC_VERSION: '$.specVersion',
  INVALID_DOCUMENT_ID: '$.id',
  MISSING_MANIFEST_SCHEMA_VERSION: '$.manifest',
  UNSUPPORTED_MANIFEST_SCHEMA_VERSION: '$.manifest.schemaVersion',
};

/** One document against the schema and the rules that need nothing else. */
function checkDocument(entry, report) {
  let document = entry.value;
  if (entry.type === 'manifest' && Object.prototype.hasOwnProperty.call(document, 'format')) {
    // `format` belongs to the file, not to the manifest the schema checks.
    const { format, ...manifest } = document;
    document = manifest;
    if (format !== FORMAT) {
      report('error', 'UNSUPPORTED_FORMAT', `Unsupported .wf format "${String(format)}". This engine reads ${FORMAT}.`, { entry, path: '$.format' });
    }
  }
  entry.document = document;
  if (UNCHECKED_TYPES.has(entry.type)) return;

  try {
    validateDocument(document, entry.path || `document ${entry.index + 1}`, SUPPORTED_SPEC_VERSION);
    entry.valid = true;
  } catch (error) {
    const schemaErrors = error.code === 'SCHEMA_VALIDATION' && Array.isArray(error.details?.errors) ? error.details.errors : null;
    if (!schemaErrors) {
      report('error', error.code || 'DOCUMENT_LOAD_ERROR', error.message, { entry, path: LOAD_ERROR_PATHS[error.code] || '$' });
      return;
    }
    for (const schemaError of schemaErrors) {
      report('error', schemaError.code || 'SCHEMA_VALIDATION',
        `Schema validation error${schemaError.path ? ` at ${schemaError.path}` : ''}: ${schemaError.message}`,
        { entry, path: schemaError.path || '$', key: schemaError.code === 'SCHEMA_ADDITIONAL_PROPERTIES' });
    }
  }

  // Presentation walks from a root it calls `project`; here the root is the document.
  const presentation = validatePresentation(document, { locate: true });
  const relative = (path) => `$${path.replace(/^project/, '')}`;
  for (const finding of presentation.errors) report('error', finding.code, finding.message, { entry, path: relative(finding.path) });
  for (const finding of presentation.warnings) report('warning', finding.code, finding.message, { entry, path: relative(finding.path) });
  for (const finding of validateLogoReferences(document, { locate: true })) {
    report('error', finding.code, finding.message, { entry, path: finding.path });
  }
}

/** Icon names, in one pass so the index is prepared once for the whole project. */
function checkIcons(documents, iconIndex, report) {
  const checked = documents.filter((entry) => entry.document && !UNCHECKED_TYPES.has(entry.type));
  for (const finding of validateIconReferences(checked.map((entry) => entry.document), iconIndex)) {
    // The walk names its root `project` and each document by its place in the list.
    const match = /^project\[(\d+)\](.*)$/.exec(finding.path);
    if (match) report('warning', finding.code, finding.message, { entry: checked[Number(match[1])], path: `$${match[2]}` });
  }
}

/** The rules that look across documents, on everything that parsed. */
function checkAcrossDocuments(documents, report) {
  const parsed = documents.filter((entry) => entry.document);
  for (const type of SINGLE_TYPES) {
    parsed.filter((entry) => entry.type === type).slice(1).forEach((entry) => {
      report('error', 'DUPLICATE_DOCUMENT', `A project has one ${type} document.`, { entry, path: '$.documentType' });
    });
  }

  // Keyed as `wf doctor` keys them: a page by `page.id`, a dataset by its document id.
  const pages = new Map();
  const pageEntries = new Map();
  const datasetIds = new Set();
  for (const entry of parsed) {
    if (entry.type === 'page' && typeof entry.document.page?.id === 'string') {
      const pageId = entry.document.page.id;
      if (pages.has(pageId)) {
        report('error', 'DUPLICATE_PAGE_ID', `Duplicate page id "${pageId}".`, { entry, path: '$.page.id' });
      } else {
        const loaded = { id: entry.id, document: entry.document };
        pages.set(pageId, loaded);
        pageEntries.set(loaded, entry);
      }
    } else if (entry.type === 'dataset' && entry.id) {
      if (datasetIds.has(entry.id)) report('error', 'DUPLICATE_DATASET_ID', `Duplicate dataset id "${entry.id}".`, { entry, path: '$.id' });
      else datasetIds.add(entry.id);
    }
  }

  const one = (type) => parsed.find((entry) => entry.type === type) || null;
  const loaded = (entry) => (entry ? { document: entry.document } : null);
  const templates = one('templates');
  const scopes = createComponentScopes(parsed, report);
  const importError = (scope, label) => report('error', 'COMPONENT_IMPORT_ERROR',
    `Unable to load component imports for ${label}: ${scope.error}`, { entry: scope.entry, path: '$.imports', key: true });

  const result = { errors: [], warnings: [], locations: true };
  try {
    checkProject({
      result,
      manifest: loaded(one('manifest')),
      sitemap: loaded(one('sitemap')),
      templates: loaded(templates),
      pages,
      datasetIds,
      componentMap: scopes.componentMap,
      componentIdsFor(target) {
        const page = target.kind === 'page' ? pageEntries.get(target.page) : null;
        const scope = scopes.scope(target.kind === 'template' ? [templates] : [page]);
        if (scope.ok) return new Set(Object.keys(scope.components));
        importError(scope, target.kind === 'template' ? `template "${target.id}"` : `page "${target.page.id}"`);
        return target.componentIds;
      },
      resolveComponentsForPage(page) {
        const scope = scopes.scope([templates, pageEntries.get(page)].filter(Boolean));
        return scope.ok ? scope : { ok: false, error: `Unable to load component imports for page "${page?.id || '<unknown>'}": ${scope.error}` };
      },
    });
  } catch {
    // A document the schema already refused can have any shape. Its schema findings
    // are reported; the project rules wait until it is a document again.
    return;
  }
  // A duplicate is underlined where it was repeated, not where it was first written.
  for (const finding of result.errors) report('error', finding.code, finding.message, { at: finding.at, last: finding.code.startsWith('DUPLICATE_') });
  for (const finding of result.warnings) report('warning', finding.code, finding.message, { at: finding.at });
}

/** Naming and element rules, only where the schema found nothing. */
function checkStyle(documents, report) {
  const valid = documents.filter((entry) => entry.valid);
  const one = (type) => valid.find((entry) => entry.type === type)?.document || null;
  const result = { errors: [], warnings: [], info: [], locations: true };
  lintDocuments(result, {
    manifest: one('manifest'),
    sitemap: one('sitemap'),
    templates: one('templates'),
    components: one('components'),
    datasets: valid.filter((entry) => entry.type === 'dataset').map((entry) => entry.document),
    pages: valid.filter((entry) => entry.type === 'page').map((entry) => entry.document),
  });
  for (const finding of result.warnings) report('warning', finding.code, finding.message, { at: finding.at });
  for (const finding of result.info) report('info', finding.code, finding.message, { at: finding.at });
}

/**
 * @param {{ name: string, text: string }[]} sources  the project's documents as text: one
 *   per file, or one `.wf` stream. Folder config (`.wfrc.yaml`) is not a document.
 * @param {{ iconIndex?: object[] }} [options]  `iconIndex` turns on the icon name check
 * @returns {{ ok: boolean, documents: object[], diagnostics: object[] }}
 */
function lintSources(sources, options = {}) {
  const list = (Array.isArray(sources) ? sources : []).map((source) => ({
    name: typeof source?.name === 'string' ? source.name : '',
    text: typeof source?.text === 'string' ? source.text : '',
  }));
  const found = [];
  const report = (severity, code, message, where = {}) => found.push({ severity, code, message, where });

  const documents = readDocuments(list, report);
  for (const entry of documents) {
    if (entry.value) checkDocument(entry, report);
  }
  if (options.iconIndex) checkIcons(documents, options.iconIndex, report);
  if (!documents.some((entry) => entry.type === 'manifest')) {
    report('error', 'MISSING_MANIFEST', 'A project needs a manifest document.');
  }
  checkAcrossDocuments(documents, report);
  checkStyle(documents, report);

  // A document that did not parse, or does not say what it is, may hold anything the
  // others refer to, so findings about missing things wait until it can be read.
  const complete = documents.every((entry) => entry.value !== null && entry.type);
  const locator = createLocator(list, documents);
  const seen = new Set();
  const diagnostics = [];
  for (const finding of found) {
    if (!complete && NEEDS_EVERY_DOCUMENT.has(finding.code)) continue;
    const place = locator.resolve(finding.where);
    const key = `${place ? `${place.source}|${place.start}|${place.end}` : ''}|${finding.code}|${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push({
      severity: finding.severity,
      code: finding.code,
      message: finding.message,
      // A finding about the whole project belongs to no source and has no range.
      source: place ? list[place.source].name : null,
      document: place ? place.document : null,
      path: place ? place.path : null,
      range: place ? locator.range(place) : null,
      order: place ? [place.source, place.start] : [-1, 0],
    });
  }
  diagnostics.forEach((diagnostic, index) => diagnostic.order.push(index));
  diagnostics.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
  for (const diagnostic of diagnostics) delete diagnostic.order;

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    documents: documents.map((entry) => ({
      source: list[entry.source].name,
      index: entry.index,
      type: entry.type,
      id: entry.id,
      file: entry.file,
      range: locator.range({ source: entry.source, start: entry.start, end: entry.end }),
    })),
    diagnostics,
  };
}

module.exports = {
  lintSources,
  splitSource,
};
