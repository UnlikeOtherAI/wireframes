'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema', 'loader'));

const COMPONENT_ID_REGEX = /^[a-z][a-z0-9_]*$/;

function componentsFilePath(projectPath) {
  return path.join(projectPath, 'components.yaml');
}

function isValidId(id) {
  return typeof id === 'string' && COMPONENT_ID_REGEX.test(id);
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function loadComponentsProject(projectPath) {
  const filePath = componentsFilePath(projectPath);
  const loaded = loadDocumentFromFile(filePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });

  return {
    loaded,
    components: loaded.document.components || {},
    path: filePath,
  };
}

function pagesDirPath(projectPath) {
  return path.join(projectPath, 'pages');
}

function templatesFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function walkNodes(node, callback) {
  if (!isObject(node)) {
    return;
  }

  callback(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNodes(child, callback);
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkNodes(child, callback);
    }
  }
}

function collectTemplateUsages(templates, componentId, usages) {
  if (!isObject(templates)) {
    return;
  }

  for (const [templateId, templateDocument] of Object.entries(templates)) {
    if (!isObject(templateDocument)) {
      continue;
    }

    const regions = Array.isArray(templateDocument.regions) ? templateDocument.regions : [];
    for (const region of regions) {
      if (!isObject(region)) {
        continue;
      }

      if (Array.isArray(region.children)) {
        for (const node of region.children) {
          walkNodes(node, (entry) => {
            if (entry.use === componentId) {
              usages.push(`template:${templateId}`);
            }
          });
        }
      }
    }

    const overlays = Array.isArray(templateDocument.overlays) ? templateDocument.overlays : [];
    for (const overlay of overlays) {
      if (!isObject(overlay) || !Array.isArray(overlay.content)) {
        continue;
      }

      for (const node of overlay.content) {
        walkNodes(node, (entry) => {
          if (entry.use === componentId) {
            usages.push(`template:${templateId}`);
          }
        });
      }
    }
  }
}

function collectPageUsages(projectPath, componentId, usages) {
  const pagesPath = pagesDirPath(projectPath);
  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return;
  }

  const pageFiles = fs.readdirSync(pagesPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml')).sort();

  for (const pageFile of pageFiles) {
    const pageDoc = parseYaml(path.join(pagesPath, pageFile));
    const pageId = pageDoc?.page?.id || pageFile;

    const slots = Array.isArray(pageDoc?.page?.slots) ? pageDoc.page.slots : [];
    for (const slot of slots) {
      if (!isObject(slot) || !Array.isArray(slot.content)) {
        continue;
      }

      for (const node of slot.content) {
        walkNodes(node, (entry) => {
          if (entry.use === componentId) {
            usages.push(`page:${pageId}`);
          }
        });
      }
    }

    const injectables = Array.isArray(pageDoc?.page?.injectables) ? pageDoc.page.injectables : [];
    for (const injectable of injectables) {
      if (!isObject(injectable) || !Array.isArray(injectable.content)) {
        continue;
      }

      for (const node of injectable.content) {
        walkNodes(node, (entry) => {
          if (entry.use === componentId) {
            usages.push(`page:${pageId}`);
          }
        });
      }
    }

    const overlays = Array.isArray(pageDoc?.page?.overlays) ? pageDoc.page.overlays : [];
    for (const overlay of overlays) {
      if (!isObject(overlay) || !Array.isArray(overlay.content)) {
        continue;
      }

      for (const node of overlay.content) {
        walkNodes(node, (entry) => {
          if (entry.use === componentId) {
            usages.push(`page:${pageId}`);
          }
        });
      }
    }
  }
}

function collectComponentUsages(components, componentId, usages) {
  for (const [componentName, componentDocument] of Object.entries(components)) {
    if (!isObject(componentDocument) || componentName === componentId) {
      continue;
    }

    const root = componentDocument.root;
    walkNodes(root, (entry) => {
      if (entry.use === componentId) {
        usages.push(`component:${componentName}`);
      }
    });
  }
}

function findComponentUsages(projectPath, componentId) {
  const usages = [];

  const componentsPath = componentsFilePath(projectPath);
  const componentsLoaded = loadDocumentFromFile(componentsPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const components = componentsLoaded.document.components || {};

  const templatesDoc = parseYaml(templatesFilePath(projectPath));
  collectTemplateUsages(templatesDoc?.templates, componentId, usages);

  collectPageUsages(projectPath, componentId, usages);

  collectComponentUsages(components, componentId, usages);

  return [...new Set(usages)];
}

function buildComponentScaffold(componentId) {
  return {
    root: {
      id: componentId,
      component: 'section',
    },
    propDefaults: {},
    propHints: {},
  };
}

function listComponents(projectPath) {
  const { components } = loadComponentsProject(projectPath);
  return Object.keys(components).sort();
}

function addComponent({ projectPath, componentId }) {
  const normalizedId = typeof componentId === 'string' ? componentId.trim() : '';

  if (!isValidId(normalizedId)) {
    return {
      ok: false,
      error: `Invalid component id "${componentId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const { components, loaded, path: filePath } = loadComponentsProject(projectPath);
  if (components[normalizedId]) {
    return {
      ok: false,
      error: `Component "${normalizedId}" already exists.`,
    };
  }

  loaded.document.components = components;
  loaded.document.components[normalizedId] = buildComponentScaffold(normalizedId);
  writeYaml(filePath, loaded.document);

  return {
    ok: true,
    componentId: normalizedId,
  };
}

function removeComponent({ projectPath, componentId }) {
  const normalizedId = typeof componentId === 'string' ? componentId.trim() : '';

  if (!isValidId(normalizedId)) {
    return {
      ok: false,
      error: `Invalid component id "${componentId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const { components, loaded, path: filePath } = loadComponentsProject(projectPath);
  const usages = findComponentUsages(projectPath, normalizedId);
  if (usages.length > 0) {
    return {
      ok: false,
      error: `Component "${normalizedId}" is in use and cannot be removed.`,
      details: {
        usages,
      },
    };
  }

  if (!components[normalizedId]) {
    return {
      ok: false,
      error: `Component "${normalizedId}" does not exist.`,
    };
  }

  delete components[normalizedId];
  loaded.document.components = components;
  writeYaml(filePath, loaded.document);

  return {
    ok: true,
    componentId: normalizedId,
  };
}

module.exports = {
  addComponent,
  listComponents,
  removeComponent,
  buildComponentScaffold,
};
