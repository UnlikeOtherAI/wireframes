'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  SUPPORTED_SPEC_VERSION,
} = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { compareVersions, loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));
const {
  loadComponentRegistryForDocuments,
  loadProjectComponentRegistry,
} = require(path.resolve(__dirname, '..', 'component-registry'));
const { runSemanticValidation } = require(path.resolve(__dirname, 'semantic-validator'));

const PRIMITIVE_COMPONENTS = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'icon',
  'button',
  'tab_bar',
  'bottom_tab_bar',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'toggle',
  'chart',
  'table',
  'section',
  'divider',
  'spacer',
]);

function addDiagnostic(result, severity, code, message) {
  result[severity].push({
    code,
    message,
  });
}

function isYamlFile(fileName) {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}

function parseYamlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return yaml.load(content);
  } catch (error) {
    return {
      error: `Invalid YAML in ${filePath}: ${error.message}`,
    };
  }
}

function loadDocument(filePath, result, expectedType) {
  try {
    const loaded = loadDocumentFromFile(filePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });

    if (expectedType && loaded.documentType !== expectedType) {
      addDiagnostic(
        result,
        'errors',
        'INVALID_DOCUMENT_TYPE',
        `Expected documentType "${expectedType}" in ${filePath}, found "${loaded.documentType}".`,
      );
      return null;
    }

    return loaded;
  } catch (error) {
    if (
      error.code === 'SCHEMA_VALIDATION'
      && error.details != null
      && Array.isArray(error.details.errors)
    ) {
      for (const schemaError of error.details.errors) {
        const location = schemaError.path ? ` at ${schemaError.path}` : '';
        addDiagnostic(
          result,
          'errors',
          schemaError.code || 'SCHEMA_VALIDATION',
          `Schema validation error${location}: ${schemaError.message}`,
        );
      }
      return null;
    }

    addDiagnostic(result, 'errors', error.code || 'DOCUMENT_LOAD_ERROR', error.message);
    return null;
  }
}

function collectReferencedComponents(node, result, context, componentIds, usage) {
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
      collectReferencedComponents(child, result, context, componentIds, usage);
    }
  }
}

function collectTemplateReferences(templateContent, result, componentIds, seenSlotIds, seenInjectableIds, usage) {
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
        collectReferencedComponents(child, result, `template region "${region.id}"`, componentIds, usage);
      }
    }

    collectReferencedComponents(region, result, `template region "${region.id}"`, componentIds, usage);
  }

  if (Array.isArray(templateContent.overlays)) {
    for (const overlay of templateContent.overlays) {
      if (overlay && Array.isArray(overlay.content)) {
        for (const node of overlay.content) {
          collectReferencedComponents(node, result, `template overlay "${overlay.id}"`, componentIds, usage);
        }
      }
    }
  }
}

function collectPageReferences(pageDocument, result, pageTemplates, componentIds, datasetIds, usage) {
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
        collectReferencedComponents(node, result, `page "${pageId}" slot "${slotId}"`, componentIds, usage);
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
          collectReferencedComponents(node, result, `page "${pageId}" injectable "${injectable.injectableId}"`, componentIds, usage);
        }
      }
    }
  }

  if (Array.isArray(page.overlays)) {
    for (const overlay of page.overlays) {
      if (overlay && Array.isArray(overlay.content)) {
        for (const node of overlay.content) {
          collectReferencedComponents(node, result, `page "${pageId}" overlay "${overlay.id}"`, componentIds, usage);
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

function collectComponentUseGraph(components, result) {
  const graph = Object.create(null);
  const componentIds = new Set(Object.keys(components));
  const entries = Object.entries(components);

  for (const [componentId, componentDoc] of entries) {
    const edges = [];
    const root = componentDoc?.root;
    walkUseGraph(root, edges, componentIds);
    graph[componentId] = edges;
  }

  return graph;
}

function walkUseGraph(node, edges, componentIds) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return;
  }

  if (typeof node.use === 'string' && componentIds.has(node.use)) {
    edges.push(node.use);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkUseGraph(child, edges, componentIds);
    }
  }
}

function collectUsedComponents(componentGraph, directUsages) {
  const used = new Set(directUsages);
  const queue = Array.from(directUsages);

  while (queue.length > 0) {
    const current = queue.shift();
    const references = componentGraph[current] || [];
    for (const reference of references) {
      if (!used.has(reference)) {
        used.add(reference);
        queue.push(reference);
      }
    }
  }

  return used;
}

function detectCircularUse(referenceGraph, result) {
  const visited = new Set();
  const stack = [];
  const inStack = new Set();

  function visit(current) {
    if (!Object.prototype.hasOwnProperty.call(referenceGraph, current)) {
      return null;
    }
    if (inStack.has(current)) {
      const start = stack.indexOf(current);
      const cycle = stack.slice(start).concat(current);
      return cycle;
    }
    if (visited.has(current)) {
      return null;
    }

    visited.add(current);
    inStack.add(current);
    stack.push(current);

    for (const edge of referenceGraph[current]) {
      const cycle = visit(edge);
      if (cycle) {
        return cycle;
      }
    }

    stack.pop();
    inStack.delete(current);
    return null;
  }

  for (const node of Object.keys(referenceGraph)) {
    const cycle = visit(node);
    if (cycle) {
      addDiagnostic(
        result,
        'errors',
        'CIRCULAR_TEMPLATE_REFERENCE',
        `Circular component reference detected: ${cycle.join(' -> ')}.`,
      );
      return;
    }
  }
}

function collectPageRouteDiagnostics(routes, result, pages, templates) {
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

function loadScopedComponentIds(root, result, entries, contextLabel, fallbackIds) {
  const registryResult = loadComponentRegistryForDocuments(root, entries);
  if (!registryResult.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load component imports for ${contextLabel}: ${registryResult.error}`,
    );
    return fallbackIds;
  }

  return new Set(Object.keys(registryResult.registry.components));
}

function runDoctor({ projectPath } = {}) {
  const result = {
    ok: true,
    errors: [],
    warnings: [],
    projectPath: path.resolve(projectPath || process.cwd()),
  };

  const root = result.projectPath;

  const requiredFiles = [
    { path: 'manifest.yaml', type: 'file' },
    { path: '.wfrc.yaml', type: 'file' },
    { path: 'sitemap.yaml', type: 'file' },
    { path: 'templates.yaml', type: 'file' },
    { path: 'components.yaml', type: 'file' },
    { path: 'pages', type: 'dir' },
    { path: 'data', type: 'dir' },
  ];

  for (const item of requiredFiles) {
    const abs = path.join(root, item.path);
    if (!fs.existsSync(abs)) {
      addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', `Required path is missing: ${item.path}`);
      continue;
    }

    const stats = fs.statSync(abs);
    if (item.type === 'file' && !stats.isFile()) {
      addDiagnostic(result, 'errors', 'INVALID_REQUIRED_PATH', `Expected file at ${item.path}.`);
    }
    if (item.type === 'dir' && !stats.isDirectory()) {
      addDiagnostic(result, 'errors', 'INVALID_REQUIRED_PATH', `Expected directory at ${item.path}.`);
    }
  }

  const manifest = loadDocument(path.join(root, 'manifest.yaml'), result, 'manifest');
  const sitemap = loadDocument(path.join(root, 'sitemap.yaml'), result, 'sitemap');
  const templates = loadDocument(path.join(root, 'templates.yaml'), result, 'templates');
  const components = loadDocument(path.join(root, 'components.yaml'), result, 'components');

  const wfrcPath = path.join(root, '.wfrc.yaml');
  if (fs.existsSync(wfrcPath)) {
    const parsed = parseYamlFile(wfrcPath);
    if (parsed && parsed.error) {
      addDiagnostic(result, 'errors', 'INVALID_YAML', parsed.error);
    }
  }

  const templateMap = new Map();
  const pageMap = new Map();
  const datasetIds = new Set();

  const pagesDir = path.join(root, 'pages');
  if (fs.existsSync(pagesDir) && fs.statSync(pagesDir).isDirectory()) {
    const pageFiles = fs.readdirSync(pagesDir).filter((name) => isYamlFile(name));
    for (const pageFile of pageFiles) {
      const abs = path.join(pagesDir, pageFile);
      const loaded = loadDocument(abs, result, 'page');
      if (!loaded) {
        continue;
      }
      const pageId = loaded.document?.page?.id;
      if (typeof pageId === 'string') {
        if (pageMap.has(pageId)) {
          addDiagnostic(result, 'errors', 'DUPLICATE_PAGE_ID', `Duplicate page id "${pageId}" in ${abs}.`);
        } else {
          pageMap.set(pageId, loaded);
        }
      } else {
        addDiagnostic(result, 'errors', 'INVALID_PAGE_ID', `Page document at ${abs} has no valid id.`);
      }
    }
  } else {
    addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', 'pages directory is missing required page sources.');
  }

  const dataDir = path.join(root, 'data');
  if (fs.existsSync(dataDir) && fs.statSync(dataDir).isDirectory()) {
    const datasetFiles = fs.readdirSync(dataDir).filter((name) => isYamlFile(name));
    for (const datasetFile of datasetFiles) {
      const abs = path.join(dataDir, datasetFile);
      const loaded = loadDocument(abs, result, 'dataset');
      if (!loaded) {
        continue;
      }
      const datasetId = loaded.id;
      if (typeof datasetId === 'string') {
        if (datasetIds.has(datasetId)) {
          addDiagnostic(result, 'errors', 'DUPLICATE_DATASET_ID', `Duplicate dataset id "${datasetId}" in ${abs}.`);
        } else {
          datasetIds.add(datasetId);
        }
      } else {
        addDiagnostic(result, 'errors', 'INVALID_DATASET_ID', `Dataset document at ${abs} has no valid id.`);
      }
    }
  } else {
    addDiagnostic(result, 'errors', 'MISSING_REQUIRED_FILE', 'data directory is missing required dataset sources.');
  }

  if (manifest && manifest.document?.manifest?.schemaVersion) {
    const schemaVersion = manifest.document.manifest.schemaVersion;
    const supportedSchemaVersion = SUPPORTED_SPEC_VERSION;

    try {
      if (compareVersions(String(schemaVersion), supportedSchemaVersion, manifest.absolutePath) > 0) {
        addDiagnostic(
          result,
          'errors',
          'INCOMPATIBLE_SCHEMA_VERSION',
          `manifest.schemaVersion "${schemaVersion}" exceeds CLI-supported version "${supportedSchemaVersion}".`,
        );
      }
    } catch (error) {
      addDiagnostic(result, 'errors', 'INVALID_MANIFEST_SCHEMA_VERSION', error.message);
    }
  }

  const templateDefinitions = templates?.document?.templates || {};
  const projectComponentRegistry = loadProjectComponentRegistry(root);
  if (!projectComponentRegistry.ok) {
    addDiagnostic(
      result,
      'errors',
      'COMPONENT_IMPORT_ERROR',
      `Unable to load project component registry: ${projectComponentRegistry.error}`,
    );
  }
  const componentMap = projectComponentRegistry.ok ? projectComponentRegistry.registry.components : {};
  const componentIds = new Set(Object.keys(componentMap));
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
    const templateComponentIds = loadScopedComponentIds(
      root,
      result,
      templates?.absolutePath && templates?.document
        ? [{ documentPath: templates.absolutePath, document: templates.document }]
        : [],
      `template "${templateId}"`,
      componentIds,
    );
    collectTemplateReferences(templateDocument, result, templateComponentIds, templateInfo.slotIds, templateInfo.injectableIds, componentUsages);
  }

  const routeEntries = sitemap?.document?.routes || sitemap?.document?.sitemap?.routes || [];
  collectPageRouteDiagnostics(routeEntries, result, pageMap, templateMap);

  for (const pageLoaded of pageMap.values()) {
    const pageComponentIds = loadScopedComponentIds(
      root,
      result,
      pageLoaded?.absolutePath && pageLoaded?.document
        ? [{ documentPath: pageLoaded.absolutePath, document: pageLoaded.document }]
        : [],
      `page "${pageLoaded.id}"`,
      componentIds,
    );
    collectPageReferences(
      pageLoaded.document?.page ? pageLoaded : { id: pageLoaded.id, document: pageLoaded.document },
      result,
      templateMap,
      pageComponentIds,
      datasetIds,
      componentUsages,
    );
  }

  const componentGraph = collectComponentUseGraph(componentMap, result);
  const usedComponents = collectUsedComponents(componentGraph, componentUsages.componentsUsed);

  for (const componentId of Object.keys(componentMap)) {
    if (!usedComponents.has(componentId)) {
      addDiagnostic(
        result,
        'warnings',
        'UNUSED_COMPONENT',
        `Component "${componentId}" is not referenced by any page or template.`,
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
      );
    }
  }

  detectCircularUse(componentGraph, result);

  runSemanticValidation({
    result,
    manifest: manifest?.document?.manifest || {},
    sitemap: sitemap?.document?.sitemap || sitemap?.document || {},
    templates: templates?.document?.templates || {},
    components: componentMap,
    pages: Array.from(pageMap.values()),
    resolveComponentsForPage(pageLoaded) {
      const entries = [];
      if (templates?.absolutePath && templates?.document) {
        entries.push({
          documentPath: templates.absolutePath,
          document: templates.document,
        });
      }
      if (pageLoaded?.absolutePath && pageLoaded?.document) {
        entries.push({
          documentPath: pageLoaded.absolutePath,
          document: pageLoaded.document,
        });
      }

      const registryResult = loadComponentRegistryForDocuments(root, entries);
      if (!registryResult.ok) {
        return {
          ok: false,
          error: `Unable to load component imports for page "${pageLoaded?.id || '<unknown>'}": ${registryResult.error}`,
        };
      }

      return {
        ok: true,
        components: registryResult.registry.components,
      };
    },
  });

  result.ok = result.errors.length === 0;

  return result;
}

module.exports = {
  runDoctor,
};
