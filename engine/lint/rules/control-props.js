'use strict';

// Lint for control props whose misuse the schema cannot express: an `input`
// value list outside a two-thumb range, and a checkbox, radio or toggle that
// sets both `help` and its alias `description`.

const { appendPath } = require('../../schema/validator');

const INLINE_CHOICES = new Set(['checkbox', 'radio', 'toggle']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isRangeEnd(entry) {
  if (typeof entry === 'number') return Number.isFinite(entry);
  if (typeof entry !== 'string' || entry.trim() === '') return false;
  return entry.includes('{{') || Number.isFinite(Number(entry));
}

/** `at` says where the finding is. Only a result that sets `locations` keeps it. */
function add(result, severity, code, message, at) {
  if (!Array.isArray(result[severity])) result[severity] = [];
  result[severity].push(at && result.locations ? { code, message, at } : { code, message });
}

/** A prop of the node at `at`. `key` points at the prop's key, not its value. */
function propAt(at, name, key = false) {
  if (!at) return undefined;
  const path = appendPath(appendPath(at.path, 'props'), name);
  return key ? { document: at.document, path, key: true } : { document: at.document, path };
}

function validateRangeValue(result, props, context, at) {
  if (!Array.isArray(props.value)) return;
  if (props.inputType !== 'range') {
    add(result, 'warnings', 'UNKNOWN_PROP_VALUE', `${context}: input.value is a list, which only inputType: range takes (two thumbs). Give one value.`, propAt(at, 'value'));
  } else if (props.value.length !== 2 || !props.value.every(isRangeEnd)) {
    add(result, 'warnings', 'UNKNOWN_PROP_VALUE', `${context}: a range value list needs exactly two numbers, such as [20, 80]; this one draws the default thumb.`, propAt(at, 'value'));
  }
}

function validateHelpAlias(result, component, props, context, at) {
  if (!hasText(props.help) || !hasText(props.description)) return;
  add(result, 'info', 'HELP_PROP_ALIAS', `${context}: ${component} sets both help and description. help is the description's alias and wins, so description is not shown. Keep one.`, propAt(at, 'description', true));
}

/** `component` is the resolved primitive name; `at` is where the node is written. */
function validateControlProps(result, component, props, context, at) {
  if (!isObject(props)) return;
  if (component === 'input') validateRangeValue(result, props, context, at);
  if (INLINE_CHOICES.has(component)) validateHelpAlias(result, component, props, context, at);
}

module.exports = { validateControlProps };
