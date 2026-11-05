'use strict';

const { PRIMITIVES } = require('../schema/primitive-registry');
const { LOGO_SLOTS, logoForSkin } = require('./logos');
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
    if (skin.logos !== undefined) {
      if (!isObject(skin.logos)) add('SKIN_LOGO', at + '.logos', 'Company logos must be a map of up to three slots.');
      else for (const slot of Object.keys(skin.logos)) {
        if (!LOGO_SLOTS.includes(slot)) add('SKIN_LOGO_SLOT', at + '.logos', 'Use only logo_1, logo_2 and logo_3.');
        else if (!logoForSkin(skin, slot)) add('SKIN_LOGO', at + '.logos.' + slot,
          'A logo needs a nonempty name up to 80 characters and a static PNG up to 256 KiB and 1024 pixels per side.');
      }
    }
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
