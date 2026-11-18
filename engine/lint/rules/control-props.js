'use strict';

// Lint for control props whose misuse the schema cannot express: an `input`
// value list outside a two-thumb range, and a checkbox, radio or toggle that
// sets both `help` and its alias `description`.

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

function add(result, severity, code, message) {
  if (!Array.isArray(result[severity])) result[severity] = [];
  result[severity].push({ code, message });
}

function validateRangeValue(result, props, context) {
  if (!Array.isArray(props.value)) return;
  if (props.inputType !== 'range') {
    add(result, 'warnings', 'UNKNOWN_PROP_VALUE', `${context}: input.value is a list, which only inputType: range takes (two thumbs). Give one value.`);
  } else if (props.value.length !== 2 || !props.value.every(isRangeEnd)) {
    add(result, 'warnings', 'UNKNOWN_PROP_VALUE', `${context}: a range value list needs exactly two numbers, such as [20, 80]; this one draws the default thumb.`);
  }
}

function validateHelpAlias(result, component, props, context) {
  if (!hasText(props.help) || !hasText(props.description)) return;
  add(result, 'info', 'HELP_PROP_ALIAS', `${context}: ${component} sets both help and description. help is the description's alias and wins, so description is not shown. Keep one.`);
}

/** `component` is the resolved primitive name. */
function validateControlProps(result, component, props, context) {
  if (!isObject(props)) return;
  if (component === 'input') validateRangeValue(result, props, context);
  if (INLINE_CHOICES.has(component)) validateHelpAlias(result, component, props, context);
}

module.exports = { validateControlProps };
