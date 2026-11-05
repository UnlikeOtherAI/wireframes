'use strict';

const { resolveTemplatePage } = require('../resolver');
const { buildOverlayRoots } = require('../resolver/nodes');
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function resolvePageTree(documentMap, pageId) {
  const pageDoc = documentMap.pages instanceof Map
    ? documentMap.pages.get(pageId)
    : documentMap.pages?.[pageId];

  if (!isObject(pageDoc)) {
    return { ok: false, error: `Page "${pageId}" not found in document map.` };
  }

  const page = isObject(pageDoc.page) ? pageDoc.page : null;
  if (!page) {
    return { ok: false, error: `Page "${pageId}" has no page payload.` };
  }

  const templateId = page.template;
  if (typeof templateId !== 'string' || templateId.trim() === '') {
    return { ok: false, error: `Page "${pageId}" does not define a template.` };
  }

  const templates = isObject(documentMap.templates?.templates)
    ? documentMap.templates.templates
    : isObject(documentMap.templates)
      ? documentMap.templates
      : {};
  const template = templates[templateId];
  if (!isObject(template)) {
    return { ok: false, error: `Page "${pageId}" references missing template "${templateId}".` };
  }

  const pageComponents = documentMap.componentRegistriesByPage?.get(pageId);
  const components = isObject(pageComponents)
    ? pageComponents
    : isObject(documentMap.components?.components)
    ? documentMap.components.components
    : isObject(documentMap.components)
      ? documentMap.components
      : {};

  const resolved = resolveTemplatePage({ template, page, components });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const templateOverlays = buildOverlayRoots(template.overlays, components, 'template');
  if (!templateOverlays.ok) return templateOverlays;
  const pageOverlays = buildOverlayRoots(page.overlays, components, 'page');
  if (!pageOverlays.ok) return pageOverlays;

  const templateLayout = isObject(template.layout) ? template.layout : {};
  const bodyLayoutType = templateLayout.type === 'row' ? 'row' : 'stack';

  return {
    ok: true,
    roots: [...(Array.isArray(resolved.roots) ? resolved.roots : []), ...templateOverlays.roots, ...pageOverlays.roots],
    bodyLayoutType,
    bodyLayout: templateLayout,
    page,
    templateId,
  };
}

module.exports = { resolvePageTree };
