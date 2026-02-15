'use strict';

const {
  buildOverlayScaffold,
  collectOverlayIds,
  ensureOverlayList,
  findPagesByTemplate,
  isObject,
  isValidId,
  pageFilePath,
  listOverlaysBySource,
  loadPage,
  loadTemplate,
  mutateAndValidate,
  parseYaml,
  validateOverlayCreationOptions,
  writeYaml,
} = require('./overlay-utils');

function addOverlay({
  projectPath,
  targetId,
  overlayId,
  type,
  trigger,
  placement,
  template = false,
}) {
  const normalizedTargetId = typeof targetId === 'string' ? targetId.trim() : '';
  const normalizedOverlayId = typeof overlayId === 'string' ? overlayId.trim() : '';

  const options = validateOverlayCreationOptions({
    overlayId: normalizedOverlayId,
    type,
    trigger,
    placement,
  });
  if (!options.ok) {
    return options;
  }

  if (template) {
    const templateResult = loadTemplate(projectPath, normalizedTargetId);
    if (!templateResult.ok) {
      return templateResult;
    }

    const overlaysResult = ensureOverlayList(templateResult.template, `Template "${normalizedTargetId}"`);
    if (!overlaysResult.ok) {
      return overlaysResult;
    }

    const existingOverlayIds = collectOverlayIds(overlaysResult.list);
    if (existingOverlayIds.has(normalizedOverlayId)) {
      return {
        ok: false,
        error: `Overlay id "${normalizedOverlayId}" already exists in template "${normalizedTargetId}".`,
      };
    }

    const conflictingPages = findPagesByTemplate(projectPath, normalizedTargetId)
      .filter((pageId) => collectOverlayIds(parseYaml(pageFilePath(projectPath, pageId)).page?.overlays).has(normalizedOverlayId));

    if (conflictingPages.length > 0) {
      return {
        ok: false,
        error: `Overlay id "${normalizedOverlayId}" already exists on page(s): ${conflictingPages.join(', ')}.`,
      };
    }

    overlaysResult.list.push(
      buildOverlayScaffold({
        overlayId: normalizedOverlayId,
        type: options.type,
        trigger: options.trigger,
        placement: options.placement,
      }),
    );
    templateResult.templates[normalizedTargetId] = templateResult.template;
    const result = mutateAndValidate(projectPath, templateResult.filePath, () => {
      templateResult.loaded.document.templates = templateResult.templates;
      writeYaml(templateResult.filePath, templateResult.loaded.document);
    });

    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      overlayId: normalizedOverlayId,
      targetId: normalizedTargetId,
      targetType: 'template',
    };
  }

  const pageResult = loadPage(projectPath, normalizedTargetId);
  if (!pageResult.ok) {
    return pageResult;
  }

  const templateId = pageResult.page?.template;
  if (!isValidId(templateId)) {
    return {
      ok: false,
      error: `Page "${normalizedTargetId}" has an invalid template reference.`,
      path: pageResult.filePath,
    };
  }

  const templateResult = loadTemplate(projectPath, templateId);
  if (!templateResult.ok) {
    return templateResult;
  }

  const pageOverlaysResult = ensureOverlayList(pageResult.page, `Page "${normalizedTargetId}"`);
  if (!pageOverlaysResult.ok) {
    return pageOverlaysResult;
  }

  const pageOverlayIds = collectOverlayIds(pageOverlaysResult.list);
  const templateOverlayIds = collectOverlayIds(templateResult.template?.overlays);
  if (pageOverlayIds.has(normalizedOverlayId) || templateOverlayIds.has(normalizedOverlayId)) {
    return {
      ok: false,
      error: `Overlay id "${normalizedOverlayId}" already exists for page "${normalizedTargetId}".`,
    };
  }

  pageOverlaysResult.list.push(
    buildOverlayScaffold({
      overlayId: normalizedOverlayId,
      type: options.type,
      trigger: options.trigger,
      placement: options.placement,
    }),
  );

  const result = mutateAndValidate(projectPath, pageResult.filePath, () => {
    writeYaml(pageResult.filePath, pageResult.loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    overlayId: normalizedOverlayId,
    targetId: normalizedTargetId,
    targetType: 'page',
  };
}

function removeOverlay({ projectPath, targetId, overlayId, template = false }) {
  const normalizedTargetId = typeof targetId === 'string' ? targetId.trim() : '';
  const normalizedOverlayId = typeof overlayId === 'string' ? overlayId.trim() : '';

  if (!isValidId(normalizedTargetId) || !isValidId(normalizedOverlayId)) {
    return {
      ok: false,
      error: `Invalid ${!isValidId(normalizedTargetId) ? 'target' : 'overlay'} id "${!isValidId(normalizedTargetId)
        ? targetId
        : overlayId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  if (template) {
    const templateResult = loadTemplate(projectPath, normalizedTargetId);
    if (!templateResult.ok) {
      return templateResult;
    }

    const overlaysResult = ensureOverlayList(templateResult.template, `Template "${normalizedTargetId}"`);
    if (!overlaysResult.ok) {
      return overlaysResult;
    }

    const nextOverlays = overlaysResult.list.filter(
      (overlay) => !isObject(overlay) || overlay.id !== normalizedOverlayId,
    );
    if (nextOverlays.length === overlaysResult.list.length) {
      return {
        ok: false,
        error: `Overlay "${normalizedOverlayId}" does not exist on template "${normalizedTargetId}".`,
      };
    }

    templateResult.template.overlays = nextOverlays;
    const result = mutateAndValidate(projectPath, templateResult.filePath, () => {
      templateResult.loaded.document.templates = templateResult.templates;
      writeYaml(templateResult.filePath, templateResult.loaded.document);
    });
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      overlayId: normalizedOverlayId,
      targetId: normalizedTargetId,
      targetType: 'template',
    };
  }

  const pageResult = loadPage(projectPath, normalizedTargetId);
  if (!pageResult.ok) {
    return pageResult;
  }

  const pageOverlaysResult = ensureOverlayList(pageResult.page, `Page "${normalizedTargetId}"`);
  if (!pageOverlaysResult.ok) {
    return pageOverlaysResult;
  }

  const nextOverlays = pageOverlaysResult.list.filter(
    (overlay) => !isObject(overlay) || overlay.id !== normalizedOverlayId,
  );
  if (nextOverlays.length === pageOverlaysResult.list.length) {
    return {
      ok: false,
      error: `Overlay "${normalizedOverlayId}" does not exist on page "${normalizedTargetId}".`,
    };
  }

  pageResult.page.overlays = nextOverlays;
  const result = mutateAndValidate(projectPath, pageResult.filePath, () => {
    writeYaml(pageResult.filePath, pageResult.loaded.document);
  });
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    overlayId: normalizedOverlayId,
    targetId: normalizedTargetId,
    targetType: 'page',
  };
}

function listOverlays({ projectPath, targetId, template = false }) {
  const normalizedTargetId = typeof targetId === 'string' ? targetId.trim() : '';
  if (!isValidId(normalizedTargetId)) {
    return {
      ok: false,
      error: `Invalid target id "${targetId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  if (template) {
    const templateResult = loadTemplate(projectPath, normalizedTargetId);
    if (!templateResult.ok) {
      return templateResult;
    }

    return {
      ok: true,
      targetType: 'template',
      targetId: normalizedTargetId,
      overlays: listOverlaysBySource(templateResult.template.overlays, 'template'),
    };
  }

  const pageResult = loadPage(projectPath, normalizedTargetId);
  if (!pageResult.ok) {
    return pageResult;
  }

  const templateId = pageResult.page?.template;
  if (!isValidId(templateId)) {
    return {
      ok: false,
      error: `Page "${normalizedTargetId}" has an invalid template reference.`,
      path: pageResult.filePath,
    };
  }

  const templateResult = loadTemplate(projectPath, templateId);
  if (!templateResult.ok) {
    return templateResult;
  }

  const pageOverlays = listOverlaysBySource(pageResult.page.overlays, 'page');
  const templateOverlays = listOverlaysBySource(templateResult.template.overlays, 'template');
  return {
    ok: true,
    targetType: 'page',
    targetId: normalizedTargetId,
    templateId,
    pageOverlays,
    templateOverlays,
    overlays: [...pageOverlays, ...templateOverlays],
  };
}

module.exports = {
  addOverlay,
  listOverlays,
  removeOverlay,
};
