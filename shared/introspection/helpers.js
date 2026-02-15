'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

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

module.exports = {
  ID_REGEX,
  collectComponents,
  collectNodeComponentUsages,
  collectPages,
  collectTemplateComponentUsages,
  collectTemplates,
  componentsFilePath,
  dataFilePath,
  isObject,
  isYamlFile,
  normalizeId,
  pageFilePath,
  readYaml,
  sitemapFilePath,
  templatesFilePath,
};
