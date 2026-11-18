'use strict';

const path = require('node:path');
const { loadProjectComponentRegistry } = require(path.resolve(__dirname, '..', 'component-registry'));
const { resolveAuthoredComponent } = require(path.resolve(__dirname, '..', 'component-registry', 'definition-lookup'));
const { projectFileTarget } = require(path.resolve(__dirname, '..', 'component-registry', 'project-file'));
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
  const { parseAddress, buildPageRoots, buildTemplateRoots, isObject, SUPPORTED_DOCTYPES } = core();
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

  return resolveComponentAddress(projectPath, parsed);
}

function displayPath(projectPath, filePath) {
  return path.relative(projectPath, filePath).split(path.sep).join('/');
}

/**
 * A component address resolves the way a `use:` does: through the project
 * registry, so a `std.<name>` the project defines (under a `std` alias) is the
 * project's, read from and written to the file that defines it. Only an id the
 * project lacks falls back to a built-in pattern, and that one is read-only.
 */
function resolveComponentAddress(projectPath, parsed) {
  const { buildComponentRootsFromMap, isObject } = core();
  const componentId = parsed.documentId;
  const located = {
    segments: parsed.pathSegments,
    rawAddress: parsed.raw,
    documentType: 'component',
    documentId: componentId,
  };

  const loadedRegistry = loadProjectComponentRegistry(projectPath);
  if (!loadedRegistry.ok) {
    return { ok: false, error: `Unable to load project components: ${loadedRegistry.error}` };
  }
  const { components, sources } = loadedRegistry.registry;

  if (!Object.hasOwn(components, componentId)) {
    const builtin = resolveAuthoredComponent(componentId, components);
    if (!builtin) return { ok: false, error: `Component "${componentId}" does not exist.` };
    const builtinResult = buildComponentRootsFromMap({ [componentId]: structuredClone(builtin) }, componentId);
    if (!builtinResult.ok) return builtinResult;
    return {
      ok: true,
      ...located,
      documentPath: null,
      document: null,
      readOnly: builtinCopyHint(componentId),
      roots: builtinResult.roots,
    };
  }

  // The registry holds rewritten copies; the roots come from the authored document.
  const source = sources[componentId];
  const loaded = loadDocumentFromFile(source.sourcePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  const authored = isObject(loaded.document?.components) ? loaded.document.components[source.localId] : null;
  const componentsResult = buildComponentRootsFromMap({ [componentId]: authored }, componentId);
  if (!componentsResult.ok) return componentsResult;

  const target = projectFileTarget(projectPath, source.sourcePath);
  return {
    ok: true,
    ...located,
    documentPath: source.sourcePath,
    document: loaded.document,
    ...(target.inside ? {} : {
      readOnly: `Component "${componentId}" is defined in ${displayPath(projectPath, source.sourcePath)}, outside the project. `
        + 'wf only writes files inside the project; edit that file directly.',
    }),
    roots: componentsResult.roots,
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
