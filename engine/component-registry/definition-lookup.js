'use strict';

const { builtinComponentDefinition } = require('../stdlib');

/**
 * The one lookup rule for a component reference, used by every entry point:
 * the file registry, per-page and in-memory registries, the expansion guard,
 * validation, tree, inspect and the browser bundle.
 *
 * The project's own definitions win, including any it imports under a `std`
 * alias. A built-in `std.<name>` pattern is the fallback. Built-ins are looked
 * up here on demand and never copied into a registry, so listings and
 * unused-component reports only ever see the project's own components.
 */
function resolveComponentDefinition(id, definitions) {
  if (typeof id !== 'string') return null;
  if (definitions != null && typeof definitions === 'object' && Object.hasOwn(definitions, id)) {
    return definitions[id];
  }
  return builtinComponentDefinition(id);
}

module.exports = { resolveComponentDefinition };
