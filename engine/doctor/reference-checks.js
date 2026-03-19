'use strict';

const path = require('node:path');
const { PRIMITIVE_COMPONENTS } = require(path.resolve(__dirname, '..', 'schema', 'primitives'));

/**
 * Reference-checking functions: component refs in nodes, template regions,
 * page slots/injectables/overlays/dataSources, and route diagnostics.
 */

function collectReferencedComponents(node, result, context, componentIds, usage, addDiagnostic) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  if (typeof node.component === 'string') {
    if (!PRIMITIVE_COMPONENTS.has(node.component) && !componentIds.has(node.component)) {
      addDiagnostic(
        result,
        'errors',
        'BROKEN_COMPONENT_REFERENCE',
        `Unknown component "${node.component}" in ${context}.`,
      );
    } else if (componentIds.has(node.component) && usage?.componentsUsed) {
      usage.componentsUsed.add(node.component);
    }
  }

  if (typeof node.use === 'string') {
    if (!componentIds.has(node.use)) {
      addDiagnostic(
        result,
        'errors',
        'BROKEN_COMPONENT_REFERENCE',
        `Unknown component reference "${node.use}" in ${context}.`,
      );
    } else if (usage?.componentsUsed) {
      usage.componentsUsed.add(node.use);
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectReferencedComponents(child, result, context, componentIds, usage, addDiagnostic);
    }
  }
}

function collectTemplateReferences(templateContent, result, componentIds, seenSlotIds, seenInjectableIds, usage, addDiagnostic) {
  if (!templateContent || typeof templateContent !== 'object') {
    return;
  }

  const regions = Array.isArray(templateContent.regions) ? templateContent.regions : [];
  for (const region of regions) {
    if (!region || typeof region !== 'object') {
      continue;
    }

    if (region.kind === 'slot' && typeof region.id === 'string') {
      seenSlotIds.add(region.id);
    }

    if (Array.isArray(region.children)) {
      const queue = [...region.children];
      while (queue.length > 0) {
        const child = queue.shift();
        if (child && typeof child === 'object') {
          if (child.injectable === true && typeof child.id === 'string') {
            seenInjectableIds.add(child.id);
          }
          if (Array.isArray(child.children)) {
            queue.push(...child.children);
          }
        }
      }
      for (const child of region.children) {
        collectReferencedComponents(child, result, `template region "${region.id}"`, componentIds, usage, addDiagnostic);
      }
    }

    collectReferencedComponents(region, result, `template region "${region.id}"`, componentIds, usage, addDiagnostic);
  }

  if (Array.isArray(templateContent.overlays)) {
    for (const overlay of templateContent.overlays) {
      if (overlay && Array.isArray(overlay.content)) {
        for (const node of overlay.content) {
          collectReferencedComponents(node, result, `template overlay "${overlay.id}"`, componentIds, usage, addDiagnostic);
        }
      }
    }
  }
}

function collectPageReferences(pageDocument, result, pageTemplates, componentIds, datasetIds, usage, addDiagnostic) {
  const pageId = pageDocument.id;
  const page = pageDocument.document?.page || {};
  const templateId = page.template;
  const filledSlots = new Set();

  const templateMeta = pageTemplates.get(templateId);
  const templateInfo = templateMeta || { slotIds: new Set(), injectableIds: new Set() };

  if (!templateId) {
    addDiagnostic(result, 'errors', 'MISSING_PAGE_TEMPLATE', `Page "${pageId}" does not define a template.`);
    return;
  }

  if (!pageMetaExists(pageTemplates, templateId)) {
    addDiagnostic(result, 'errors', 'MISSING_TEMPLATE_REFERENCE', `Page "${pageId}" references missing template "${templateId}".`);
    return;
  }

  const pageSlots = Array.isArray(page.slots) ? page.slots : [];
  for (const slot of pageSlots) {
    if (!slot || typeof slot !== 'object') {
      continue;
    }
    const slotId = slot.slotId;
    const slotHasContent = Array.isArray(slot.content) && slot.content.length > 0;

    if (typeof slotId === 'string' && !templateInfo.slotIds.has(slotId)) {
      addDiagnostic(
        result,
        'errors',
        'MISSING_SLOT_REFERENCE',
        `Page "${pageId}" targets unknown slot "${slotId}" on template "${templateId}".`,
      );
    }

    if (Array.isArray(slot.content)) {
      for (const node of slot.content) {
        collectReferencedComponents(node, result, `page "${pageId}" slot "${slotId}"`, componentIds, usage, addDiagnostic);
      }
    }

    if (typeof slotId === 'string' && templateInfo.slotIds.has(slotId)) {
      if (!slotHasContent) {
        addDiagnostic(
          result,
          'warnings',
          'EMPTY_SLOT',
          `Page "${pageId}" defines empty content for template slot "${slotId}" on template "${templateId}".`,
        );
      } else {
        filledSlots.add(slotId);
      }
    }
  }

  if (Array.isArray(page.injectables)) {
    for (const injectable of page.injectables) {
      if (!injectable || typeof injectable !== 'object') {
        continue;
      }
      if (typeof injectable.injectableId === 'string' && !templateInfo.injectableIds.has(injectable.injectableId)) {
        addDiagnostic(
          result,
          'errors',
          'MISSING_INJECTABLE_REFERENCE',
          `Page "${pageId}" targets unknown injectable "${injectable.injectableId}" on template "${templateId}".`,
        );
      }
      if (Array.isArray(injectable.content)) {
        for (const node of injectable.content) {
          collectReferencedComponents(node, result, `page "${pageId}" injectable "${injectable.injectableId}"`, componentIds, usage, addDiagnostic);
        }
      }
    }
  }

  if (Array.isArray(page.overlays)) {
    for (const overlay of page.overlays) {
      if (overlay && Array.isArray(overlay.content)) {
        for (const node of overlay.content) {
          collectReferencedComponents(node, result, `page "${pageId}" overlay "${overlay.id}"`, componentIds, usage, addDiagnostic);
        }
      }
    }
  }

  if (Array.isArray(page.dataSources)) {
    for (const source of page.dataSources) {
      if (!source || typeof source !== 'object' || typeof source.dataset !== 'string') {
        continue;
      }
      if (!datasetIds.has(source.dataset)) {
        addDiagnostic(
          result,
          'errors',
          'MISSING_DATASET_REFERENCE',
          `Page "${pageId}" references missing dataset "${source.dataset}".`,
        );
      } else if (usage) {
        usage.datasetsUsed.add(source.dataset);
      }
    }
  }

  if (templateInfo.slotIds.size > 0) {
    for (const slotId of templateInfo.slotIds) {
      if (!filledSlots.has(slotId)) {
        addDiagnostic(
          result,
          'warnings',
          'EMPTY_SLOT',
          `Page "${pageId}" does not define content for template slot "${slotId}" on template "${templateId}".`,
        );
      }
    }
  }
}

function pageMetaExists(pageTemplates, templateId) {
  return pageTemplates.has(templateId);
}

function collectPageRouteDiagnostics(routes, result, pages, templates, addDiagnostic) {
  if (!Array.isArray(routes)) {
    addDiagnostic(result, 'errors', 'INVALID_ROUTE_BLOCK', 'sitemap.routes must be an array.');
    return;
  }

  for (const route of routes) {
    if (!route || typeof route !== 'object') {
      continue;
    }

    if (typeof route.page === 'string' && !pages.has(route.page)) {
      addDiagnostic(
        result,
        'errors',
        'ORPHAN_ROUTE',
        `Route "${route.id ?? '<unknown>'}" points to missing page "${route.page}".`,
      );
    }
    if (typeof route.template === 'string' && !templates.has(route.template)) {
      addDiagnostic(
        result,
        'errors',
        'MISSING_TEMPLATE_REFERENCE',
        `Route "${route.id ?? '<unknown>'}" points to missing template "${route.template}".`,
      );
    }
  }
}

module.exports = {
  collectReferencedComponents,
  collectTemplateReferences,
  collectPageReferences,
  collectPageRouteDiagnostics,
  pageMetaExists,
};
