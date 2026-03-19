'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const PAGE_ID_REGEX = /^[a-z][a-z0-9_]*$/;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function collectStateKeys(state, prefix, keys) {
  if (!isObject(state)) {
    if (prefix) {
      keys.add(prefix);
    }
    return;
  }

  if (prefix) {
    keys.add(prefix);
  }

  for (const [segment, value] of Object.entries(state)) {
    const nextPrefix = prefix ? `${prefix}.${segment}` : segment;
    if (isObject(value)) {
      collectStateKeys(value, nextPrefix, keys);
      continue;
    }

    keys.add(nextPrefix);
  }
}

function readYaml(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
  } catch {
    return null;
  }
}

function sitemapPath(projectPath) {
  return path.join(projectPath, 'sitemap.yaml');
}

function pageFilePath(projectPath, pageId) {
  return path.join(projectPath, 'pages', `${pageId}.yaml`);
}

function pagesDirectory(projectPath) {
  return path.join(projectPath, 'pages');
}

function readAppState(projectPath) {
  const parsed = readYaml(sitemapPath(projectPath));
  if (!parsed) {
    return { ok: false, error: `Invalid YAML in ${sitemapPath(projectPath)}` };
  }

  if (parsed.documentType !== 'sitemap') {
    return { ok: false, error: 'Invalid sitemap document type.' };
  }

  const container = isObject(parsed.sitemap) ? parsed.sitemap : {};
  const appState = isObject(container.appState) ? container.appState : (isObject(parsed.appState) ? parsed.appState : null);

  return {
    ok: true,
    appState,
  };
}

function readPageState(projectPath, pageId) {
  if (!PAGE_ID_REGEX.test(pageId)) {
    return {
      ok: false,
      error: `Invalid page id "${pageId}". Use snake_case alpha-numeric with underscores starting with a letter.`,
    };
  }

  const filePath = pageFilePath(projectPath, pageId);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Page "${pageId}" does not exist.` };
  }

  const parsed = readYaml(filePath);
  if (!parsed) {
    return { ok: false, error: `Invalid YAML in ${filePath}` };
  }

  if (parsed.documentType !== 'page') {
    return { ok: false, error: `Invalid page document type for "${pageId}".` };
  }

  return {
    ok: true,
    pageId: parsed?.page?.id || pageId,
    pageState: isObject(parsed?.page?.pageState) ? parsed.page.pageState : null,
  };
}

function listAllPageStateKeys(projectPath) {
  const pagesPath = pagesDirectory(projectPath);
  const pageEntries = fs.existsSync(pagesPath) && fs.statSync(pagesPath).isDirectory()
    ? fs.readdirSync(pagesPath).filter((entry) => entry.endsWith('.yaml') || entry.endsWith('.yml'))
    : [];

  const allKeys = new Set();

  for (const entry of pageEntries) {
    const pageId = path.basename(entry, path.extname(entry));
    const result = readPageState(projectPath, pageId);
    if (!result.ok) {
      return result;
    }

    if (!result.pageState) {
      continue;
    }

    collectStateKeys(result.pageState, '', allKeys);
  }

  return { ok: true, keys: allKeys };
}

function listStateKeys({ projectPath, scope = 'all', page }) {
  if (scope === 'app') {
    const appResult = readAppState(projectPath);
    if (!appResult.ok) {
      return appResult;
    }

    const keys = new Set();
    if (appResult.appState) {
      collectStateKeys(appResult.appState, '', keys);
    }

    return {
      ok: true,
      scope,
      keys: Array.from(keys).sort(),
    };
  }

  if (scope === 'page') {
    if (!page) {
      return {
        ok: false,
        error: '--scope page requires --page <pageId>.',
      };
    }

    const pageResult = readPageState(projectPath, page);
    if (!pageResult.ok) {
      return pageResult;
    }

    const keys = new Set();
    if (pageResult.pageState) {
      collectStateKeys(pageResult.pageState, '', keys);
    }

    return {
      ok: true,
      scope: 'page',
      page: pageResult.pageId,
      keys: Array.from(keys).sort(),
    };
  }

  if (scope !== 'all') {
    return { ok: false, error: `Invalid scope "${scope}". Allowed values: app, page.` };
  }

  const keys = new Set();

  const appResult = readAppState(projectPath);
  if (!appResult.ok) {
    return appResult;
  }
  if (appResult.appState) {
    collectStateKeys(appResult.appState, '', keys);
  }

  const pageResult = listAllPageStateKeys(projectPath);
  if (!pageResult.ok) {
    return pageResult;
  }
  for (const key of pageResult.keys) {
    keys.add(key);
  }

  return {
    ok: true,
    scope: 'all',
    keys: Array.from(keys).sort(),
  };
}

module.exports = {
  listStateKeys,
  collectStateKeys,
};
