'use strict';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function isNodeLike(value) {
  return typeof value.id === 'string'
    && value.id.trim() !== ''
    && (value.component != null || value.use != null || value.kind != null || Array.isArray(value.children));
}

// Props hold element data such as tree items, which can carry ids of their own
// but are never rendered as nodes.
function stampNodes(value, documentAddress) {
  if (Array.isArray(value)) {
    return value.map((entry) => stampNodes(entry, documentAddress));
  }
  if (!isObject(value)) {
    return value;
  }
  const stamped = {};
  for (const [key, entry] of Object.entries(value)) {
    stamped[key] = key === 'props' ? entry : stampNodes(entry, documentAddress);
    if (key === 'overlays' && Array.isArray(stamped[key])) {
      stamped[key] = stamped[key].map(overlay => isObject(overlay) && typeof overlay.id === 'string'
        ? { ...overlay, __source: `${documentAddress}#${overlay.id}` } : overlay);
    }
  }
  if (isNodeLike(value)) {
    stamped.__source = `${documentAddress}#${value.id}`;
  }
  return stamped;
}

function stampPages(pages) {
  if (pages instanceof Map) {
    return new Map([...pages].map(([id, doc]) => [id, stampNodes(doc, `page:${id}`)]));
  }
  return Object.fromEntries(Object.entries(pages || {}).map(([id, doc]) => [id, stampNodes(doc, `page:${id}`)]));
}

function stampCollection(collection, kind) {
  return Object.fromEntries(Object.entries(collection).map(([id, entry]) => {
    const stamped = stampNodes(entry, `${kind}:${id}`);
    if (kind === 'component' && isObject(stamped) && isObject(stamped.root)) {
      stamped.root = { ...stamped.root, __definition: `component:${id}` };
    }
    return [id, stamped];
  }));
}

function stampWrappedCollection(document, wrapperKey, kind) {
  if (!isObject(document)) return document;
  if (isObject(document[wrapperKey])) {
    return { ...document, [wrapperKey]: stampCollection(document[wrapperKey], kind) };
  }
  return stampCollection(document, kind);
}

/**
 * A copy of the document map where every node records the document that owns it.
 * Stamps survive component expansion and collection cloning because both copy a
 * node's fields, so a rendered id never has to be reversed. The input is untouched.
 */
function stampDocumentSources(documentMap) {
  return {
    ...documentMap,
    pages: stampPages(documentMap.pages),
    templates: stampWrappedCollection(documentMap.templates, 'templates', 'template'),
    components: stampWrappedCollection(documentMap.components, 'components', 'component'),
  };
}

module.exports = { stampDocumentSources };
