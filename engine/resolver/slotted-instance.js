'use strict';

/**
 * Preparing an instance of a component that declares slot placeholders.
 *
 * The definition is prepared in its own scope: its root, internal nodes,
 * fallbacks and the fills it writes for its own nested instances all get its
 * `{{props}}` substitution and are namespaced under the instance id. The
 * caller's fills arrive already prepared and expanded in the caller's scope.
 * They stay opaque to the callee: a filled placeholder becomes a marker while
 * the callee's own tree expands, and the fill takes the marker's place after.
 * So nothing the callee expands, including a component without slots that
 * would substitute and namespace its instance children, ever touches a fill.
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

// A marker is `{ [FILL]: token, name }`. The token is a symbol per instance, so
// cloning keeps it and no authored value can equal it.
const FILL = '__wfSlotFill';

function spliceList(nodes, fills, token) {
  const output = [];
  for (const node of nodes) {
    if (isSlotPlaceholder(node)) {
      if (fills.has(node.slot)) {
        output.push({ [FILL]: token, name: node.slot });
      } else if (Array.isArray(node.children)) {
        output.push(...spliceList(node.children, fills, token));
      }
      continue;
    }
    spliceBelow(node, fills, token);
    output.push(node);
  }
  return output;
}

function spliceBelow(node, fills, token) {
  if (!isObject(node)) {
    return;
  }
  if (Array.isArray(node.children)) {
    node.children = spliceList(node.children, fills, token);
  }
  if (node.use != null && isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      if (Array.isArray(fill)) {
        node.slots[name] = spliceList(fill, fills, token);
      }
    }
  }
}

/**
 * @param {object} node The caller-authored instance node.
 * @param {object} componentDoc The component definition.
 * @param {Map<string, object[]>} fills Slot name to caller content. `[]` means intentionally empty.
 * @param {symbol} token Marks this instance's filled placeholders.
 * @returns {object} The prepared definition root, with a marker for each filled
 *   placeholder and fallbacks in place of the rest. Its own nested `use:`
 *   instances are still unexpanded.
 */
function prepareSlottedInstance(node, componentDoc, fills, token) {
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

  spliceBelow(prepared, fills, token);
  return prepared;
}

/**
 * Put each fill where its marker ended up in the expanded tree. A fill is
 * final content, so it is not searched again.
 */
function placeFills(nodes, fills, token) {
  const output = [];
  for (const node of nodes) {
    if (isObject(node) && node[FILL] === token) {
      output.push(...cloneDeep(fills.get(node.name) || []));
      continue;
    }
    if (isObject(node) && Array.isArray(node.children)) {
      node.children = placeFills(node.children, fills, token);
    }
    output.push(node);
  }
  return output;
}

module.exports = { placeFills, prepareSlottedInstance };
