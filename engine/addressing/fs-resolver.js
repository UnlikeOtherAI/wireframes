'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { resolveComponentDefinition } = require(path.resolve(__dirname, '..', 'component-registry', 'definition-lookup'));
const { builtinCopyHint } = require(path.resolve(__dirname, '..', 'stdlib'));
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema', 'loader'));

// Lazy require to avoid circular dependency (index.js re-exports from this file)
let _core;
function core() {
  if (!_core) _core = require('./index');
  return _core;
}

function pageFilePath(projectPath, pageId) {
  return path.join(projectPath, 'pages', `${pageId}.yaml`);
}

function templatesFilePath(projectPath) {
  return path.join(projectPath, 'templates.yaml');
}

function componentsFilePath(projectPath) {
  return path.join(projectPath, 'components.yaml');
}

function resolveAddress(projectPath, address) {
  const { parseAddress, buildPageRoots, buildTemplateRoots, buildComponentRootsFromMap, isObject, SUPPORTED_DOCTYPES } = core();
  const parsed = parseAddress(address);
  if (!parsed.ok) return parsed;

  if (!SUPPORTED_DOCTYPES.has(parsed.doctype)) {
    return { ok: false, error: `Unsupported address doctype "${parsed.doctype}".` };
  }

  if (parsed.doctype === 'page') {
    const pagePath = pageFilePath(projectPath, parsed.documentId);
    const loaded = loadDocumentFromFile(pagePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const rootsResult = buildPageRoots(loaded.document, loaded.id);
    if (!rootsResult.ok) return rootsResult;

    return {
      ok: true,
      documentPath: pagePath,
      document: loaded.document,
      roots: rootsResult.roots,
      segments: parsed.pathSegments,
      rawAddress: parsed.raw,
      documentType: 'page',
      documentId: parsed.documentId,
    };
  }

  if (parsed.doctype === 'template') {
    const tPath = templatesFilePath(projectPath);
    const loaded = loadDocumentFromFile(tPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const template = loaded.document?.templates?.[parsed.documentId];

    if (!isObject(template)) {
      return { ok: false, error: `Template "${parsed.documentId}" does not exist.` };
    }

    const rootsResult = buildTemplateRoots(template, parsed.documentId);
    if (!rootsResult.ok) return rootsResult;

    return {
      ok: true,
      documentPath: tPath,
      document: loaded.document,
      roots: rootsResult.roots,
      segments: parsed.pathSegments,
      rawAddress: parsed.raw,
      documentType: 'template',
      documentId: parsed.documentId,
    };
  }

  const cPath = componentsFilePath(projectPath);
  const loaded = fs.existsSync(cPath) || !resolveComponentDefinition(parsed.documentId, null)
    ? loadDocumentFromFile(cPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION })
    : null;
  const own = isObject(loaded?.document?.components) ? loaded.document.components : {};
  if (!Object.hasOwn(own, parsed.documentId)) {
    // A built-in std pattern is read-only: it can be inspected, never written.
    const builtin = resolveComponentDefinition(parsed.documentId, own);
    if (builtin) {
      const builtinResult = buildComponentRootsFromMap({ [parsed.documentId]: structuredClone(builtin) }, parsed.documentId);
      if (!builtinResult.ok) return builtinResult;
      return {
        ok: true,
        documentPath: null,
        document: null,
        readOnly: builtinCopyHint(parsed.documentId),
        roots: builtinResult.roots,
        segments: parsed.pathSegments,
        rawAddress: parsed.raw,
        documentType: 'component',
        documentId: parsed.documentId,
      };
    }
  }
  const componentsResult = buildComponentRootsFromMap(own, parsed.documentId);
  if (!componentsResult.ok) return componentsResult;

  return {
    ok: true,
    documentPath: cPath,
    document: loaded.document,
    roots: componentsResult.roots,
    segments: parsed.pathSegments,
    rawAddress: parsed.raw,
    documentType: 'component',
    documentId: parsed.documentId,
  };
}

function resolveTarget(projectPath, address) {
  return resolveAddress(projectPath, address);
}

module.exports = {
  resolveAddress,
  resolveTarget,
  pageFilePath,
  templatesFilePath,
  componentsFilePath,
};
