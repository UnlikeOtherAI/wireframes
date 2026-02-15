'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { SUPPORTED_SPEC_VERSION } = require('../schema/constants');
const { loadDocumentFromFile } = require('../schema');

const TEMPLATE_ID_REGEX = /^[a-z][a-z0-9_]*$/;

function templateFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function sitemapFilePath(projectPath) {
  return path.join(projectPath, 'sitemap.yaml');
}

function pagesDirPath(projectPath) {
  return path.join(projectPath, 'pages');
}

function isValidId(id) {
  return typeof id === 'string' && TEMPLATE_ID_REGEX.test(id);
}

function parseYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content) || {};
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function loadTemplatesProject(projectPath) {
  const templatesPath = templateFilePath(projectPath);
  const loaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const document = loaded.document || {};

  return {
    loaded,
    templates: document.templates || {},
    path: templatesPath,
  };
}

function listTemplates(projectPath) {
  const { templates } = loadTemplatesProject(projectPath);
  return Object.keys(templates).sort();
}

function buildTemplateScaffold(templateId) {
  return {
    layout: {
      type: 'stack',
    },
    regions: [
      {
        id: 'app_header',
        kind: 'persistent',
        children: [
          {
            id: 'page_title',
            component: 'text',
            props: {
              text: `${templateId}_title`,
            },
          },
          {
            id: 'page_actions',
            injectable: true,
          },
        ],
      },
      {
        id: 'main_content',
        kind: 'slot',
      },
    ],
  };
}

function findTemplateUsages(projectPath, templateId) {
  const usages = [];
  const routeUsages = [];
  const pageUsages = [];

  const sitemapPath = sitemapFilePath(projectPath);
  if (fs.existsSync(sitemapPath)) {
    const sitemapDoc = parseYaml(sitemapPath);
    const routes = sitemapDoc?.sitemap?.routes;

    if (Array.isArray(routes)) {
      for (const route of routes) {
        if (route?.template === templateId) {
          routeUsages.push(route.id ?? route.path ?? '<unknown>');
        }
      }
    }
  }

  const pagesPath = pagesDirPath(projectPath);
  if (fs.existsSync(pagesPath) && fs.statSync(pagesPath).isDirectory()) {
    const files = fs.readdirSync(pagesPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml'));

    for (const pageFile of files) {
      const pageDoc = parseYaml(path.join(pagesPath, pageFile));
      const pageId = pageDoc?.page?.id;
      if (pageDoc?.page?.template === templateId) {
        pageUsages.push(pageId ?? pageFile);
      }
    }
  }

  return {
    routeUsages,
    pageUsages,
    usages: [...routeUsages, ...pageUsages],
  };
}

function addTemplate({ projectPath, templateId }) {
  if (!isValidId(templateId)) {
    return {
      ok: false,
      error: `Invalid template id "${templateId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const { templates, path: templatesPath } = loadTemplatesProject(projectPath);
  if (templates[templateId]) {
    return {
      ok: false,
      error: `Template "${templateId}" already exists.`,
      usedId: templateId,
    };
  }

  const loaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  loaded.document.templates = templates;
  loaded.document.templates[templateId] = buildTemplateScaffold(templateId);
  writeYaml(templatesPath, loaded.document);

  return {
    ok: true,
    templateId,
  };
}

function removeTemplate({ projectPath, templateId }) {
  if (!isValidId(templateId)) {
    return {
      ok: false,
      error: `Invalid template id "${templateId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const { templates, path: templatesPath } = loadTemplatesProject(projectPath);
  const usage = findTemplateUsages(projectPath, templateId);
  if (usage.usages.length > 0) {
    return {
      ok: false,
      error: `Template "${templateId}" is in use and cannot be removed.`,
      details: usage,
    };
  }

  if (!templates[templateId]) {
    return {
      ok: false,
      error: `Template "${templateId}" does not exist.`,
    };
  }

  delete templates[templateId];

  const loaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  loaded.document.templates = templates;
  writeYaml(templatesPath, loaded.document);

  return {
    ok: true,
    templateId,
  };
}

module.exports = {
  addTemplate,
  removeTemplate,
  listTemplates,
  buildTemplateScaffold,
  findTemplateUsages,
};
