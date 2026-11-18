'use strict';

const { builtinComponentDefinition } = require('../stdlib');

// A reference that may only mean the built-in pattern. The colon keeps it out of
// the authored id grammar, so no definition can ever take its place.
const BUILTIN_REFERENCE_PREFIX = 'builtin:';

/**
 * The one lookup rule for a component reference, used by every entry point:
 * the file registry, per-page and in-memory registries, the expansion guard,
 * validation, tree, inspect and the browser bundle.
 *
 * The project's own definitions win, including any it imports under a `std`
 * alias. A built-in `std.<name>` pattern is the fallback. Built-ins are looked
 * up here on demand and never copied into a registry, so listings and
 * unused-component reports only ever see the project's own components. A
 * `builtinReference` skips the project's definitions.
 */
function resolveComponentDefinition(id, definitions) {
  if (typeof id !== 'string') return null;
  if (id.startsWith(BUILTIN_REFERENCE_PREFIX)) return builtinComponentDefinition(id.slice(BUILTIN_REFERENCE_PREFIX.length));
  if (definitions != null && typeof definitions === 'object' && Object.hasOwn(definitions, id)) {
    return definitions[id];
  }
  return builtinComponentDefinition(id);
}

/**
 * The reference to the built-in `std.<name>` alone, whatever the project defines
 * under that id, or null when there is no such built-in. A module whose own `std`
 * alias lacks the id means the built-in, not a `std` alias of the project.
 */
function builtinReference(id) {
  return builtinComponentDefinition(id) ? `${BUILTIN_REFERENCE_PREFIX}${id}` : null;
}

module.exports = { builtinReference, resolveComponentDefinition };
