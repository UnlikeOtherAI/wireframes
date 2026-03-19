'use strict';

const path = require('node:path');
const { listDatasets } = require(path.resolve(__dirname, '..', 'data'));
const {
  collectComponents,
  collectPages,
  collectTemplateComponentUsages,
  collectNodeComponentUsages,
  collectTemplates,
  ID_REGEX,
  isObject,
  normalizeId,
  pageFilePath,
  readYaml,
} = require('./helpers');

function findComponentUsages(projectPath, componentId) {
  const normalizedId = normalizeId(componentId);
  if (!ID_REGEX.test(normalizedId)) {
    return { ok: false, error: `Invalid id "${componentId}". Use snake_case alpha-numeric with underscores starting with a letter.` };
  }

  const components = collectComponents(projectPath);
  const componentIds = new Set(Object.keys(components).filter((value) => ID_REGEX.test(value)));
  if (!componentIds.has(normalizedId)) {
    return { ok: false, error: `Unknown component "${normalizedId}".` };
  }

  const usages = new Set();
  const templates = collectTemplates(projectPath);
  for (const [templateId, template] of Object.entries(templates)) {
    if (!isObject(template)) {
      continue;
    }

    const templateUsages = new Set();
    const directUsages = new Set();
    const targetCallback = (value) => {
      if (value === normalizedId) {
        templateUsages.add(`template:${templateId}`);
      }
    };
    collectTemplateComponentUsages(templateId, template, componentIds, directUsages, targetCallback);
    for (const entry of templateUsages) {
      usages.add(entry);
    }
  }

  const pageFiles = collectPages(projectPath);
  for (const pageFile of pageFiles) {
    const pagePath = pageFilePath(projectPath, path.basename(pageFile, path.extname(pageFile)));
    const pageDoc = readYaml(pagePath);
    const pageUsages = new Set();
    const targetCallback = (value) => {
      if (value === normalizedId) {
        const pageId = pageDoc?.page?.id || path.basename(pageFile, path.extname(pageFile));
        pageUsages.add(`page:${pageId}`);
      }
    };
    const page = pageDoc?.page;
    if (!isObject(page)) {
      continue;
    }

    if (Array.isArray(page.slots)) {
      for (const slot of page.slots) {
        if (!isObject(slot) || !Array.isArray(slot.content)) {
          continue;
        }
        for (const node of slot.content) {
          collectNodeComponentUsages(node, componentIds, (value) => targetCallback(value));
        }
      }
    }
    if (Array.isArray(page.injectables)) {
      for (const injectable of page.injectables) {
        if (!isObject(injectable) || !Array.isArray(injectable.content)) {
          continue;
        }
        for (const node of injectable.content) {
          collectNodeComponentUsages(node, componentIds, (value) => targetCallback(value));
        }
      }
    }
    if (Array.isArray(page.overlays)) {
      for (const overlay of page.overlays) {
        if (!isObject(overlay) || !Array.isArray(overlay.content)) {
          continue;
        }
        for (const node of overlay.content) {
          collectNodeComponentUsages(node, componentIds, (value) => targetCallback(value));
        }
      }
    }

    for (const entry of pageUsages) {
      usages.add(entry);
    }
  }

  for (const [candidateId, componentDoc] of Object.entries(components)) {
    if (candidateId === normalizedId || !isObject(componentDoc?.root)) {
      continue;
    }

    const componentUsages = new Set();
    const targetCallback = (value) => {
      if (value === normalizedId) {
        componentUsages.add(`component:${candidateId}`);
      }
    };
    collectNodeComponentUsages(componentDoc.root, componentIds, (value) => targetCallback(value));
    for (const entry of componentUsages) {
      usages.add(entry);
    }
  }

  return { ok: true, componentId: normalizedId, usages: Array.from(usages).sort() };
}

function listDataUsages(projectPath, datasetId) {
  const normalizedId = normalizeId(datasetId);
  if (!ID_REGEX.test(normalizedId)) {
    return { ok: false, error: `Invalid id "${datasetId}". Use snake_case alpha-numeric with underscores starting with a letter.` };
  }

  const usages = [];
  const pageFiles = collectPages(projectPath);
  for (const pageFile of pageFiles) {
    const pagePath = pageFilePath(projectPath, path.basename(pageFile, path.extname(pageFile)));
    const pageDoc = readYaml(pagePath);
    const page = pageDoc?.page;
    if (!isObject(page)) {
      continue;
    }

    const pageId = normalizeId(page.id) || path.basename(pageFile, path.extname(pageFile));
    const sources = Array.isArray(page.dataSources) ? page.dataSources : [];
    const hasMatch = sources.some((source) => isObject(source) && source.dataset === normalizedId);
    if (hasMatch) {
      usages.push(`page:${pageId}`);
    }
  }

  return { ok: true, datasetId: normalizedId, usages: usages.sort() };
}

function findUsagesForId({ projectPath, id }) {
  const normalizedId = normalizeId(id);
  if (!ID_REGEX.test(normalizedId)) {
    return { ok: false, error: `Invalid id "${id}". Use snake_case alpha-numeric with underscores starting with a letter.` };
  }

  const components = collectComponents(projectPath);
  const datasetIds = listDatasets(projectPath);
  const isComponent = Object.prototype.hasOwnProperty.call(components, normalizedId);
  const isDataset = datasetIds.includes(normalizedId);

  if (!isComponent && !isDataset) {
    return { ok: false, error: `Unknown component or dataset "${normalizedId}".` };
  }

  const result = {
    ok: true,
    id: normalizedId,
    component: null,
    dataset: null,
  };

  if (isComponent) {
    const usages = findComponentUsages(projectPath, normalizedId);
    if (!usages.ok) {
      return usages;
    }
    result.component = usages.usages;
  }

  if (isDataset) {
    const datasetUsages = listDataUsages(projectPath, normalizedId);
    if (!datasetUsages.ok) {
      return datasetUsages;
    }
    result.dataset = {
      id: normalizedId,
      usages: datasetUsages.usages,
    };
  }

  return result;
}

function listUsedComponents(projectPath) {
  const components = collectComponents(projectPath);
  const templates = collectTemplates(projectPath);
  const componentIds = new Set(Object.keys(components).filter((value) => ID_REGEX.test(value)));

  const directUsages = new Set();
  const componentUsagesBySource = new Map();
  for (const componentId of componentIds) {
    componentUsagesBySource.set(componentId, new Set());
  }

  const addComponentUsage = (componentId, usageContext, usagesBySource) => {
    if (!componentIds.has(componentId)) {
      return;
    }
    directUsages.add(componentId);
    if (usagesBySource) {
      usagesBySource.add(usageContext);
    }
  };

  for (const [templateId, template] of Object.entries(templates)) {
    if (!isObject(template)) {
      continue;
    }

    const collect = (componentId) => {
      if (componentId === templateId) {
        return;
      }
      addComponentUsage(componentId, `template:${templateId}`, componentUsagesBySource.get(componentId));
    };

    collectTemplateComponentUsages(templateId, template, componentIds, directUsages, new Set(), null);
    collectTemplateComponentUsages(templateId, template, componentIds, directUsages, new Set(), new Set([`template:${templateId}`]));
    const fallbackTemplates = template.regions || [];
    for (const region of fallbackTemplates) {
      if (!isObject(region) || !Array.isArray(region.children)) {
        continue;
      }
      for (const node of region.children) {
        collectNodeComponentUsages(node, componentIds, collect);
      }
    }
    if (Array.isArray(template.overlays)) {
      for (const overlay of template.overlays) {
        if (!isObject(overlay) || !Array.isArray(overlay.content)) {
          continue;
        }
        for (const node of overlay.content) {
          collectNodeComponentUsages(node, componentIds, collect);
        }
      }
    }
  }

  if (collectPages(path.resolve(projectPath)).length > 0) {
    const pageFiles = collectPages(projectPath);
    for (const pageFile of pageFiles) {
      const pageDoc = readYaml(path.join(projectPath, 'pages', pageFile));
      const page = pageDoc?.page;
    const pageId = normalizeId(page?.id) || path.basename(pageFile, path.extname(pageFile));
    if (!isObject(page)) {
      continue;
    }
    const context = `page:${pageId}`;
    const collect = (componentId) => addComponentUsage(componentId, context, componentUsagesBySource.get(componentId));
      if (Array.isArray(page.slots)) {
        for (const slot of page.slots) {
          if (!isObject(slot) || !Array.isArray(slot.content)) {
            continue;
          }
          for (const node of slot.content) {
            collectNodeComponentUsages(node, componentIds, collect);
          }
        }
      }
      if (Array.isArray(page.injectables)) {
        for (const injectable of page.injectables) {
          if (!isObject(injectable) || !Array.isArray(injectable.content)) {
            continue;
          }
          for (const node of injectable.content) {
            collectNodeComponentUsages(node, componentIds, collect);
          }
        }
      }
      if (Array.isArray(page.overlays)) {
        for (const overlay of page.overlays) {
          if (!isObject(overlay) || !Array.isArray(overlay.content)) {
            continue;
          }
          for (const node of overlay.content) {
            collectNodeComponentUsages(node, componentIds, collect);
          }
        }
      }
    }
  }

  const graph = Object.create(null);
  for (const componentId of componentIds) {
    const componentDoc = components[componentId];
    const refs = new Set();
    if (isObject(componentDoc?.root)) {
      collectNodeComponentUsages(componentDoc.root, componentIds, (ref) => {
        if (ref !== componentId) {
          refs.add(ref);
        }
      });
    }
    graph[componentId] = Array.from(refs);
  }

  const usedComponents = new Set(directUsages);
  const queue = Array.from(directUsages);

  while (queue.length > 0) {
    const next = queue.shift();
    const refs = graph[next] || [];
    for (const ref of refs) {
      if (!usedComponents.has(ref)) {
        usedComponents.add(ref);
        queue.push(ref);
      }
    }
  }

  return { ok: true, usedComponents, directUsages, total: componentIds };
}

module.exports = {
  findComponentUsages,
  findUsagesForId,
  listDataUsages,
  listUsedComponents,
};
