'use strict';

const { PRIMITIVE_COMPONENTS } = require('../schema/primitives');
const { appendPath } = require('../schema/validator');
const { childNodeEntries, childNodeLists } = require('../component-registry/child-nodes');
const { resolveComponentDefinition } = require('../component-registry/definition-lookup');
const { repeatCellReference } = require('../component-registry/repeat');

/**
 * Reference-checking functions: component refs in nodes, template regions,
 * page slots/injectables/overlays/dataSources, and route diagnostics.
 *
 * `definitions` is the component registry a document resolves against; built-in
 * `std.*` patterns are found through `resolveComponentDefinition`.
 *
 * `at` is where the thing being checked sits: `{ document, path }`. It is optional,
 * and only a caller that has the source text gives one.
 */

const knows = (definitions, id) => resolveComponentDefinition(id, definitions) != null;

function under(at, ...segments) {
  if (!at) return undefined;
  return { document: at.document, path: segments.reduce((path, segment) => appendPath(path, segment), at.path) };
}

function collectReferencedComponents(node, result, context, definitions, usage, addDiagnostic, at) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  if (typeof node.component === 'string') {
    if (!PRIMITIVE_COMPONENTS.has(node.component) && !knows(definitions, node.component)) {
      addDiagnostic(
        result,
        'errors',
        'BROKEN_COMPONENT_REFERENCE',
        `Unknown component "${node.component}" in ${context}.`,
        under(at, 'component'),
      );
    } else if (knows(definitions, node.component) && usage?.componentsUsed) {
      usage.componentsUsed.add(node.component);
    }
  }

  if (typeof node.use === 'string') {
    if (!knows(definitions, node.use)) {
      addDiagnostic(
        result,
        'errors',
        'BROKEN_COMPONENT_REFERENCE',
        `Unknown component reference "${node.use}" in ${context}.`,
        under(at, 'use'),
      );
    } else if (usage?.componentsUsed) {
      usage.componentsUsed.add(node.use);
    }
  }

  // A component cell is a use of its component; an unknown one is UNKNOWN_REPEAT_CELL.
  const cell = repeatCellReference(node);
  if (cell && knows(definitions, cell) && usage?.componentsUsed) {
    usage.componentsUsed.add(cell);
  }

  for (const { segments, nodes } of childNodeEntries(node)) {
    nodes.forEach((child, index) => {
      collectReferencedComponents(child, result, context, definitions, usage, addDiagnostic, under(at, ...segments, index));
    });
  }
}

function collectTemplateReferences(templateContent, result, definitions, seenSlotIds, seenInjectableIds, usage, addDiagnostic, at) {
  if (!templateContent || typeof templateContent !== 'object') {
    return;
  }

  const regions = Array.isArray(templateContent.regions) ? templateContent.regions : [];
  regions.forEach((region, regionIndex) => {
    if (!region || typeof region !== 'object') {
      return;
    }
    const regionAt = under(at, 'regions', regionIndex);

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
          for (const list of childNodeLists(child)) {
            queue.push(...list);
          }
        }
      }
      region.children.forEach((child, index) => {
        collectReferencedComponents(child, result, `template region "${region.id}"`, definitions, usage, addDiagnostic, under(regionAt, 'children', index));
      });
    }

    collectReferencedComponents(region, result, `template region "${region.id}"`, definitions, usage, addDiagnostic, regionAt);
  });

  if (Array.isArray(templateContent.overlays)) {
    templateContent.overlays.forEach((overlay, overlayIndex) => {
      if (overlay && Array.isArray(overlay.content)) {
        overlay.content.forEach((node, index) => {
          collectReferencedComponents(node, result, `template overlay "${overlay.id}"`, definitions, usage, addDiagnostic, under(at, 'overlays', overlayIndex, 'content', index));
        });
      }
    });
  }
}

function collectPageReferences(pageDocument, result, pageTemplates, definitions, datasetIds, usage, addDiagnostic) {
  const pageId = pageDocument.id;
  const page = pageDocument.document?.page || {};
  const templateId = page.template;
  const filledSlots = new Set();
  const at = { document: `page:${pageId}`, path: '$.page' };

  const templateMeta = pageTemplates.get(templateId);
  const templateInfo = templateMeta || { slotIds: new Set(), injectableIds: new Set() };

  if (!templateId) {
    addDiagnostic(result, 'errors', 'MISSING_PAGE_TEMPLATE', `Page "${pageId}" does not define a template.`, at);
    return;
  }

  if (!pageMetaExists(pageTemplates, templateId)) {
    addDiagnostic(result, 'errors', 'MISSING_TEMPLATE_REFERENCE', `Page "${pageId}" references missing template "${templateId}".`, under(at, 'template'));
    return;
  }

  const pageSlots = Array.isArray(page.slots) ? page.slots : [];
  pageSlots.forEach((slot, slotIndex) => {
    if (!slot || typeof slot !== 'object') {
      return;
    }
    const slotAt = under(at, 'slots', slotIndex);
    const slotId = slot.slotId;
    const slotHasContent = Array.isArray(slot.content) && slot.content.length > 0;

    if (typeof slotId === 'string' && !templateInfo.slotIds.has(slotId)) {
      addDiagnostic(
        result,
        'errors',
        'MISSING_SLOT_REFERENCE',
        `Page "${pageId}" targets unknown slot "${slotId}" on template "${templateId}".`,
        under(slotAt, 'slotId'),
      );
    }

    if (Array.isArray(slot.content)) {
      slot.content.forEach((node, index) => {
        collectReferencedComponents(node, result, `page "${pageId}" slot "${slotId}"`, definitions, usage, addDiagnostic, under(slotAt, 'content', index));
      });
    }

    if (typeof slotId === 'string' && templateInfo.slotIds.has(slotId)) {
      if (!slotHasContent) {
        addDiagnostic(
          result,
          'warnings',
          'EMPTY_SLOT',
          `Page "${pageId}" defines empty content for template slot "${slotId}" on template "${templateId}".`,
          under(slotAt, 'content'),
        );
      } else {
        filledSlots.add(slotId);
      }
    }
  });

  if (Array.isArray(page.injectables)) {
    page.injectables.forEach((injectable, injectableIndex) => {
      if (!injectable || typeof injectable !== 'object') {
        return;
      }
      const injectableAt = under(at, 'injectables', injectableIndex);
      if (typeof injectable.injectableId === 'string' && !templateInfo.injectableIds.has(injectable.injectableId)) {
        addDiagnostic(
          result,
          'errors',
          'MISSING_INJECTABLE_REFERENCE',
          `Page "${pageId}" targets unknown injectable "${injectable.injectableId}" on template "${templateId}".`,
          under(injectableAt, 'injectableId'),
        );
      }
      if (Array.isArray(injectable.content)) {
        injectable.content.forEach((node, index) => {
          collectReferencedComponents(node, result, `page "${pageId}" injectable "${injectable.injectableId}"`, definitions, usage, addDiagnostic, under(injectableAt, 'content', index));
        });
      }
    });
  }

  if (Array.isArray(page.overlays)) {
    page.overlays.forEach((overlay, overlayIndex) => {
      if (overlay && Array.isArray(overlay.content)) {
        overlay.content.forEach((node, index) => {
          collectReferencedComponents(node, result, `page "${pageId}" overlay "${overlay.id}"`, definitions, usage, addDiagnostic, under(at, 'overlays', overlayIndex, 'content', index));
        });
      }
    });
  }

  if (Array.isArray(page.dataSources)) {
    page.dataSources.forEach((source, sourceIndex) => {
      if (!source || typeof source !== 'object' || typeof source.dataset !== 'string') {
        return;
      }
      if (!datasetIds.has(source.dataset)) {
        addDiagnostic(
          result,
          'errors',
          'MISSING_DATASET_REFERENCE',
          `Page "${pageId}" references missing dataset "${source.dataset}".`,
          under(at, 'dataSources', sourceIndex, 'dataset'),
        );
      } else if (usage) {
        usage.datasetsUsed.add(source.dataset);
      }
    });
  }

  if (templateInfo.slotIds.size > 0) {
    for (const slotId of templateInfo.slotIds) {
      if (!filledSlots.has(slotId)) {
        addDiagnostic(
          result,
          'warnings',
          'EMPTY_SLOT',
          `Page "${pageId}" does not define content for template slot "${slotId}" on template "${templateId}".`,
          under(at, 'slots'),
        );
      }
    }
  }
}

function pageMetaExists(pageTemplates, templateId) {
  return pageTemplates.has(templateId);
}

function collectPageRouteDiagnostics(routes, result, pages, templates, addDiagnostic, at) {
  if (!Array.isArray(routes)) {
    addDiagnostic(result, 'errors', 'INVALID_ROUTE_BLOCK', 'sitemap.routes must be an array.', at);
    return;
  }

  routes.forEach((route, index) => {
    if (!route || typeof route !== 'object') {
      return;
    }

    if (typeof route.page === 'string' && !pages.has(route.page)) {
      addDiagnostic(
        result,
        'errors',
        'ORPHAN_ROUTE',
        `Route "${route.id ?? '<unknown>'}" points to missing page "${route.page}".`,
        under(at, index, 'page'),
      );
    }
    if (typeof route.template === 'string' && !templates.has(route.template)) {
      addDiagnostic(
        result,
        'errors',
        'MISSING_TEMPLATE_REFERENCE',
        `Route "${route.id ?? '<unknown>'}" points to missing template "${route.template}".`,
        under(at, index, 'template'),
      );
    }
  });
}

module.exports = {
  collectReferencedComponents,
  collectTemplateReferences,
  collectPageReferences,
  collectPageRouteDiagnostics,
  pageMetaExists,
};
