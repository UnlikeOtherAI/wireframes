'use strict';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cloneDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDeep(entry));
  }

  if (!isObject(value)) {
    return value;
  }

  const clone = {};
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneDeep(item);
  }

  return clone;
}

function buildContentMap(list, idField) {
  const map = new Map();

  if (!Array.isArray(list)) {
    return map;
  }

  for (const entry of list) {
    if (!isObject(entry) || typeof entry[idField] !== 'string') {
      continue;
    }
    map.set(entry[idField], Array.isArray(entry.content) ? entry.content : []);
  }

  return map;
}

function resolveInjectableNodes(nodes, injectableMap) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  const output = [];

  for (const node of nodes) {
    if (!isObject(node)) {
      output.push(cloneDeep(node));
      continue;
    }

    if (node.injectable === true && typeof node.id === 'string') {
      const injected = injectableMap.get(node.id);
      if (Array.isArray(injected) && injected.length > 0) {
        output.push(...resolveInjectableNodes(injected, injectableMap));
      }
      continue;
    }

    const resolvedNode = cloneDeep(node);
    if (Array.isArray(node.children)) {
      resolvedNode.children = resolveInjectableNodes(node.children, injectableMap);
    }

    output.push(resolvedNode);
  }

  return output;
}

function resolveRegion(region, slotMap, injectableMap) {
  if (!isObject(region) || typeof region.id !== 'string' || typeof region.kind !== 'string') {
    return null;
  }

  const resolved = cloneDeep(region);
  const slotContent = slotMap.get(region.id);
  const baseChildren = region.kind === 'slot'
    ? (Array.isArray(slotContent) ? slotContent : (Array.isArray(region.children) ? region.children : []))
    : (Array.isArray(region.children) ? region.children : []);

  delete resolved.kind;
  resolved.children = resolveInjectableNodes(baseChildren, injectableMap);

  return resolved;
}

function resolveTemplatePage({ template, page }) {
  if (!isObject(template)) {
    return {
      ok: false,
      error: 'Template document must be an object.',
    };
  }

  const regions = Array.isArray(template.regions) ? template.regions : [];
  const pageDoc = isObject(page) ? page : {};
  const slotMap = buildContentMap(Array.isArray(pageDoc.slots) ? pageDoc.slots : [], 'slotId');
  const injectableMap = buildContentMap(Array.isArray(pageDoc.injectables) ? pageDoc.injectables : [], 'injectableId');
  const roots = [];

  for (const region of regions) {
    const resolvedRegion = resolveRegion(region, slotMap, injectableMap);
    if (resolvedRegion) {
      roots.push(resolvedRegion);
    }
  }

  return {
    ok: true,
    roots,
    slots: slotMap,
    injectables: injectableMap,
  };
}

module.exports = {
  resolveTemplatePage,
};
