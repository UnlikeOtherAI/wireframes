'use strict';

const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));

const ADDRESS_PREFIX = 'wf://';
const WF_ID_REGEX = /^[a-z][a-z0-9_]*$/;

const SUPPORTED_DOCTYPES = new Set(['page', 'template', 'component']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
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

function buildRootNode(origin, sourceRef, kind, id, nodes, aliases = []) {
  return {
    kind,
    id,
    aliasIds: aliases,
    nodes,
    origin,
    sourceRef,
  };
}

function buildPageRoots(pageDoc, pageId) {
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

    roots.push(buildRootNode('page', `wf://page/${pageId}#${slot.slotId}`, 'slot', slot.slotId, content.value));
  }

  for (const injectable of Array.isArray(page.injectables) ? page.injectables : []) {
    if (!isObject(injectable) || typeof injectable.injectableId !== 'string' || injectable.injectableId.trim() === '') {
      continue;
    }

    const content = ensureArrayField(injectable, 'content', `Page injectable "${injectable.injectableId}" content`);
    if (!content.ok) return content;

    roots.push(buildRootNode('page', `wf://page/${pageId}#${injectable.injectableId}`, 'injectable', injectable.injectableId, content.value));
  }

  for (const overlay of Array.isArray(page.overlays) ? page.overlays : []) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }

    const content = ensureArrayField(overlay, 'content', `Page overlay "${overlay.id}" content`);
    if (!content.ok) return content;

    roots.push(buildRootNode('page', `wf://page/${pageId}#${overlay.id}`, 'overlay', overlay.id, content.value));
  }

  return { ok: true, roots };
}

function buildTemplateRoots(template, templateId) {
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

    roots.push(buildRootNode('template', `wf://template/${templateId}#${region.id}`, 'region', region.id, children.value));
  }

  for (const overlay of Array.isArray(template.overlays) ? template.overlays : []) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }

    const content = ensureArrayField(overlay, 'content', `Template overlay "${overlay.id}" content`);
    if (!content.ok) return content;

    roots.push(buildRootNode('template', `wf://template/${templateId}#${overlay.id}`, 'overlay', overlay.id, content.value));
  }

  return { ok: true, roots };
}

function buildComponentRootsFromMap(components, componentId) {
  const component = isObject(components) ? components[componentId] : null;
  if (!isObject(component) || !isObject(component.root)) {
    return { ok: false, error: `Component "${componentId}" does not exist.` };
  }

  const componentRoot = component.root;
  const rootId = typeof componentRoot.id === 'string' && componentRoot.id.trim() !== '' ? componentRoot.id : 'root';
  const rootChildren = Array.isArray(componentRoot.children) ? componentRoot.children : [];
  componentRoot.children = rootChildren;

  return {
    ok: true,
    roots: [
      buildRootNode(
        'component',
        `wf://component/${componentId}#${rootId}`,
        'root',
        rootId,
        rootChildren,
        ['root'],
      ),
    ],
  };
}

function resolveNodeBySegment(nodes, segment, isRoot) {
  let match;

  if (isRoot) {
    match = nodes.find((entry) => entry.id === segment || (Array.isArray(entry.aliasIds) && entry.aliasIds.includes(segment)));
  } else {
    match = nodes.find((entry) => isObject(entry) && entry.id === segment);
  }

  if (!match) {
    return { ok: false, error: `Node "${segment}" not found while resolving address.` };
  }

  return { ok: true, match };
}

function resolveAddressInRoots(roots, segments, { allowContainerFinal = false } = {}) {
  let currentNodes = roots;
  let resolvedPath = [];
  let activeOrigin = null;
  let activeSourceRef = null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (index === 0) {
      if (!WF_ID_REGEX.test(segment)) {
        return { ok: false, error: `Invalid node id "${segment}". Use snake_case starting with a letter.` };
      }

      let rootMatch = resolveNodeBySegment(currentNodes, segment, true);
      if (!rootMatch.ok && currentNodes.length === 1 && currentNodes[0].kind === 'root') {
        const root = currentNodes[0];
        const directMatchIndex = Array.isArray(root.nodes)
          ? root.nodes.findIndex((entry) => isObject(entry) && entry.id === segment)
          : -1;

        if (directMatchIndex !== -1) {
          const directMatchNode = root.nodes[directMatchIndex];
          resolvedPath.push(directMatchNode.id);
          activeOrigin = root.origin;
          activeSourceRef = root.sourceRef;

          const baseRefPrefix = String(activeSourceRef).split('#')[0];
          if (isLast) {
            return {
              ok: true,
              targetType: 'node',
              node: directMatchNode,
              parentNodes: root.nodes,
              parentIndex: directMatchIndex,
              origin: activeOrigin,
              sourceRef: activeSourceRef,
              resolvedAddress: `${baseRefPrefix}#${resolvedPath.join('.')}`,
            };
          }

          if (!Array.isArray(directMatchNode.children)) {
            return { ok: false, error: `Node "${segment}" has no children.` };
          }

          currentNodes = directMatchNode.children;
          continue;
        }
      }

      if (!rootMatch.ok) {
        return { ok: false, error: `No root container "${segment}" found for the address.` };
      }

      const rootNode = rootMatch.match;
      resolvedPath.push(rootNode.id);
      activeOrigin = rootNode.origin;
      activeSourceRef = rootNode.sourceRef;

      const baseRefPrefix = String(activeSourceRef).split('#')[0];
      const resolvedAddress = `${baseRefPrefix}#${resolvedPath.join('.')}`;

      if (isLast) {
        if (!allowContainerFinal) {
          return {
            ok: false,
            error: `Address "${segment}" resolves to a container, not a node.`,
          };
        }

        return {
          ok: true,
          targetType: 'container',
          container: rootNode,
          origin: rootNode.origin,
          sourceRef: rootNode.sourceRef,
          resolvedAddress,
        };
      }

      if (!Array.isArray(rootNode.nodes)) {
        return { ok: false, error: `Node "${segment}" has no children.` };
      }

      currentNodes = rootNode.nodes;
      continue;
    }

    if (!WF_ID_REGEX.test(segment)) {
      return { ok: false, error: `Invalid node id "${segment}". Use snake_case starting with a letter.` };
    }

    const matchIndex = currentNodes.findIndex((entry) => isObject(entry) && entry.id === segment);
    if (matchIndex === -1) {
      return { ok: false, error: `Node "${segment}" not found while resolving address.` };
    }

    const node = currentNodes[matchIndex];
    resolvedPath.push(node.id);

    if (isLast) {
      const baseRefPrefix = String(activeSourceRef).split('#')[0];
      return {
        ok: true,
        targetType: 'node',
        node,
        parentNodes: currentNodes,
        parentIndex: matchIndex,
        origin: activeOrigin,
        sourceRef: activeSourceRef,
        resolvedAddress: `${baseRefPrefix}#${resolvedPath.join('.')}`,
      };
    }

    if (!Array.isArray(node.children)) {
      return { ok: false, error: `Node "${segment}" has no children.` };
    }

    currentNodes = node.children;
  }

  return { ok: false, error: 'Unable to resolve address.' };
}

function resolveAddress(projectPath, address) {
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
    const templatesPath = templatesFilePath(projectPath);
    const loaded = loadDocumentFromFile(templatesPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
    const template = loaded.document?.templates?.[parsed.documentId];

    if (!isObject(template)) {
      return { ok: false, error: `Template "${parsed.documentId}" does not exist.` };
    }

    const rootsResult = buildTemplateRoots(template, parsed.documentId);
    if (!rootsResult.ok) return rootsResult;

    return {
      ok: true,
      documentPath: templatesPath,
      document: loaded.document,
      roots: rootsResult.roots,
      segments: parsed.pathSegments,
      rawAddress: parsed.raw,
      documentType: 'template',
      documentId: parsed.documentId,
    };
  }

  const componentsPath = componentsFilePath(projectPath);
  const loaded = loadDocumentFromFile(componentsPath, {
    supportedSpecVersion: SUPPORTED_SPEC_VERSION,
  });
  const componentsResult = buildComponentRootsFromMap(loaded.document?.components, parsed.documentId);
  if (!componentsResult.ok) return componentsResult;

  return {
    ok: true,
    documentPath: componentsPath,
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
  parseAddress,
  resolveAddress,
  resolveAddressInRoots,
  resolveTarget,
  templatesFilePath,
  pageFilePath,
};
