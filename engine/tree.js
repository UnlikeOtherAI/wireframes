'use strict';
const { loadDocumentFromFile } = require('./schema');
const { SUPPORTED_SPEC_VERSION } = require('./schema/constants');
const {
  pageFilePath,
  templatesFilePath,
} = require('./addressing');
const { listPages } = require('./page');
const { listTemplates } = require('./template');
const {
  loadComponentRegistryForDocuments,
  loadProjectComponentRegistry,
} = require('./component-registry');
const { resolveTemplatePage } = require('./resolver');
function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
function normalizeFilter(rawFilter) {
  if (rawFilter == null) {
    return null;
  }
  const value = String(rawFilter).trim().toLowerCase();
  return value.length > 0 ? value : null;
}
function loadDocument(filePath, expectedType) {
  try {
    const loaded = loadDocumentFromFile(filePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    if (expectedType && loaded.documentType !== expectedType) {
      return {
        ok: false,
        error: `Expected ${expectedType} document at ${filePath}, found ${loaded.documentType}.`,
      };
    }
    return { ok: true, loaded };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function loadComponentsForDocuments(projectPath, entries, label) {
  const registryResult = loadComponentRegistryForDocuments(projectPath, entries);
  if (!registryResult.ok) {
    return {
      ok: false,
      error: `Unable to load component registry${label ? ` for ${label}` : ''}: ${registryResult.error}`,
    };
  }

  return {
    ok: true,
    components: registryResult.registry.components,
  };
}

function resolveNodes(nodes, components) {
  const syntheticTemplate = {
    regions: [
      {
        id: '__tree_root__',
        kind: 'slot',
      },
    ],
  };
  const syntheticPage = {
    slots: [
      {
        slotId: '__tree_root__',
        content: Array.isArray(nodes) ? nodes : [],
      },
    ],
  };
  const resolved = resolveTemplatePage({
    template: syntheticTemplate,
    page: syntheticPage,
    components,
  });
  if (!resolved.ok) {
    return resolved;
  }
  const firstRoot = Array.isArray(resolved.roots) && resolved.roots.length > 0
    ? resolved.roots[0]
    : null;
  const resolvedNodes = Array.isArray(firstRoot?.nodes)
    ? firstRoot.nodes
    : Array.isArray(firstRoot?.children)
      ? firstRoot.children
      : [];
  return {
    ok: true,
    nodes: resolvedNodes,
  };
}
function buildOverlayRoots(overlays, components, source) {
  const list = [];
  if (!Array.isArray(overlays)) {
    return { ok: true, roots: list };
  }
  for (const overlay of overlays) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }
    const resolvedOverlay = resolveNodes(overlay.content, components);
    if (!resolvedOverlay.ok) {
      return { ok: false, error: resolvedOverlay.error, target: overlay.id };
    }
    list.push({
      id: overlay.id,
      kind: 'overlay',
      type: overlay.type,
      trigger: overlay.trigger,
      placement: overlay.placement,
      dismissOn: overlay.dismissOn,
      size: isObject(overlay.size) ? overlay.size : undefined,
      source,
      nodes: resolvedOverlay.nodes,
      wireframeStyle: isObject(overlay.wireframeStyle) ? overlay.wireframeStyle : undefined,
    });
  }
  return { ok: true, roots: list };
}
function buildPageTree(projectPath, pageId) {
  const pageFile = pageFilePath(projectPath, pageId);
  const pageLoaded = loadDocument(pageFile, 'page');
  if (!pageLoaded.ok) {
    return {
      ok: false,
      error: `Unable to load page "${pageId}": ${pageLoaded.error}`,
    };
  }
  const page = isObject(pageLoaded.loaded.document?.page) ? pageLoaded.loaded.document.page : null;
  if (!page) {
    return {
      ok: false,
      error: `Page "${pageId}" has no page payload.`,
    };
  }
  const templateId = page.template;
  if (typeof templateId !== 'string' || templateId.trim() === '') {
    return {
      ok: false,
      error: `Page "${pageId}" does not define a template.`,
    };
  }
  const templatesLoaded = loadDocument(templatesFilePath(projectPath), 'templates');
  if (!templatesLoaded.ok) {
    return {
      ok: false,
      error: `Unable to load templates.yaml for page "${pageId}": ${templatesLoaded.error}`,
    };
  }
  const template = templatesLoaded.loaded.document?.templates?.[templateId];
  if (!isObject(template)) {
    return {
      ok: false,
      error: `Page "${pageId}" references missing template "${templateId}".`,
    };
  }
  const componentRegistry = loadComponentsForDocuments(projectPath, [
    {
      documentPath: templatesLoaded.loaded.absolutePath,
      document: templatesLoaded.loaded.document,
    },
    {
      documentPath: pageLoaded.loaded.absolutePath,
      document: pageLoaded.loaded.document,
    },
  ], `page "${pageId}"`);
  if (!componentRegistry.ok) {
    return componentRegistry;
  }
  const resolved = resolveTemplatePage({
    template,
    page,
    components: componentRegistry.components,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
    };
  }
  const roots = Array.isArray(resolved.roots) ? [...resolved.roots] : [];
  const templateLayout = isObject(template.layout) ? template.layout : {};
  const bodyLayoutType = templateLayout.type === 'row' ? 'row' : 'stack';
  const templateOverlays = buildOverlayRoots(template.overlays, componentRegistry.components, 'template');
  if (!templateOverlays.ok) {
    return templateOverlays;
  }
  const pageOverlays = buildOverlayRoots(page.overlays, componentRegistry.components, 'page');
  if (!pageOverlays.ok) {
    return pageOverlays;
  }
  return {
    ok: true,
    trees: [
      {
        type: 'page',
        id: pageId,
        templateId,
        bodyLayoutType,
        roots: [
          ...roots,
          ...templateOverlays.roots,
          ...pageOverlays.roots,
        ],
      },
    ],
  };
}
function buildTemplateTree(projectPath, templateId) {
  const templatesLoaded = loadDocument(templatesFilePath(projectPath), 'templates');
  if (!templatesLoaded.ok) {
    return {
      ok: false,
      error: `Unable to load templates.yaml: ${templatesLoaded.error}`,
    };
  }
  const template = templatesLoaded.loaded.document?.templates?.[templateId];
  if (!isObject(template)) {
    return {
      ok: false,
      error: `Template "${templateId}" does not exist.`,
    };
  }
  const componentRegistry = loadComponentsForDocuments(projectPath, [
    {
      documentPath: templatesLoaded.loaded.absolutePath,
      document: templatesLoaded.loaded.document,
    },
  ], `template "${templateId}"`);
  if (!componentRegistry.ok) {
    return componentRegistry;
  }
  const resolved = resolveTemplatePage({
    template,
    page: {},
    components: componentRegistry.components,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
    };
  }
  const roots = Array.isArray(resolved.roots) ? [...resolved.roots] : [];
  const templateOverlays = buildOverlayRoots(template.overlays, componentRegistry.components, 'template');
  if (!templateOverlays.ok) {
    return templateOverlays;
  }
  return {
    ok: true,
    trees: [
      {
        type: 'template',
        id: templateId,
        roots: [
          ...roots,
          ...templateOverlays.roots,
        ],
      },
    ],
  };
}
function buildComponentTree(projectPath, componentId, components) {
  const component = components[componentId];
  if (!isObject(component) || !isObject(component.root)) {
    return {
      ok: false,
      error: `Component "${componentId}" does not exist.`,
    };
  }
  const resolved = resolveNodes(component.root, components);
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
    };
  }
  return {
    ok: true,
    trees: [
      {
        type: 'component',
        id: componentId,
        roots: [
          {
            id: componentId,
            kind: 'component-root',
            nodes: resolved.nodes,
          },
        ],
      },
    ],
  };
}
function matchesFilterValue(value, filter) {
  return typeof value === 'string' && value.toLowerCase().includes(filter);
}
function nodeMatchesFilter(node, filter) {
  if (!filter) {
    return true;
  }
  const propsText = isObject(node.props) ? node.props.text : undefined;
  return (
    matchesFilterValue(node.id, filter)
    || matchesFilterValue(node.component, filter)
    || matchesFilterValue(node.use, filter)
    || matchesFilterValue(propsText, filter)
  );
}
function formatNodeLabel(node) {
  if (!isObject(node)) {
    return '<invalid node>';
  }
  const nodeId = typeof node.id === 'string' ? node.id : '<unnamed>';
  if (typeof node.component === 'string') {
    return `${nodeId} (component:${node.component})`;
  }
  if (typeof node.use === 'string') {
    return `${nodeId} (use:${node.use})`;
  }
  if (node.injectable === true) {
    return `${nodeId} (injectable)`;
  }
  return nodeId;
}
function renderNode(node, depth, options) {
  const { depthLimit, filter } = options;
  const shouldCheckChildren = depthLimit == null || depth < depthLimit;
  const matched = nodeMatchesFilter(node, filter);
  const children = Array.isArray(node.children) ? node.children : [];
  let childLines = [];
  let hasMatch = false;
  if (shouldCheckChildren) {
    for (const child of children) {
      const childRender = renderNode(child, depth + 1, options);
      if (childRender.lines.length > 0) {
        childLines.push(...childRender.lines);
      }
      if (childRender.hasMatch) {
        hasMatch = true;
      }
    }
  }
  if (!matched && filter && !hasMatch) {
    return { lines: [], hasMatch: false };
  }
  const lines = [`${'  '.repeat(depth)}- ${formatNodeLabel(node)}`];
  if (childLines.length > 0) {
    lines.push(...childLines);
  }
  return { lines, hasMatch: true };
}
function formatContainerLabel(root) {
  if (root.kind === 'overlay') {
    return `${root.source === 'template' ? 'template' : 'page'} overlay: ${root.id}`;
  }
  if (root.kind === 'component-root') {
    return `component root: ${root.id}`;
  }
  return `${root.kind ?? 'container'}: ${root.id}`;
}
function renderTreeTrees(trees, options) {
  const lines = [];
  for (const tree of trees) {
    lines.push(`${tree.type}:${tree.id}`);
    if (!Array.isArray(tree.roots) || tree.roots.length === 0) {
      lines.push(`  (empty)`);
      continue;
    }
    for (const root of tree.roots) {
      const rootNodes = Array.isArray(root?.nodes)
        ? root.nodes
        : Array.isArray(root?.children)
          ? root.children
          : [];
      if (!isObject(root) || rootNodes.length === 0) {
        continue;
      }
      const rootLabel = formatContainerLabel(root);
      const childLines = [];
      let hasMatch = false;
      for (const child of rootNodes) {
        const childRender = renderNode(child, 1, options);
        if (childRender.lines.length > 0) {
          childLines.push(...childRender.lines);
        }
        if (childRender.hasMatch) {
          hasMatch = true;
        }
      }
      if (childLines.length === 0 && options.filter && !matchesFilterValue(root.id, options.filter)) {
        continue;
      }
      if (options.filter && !hasMatch && !matchesFilterValue(root.id, options.filter)) {
        continue;
      }
      lines.push(`  - ${rootLabel}`);
      lines.push(...childLines.map((entry) => `    ${entry}`));
    }
  }
  return lines;
}
function buildTreeTargets(options) {
  const targetType = options.targetType || 'all';
  const filter = normalizeFilter(options.filter);
  const depthLimit = Number.isInteger(options.depth) ? options.depth : null;
  const projectPath = options.projectPath;
  const projectRegistry = loadProjectComponentRegistry(projectPath);
  if (!projectRegistry.ok) {
    return { ok: false, error: `Unable to load project components: ${projectRegistry.error}` };
  }
  const components = projectRegistry.registry.components;
  if (!['page', 'template', 'component', 'all'].includes(targetType)) {
    return { ok: false, error: `Unknown tree target type "${targetType}".` };
  }
  if (targetType === 'page') {
    const pageIds = options.targetId ? [options.targetId] : listPages(projectPath);
    const trees = [];
    for (const pageId of pageIds) {
      const pageTree = buildPageTree(projectPath, pageId);
      if (!pageTree.ok) {
        return pageTree;
      }
      trees.push(...pageTree.trees);
    }
    return {
      ok: true,
      trees,
      depthLimit,
      filter,
    };
  }
  if (targetType === 'template') {
    const templateIds = options.targetId ? [options.targetId] : listTemplates(projectPath);
    const trees = [];
    for (const templateId of templateIds) {
      const templateTree = buildTemplateTree(projectPath, templateId);
      if (!templateTree.ok) {
        return templateTree;
      }
      trees.push(...templateTree.trees);
    }
    return { ok: true, trees, depthLimit, filter };
  }
  if (targetType === 'component') {
    const componentIds = options.targetId ? [options.targetId] : Object.keys(components).sort();
    const trees = [];
    for (const componentId of componentIds) {
      const componentTree = buildComponentTree(projectPath, componentId, components);
      if (!componentTree.ok) {
        return componentTree;
      }
      trees.push(...componentTree.trees);
    }
    return { ok: true, trees, depthLimit, filter };
  }
  const allTargets = [];
  const pageResult = buildTreeTargets({ ...options, targetType: 'page' });
  if (!pageResult.ok) {
    return pageResult;
  }
  for (const pageTree of pageResult.trees) {
    allTargets.push(pageTree);
  }
  const templateResult = buildTreeTargets({ ...options, targetType: 'template' });
  if (!templateResult.ok) {
    return templateResult;
  }
  for (const templateTree of templateResult.trees) {
    allTargets.push(templateTree);
  }
  const componentResult = buildTreeTargets({ ...options, targetType: 'component' });
  if (!componentResult.ok) {
    return componentResult;
  }
  for (const componentTree of componentResult.trees) {
    allTargets.push(componentTree);
  }
  return { ok: true, trees: allTargets, depthLimit, filter };
}
function buildTreeReport(options) {
  const result = buildTreeTargets(options);
  if (!result.ok) {
    return result;
  }
  const lines = renderTreeTrees(result.trees, {
    depthLimit: result.depthLimit,
    filter: result.filter,
  });
  return {
    ok: true,
    lines,
  };
}
module.exports = {
  buildTreeReport,
  buildTreeTargets,
};
