'use strict';

const { resolvePrimitiveName, itemProps } = require('../../schema/primitive-registry');
const { normalizeItems, resolveSelection } = require('../../renderer/items');

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A single-choice element (no `multiple: true`) whose `value` matches more
 * than one item in an item prop selects only the first match.
 */
function validateAmbiguousValue(result, node, context) {
  if (!isObject(node) || typeof node.component !== 'string') return;
  const component = resolvePrimitiveName(node.component);
  const props = isObject(node.props) ? node.props : {};
  if (!component || props.value == null || props.multiple === true) return;

  for (const prop of itemProps(component)) {
    const { ambiguous } = resolveSelection(normalizeItems(props[prop]), { value: props.value });
    if (!ambiguous) continue;
    if (!Array.isArray(result.info)) result.info = [];
    result.info.push({
      code: 'AMBIGUOUS_VALUE',
      message: `${context}: ${component}.value ${JSON.stringify(props.value)} matches more than one of its ${prop}, so only the first is selected. Give each item a distinct value.`,
    });
  }
}

module.exports = { validateAmbiguousValue };
