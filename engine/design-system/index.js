'use strict';

const { catalogueModel } = require('../catalogue/model');
const { manifestData, validateDesignSystem, isObject } = require('./validate');

function clone(value) {
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, clone(item)]));
  if (Array.isArray(value)) return value.map(clone);
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  return value;
}

function getDesignSystem(documentMap) {
  const system = manifestData(documentMap).designSystem || {};
  return {
    activeSkin: system.activeSkin ?? 'wireframe',
    skins: clone(system.skins || {}),
    components: catalogueModel(),
  };
}

function updateDesignSystem(documentMap, change) {
  const fail = (errors) => ({ ok: false, error: errors[0]?.message || 'Invalid skin edit.', details: { errors } });
  if (!isObject(documentMap?.manifest?.manifest) || !isObject(change)) {
    return fail([{ code: 'SKIN_INPUT', path: '$', message: 'A manifest document and a skin change are required.' }]);
  }
  if (Object.keys(change).some((key) => !['skin', 'activeSkin'].includes(key))) {
    return fail([{ code: 'SKIN_CHANGE', path: '$', message: 'Only skin and activeSkin can be changed.' }]);
  }
  const next = clone(documentMap);
  const manifest = next.manifest.manifest;
  const system = clone(manifest.designSystem || { skins: {}, activeSkin: 'wireframe' });
  if (!isObject(system)) return fail([{ code: 'SKIN_INPUT', path: '$.manifest.designSystem', message: 'The design system must be an object.' }]);
  if (change.skin !== undefined) {
    if (!isObject(change.skin) || typeof change.skin.id !== 'string' || !isObject(change.skin.value)
      || Object.keys(change.skin).some((key) => !['id', 'value'].includes(key))) {
      return fail([{ code: 'SKIN_CHANGE', path: '$.skin', message: 'skin must contain an id and a skin value.' }]);
    }
    system.skins = Object.fromEntries([...Object.entries(system.skins || {}).filter(([id]) => id !== change.skin.id),
      [change.skin.id, clone(change.skin.value)]]);
  }
  if (change.activeSkin !== undefined) system.activeSkin = change.activeSkin;
  // A built-in-only selection does not upgrade or rewrite an ordinary project.
  if (!manifest.designSystem && change.skin === undefined && system.activeSkin === 'wireframe') {
    return { ok: true, documentMap: next };
  }
  manifest.designSystem = system;
  next.manifest.specVersion = '1.2';
  manifest.schemaVersion = '1.2';
  const errors = validateDesignSystem(next.manifest);
  return errors.length ? fail(errors) : { ok: true, documentMap: next };
}

module.exports = { getDesignSystem, updateDesignSystem };
