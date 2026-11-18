'use strict';

/**
 * Preparing an instance of a component that declares slot placeholders.
 *
 * The definition is prepared in its own scope: its root, internal nodes,
 * fallbacks and the fills it writes for its own nested instances all get its
 * `{{props}}` substitution and are namespaced under the instance id. The
 * caller's fills arrive already prepared and expanded in the caller's scope,
 * and are spliced in place of the placeholders without being touched again.
 */

const { isSlotPlaceholder } = require('../component-registry/slot-placeholders');
const {
  cloneDeep,
  isObject,
  mergeNodeProps,
  namespaceDescendants,
  resolveComponentPropTemplates,
} = require('./component-prep');

// Keys of an instance node that are not overrides of the definition root.
const INSTANCE_ONLY_KEYS = new Set(['use', 'props', 'children', 'slots', 'id']);

function spliceList(nodes, fills) {
  const output = [];
  for (const node of nodes) {
    if (isSlotPlaceholder(node)) {
      if (fills.has(node.slot)) {
        output.push(...cloneDeep(fills.get(node.slot)));
      } else if (Array.isArray(node.children)) {
        output.push(...spliceList(node.children, fills));
      }
      continue;
    }
    spliceBelow(node, fills);
    output.push(node);
  }
  return output;
}

function spliceBelow(node, fills) {
  if (!isObject(node)) {
    return;
  }
  if (Array.isArray(node.children)) {
    node.children = spliceList(node.children, fills);
  }
  if (node.use != null && isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      if (Array.isArray(fill)) {
        node.slots[name] = spliceList(fill, fills);
      }
    }
  }
}

/**
 * @param {object} node The caller-authored instance node.
 * @param {object} componentDoc The component definition.
 * @param {Map<string, object[]>} fills Slot name to caller content, already
 *   prepared and expanded in the caller's scope. `[]` means intentionally empty.
 * @returns {object} The prepared definition root with fills spliced in. Its own
 *   nested `use:` instances are still unexpanded.
 */
function prepareSlottedInstance(node, componentDoc, fills) {
  const { props, id } = node;
  const root = cloneDeep(componentDoc.root);
  const mergedProps = mergeNodeProps(props, root.props, componentDoc.propDefaults);
  if (Object.keys(mergedProps).length > 0) {
    root.props = mergedProps;
  }

  const prepared = resolveComponentPropTemplates(root, mergedProps);
  prepared.id = id;

  namespaceDescendants(prepared, id, componentDoc.root.id);

  // Everything else on the instance overrides the root as authored by the
  // caller, so it gets none of the definition's preparation.
  for (const [key, value] of Object.entries(node)) {
    if (!INSTANCE_ONLY_KEYS.has(key)) {
      prepared[key] = cloneDeep(value);
    }
  }

  spliceBelow(prepared, fills);
  return prepared;
}

module.exports = { prepareSlottedInstance };
