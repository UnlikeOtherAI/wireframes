'use strict';

const { resolvePrimitiveName } = require('../schema/primitive-registry');
const { LOGO_SLOTS, logoDimension } = require('./logos');

function validateLogoReferences(documentMap) {
  const errors = [];
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (resolvePrimitiveName(value.component) === 'image' && value.props?.slot !== undefined) {
      const props = value.props;
      if (props.kind !== 'logo' || !LOGO_SLOTS.includes(props.slot)) {
        errors.push({ code: 'LOGO_SLOT', message: 'A company image uses kind: logo and slot: logo_1, logo_2 or logo_3.' });
      }
      for (const field of ['width', 'height']) {
        if (props[field] !== undefined && (logoDimension(props[field], 0) !== Number.parseFloat(props[field])
          || !(Number.parseFloat(props[field]) > 0))) {
          errors.push({ code: 'LOGO_SIZE', message: 'Logo container width and height must be positive point values up to 4096.' });
        }
      }
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'props') {
      if (child instanceof Map) child.forEach(visit); else visit(child);
    }
  };
  visit(documentMap);
  return errors;
}

module.exports = { validateLogoReferences };
