'use strict';

// The lint rules, applied to documents already in memory: how ids are written, and
// what each element is given. `wf lint` runs this after loading from disk and
// `lintSources` runs it on text.

const { appendPath } = require('../../schema/validator');
const { childNodeEntries } = require('../../component-registry/child-nodes');
const { validatePrimitiveProps } = require('./primitive-props');
const { lintRenderedRows } = require('./repeat-rows');

const RESERVED_KEYWORDS = new Set([
  'page',
  'pages',
  'template',
  'templates',
  'component',
  'components',
  'sitemap',
  'manifest',
  'dataset',
  'datasets',
  'overlay',
  'overlays',
  'slot',
  'slots',
  'injectable',
  'injectables',
  'route',
  'routes',
  'navigation',
  'open_overlay',
  'close_overlay',
  'toggle',
  'set_state',
  'submit',
  'action',
  'gesture',
  'id',
  'documentType',
  'specVersion',
  'heading',
  'paragraph',
  'text',
  'image',
  'button',
  'tab_bar',
  'input',
  'textarea',
  'select',
  'checkbox',
  'toggle',
  'table',
  'section',
  'divider',
  'spacer',
]);

/** `at` says where the finding is. Only a result that sets `locations` keeps it. */
function addDiagnostic(result, severity, code, message, at) {
  result[severity].push(at && result.locations ? { code, message, at } : { code, message });
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isSnakeCase(value) {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function isAmbiguous(value) {
  return /^_/.test(value) || /_$/.test(value) || /__/.test(value);
}

/** A place in a document. `key` points at the last segment's key, not its value. */
function place(document, segments, key = false) {
  const path = segments.reduce((current, segment) => appendPath(current, segment), '$');
  return key ? { document, path, key: true } : { document, path };
}

function validateIdentifier(result, context, id, at) {
  if (!isObject(result) || typeof id !== 'string') {
    return;
  }

  if (/[A-Z]/.test(id)) {
    addDiagnostic(result, 'warnings', 'UPPERCASE_ID', `${context}: ID "${id}" contains uppercase characters.`, at);
  }

  if (!isSnakeCase(id)) {
    addDiagnostic(result, 'warnings', 'INVALID_ID_FORMAT', `${context}: ID "${id}" is not snake_case.`, at);
    return;
  }

  if (isAmbiguous(id)) {
    addDiagnostic(
      result,
      'warnings',
      'AMBIGUOUS_ID',
      `${context}: ID "${id}" is ambiguous (leading/trailing or repeated underscore).`,
      at,
    );
  }

  if (RESERVED_KEYWORDS.has(id)) {
    addDiagnostic(result, 'warnings', 'RESERVED_KEYWORD', `${context}: ID "${id}" uses a reserved keyword.`, at);
  }
}

function validateNodeIds(result, node, context, document, segments) {
  if (!isObject(node)) {
    return;
  }

  if (typeof node.id === 'string') {
    validateIdentifier(result, context, node.id, place(document, [...segments, 'id']));
  }

  // Children, and the named fills of a component instance.
  for (const list of childNodeEntries(node)) {
    list.nodes.forEach((child, index) => {
      validateNodeIds(result, child, `${context} > ${node.id ?? 'node'}`, document, [...segments, ...list.segments, index]);
    });
  }

  if (Array.isArray(node.content)) {
    node.content.forEach((child, index) => {
      validateNodeIds(result, child, context, document, [...segments, 'content', index]);
    });
  }
}

function validateNode(result, node, context, document, segments, traversal = {}) {
  validateNodeIds(result, node, context, document, segments);
  validatePrimitiveProps(result, node, context, { ...traversal, at: place(document, segments) });
}

function lintTemplates(result, templates) {
  const templatesMap = templates?.templates || {};
  for (const [templateId, templateDoc] of Object.entries(templatesMap)) {
    const base = ['templates', templateId];
    validateIdentifier(result, `template "${templateId}"`, templateId, place('templates', base, true));
    if (!isObject(templateDoc)) {
      continue;
    }
    const regions = Array.isArray(templateDoc.regions) ? templateDoc.regions : [];
    regions.forEach((region, index) => {
      const segments = [...base, 'regions', index];
      if (region && typeof region.id === 'string') {
        validateIdentifier(result, `template "${templateId}" region`, region.id, place('templates', [...segments, 'id']));
      }
      validateNode(result, region, `template "${templateId}" region`, 'templates', segments, {
        surfaceDepth: region?.kind === 'slot' ? 0 : 1,
        parentLayoutIsGrid: region?.layout?.type === 'grid',
      });
    });
    if (Array.isArray(templateDoc.overlays)) {
      templateDoc.overlays.forEach((overlay, index) => {
        if (!isObject(overlay)) {
          return;
        }
        const segments = [...base, 'overlays', index];
        if (typeof overlay.id === 'string') {
          validateIdentifier(result, `template "${templateId}" overlay`, overlay.id, place('templates', [...segments, 'id']));
        }
        validateNode(result, overlay, `template "${templateId}" overlay`, 'templates', segments);
      });
    }
  }
}

function lintPage(result, pageDoc) {
  if (!pageDoc?.page || !isObject(pageDoc.page)) {
    return;
  }
  const pageData = pageDoc.page;
  const document = `page:${typeof pageDoc.id === 'string' ? pageDoc.id : pageData.id}`;
  if (typeof pageData.id === 'string') {
    validateIdentifier(result, 'page', pageData.id, place(document, ['page', 'id']));
  }
  if (Array.isArray(pageData.slots)) {
    pageData.slots.forEach((slot, slotIndex) => {
      if (isObject(slot) && typeof slot.slotId === 'string') {
        const segments = ['page', 'slots', slotIndex];
        validateIdentifier(result, `page "${pageData.id}" slot`, slot.slotId, place(document, [...segments, 'slotId']));
        if (Array.isArray(slot.content)) {
          slot.content.forEach((node, index) => {
            validateNode(result, node, `page "${pageData.id}" slot "${slot.slotId}" > ${node.id ?? 'node'}`, document, [...segments, 'content', index]);
          });
        }
      }
    });
  }
  if (Array.isArray(pageData.injectables)) {
    pageData.injectables.forEach((injectable, injectableIndex) => {
      if (isObject(injectable) && typeof injectable.injectableId === 'string') {
        const segments = ['page', 'injectables', injectableIndex];
        validateIdentifier(result, `page "${pageData.id}" injectable`, injectable.injectableId, place(document, [...segments, 'injectableId']));
        if (Array.isArray(injectable.content)) {
          injectable.content.forEach((node, index) => {
            validateNode(result, node, `page "${pageData.id}" injectable "${injectable.injectableId}" > ${node.id ?? 'node'}`, document, [...segments, 'content', index]);
          });
        }
      }
    });
  }
  if (Array.isArray(pageData.overlays)) {
    pageData.overlays.forEach((overlay, overlayIndex) => {
      if (!isObject(overlay)) {
        return;
      }
      const segments = ['page', 'overlays', overlayIndex];
      if (typeof overlay.id === 'string') {
        validateIdentifier(result, `page "${pageData.id}" overlay`, overlay.id, place(document, [...segments, 'id']));
      }
      if (Array.isArray(overlay.content)) {
        overlay.content.forEach((node, index) => {
          validateNode(result, node, `page "${pageData.id}" overlay "${overlay.id}" > ${node.id ?? 'node'}`, document, [...segments, 'content', index]);
        });
      }
    });
  }
  if (isObject(pageData.actions)) {
    for (const actionId of Object.keys(pageData.actions)) {
      validateIdentifier(result, `page "${pageData.id}" action`, actionId, place(document, ['page', 'actions', actionId], true));
    }
  }
}

/**
 * @param {object} result  `{ errors, warnings, info }`, added to in place
 * @param {object} documents
 * @param {object|null} documents.manifest
 * @param {object|null} documents.sitemap
 * @param {object|null} documents.templates
 * @param {object|null} documents.components
 * @param {object[]} documents.datasets
 * @param {object[]} documents.pages
 * @param {object[]} [documents.renderedPages]  the pages as they render, from the doctor's
 *   `onRenderedPage`, whose repeat rows get their element contract
 */
function lintDocuments(result, { manifest, sitemap, templates, components, datasets = [], pages = [], renderedPages = [] }) {
  const routeEntries = sitemap?.sitemap?.routes || [];
  routeEntries.forEach((route, index) => {
    if (route && typeof route.id === 'string') {
      validateIdentifier(result, 'route', route.id, place('sitemap', ['sitemap', 'routes', index, 'id']));
    }
  });

  if (manifest?.manifest?.projectId) {
    validateIdentifier(result, 'manifest', manifest.manifest.projectId, place('manifest', ['manifest', 'projectId']));
  }

  lintTemplates(result, templates);

  const componentMap = components?.components || {};
  for (const [componentId, componentDoc] of Object.entries(componentMap)) {
    validateIdentifier(result, `component "${componentId}"`, componentId, place('components', ['components', componentId], true));
    if (isObject(componentDoc) && isObject(componentDoc.root)) {
      validateNode(result, componentDoc.root, `component "${componentId}" root`, 'components', ['components', componentId, 'root']);
    }
  }

  for (const datasetDoc of datasets) {
    if (datasetDoc && typeof datasetDoc.id === 'string') {
      validateIdentifier(result, `dataset "${datasetDoc.id}"`, datasetDoc.id, place(`dataset:${datasetDoc.id}`, ['id']));
    }
  }

  for (const pageDoc of pages) {
    lintPage(result, pageDoc);
  }

  lintRenderedRows(result, renderedPages);
}

module.exports = {
  lintDocuments,
  RESERVED_KEYWORDS,
};
