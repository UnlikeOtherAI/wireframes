'use strict';

const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));

const ADDRESS_PREFIX = 'wf://';
const WF_ID_REGEX = /^[a-z][a-z0-9_]*$/;

const PRIMITIVE_COMPONENTS = new Set([
  'heading',
  'paragraph',
  'text',
  'image',
  'button',
  'input',
  'textarea',
  'select',
  'checkbox',
  'toggle',
  'section',
  'divider',
  'spacer',
]);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(raw, label) {
  if (raw == null) {
    return {
      ok: false,
      error: `${label} requires a JSON value.`,
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(raw),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON for ${label}: ${error.message}`,
    };
  }
}

function ensureObject(value, label) {
  if (!isObject(value)) {
    return {
      ok: false,
      error: `${label} must be an object.`,
    };
  }

  return { ok: true, value };
}

function parseAddress(address) {
  if (typeof address !== 'string' || address.trim() === '') {
    return { ok: false, error: 'Address is required.' };
  }

  const trimmed = address.trim();
  if (!trimmed.startsWith(ADDRESS_PREFIX)) {
    return { ok: false, error: `Address must start with ${ADDRESS_PREFIX}.` };
  }

  const body = trimmed.slice(ADDRESS_PREFIX.length);
  const hashIndex = body.indexOf('#');
  if (hashIndex === -1 || hashIndex === body.length - 1) {
    return { ok: false, error: 'Address must include a #path segment.' };
  }

  const doctypePath = body.slice(0, hashIndex);
  const pathPart = body.slice(hashIndex + 1);
  const slashIndex = doctypePath.indexOf('/');
  if (slashIndex === -1 || slashIndex === doctypePath.length - 1) {
    return { ok: false, error: 'Address must be wf://<doctype>/<id>#<path>.' };
  }

  const segments = pathPart
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { ok: false, error: 'Address path is empty.' };
  }

  return {
    ok: true,
    doctype: doctypePath.slice(0, slashIndex),
    documentId: doctypePath.slice(slashIndex + 1),
    pathSegments: segments,
    raw: trimmed,
  };
}

function ensureArrayField(owner, fieldName, context) {
  const current = owner?.[fieldName];

  if (current == null) {
    owner[fieldName] = [];
    return { ok: true, value: owner[fieldName] };
  }

  if (!Array.isArray(current)) {
    return { ok: false, error: `${context} must be an array.` };
  }

  return { ok: true, value: current };
}

function buildPageRoots(pageDoc) {
  const page = pageDoc?.page;
  if (!isObject(page)) {
    return { ok: false, error: 'Target page document is missing a page section.' };
  }

  const roots = [];

  for (const slot of Array.isArray(page.slots) ? page.slots : []) {
    if (!isObject(slot) || typeof slot.slotId !== 'string' || slot.slotId.trim() === '') {
      continue;
    }

    const content = ensureArrayField(slot, 'content', `Page slot "${slot.slotId}" content`);
    if (!content.ok) return content;

    roots.push({ kind: 'slot', id: slot.slotId, nodes: content.value });
  }

  for (const injectable of Array.isArray(page.injectables) ? page.injectables : []) {
    if (!isObject(injectable) || typeof injectable.injectableId !== 'string' || injectable.injectableId.trim() === '') {
      continue;
    }

    const content = ensureArrayField(injectable, 'content', `Page injectable "${injectable.injectableId}" content`);
    if (!content.ok) return content;

    roots.push({ kind: 'injectable', id: injectable.injectableId, nodes: content.value });
  }

  for (const overlay of Array.isArray(page.overlays) ? page.overlays : []) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }

    const content = ensureArrayField(overlay, 'content', `Page overlay "${overlay.id}" content`);
    if (!content.ok) return content;

    roots.push({ kind: 'overlay', id: overlay.id, nodes: content.value });
  }

  return { ok: true, roots };
}

function buildTemplateRoots(template) {
  if (!isObject(template)) {
    return { ok: false, error: 'Target template is missing required properties.' };
  }

  const roots = [];

  for (const region of Array.isArray(template.regions) ? template.regions : []) {
    if (!isObject(region) || typeof region.id !== 'string' || region.id.trim() === '') {
      continue;
    }

    const children = ensureArrayField(region, 'children', `Template region "${region.id}" children`);
    if (!children.ok) return children;

    roots.push({ kind: 'region', id: region.id, nodes: children.value });
  }

  for (const overlay of Array.isArray(template.overlays) ? template.overlays : []) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }

    const content = ensureArrayField(overlay, 'content', `Template overlay "${overlay.id}" content`);
    if (!content.ok) return content;

    roots.push({ kind: 'overlay', id: overlay.id, nodes: content.value });
  }

  return { ok: true, roots };
}

function parseNodeId(nodeId) {
  if (!WF_ID_REGEX.test(nodeId || '')) {
    return { ok: false, error: `Invalid node id "${nodeId}". Use snake_case starting with a letter.` };
  }
  return { ok: true, value: nodeId };
}

function buildComponentIds(projectPath) {
  const components = loadDocumentFromFile(componentsFilePath(projectPath), {
    supportedSpecVersion: SUPPORTED_SPEC_VERSION,
  }).document?.components;
  return isObject(components) ? new Set(Object.keys(components)) : new Set();
}

function resolveComponentBinding(projectPath, componentRef) {
  if (typeof componentRef !== 'string' || componentRef.trim() === '') {
    return { ok: false, error: 'Component is required.' };
  }

  if (PRIMITIVE_COMPONENTS.has(componentRef)) {
    return { ok: true, node: { component: componentRef } };
  }

  if (buildComponentIds(projectPath).has(componentRef)) {
    return { ok: true, node: { use: componentRef } };
  }

  return { ok: false, error: `Unknown component reference "${componentRef}".` };
}

function collectNodeIds(nodes, set) {
  for (const node of nodes) {
    if (!isObject(node)) {
      continue;
    }

    if (typeof node.id === 'string') {
      set.add(node.id);
    }

    if (Array.isArray(node.children)) {
      collectNodeIds(node.children, set);
    }
  }
}

function uniqueNodeIdsFromRoots(roots) {
  const ids = new Set();

  for (const root of roots) {
    collectNodeIds(root.nodes, ids);
  }

  return ids;
}

function resolveAddressInRoots(roots, segments, { allowContainerFinal = false } = {}) {
  let currentNodes = roots;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (index === 0) {
      const rootMatch = currentNodes.find((entry) => entry.id === segment);
      if (!rootMatch) {
        return { ok: false, error: `No root container "${segment}" found for the address.` };
      }
      if (isLast) {
        if (!allowContainerFinal) {
          return { ok: false, error: `Address "${segment}" resolves to a container, not a node.` };
        }
        return { ok: true, targetType: 'container', container: rootMatch };
      }

      currentNodes = rootMatch.nodes;
      continue;
    }

    const matchIndex = currentNodes.findIndex((entry) => isObject(entry) && entry.id === segment);
    if (matchIndex === -1) {
      return { ok: false, error: `Node "${segment}" not found while resolving address.` };
    }

    const node = currentNodes[matchIndex];
    if (isLast) {
      return {
        ok: true,
        targetType: 'node',
        node,
        parentNodes: currentNodes,
        parentIndex: matchIndex,
      };
    }

    if (!Array.isArray(node.children)) {
      return { ok: false, error: `Node "${segment}" has no children.` };
    }

    currentNodes = node.children;
  }

  return { ok: false, error: 'Unable to resolve address.' };
}

function resolveTarget(projectPath, address) {
  const parsed = parseAddress(address);
  if (!parsed.ok) return parsed;

  if (parsed.doctype === 'page') {
    const pagePath = pageFilePath(projectPath, parsed.documentId);
    const loaded = loadDocumentFromFile(pagePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const rootsResult = buildPageRoots(loaded.document);
    if (!rootsResult.ok) return rootsResult;

    return {
      ok: true,
      documentPath: pagePath,
      document: loaded.document,
      roots: rootsResult.roots,
      segments: parsed.pathSegments,
      rawAddress: parsed.raw,
      documentType: 'page',
    };
  }

  if (parsed.doctype === 'template') {
    const templatesPath = templatesFilePath(projectPath);
    const loaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const template = loaded.document?.templates?.[parsed.documentId];

    if (!isObject(template)) {
      return { ok: false, error: `Template "${parsed.documentId}" does not exist.` };
    }

    const rootsResult = buildTemplateRoots(template);
    if (!rootsResult.ok) return rootsResult;

    return {
      ok: true,
      documentPath: templatesPath,
      document: loaded.document,
      roots: rootsResult.roots,
      segments: parsed.pathSegments,
      rawAddress: parsed.raw,
      documentType: 'template',
    };
  }

  return { ok: false, error: `Unsupported address doctype "${parsed.doctype}".` };
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

module.exports = {
  componentsFilePath,
  collectNodeIds,
  ensureObject,
  isObject,
  parseAddress,
  parseJson,
  parseNodeId,
  resolveAddressInRoots,
  resolveComponentBinding,
  resolveTarget,
  uniqueNodeIdsFromRoots,
};
