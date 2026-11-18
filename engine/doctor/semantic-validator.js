'use strict';

// What nodes do across a project: each template's overlays, each component's
// own tree, and each page with its template and components folded in. The walk
// itself is in `node-walker.js`; what one node refers to is checked in
// `semantic-interactions.js`.

const { resolveTemplatePage } = require('../resolver');
const { appendPath } = require('../schema/validator');
const {
  isObject,
  addDiagnostic,
  atNode,
  validateOverlayDefinition,
} = require('./semantic-interactions');
const { createNodeContext, reportPageIdChecks, validateNode } = require('./node-walker');

function defaultGridColumnsFromManifest(manifest) {
  const value = Number(manifest?.defaultGridColumns ?? manifest?.manifest?.defaultGridColumns);
  return Number.isInteger(value) && value > 0 ? value : 12;
}

function collectRouteIds(routes) {
  const routeIds = new Set();

  if (!Array.isArray(routes)) {
    return routeIds;
  }

  for (const route of routes) {
    if (typeof route?.id === 'string' && route.id.trim() !== '') {
      routeIds.add(route.id);
    }
  }

  return routeIds;
}

function collectTemplateOverlays(templates, result) {
  const templateMap = new Map();

  for (const [templateId, template] of Object.entries(templates || {})) {
    const overlayIds = new Set();
    const overlayTriggerRefs = [];

    const sourceOverlays = isObject(template) && Array.isArray(template.overlays)
      ? template.overlays
      : [];

    for (const overlay of sourceOverlays) {
      validateOverlayDefinition(
        overlay,
        {
          result,
          document: 'templates',
          overlayIds,
          overlayTriggerRefs,
        },
        `template "${templateId}"`,
      );
    }

    templateMap.set(templateId, {
      overlayIds,
      overlayTriggerRefs,
    });
  }

  return templateMap;
}

function collectComponentRoots(componentMap, result, routeIds, defaultGridColumns) {
  for (const [componentId, component] of Object.entries(componentMap || {})) {
    if (!isObject(component) || !isObject(component.root)) {
      continue;
    }

    const context = createNodeContext({
      result,
      document: 'components',
      within: `${appendPath('$.components', componentId)}.root`,
      pageId: `component "${componentId}"`,
      routeIds,
      appState: {},
      pageState: {},
      actionIds: new Set(),
      overlayIds: new Set(),
      componentRoots: componentMap,
      defaultGridColumns,
      validateDepthAndNodes: false,
    });

    validateNode(component.root, context, 1);

    for (const duplicate of context.duplicateNodeIds) {
      addDiagnostic(result, 'DUPLICATE_NODE_ID', `Component "${componentId}" defines duplicate node id "${duplicate}".`, atNode(context, duplicate));
    }
  }
}

function collectRootsFromPage(pageDoc, templateDoc, componentRoots) {
  const roots = [];

  const templatePage = isObject(templateDoc) && isObject(pageDoc)
    ? resolveTemplatePage({ template: templateDoc, page: pageDoc, components: componentRoots })
    : null;

  if (templatePage && templatePage.ok && Array.isArray(templatePage.roots)) {
    roots.push(...templatePage.roots);
  }

  if (Array.isArray(pageDoc.overlays)) {
    for (const overlay of pageDoc.overlays) {
      if (isObject(overlay) && Array.isArray(overlay.content)) {
        roots.push(...overlay.content);
      }
    }
  }

  return roots;
}

function validatePageNodes(pageLoaded, templates, templateOverlayMap, routeIds, appState, componentRoots, result, defaultGridColumns) {
  const pageDoc = isObject(pageLoaded.document) ? pageLoaded.document.page : null;
  if (!isObject(pageDoc)) {
    return;
  }

  const pageId = pageLoaded.id || pageDoc.id || '<unknown>';
  const document = `page:${pageId}`;
  const template = isObject(templates[pageDoc.template]) ? templates[pageDoc.template] : null;

  const templateOverlayInfo = isObject(template) && templateOverlayMap.get(pageDoc.template);
  const overlayIds = new Set(templateOverlayInfo ? templateOverlayInfo.overlayIds : []);
  const overlayTriggerRefs = [...(templateOverlayInfo ? templateOverlayInfo.overlayTriggerRefs : [])];

  const pageOverlays = Array.isArray(pageDoc.overlays) ? pageDoc.overlays : [];
  const pageOverlayIds = new Set();

  for (const overlay of pageOverlays) {
    const overlayValidationIds = new Set();
    validateOverlayDefinition(
      overlay,
      {
        result,
        document,
        overlayIds: overlayValidationIds,
        overlayTriggerRefs,
      },
      `page "${pageId}"`,
    );

    if (isObject(overlay) && typeof overlay.id === 'string') {
      if (overlayIds.has(overlay.id) || pageOverlayIds.has(overlay.id)) {
        addDiagnostic(result, 'DUPLICATE_OVERLAY_ID', `Duplicate overlay id "${overlay.id}" on page "${pageId}".`, { document, node: overlay.id });
      }
      pageOverlayIds.add(overlay.id);
      overlayIds.add(overlay.id);
    }
  }

  const context = createNodeContext({
    result,
    document,
    pageId,
    routeIds,
    appState,
    pageState: isObject(pageDoc.pageState) ? pageDoc.pageState : {},
    actionIds: isObject(pageDoc.actions) ? new Set(Object.keys(pageDoc.actions)) : new Set(),
    overlayIds,
    componentRoots,
    defaultGridColumns,
    validateDepthAndNodes: true,
  });

  const roots = collectRootsFromPage(pageDoc, template, componentRoots);
  for (const root of roots) {
    validateNode(root, context, 1);
  }

  reportPageIdChecks(context, pageId, overlayTriggerRefs);
}

function runSemanticValidation({
  result,
  manifest = {},
  sitemap = {},
  templates = {},
  components = {},
  pages = [],
  resolveComponentsForPage = null,
}) {
  const routeIds = collectRouteIds(sitemap.routes);
  const appState = isObject(sitemap.appState) ? sitemap.appState : {};
  const defaultGrid = defaultGridColumnsFromManifest(manifest);
  const globalComponents = isObject(components) ? components : {};

  const templateOverlayMap = collectTemplateOverlays(templates, result);
  collectComponentRoots(globalComponents, result, routeIds, defaultGrid);

  for (const pageLoaded of pages) {
    let pageComponents = globalComponents;

    if (typeof resolveComponentsForPage === 'function') {
      const resolvedComponents = resolveComponentsForPage(pageLoaded);
      if (resolvedComponents && resolvedComponents.ok === false) {
        addDiagnostic(
          result,
          'COMPONENT_IMPORT_ERROR',
          resolvedComponents.error || `Unable to resolve component imports for page "${pageLoaded?.id || '<unknown>'}".`,
          { document: `page:${pageLoaded?.id}`, path: '$.imports', key: true },
        );
        continue;
      }
      if (resolvedComponents && isObject(resolvedComponents.components)) {
        pageComponents = resolvedComponents.components;
      }
    }

    validatePageNodes(pageLoaded, templates, templateOverlayMap, routeIds, appState, pageComponents, result, defaultGrid);
  }
}

module.exports = {
  runSemanticValidation,
};
