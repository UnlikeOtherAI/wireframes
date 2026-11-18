'use strict';

const { resolvePrimitiveName } = require('../schema/primitive-registry');
const { appendPath } = require('../schema/validator');
const { LOGO_SLOTS, logoDimension } = require('./logos');

/** `locate` adds each finding's `path`, relative to the value given. */
function validateLogoReferences(documentMap, { locate = false } = {}) {
  const errors = [];
  const found = (code, message, path) => (locate ? { code, message, path } : { code, message });
  const visit = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((entry, index) => visit(entry, appendPath(path, index))); return; }
    if (resolvePrimitiveName(value.component) === 'image' && value.props?.slot !== undefined) {
      const props = value.props;
      if (props.kind !== 'logo' || !LOGO_SLOTS.includes(props.slot)) {
        errors.push(found('LOGO_SLOT', 'A company image uses kind: logo and slot: logo_1, logo_2 or logo_3.', path + '.props.slot'));
      }
      for (const field of ['width', 'height']) {
        if (props[field] !== undefined && (logoDimension(props[field], 0) !== Number.parseFloat(props[field])
          || !(Number.parseFloat(props[field]) > 0))) {
          errors.push(found('LOGO_SIZE', 'Logo container width and height must be positive point values up to 4096.', path + '.props.' + field));
        }
      }
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'props') {
      if (child instanceof Map) child.forEach((entry, id) => visit(entry, appendPath(appendPath(path, key), id)));
      else visit(child, appendPath(path, key));
    }
  };
  visit(documentMap, '$');
  return errors;
}

module.exports = { validateLogoReferences };
