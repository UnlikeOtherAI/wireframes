 'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { listPages } = require(path.resolve(__dirname, '..', 'page'));
const { listTemplates } = require(path.resolve(__dirname, '..', 'template'));
const { listComponents } = require(path.resolve(__dirname, '..', 'component'));
const { listDatasets, dataStats } = require(path.resolve(__dirname, '..', 'data'));
const {
  resolveAddressInRoots,
  resolveTarget,
} = require(path.resolve(__dirname, '..', 'addressing'));

const ID_REGEX = /^[a-z][a-z0-9_]*$/;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isYamlFile(fileName) {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}

function readYaml(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function componentsFilePath(projectPath) {
  return path.join(projectPath, 'components.yaml');
}

function templatesFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function sitemapFilePath(projectPath) {
  return path.join(projectPath, 'sitemap.yaml');
}

function pageFilePath(projectPath, pageId) {
  return path.join(projectPath, 'pages', `${pageId}.yaml`);
}

function dataFilePath(projectPath, datasetId) {
  return path.join(projectPath, 'data', `${datasetId}.yaml`);
}

function collectPages(projectPath) {
  const pagesPath = path.join(projectPath, 'pages');
  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return [];
  }

  return fs.readdirSync(pagesPath).filter(isYamlFile).sort();
}

function collectTemplates(projectPath) {
  const loaded = readYaml(templatesFilePath(projectPath));
  return loaded?.templates && isObject(loaded.templates) ? loaded.templates : {};
}

function collectComponents(projectPath) {
  const loaded = readYaml(componentsFilePath(projectPath));
  return loaded?.components && isObject(loaded.components) ? loaded.components : {};
}

function collectNodeComponentUsages(node, componentIds, callback) {
  if (!isObject(node)) {
    return;
  }

  if (typeof node.use === 'string' && componentIds.has(node.use)) {
    callback(node.use);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectNodeComponentUsages(child, componentIds, callback);
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectNodeComponentUsages(child, componentIds, callback);
    }
  }
}

function collectTemplateComponentUsages(templateId, template, componentIds, direct, allRefs, allComponentRefs) {
  const recordReference = (value) => {
    if (!allRefs) {
      return;
    }
    if (typeof allRefs.add === 'function') {
      allRefs.add(value);
      return;
    }
    if (typeof allRefs === 'function') {
      allRefs(value);
    }
  };

  const regions = Array.isArray(template.regions) ? template.regions : [];
  for (const region of regions) {
    if (isObject(region) && Array.isArray(region.children)) {
      for (const node of region.children) {
        collectNodeComponentUsages(node, componentIds, (componentId) => {
          if (componentId === templateId) {
            return;
          }
          direct.add(componentId);
          recordReference(componentId);
        });
      }
    }
  }

  if (Array.isArray(template.overlays)) {
    for (const overlay of template.overlays) {
      if (!isObject(overlay) || !Array.isArray(overlay.content)) {
        continue;
      }
      for (const node of overlay.content) {
        collectNodeComponentUsages(node, componentIds, (componentId) => {
          if (componentId === templateId) {
            return;
          }
          direct.add(componentId);
          recordReference(componentId);
        });
      }
    }
  }

  if (allComponentRefs) {
    allComponentRefs.add(`template:${templateId}`);
  }
}

function collectPageComponentUsages(pageFileName, pageDoc, componentIds, direct, allRefs, allComponentRefs) {
  const page = pageDoc?.page;
  if (!isObject(page)) {
    return;
  }

  const recordReference = (value) => {
    if (!allRefs) {
      return;
    }
    if (typeof allRefs.add === 'function') {
      allRefs.add(value);
      return;
    }
    if (typeof allRefs === 'function') {
      allRefs(value);
    }
  };

  const pageId = typeof page.id === 'string' ? page.id : normalizeId(path.basename(pageFileName).split('.')[0]);
  const targetRef = `page:${pageId}`;

  const slotList = Array.isArray(page.slots) ? page.slots : [];
  for (const slot of slotList) {
    if (!isObject(slot) || !Array.isArray(slot.content)) {
      continue;
    }
    for (const node of slot.content) {
      collectNodeComponentUsages(node, componentIds, (componentId) => {
        direct.add(componentId);
        recordReference(componentId);
        if (allComponentRefs) {
          allComponentRefs.add(`${targetRef}`);
        }
      });
    }
  }

  const injectableList = Array.isArray(page.injectables) ? page.injectables : [];
  for (const injectable of injectableList) {
    if (!isObject(injectable) || !Array.isArray(injectable.content)) {
      continue;
    }
    for (const node of injectable.content) {
      collectNodeComponentUsages(node, componentIds, (componentId) => {
        direct.add(componentId);
        recordReference(componentId);
        if (allComponentRefs) {
          allComponentRefs.add(`${targetRef}`);
        }
      });
    }
  }

  if (Array.isArray(page.overlays)) {
    for (const overlay of page.overlays) {
      if (!isObject(overlay) || !Array.isArray(overlay.content)) {
        continue;
      }
      for (const node of overlay.content) {
        collectNodeComponentUsages(node, componentIds, (componentId) => {
          direct.add(componentId);
          recordReference(componentId);
          if (allComponentRefs) {
            allComponentRefs.add(`${targetRef}`);
          }
        });
      }
    }
  }
}

function inspectAddress({ projectPath, address }) {
  if (!address || typeof address !== 'string') {
    return { ok: false, error: 'Address is required.' };
  }

  const resolved = resolveTarget(path.resolve(projectPath), address);
  if (!resolved.ok) {
    return resolved;
  }

  const result = resolveAddressInRoots(resolved.roots, resolved.segments, { allowContainerFinal: false });
  if (!result.ok) {
    return result;
  }

  if (result.targetType !== 'node') {
    return { ok: false, error: 'Resolved address does not point to a node.' };
  }

  const node = result.node;
  const children = Array.isArray(node.children) ? node.children : [];
  return {
    ok: true,
    origin: result.origin,
    sourceRef: result.sourceRef,
    resolvedAddress: result.resolvedAddress,
    node,
    children,
    layoutSummary: {
      hasLayout: isObject(node.layout),
      hasChildren: children.length > 0,
      childrenCount: children.length,
      layout: isObject(node.layout) ? node.layout : null,
    },
  };
}

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
    const slotList = Array.isArray(page.slots) ? page.slots : [];
    for (const slot of slotList) {
      if (!isObject(slot) || !Array.isArray(slot.content)) {
        continue;
      }
      for (const node of slot.content) {
        collectNodeComponentUsages(node, componentIds, (value) => targetCallback(value));
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

function listRoutes(projectPath) {
  const loaded = readYaml(sitemapFilePath(projectPath));
  if (!loaded) {
    return { ok: false, error: 'Invalid or missing sitemap.yaml document.' };
  }

  const topLevelRoutes = Array.isArray(loaded.routes) ? loaded.routes : [];
  const nestedRoutes = isObject(loaded.sitemap) && Array.isArray(loaded.sitemap.routes)
    ? loaded.sitemap.routes
    : [];
  const routes = [...topLevelRoutes, ...nestedRoutes];

  if (!Array.isArray(routes)) {
    return { ok: false, error: 'sitemap routes must be an array.' };
  }

  const normalized = [];
  const seen = new Set();
  for (const entry of routes) {
    const id = normalizeId(entry?.id) || '<unknown>';
    const key = `${id}:${normalizeId(entry?.path) || '<unknown>'}:${normalizeId(entry?.page) || '<unknown>'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      id,
      path: normalizeId(entry?.path) || '<unknown>',
      page: normalizeId(entry?.page) || '<unknown>',
      template: normalizeId(entry?.template) || '<unknown>',
    });
  }

  return {
    ok: true,
    routes: normalized,
  };
}

function computeTemplateComponentUsagesFromPageAndTemplate(componentIds) {
  const directUsages = new Set();
  const componentRefTargets = new Set();
  const usedByTemplates = [];
  const usedByPages = [];
  return {
    directUsages,
    usedByTemplates,
    usedByPages,
  };
}

function listUsedComponents(projectPath) {
  const components = collectComponents(projectPath);
  const templates = collectTemplates(projectPath);
  const componentIds = new Set(Object.keys(components).filter((value) => ID_REGEX.test(value)));

  const directUsages = new Set();

  const addComponentUsage = (componentId, usageContext, usagesBySource) => {
    if (!componentIds.has(componentId)) {
      return;
    }
    directUsages.add(componentId);
    if (usagesBySource) {
      usagesBySource.add(usageContext);
    }
  };

  const componentUsagesBySource = new Map();
  for (const componentId of componentIds) {
    componentUsagesBySource.set(componentId, new Set());
  }

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

  const pagesPath = path.join(projectPath, 'pages');
  if (fs.existsSync(pagesPath) && fs.statSync(pagesPath).isDirectory()) {
    const pageFiles = fs.readdirSync(pagesPath).filter(isYamlFile);
    for (const pageFile of pageFiles) {
      const pageDoc = readYaml(path.join(pagesPath, pageFile));
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

function collectProjectStats({ projectPath }) {
  const totalPages = listPages(path.resolve(projectPath)).length;
  const totalTemplates = listTemplates(path.resolve(projectPath)).length;
  const componentList = listComponents(path.resolve(projectPath));
  const totalComponents = componentList.length;

  const used = listUsedComponents(path.resolve(projectPath));
  if (!used.ok) {
    return used;
  }

  const unusedComponents = componentList.filter((id) => !used.usedComponents.has(id)).sort();

  const datasetIds = listDatasets(path.resolve(projectPath));
  const datasetStats = [];
  for (const datasetId of datasetIds) {
    const stats = dataStats({ projectPath: path.resolve(projectPath), datasetId });
    if (!stats.ok) {
      return {
        ok: false,
        error: `Unable to collect stats for dataset "${datasetId}": ${stats.error}`,
      };
    }
    datasetStats.push({
      id: stats.datasetId,
      items: stats.itemCount,
      bytes: stats.byteSize,
    });
  }

  return {
    ok: true,
    totalPages,
    totalTemplates,
    totalComponents,
    unusedComponents,
    datasetStats,
  };
}

module.exports = {
  collectComponentUsagesFromNodes: collectNodeComponentUsages,
  collectProjectStats,
  findComponentUsages,
  findUsagesForId,
  inspectAddress,
  listDataUsages,
  listRoutes,
  collectProjectStats,
  listUsedComponents,
};
