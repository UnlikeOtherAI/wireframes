'use strict';

// What an element accepts: its known props, its enum values, the text or label
// it needs, and the value rules of controls. These read the props a node renders
// with, so a repeat row is checked on the rendered page (`repeat-rows.js`), not
// as written.

const { getPrimitive, knownProps } = require('../../schema/primitive-registry');
const { appendPath } = require('../../schema/validator');
const { nearest } = require('../../schema/nearest-name');
const { validateAmbiguousValue } = require('./ambiguous-value');
const { validateControlProps } = require('./control-props');

const TEXT_PRIMITIVES = new Set(['heading', 'paragraph', 'text']);
const FIELD_PRIMITIVES = new Set(['input', 'select', 'textarea', 'picker']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** `at` says where the finding is. Only a result that sets `locations` keeps it. */
function addDiagnostic(result, severity, code, message, at) {
  if (!Array.isArray(result[severity])) {
    result[severity] = [];
  }
  result[severity].push(at && result.locations ? { code, message, at } : { code, message });
}

/** A place below the node being checked. `key` points at the key, not its value. */
function under(at, segments, key = false) {
  if (!at) return undefined;
  const path = segments.reduce((current, segment) => appendPath(current, segment), at.path);
  return key ? { document: at.document, path, key: true } : { document: at.document, path };
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function validateKnownProps(result, component, props, context, at) {
  const contract = knownProps(component);
  if (!contract || !isObject(props)) return;

  for (const propName of Object.keys(props)) {
    if (contract.has(propName)) continue;
    const suggestion = nearest(propName, [...contract]);
    addDiagnostic(
      result,
      'warnings',
      'UNKNOWN_PROP',
      `${context}: ${component} has no prop "${propName}".${suggestion ? ` Did you mean "${suggestion}"?` : ` Known props: ${[...contract].join(', ')}.`}`,
      under(at, ['props', propName], true),
    );
  }
}

function validateEnumProps(result, component, props, context, at) {
  const entry = getPrimitive(component);
  if (!entry || !isObject(props)) return;
  for (const [name, spec] of Object.entries(entry.props || {})) {
    if (!Array.isArray(spec.enum)) continue;
    const value = props[name];
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (spec.enum.includes(value)) continue;
    const suggestion = nearest(value, spec.enum);
    addDiagnostic(
      result,
      'warnings',
      'UNKNOWN_PROP_VALUE',
      `${context}: ${component}.${name} is "${value}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Allowed: ${spec.enum.join(', ')}.`,
      under(at, ['props', name]),
    );
  }
}

function validateTextProps(result, component, props, context, at) {
  if (!TEXT_PRIMITIVES.has(component)) return;
  const hasText = hasNonEmptyString(props?.text);
  const hasLabel = hasNonEmptyString(props?.label);
  // `lines` says the skeleton is deliberate, so do not nag about it.
  if (!hasText && !hasLabel && props?.lines == null) {
    addDiagnostic(result, 'info', 'MISSING_TEXT', `${context}: ${component} has no text, so it renders a skeleton bar. Add props.text, or props.lines to say the placeholder is intended.`, at);
  }
  if (hasLabel && !hasText) {
    addDiagnostic(result, 'info', 'TEXT_PROP_ALIAS', `${context}: ${component} uses the label alias; prefer text.`, under(at, ['props', 'label'], true));
  }
}

function validateFieldLabel(result, component, props, context, at) {
  if (!FIELD_PRIMITIVES.has(component)) return;
  if (!hasNonEmptyString(props?.label)) {
    addDiagnostic(result, 'info', 'UNLABELED_FIELD', `${context}: ${component} has no label.`, at);
  }
}

/** `component` is the node's resolved element name. */
function validateElementContract(result, component, node, context, at) {
  const props = isObject(node.props) ? node.props : {};
  validateKnownProps(result, component, props, context, at);
  validateEnumProps(result, component, props, context, at);
  validateTextProps(result, component, props, context, at);
  validateFieldLabel(result, component, props, context, at);
  validateAmbiguousValue(result, node, context, at);
  validateControlProps(result, component, props, context, at);
}

module.exports = { validateElementContract };
