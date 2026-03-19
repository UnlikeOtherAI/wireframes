'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { runValidate } = require(path.resolve(__dirname, '..', 'validate'));
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));

const OVERLAY_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const OVERLAY_TYPES = new Set([
  'dropdown',
  'popover',
  'menu',
  'modal',
  'drawer_left',
  'drawer_right',
  'bottom_sheet',
  'toast',
  'alert',
  'tooltip',
]);
const OVERLAYS_REQUIRING_TRIGGER = new Set(['dropdown', 'popover', 'menu', 'tooltip']);
const OVERLAY_PLACEMENTS = new Set(['top', 'bottom', 'left', 'right', 'center']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isValidId(value) {
  return typeof value === 'string' && OVERLAY_ID_REGEX.test(value);
}

function parseYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function pagesDirPath(projectPath) {
  return path.join(projectPath, 'pages');
}

function pageFilePath(projectPath, pageId) {
  return path.join(pagesDirPath(projectPath), `${pageId}.yaml`);
}

function templatesFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function ensureOverlayList(container, contextLabel) {
  if (!isObject(container)) {
    return { ok: false, error: `${contextLabel} is invalid or missing.` };
  }

  if (!Array.isArray(container.overlays)) {
    if (container.overlays == null) {
      container.overlays = [];
    } else {
      return { ok: false, error: `${contextLabel} overlays must be an array.` };
    }
  }

  return { ok: true, list: container.overlays };
}

function collectOverlayIds(overlays) {
  const ids = new Set();
  if (!Array.isArray(overlays)) {
    return ids;
  }

  for (const overlay of overlays) {
    if (isObject(overlay) && typeof overlay.id === 'string') {
      ids.add(overlay.id);
    }
  }

  return ids;
}

function listOverlaysBySource(overlays, source) {
  if (!Array.isArray(overlays)) {
    return [];
  }

  return overlays
    .filter((overlay) => isObject(overlay) && typeof overlay.id === 'string')
    .map((overlay) => ({
      id: overlay.id,
      type: overlay.type,
      source,
      trigger: overlay.trigger,
      placement: overlay.placement,
    }));
}

function buildOverlayScaffold({ overlayId, type, trigger, placement }) {
  const overlay = {
    id: overlayId,
    type,
    content: [],
  };

  if (trigger) {
    overlay.trigger = trigger;
  }

  if (placement) {
    overlay.placement = placement;
  }

  return overlay;
}

function validateOverlayCreationOptions({ overlayId, type, trigger, placement }) {
  const normalizedType = typeof type === 'string' ? type.trim() : '';
  const normalizedTrigger = trigger == null ? null : trigger.trim();
  const normalizedPlacement = placement == null ? null : placement.trim();

  if (!isValidId(overlayId)) {
    return {
      ok: false,
      error: `Invalid overlay id "${overlayId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  if (!OVERLAY_TYPES.has(normalizedType)) {
    return {
      ok: false,
      error: `Invalid overlay type "${type}". Allowed values: ${Array.from(OVERLAY_TYPES).join(', ')}.`,
    };
  }

  if (normalizedPlacement != null && !OVERLAY_PLACEMENTS.has(normalizedPlacement)) {
    return {
      ok: false,
      error: `Invalid overlay placement "${normalizedPlacement}". Allowed values: ${Array.from(OVERLAY_PLACEMENTS).join(', ')}.`,
    };
  }

  if (OVERLAYS_REQUIRING_TRIGGER.has(normalizedType)) {
    if (!isValidId(normalizedTrigger)) {
      return { ok: false, error: `Overlay type "${normalizedType}" requires --trigger.` };
    }

    if (!normalizedPlacement) {
      return {
        ok: false,
        error: `Overlay type "${normalizedType}" requires --placement.`,
      };
    }
  }

  if (normalizedTrigger != null && !isValidId(normalizedTrigger)) {
    return {
      ok: false,
      error: `Invalid trigger id "${normalizedTrigger}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  return {
    ok: true,
    type: normalizedType,
    trigger: normalizedTrigger,
    placement: normalizedPlacement,
  };
}

function loadTemplate(projectPath, templateId) {
  const loaded = loadDocumentFromFile(templatesFilePath(projectPath), { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const template = loaded.document?.templates?.[templateId];
  if (!isObject(template)) {
    return { ok: false, error: `Template "${templateId}" does not exist.` };
  }

  return {
    ok: true,
    loaded,
    template,
    filePath: loaded.absolutePath,
    templates: loaded.document?.templates || {},
  };
}

function loadPage(projectPath, pageId) {
  const filePath = pageFilePath(projectPath, pageId);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Page "${pageId}" does not exist.`, path: filePath };
  }

  const loaded = loadDocumentFromFile(filePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const page = loaded.document?.page;
  if (!isObject(page)) {
    return { ok: false, error: `Page "${pageId}" is missing a page section.`, path: filePath };
  }

  return { ok: true, loaded, page, filePath };
}

function findPagesByTemplate(projectPath, templateId) {
  const pagesPath = pagesDirPath(projectPath);
  if (!fs.existsSync(pagesPath) || !fs.statSync(pagesPath).isDirectory()) {
    return [];
  }

  const pageFiles = fs.readdirSync(pagesPath).filter((entry) => entry.endsWith('.yaml') || entry.endsWith('.yml'));
  const pageIds = [];
  for (const fileName of pageFiles) {
    const doc = parseYaml(path.join(pagesPath, fileName));
    if (doc?.page?.template === templateId && isValidId(doc?.page?.id)) {
      pageIds.push(doc.page.id);
    }
  }

  return pageIds;
}

function mutateAndValidate(projectPath, targetPath, mutate) {
  const previous = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;

  try {
    mutate();
  } catch (error) {
    if (previous != null) {
      fs.writeFileSync(targetPath, previous, 'utf8');
    }
    return { ok: false, error: error.message };
  }

  const validateResult = runValidate({ projectPath });
  if (!validateResult.ok) {
    if (previous != null) {
      fs.writeFileSync(targetPath, previous, 'utf8');
    } else if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }

    return {
      ok: false,
      error: 'Validation failed after mutation.',
      details: {
        errors: validateResult.errors,
        warnings: validateResult.warnings,
      },
    };
  }

  return { ok: true };
}

module.exports = {
  OVERLAY_ID_REGEX,
  OVERLAY_TYPES,
  OVERLAY_PLACEMENTS,
  OVERLAYS_REQUIRING_TRIGGER,
  buildOverlayScaffold,
  collectOverlayIds,
  ensureOverlayList,
  findPagesByTemplate,
  isObject,
  isValidId,
  listOverlaysBySource,
  loadPage,
  pageFilePath,
  loadTemplate,
  mutateAndValidate,
  parseYaml,
  validateOverlayCreationOptions,
  writeYaml,
};
