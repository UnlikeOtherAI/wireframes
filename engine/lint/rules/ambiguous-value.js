'use strict';

const { resolvePrimitiveName, itemProps } = require('../../schema/primitive-registry');
const { normalizeItems, resolveSelection } = require('../../renderer/items');
const { appendPath } = require('../../schema/validator');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** A checkbox choice_group selects several options, like `multiple: true`. */
function isMultiple(component, props) {
  return props.multiple === true || (component === 'choice_group' && props.kind !== 'radio');
}

/**
 * A single-choice element (no `multiple: true`) whose `value` matches more
 * than one item in an item prop selects only the first match.
 *
 * `at` is where the node is written; only a result that sets `locations` keeps
 * the finding's place, which is the node's `props.value`.
 */
function validateAmbiguousValue(result, node, context, at) {
  if (!isObject(node) || typeof node.component !== 'string') return;
  const component = resolvePrimitiveName(node.component);
  const props = isObject(node.props) ? node.props : {};
  if (!component || props.value == null || isMultiple(component, props)) return;

  for (const prop of itemProps(component)) {
    const { ambiguous } = resolveSelection(normalizeItems(props[prop]), { value: props.value });
    if (!ambiguous) continue;
    if (!Array.isArray(result.info)) result.info = [];
    const code = 'AMBIGUOUS_VALUE';
    const message = `${context}: ${component}.value ${JSON.stringify(props.value)} matches more than one of its ${prop}, so only the first is selected. Give each item a distinct value.`;
    result.info.push(at && result.locations
      ? { code, message, at: { document: at.document, path: appendPath(appendPath(at.path, 'props'), 'value') } }
      : { code, message });
  }
}

module.exports = { validateAmbiguousValue };
