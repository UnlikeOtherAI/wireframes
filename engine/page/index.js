'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { SUPPORTED_SPEC_VERSION, DEFAULT_SPEC_VERSION } = require('../schema/constants');
const { loadDocumentFromFile } = require('../schema/loader');

const PAGE_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const DEVICE_VALUES = new Set(['mobile', 'tablet', 'web']);
const ORIENTATION_VALUES = new Set(['portrait', 'landscape']);

function isValidId(id) {
  return typeof id === 'string' && PAGE_ID_REGEX.test(id);
}

function isValidDevice(device) {
  return typeof device === 'string' && DEVICE_VALUES.has(device);
}

function isValidOrientation(orientation) {
  return typeof orientation === 'string' && ORIENTATION_VALUES.has(orientation);
}

function pagesDirPath(projectPath) {
  return path.join(projectPath, 'pages');
}

function pageFilePath(projectPath, pageId) {
  return path.join(pagesDirPath(projectPath), `${pageId}.yaml`);
}

function sitemapFilePath(projectPath) {
  return path.join(projectPath, 'sitemap.yaml');
}

function manifestFilePath(projectPath) {
  return path.join(projectPath, 'manifest.yaml');
}

function templatesFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function parseYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function normalizeSlotContent(input) {
  if (input == null) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  return null;
}

function buildViewport(device, orientation) {
  if (device === 'web') {
    return { device: 'web' };
  }

  const defaultOrientation = device === 'mobile' ? 'portrait' : 'landscape';
  return {
    device,
    orientation: orientation || defaultOrientation,
  };
}

function getTemplateSlots(templateDoc) {
  const regions = Array.isArray(templateDoc?.regions) ? templateDoc.regions : [];
  const slotIds = [];

  for (const region of regions) {
    if (region && typeof region === 'object' && region.kind === 'slot' && typeof region.id === 'string') {
      slotIds.push(region.id);
    }
  }

  return slotIds;
}

function loadTemplateById(projectPath, templateId) {
  const templatesPath = templatesFilePath(projectPath);
  const templatesLoaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const template = templatesLoaded.document?.templates?.[templateId];
  return {
    templatesLoaded,
    template,
  };
}

function resolveSlots(templateSlots, slots = []) {
  const provided = new Map();

  if (Array.isArray(slots)) {
    for (const slot of slots) {
      if (!slot || typeof slot !== 'object' || typeof slot.slotId !== 'string') {
        return {
          ok: false,
          error: 'Each slot override must be an object with a slotId string.',
        };
      }

      const normalizedContent = normalizeSlotContent(slot.content);
      if (normalizedContent === null) {
        return {
          ok: false,
          error: `Slot "${slot.slotId}" content must be an array.`,
        };
      }

      provided.set(slot.slotId, normalizedContent);
    }
  }

  const unknownSlots = [];
  for (const slotId of provided.keys()) {
    if (!templateSlots.includes(slotId)) {
      unknownSlots.push(slotId);
    }
  }

  if (unknownSlots.length > 0) {
    return {
      ok: false,
      error: `Unknown template slot(s): ${unknownSlots.join(', ')}`,
    };
  }

  return {
    ok: true,
    slots: templateSlots.map((slotId) => ({
      slotId,
      content: provided.has(slotId) ? provided.get(slotId) : [],
    })),
  };
}

function getDefaultWireframeStyleFromManifest(projectPath) {
  const manifestPath = manifestFilePath(projectPath);
  const manifestLoaded = loadDocumentFromFile(manifestPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const manifestWireframeStyle = manifestLoaded.document?.manifest?.defaultWireframeStyle;

  return manifestWireframeStyle && manifestWireframeStyle.border && manifestWireframeStyle.border.style
    ? manifestWireframeStyle
    : {
      border: {
        style: 'solid',
      },
    };
}

function listPages(projectPath) {
  const pagesPath = pagesDirPath(projectPath);
  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return [];
  }

  const files = fs.readdirSync(pagesPath).filter((fileName) => fileName.endsWith('.yaml') || fileName.endsWith('.yml'));
  const ids = [];

  for (const fileName of files) {
    const doc = parseYaml(path.join(pagesPath, fileName));
    const pageId = doc?.page?.id;
    if (typeof pageId === 'string' && isValidId(pageId)) {
      ids.push(pageId);
    }
  }

  return ids.sort();
}

function addPage({
  projectPath,
  pageId,
  path: routePath,
  templateId,
  device,
  orientation,
  slots,
  wireframeStyle,
}) {
  const normalizedPageId = typeof pageId === 'string' ? pageId.trim() : '';
  const normalizedPath = typeof routePath === 'string' ? routePath.trim() : '';
  const normalizedTemplate = typeof templateId === 'string' ? templateId.trim() : '';
  const normalizedDevice = typeof device === 'string' ? device.trim() : '';
  const normalizedOrientation = typeof orientation === 'string' ? orientation.trim() : '';

  if (!isValidId(normalizedPageId)) {
    return {
      ok: false,
      error: `Invalid page id "${pageId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  if (typeof normalizedPath !== 'string' || normalizedPath === '' || !normalizedPath.startsWith('/')) {
    return {
      ok: false,
      error: `Invalid path "${routePath}". Use a non-empty absolute path string like "/settings".`,
    };
  }

  if (!isValidId(normalizedTemplate)) {
    return {
      ok: false,
      error: `Invalid template id "${templateId}".`,
    };
  }

  if (!isValidDevice(normalizedDevice)) {
    return {
      ok: false,
      error: `Invalid device "${device}". Must be one of: mobile, tablet, web.`,
    };
  }

  const resolvedOrientation = (normalizedDevice === 'mobile' || normalizedDevice === 'tablet')
    ? (isValidOrientation(normalizedOrientation)
        ? normalizedOrientation
        : (normalizedDevice === 'mobile' ? 'portrait' : 'landscape'))
    : normalizedOrientation;

  const { template } = loadTemplateById(projectPath, normalizedTemplate);
  if (!template) {
    return {
      ok: false,
      error: `Template "${normalizedTemplate}" does not exist.`,
    };
  }

  const templateSlots = getTemplateSlots(template);
  const resolvedSlots = resolveSlots(templateSlots, slots);
  if (!resolvedSlots.ok) {
    return resolvedSlots;
  }

  const sitemapPath = sitemapFilePath(projectPath);
  const sitemapDoc = parseYaml(sitemapPath);
  const sitemap = sitemapDoc?.sitemap ?? {};
  const routes = Array.isArray(sitemap.routes) ? sitemap.routes : [];

  if (routes.some((route) => route?.path === normalizedPath)) {
    return {
      ok: false,
      error: `Route path "${normalizedPath}" already exists in sitemap.`,
    };
  }

  if (routes.some((route) => route?.id === normalizedPageId)) {
    return {
      ok: false,
      error: `Route id "${normalizedPageId}" already exists in sitemap.`,
    };
  }

  const existingPageFilePath = pageFilePath(projectPath, normalizedPageId);
  if (fs.existsSync(existingPageFilePath)) {
    return {
      ok: false,
      error: `Page "${normalizedPageId}" already exists.`,
    };
  }

  const defaultWireframeStyle = getDefaultWireframeStyleFromManifest(projectPath);
  const finalWireframeStyle = wireframeStyle && typeof wireframeStyle === 'object' ? wireframeStyle : defaultWireframeStyle;

  const nextRoute = {
    id: normalizedPageId,
    path: normalizedPath,
    page: normalizedPageId,
    template: normalizedTemplate,
  };

  routes.push(nextRoute);
  sitemapDoc.sitemap = {
    ...(sitemap || {}),
    routes,
  };
  writeYaml(sitemapPath, sitemapDoc);

  const pageDoc = {
    documentType: 'page',
    specVersion: DEFAULT_SPEC_VERSION,
    id: normalizedPageId,
    page: {
      id: normalizedPageId,
      template: normalizedTemplate,
      viewport: buildViewport(normalizedDevice, resolvedOrientation),
      wireframeStyle: finalWireframeStyle,
      slots: resolvedSlots.slots,
    },
  };

  fs.mkdirSync(pagesDirPath(projectPath), { recursive: true });
  writeYaml(existingPageFilePath, pageDoc);

  return {
    ok: true,
    pageId: normalizedPageId,
  };
}

function removePage({ projectPath, pageId }) {
  const normalizedPageId = typeof pageId === 'string' ? pageId.trim() : '';

  if (!isValidId(normalizedPageId)) {
    return {
      ok: false,
      error: `Invalid page id "${pageId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const targetPath = pageFilePath(projectPath, normalizedPageId);
  if (!fs.existsSync(targetPath)) {
    return {
      ok: false,
      error: `Page "${normalizedPageId}" does not exist.`,
    };
  }

  const sitemapPath = sitemapFilePath(projectPath);
  const sitemapDoc = parseYaml(sitemapPath);
  const routes = Array.isArray(sitemapDoc?.sitemap?.routes) ? sitemapDoc.sitemap.routes : [];
  const nextRoutes = routes.filter((route) => route?.page !== normalizedPageId);

  if (nextRoutes.length !== routes.length) {
    sitemapDoc.sitemap = {
      ...(sitemapDoc.sitemap || {}),
      routes: nextRoutes,
    };
    writeYaml(sitemapPath, sitemapDoc);
  }

  fs.unlinkSync(targetPath);

  return {
    ok: true,
    pageId: normalizedPageId,
  };
}

module.exports = {
  addPage,
  listPages,
  removePage,
};
