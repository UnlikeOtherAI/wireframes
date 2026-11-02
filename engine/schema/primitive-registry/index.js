'use strict';

const { textPrimitives } = require('./text');
const { controlPrimitives } = require('./controls');
const { navigationPrimitives } = require('./navigation');
const { dataPrimitives } = require('./data');
const { feedbackPrimitives } = require('./feedback');
const { containerPrimitives } = require('./containers');

const FAMILY_ORDER = ['containers', 'text', 'controls', 'navigation', 'data', 'feedback'];

const PRIMITIVES = [
  ...containerPrimitives,
  ...textPrimitives,
  ...controlPrimitives,
  ...navigationPrimitives,
  ...dataPrimitives,
  ...feedbackPrimitives,
];

const BY_NAME = new Map(PRIMITIVES.map((entry) => [entry.name, entry]));

const ALIASES = new Map();
for (const entry of PRIMITIVES) {
  for (const [alias, target] of Object.entries(entry.aliases || {})) {
    ALIASES.set(alias, target);
  }
}

function getPrimitive(name) {
  if (typeof name !== 'string') return null;
  return BY_NAME.get(name) || BY_NAME.get(ALIASES.get(name)) || null;
}

function resolvePrimitiveName(name) {
  if (typeof name !== 'string') return null;
  if (BY_NAME.has(name)) return name;
  const aliased = ALIASES.get(name);
  return aliased && BY_NAME.has(aliased) ? aliased : null;
}

function primitiveNames() {
  return PRIMITIVES.map((entry) => entry.name);
}

function primitivesByFamily(family) {
  return PRIMITIVES.filter((entry) => entry.family === family);
}

/** Prop name that a bare scalar shorthand value maps to, e.g. `- button: Save`. */
function primaryProp(name) {
  const entry = getPrimitive(name);
  if (!entry) return null;
  const found = Object.entries(entry.props || {}).find(([, spec]) => spec.primary === true);
  return found ? found[0] : null;
}

/** Every prop name a primitive accepts, including aliases. */
function knownProps(name) {
  const entry = getPrimitive(name);
  return entry ? new Set(Object.keys(entry.props || {})) : null;
}

/** Frame class: S always framed, C decided by frame rules, N never, E edge only. */
function frameClass(name) {
  const entry = getPrimitive(name);
  return entry ? entry.frame : null;
}

module.exports = {
  PRIMITIVES,
  FAMILY_ORDER,
  ALIASES,
  getPrimitive,
  resolvePrimitiveName,
  primitiveNames,
  primitivesByFamily,
  primaryProp,
  knownProps,
  frameClass,
};
