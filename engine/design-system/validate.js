'use strict';

const { PRIMITIVES } = require('../schema/primitive-registry');
const { validateDocumentAgainstSchema } = require('../schema/validator');
const ID = /^[a-z][a-z0-9_]*$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function manifestData(documentMap) {
  return documentMap?.manifest?.manifest || documentMap?.manifest || {};
}

function roleNames() {
  return PRIMITIVES.flatMap((entry) => [
    entry.name, ...(entry.props?.variant?.enum || []).map((variant) => `${entry.name}.${variant}`),
  ]);
}

/** Semantic checks supplement the schema: its validator does not inspect map keys. */
function validateDesignSystem(manifestDocument, { schema = true } = {}) {
  const manifest = manifestDocument?.manifest || manifestDocument || {};
  if (manifest.designSystem === undefined) return [];
  const errors = schema ? validateDocumentAgainstSchema(manifestDocument, 'manifest') : [];
  const add = (code, path, message) => errors.push({ code, path, message });
  const prefix = '$.manifest.designSystem';
  if (manifestDocument?.specVersion !== '1.2' || manifest.schemaVersion !== '1.2') {
    add('SKIN_VERSION', prefix, 'Named skins require manifest specVersion and schemaVersion 1.2.');
  }
  const system = manifest.designSystem;
  if (!isObject(system)) return errors;
  const skins = isObject(system.skins) ? system.skins : {};
  const roles = new Set(roleNames());
  for (const [id, skin] of Object.entries(skins)) {
    const at = `${prefix}.skins[${JSON.stringify(id)}]`;
    if (!ID.test(id) || id === 'wireframe') {
      add('SKIN_ID', at, 'Skin IDs must start with a lowercase letter and use lowercase letters, digits or underscores; wireframe is reserved.');
    }
    if (!isObject(skin)) continue;
    if (typeof skin.name === 'string' && skin.name.trim() === '') add('SKIN_NAME', `${at}.name`, 'A skin needs a display name.');
    for (const role of Object.keys(isObject(skin.roles) ? skin.roles : {})) {
      if (!roles.has(role)) add('SKIN_ROLE', `${at}.roles[${JSON.stringify(role)}]`, `Unknown standard appearance role "${role}".`);
    }
  }
  const selected = system.activeSkin ?? 'wireframe';
  if (typeof selected !== 'string' || (selected !== 'wireframe' && !own(skins, selected))) {
    add('SKIN_MISSING', `${prefix}.activeSkin`, `Selected skin "${String(selected)}" does not exist.`);
  }
  return errors;
}

module.exports = { manifestData, roleNames, validateDesignSystem, isObject };
