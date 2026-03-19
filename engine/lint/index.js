'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { runDoctor } = require(path.resolve(__dirname, '..', 'doctor'));

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

function addDiagnostic(result, severity, code, message) {
  result[severity].push({
    code,
    message,
  });
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isYamlFile(fileName) {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}

function isSnakeCase(value) {
  return /^[a-z][a-z0-9_]*$/.test(value);
}

function isAmbiguous(value) {
  return /^_/.test(value) || /_$/.test(value) || /__/.test(value);
}

function validateIdentifier(result, context, id) {
  if (!isObject(result) || typeof id !== 'string') {
    return;
  }

  if (/[A-Z]/.test(id)) {
    addDiagnostic(
      result,
      'warnings',
      'UPPERCASE_ID',
      `${context}: ID "${id}" contains uppercase characters.`,
    );
  }

  if (!isSnakeCase(id)) {
    addDiagnostic(
      result,
      'warnings',
      'INVALID_ID_FORMAT',
      `${context}: ID "${id}" is not snake_case.`,
    );
    return;
  }

  if (isAmbiguous(id)) {
    addDiagnostic(
      result,
      'warnings',
      'AMBIGUOUS_ID',
      `${context}: ID "${id}" is ambiguous (leading/trailing or repeated underscore).`,
    );
  }

  if (RESERVED_KEYWORDS.has(id)) {
    addDiagnostic(
      result,
      'warnings',
      'RESERVED_KEYWORD',
      `${context}: ID "${id}" uses a reserved keyword.`,
    );
  }
}

function validateNodeIds(result, node, context, includeUsage) {
  if (!isObject(node)) {
    return;
  }

  if (typeof node.id === 'string') {
    validateIdentifier(result, context, node.id);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      validateNodeIds(result, child, `${context} > ${node.id ?? 'node'}`, includeUsage);
    }
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      validateNodeIds(result, child, context, includeUsage);
    }
  }
}

function loadYamlSafe(filePath, result) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return yaml.load(content);
  } catch (error) {
    addDiagnostic(result, 'errors', 'INVALID_YAML', `Invalid YAML in ${filePath}: ${error.message}`);
    return null;
  }
}

function collectLintTargets(projectPath, result) {
  const root = path.resolve(projectPath);
  const manifestPath = path.join(root, 'manifest.yaml');
  const sitemapPath = path.join(root, 'sitemap.yaml');
  const templatesPath = path.join(root, 'templates.yaml');
  const componentsPath = path.join(root, 'components.yaml');
  const dataPath = path.join(root, 'data');
  const pagesPath = path.join(root, 'pages');

  const manifest = loadYamlSafe(manifestPath, result);
  const sitemap = loadYamlSafe(sitemapPath, result);
  const templates = loadYamlSafe(templatesPath, result);
  const components = loadYamlSafe(componentsPath, result);

  const routeEntries = sitemap?.sitemap?.routes || [];
  for (const route of routeEntries) {
    if (route && typeof route.id === 'string') {
      validateIdentifier(result, 'route', route.id);
    }
  }

  if (manifest?.manifest?.projectId) {
    validateIdentifier(result, 'manifest', manifest.manifest.projectId);
  }

  const templatesMap = templates?.templates || {};
  for (const [templateId, templateDoc] of Object.entries(templatesMap)) {
    validateIdentifier(result, `template "${templateId}"`, templateId);
    if (!isObject(templateDoc)) {
      continue;
    }
    const regions = Array.isArray(templateDoc.regions) ? templateDoc.regions : [];
    for (const region of regions) {
      if (region && typeof region.id === 'string') {
        validateIdentifier(result, `template "${templateId}" region`, region.id);
      }
      validateNodeIds(result, region, `template "${templateId}" region`, {});
    }
    if (Array.isArray(templateDoc.overlays)) {
      for (const overlay of templateDoc.overlays) {
        if (!isObject(overlay)) {
          continue;
        }
        if (typeof overlay.id === 'string') {
          validateIdentifier(result, `template "${templateId}" overlay`, overlay.id);
        }
        validateNodeIds(result, overlay, `template "${templateId}" overlay`, {});
      }
    }
  }

  const componentMap = components?.components || {};
  for (const [componentId, componentDoc] of Object.entries(componentMap)) {
    validateIdentifier(result, `component "${componentId}"`, componentId);
    if (isObject(componentDoc) && isObject(componentDoc.root)) {
      validateNodeIds(result, componentDoc.root, `component "${componentId}" root`, {});
    }
  }

  const datasetFiles = fs.existsSync(dataPath) ? fs.readdirSync(dataPath).filter(isYamlFile).sort() : [];
  for (const datasetFile of datasetFiles) {
    const datasetDoc = loadYamlSafe(path.join(dataPath, datasetFile), result);
    if (!datasetDoc) {
      continue;
    }
    if (typeof datasetDoc.id === 'string') {
      validateIdentifier(result, `dataset "${datasetDoc.id}"`, datasetDoc.id);
    }
  }

  const pageFiles = fs.existsSync(pagesPath) ? fs.readdirSync(pagesPath).filter(isYamlFile).sort() : [];
  for (const pageFile of pageFiles) {
    const pageDoc = loadYamlSafe(path.join(pagesPath, pageFile), result);
    if (!pageDoc?.page || !isObject(pageDoc.page)) {
      continue;
    }
    const pageData = pageDoc.page;
    if (typeof pageData.id === 'string') {
      validateIdentifier(result, 'page', pageData.id);
    }
    if (Array.isArray(pageData.slots)) {
      for (const slot of pageData.slots) {
        if (isObject(slot) && typeof slot.slotId === 'string') {
          validateIdentifier(result, `page "${pageData.id}" slot`, slot.slotId);
          if (Array.isArray(slot.content)) {
            for (const node of slot.content) {
              validateNodeIds(result, node, `page "${pageData.id}" slot "${slot.slotId}"`, {});
            }
          }
        }
      }
    }
    if (Array.isArray(pageData.injectables)) {
      for (const injectable of pageData.injectables) {
        if (isObject(injectable) && typeof injectable.injectableId === 'string') {
          validateIdentifier(result, `page "${pageData.id}" injectable`, injectable.injectableId);
          if (Array.isArray(injectable.content)) {
            for (const node of injectable.content) {
              validateNodeIds(result, node, `page "${pageData.id}" injectable "${injectable.injectableId}"`, {});
            }
          }
        }
      }
    }
    if (Array.isArray(pageData.overlays)) {
      for (const overlay of pageData.overlays) {
        if (!isObject(overlay)) {
          continue;
        }
        if (typeof overlay.id === 'string') {
          validateIdentifier(result, `page "${pageData.id}" overlay`, overlay.id);
        }
        if (Array.isArray(overlay.content)) {
          for (const node of overlay.content) {
            validateNodeIds(result, node, `page "${pageData.id}" overlay "${overlay.id}"`, {});
          }
        }
      }
    }
    if (isObject(pageData.actions)) {
      for (const actionId of Object.keys(pageData.actions)) {
        validateIdentifier(result, `page "${pageData.id}" action`, actionId);
      }
    }
  }
}

function promoteWarningsToErrors(result) {
  for (const warning of result.warnings) {
    result.errors.push({
      code: `STRICT_${warning.code ?? 'WARNING'}`,
      message: `[strict] ${warning.message}`,
    });
  }
  result.warnings = [];
}

function runLint({ projectPath, strict = false } = {}) {
  const result = runDoctor({ projectPath });

  if (result.errors.length === 0) {
    collectLintTargets(projectPath, result);
  }

  if (strict && result.warnings.length > 0) {
    promoteWarningsToErrors(result);
  }

  result.ok = result.errors.length === 0;
  return result;
}

module.exports = {
  runLint,
  promoteWarningsToErrors,
  RESERVED_KEYWORDS,
};
