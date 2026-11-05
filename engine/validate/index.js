'use strict';

const { validateDocument, SchemaLoadError } = require('../schema');
const { validatePresentation } = require('./presentation');
const { validateLogoReferences } = require('../design-system/logo-references');
const { validateIconReferences } = require('../icons/validate');
const { SUPPORTED_SPEC_VERSION } = require('../schema/constants');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function addDiagnostic(errors, warnings, severity, code, message) {
  const target = severity === 'errors' ? errors : warnings;
  target.push({ code, message });
}

function validateSingleDocument(document, label, expectedType, errors, warnings) {
  try {
    const { documentType } = validateDocument(document, label, SUPPORTED_SPEC_VERSION);
    if (expectedType && documentType !== expectedType) {
      addDiagnostic(errors, warnings, 'errors', 'INVALID_DOCUMENT_TYPE',
        `Expected documentType "${expectedType}" in ${label}, found "${documentType}".`);
      return false;
    }
    return true;
  } catch (error) {
    if (error instanceof SchemaLoadError && error.code === 'SCHEMA_VALIDATION' && Array.isArray(error.details?.errors)) {
      for (const schemaError of error.details.errors) {
        const location = schemaError.path ? ` at ${schemaError.path}` : '';
        addDiagnostic(errors, warnings, 'errors', schemaError.code || 'SCHEMA_VALIDATION',
          `Schema validation error${location}: ${schemaError.message}`);
      }
    } else {
      addDiagnostic(errors, warnings, 'errors', error.code || 'DOCUMENT_LOAD_ERROR', error.message);
    }
    return false;
  }
}

function validateProject(documentMap, options = {}) {
  const { strict = false } = options;
  const errors = [];
  const warnings = [];

  if (!isObject(documentMap)) {
    return { ok: false, errors: [{ code: 'INVALID_INPUT', message: 'documentMap must be an object.' }], warnings: [] };
  }

  if (isObject(documentMap.manifest)) {
    validateSingleDocument(documentMap.manifest, 'manifest', 'manifest', errors, warnings);
  }
  if (isObject(documentMap.sitemap)) {
    validateSingleDocument(documentMap.sitemap, 'sitemap', 'sitemap', errors, warnings);
  }
  if (isObject(documentMap.templates)) {
    validateSingleDocument(documentMap.templates, 'templates', 'templates', errors, warnings);
  }
  if (isObject(documentMap.components)) {
    validateSingleDocument(documentMap.components, 'components', 'components', errors, warnings);
  }

  const pages = documentMap.pages instanceof Map
    ? documentMap.pages
    : new Map(Object.entries(documentMap.pages || {}));

  for (const [pageId, pageDoc] of pages) {
    if (isObject(pageDoc)) {
      validateSingleDocument(pageDoc, `page:${pageId}`, 'page', errors, warnings);
    }
  }

  const datasets = documentMap.datasets instanceof Map
    ? documentMap.datasets
    : new Map(Object.entries(documentMap.datasets || {}));

  for (const [datasetId, datasetDoc] of datasets) {
    if (isObject(datasetDoc)) {
      validateSingleDocument(datasetDoc, `dataset:${datasetId}`, 'dataset', errors, warnings);
    }
  }

  const templatesDef = isObject(documentMap.templates?.templates)
    ? documentMap.templates.templates
    : {};
  const templateIds = new Set(Object.keys(templatesDef));

  for (const [pageId, pageDoc] of pages) {
    const page = isObject(pageDoc?.page) ? pageDoc.page : null;
    if (!page) continue;

    const templateRef = page.template;
    if (typeof templateRef === 'string' && templateRef.trim() !== '' && !templateIds.has(templateRef)) {
      addDiagnostic(errors, warnings, 'errors', 'MISSING_TEMPLATE',
        `Page "${pageId}" references template "${templateRef}" which does not exist.`);
    }
  }

  errors.push(...validateLogoReferences(documentMap));
  const presentation = validatePresentation(documentMap);
  errors.push(...presentation.errors);
  warnings.push(...presentation.warnings);
  if (options.iconIndex) {
    (options.iconErrors ? errors : warnings).push(...validateIconReferences(documentMap, options.iconIndex));
  }

  if (strict && warnings.length > 0) {
    for (const warning of warnings) {
      errors.push({
        code: `STRICT_${warning.code ?? 'WARNING'}`,
        message: `[strict] ${warning.message}`,
      });
    }
    warnings.length = 0;
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  validateProject,
};
