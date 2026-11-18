'use strict';

const { builtinComponentDefinition } = require('../stdlib');

// A reference that may only mean the built-in pattern. The colon keeps it out of
// the authored id grammar, so no definition can ever take its place. It is an
// id only rewritten registries hold: output shows the `std.<name>` the author
// wrote (`authoredReference`), and an id a person types never resolves to it
// (`resolveAuthoredComponent`). A distinct id, not a flag beside `use:`, keeps it
// apart from a project `std.<name>` in every lookup, cycle stack and use graph
// without each of them having to know about it.
const BUILTIN_REFERENCE_PREFIX = 'builtin:';

const isBuiltinReference = (id) => typeof id === 'string' && id.startsWith(BUILTIN_REFERENCE_PREFIX);

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
  if (isBuiltinReference(id)) return builtinComponentDefinition(id.slice(BUILTIN_REFERENCE_PREFIX.length));
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

/** The id as an author writes it: a built-in-only reference reads as its `std.<name>`. */
function authoredReference(id) {
  return isBuiltinReference(id) ? id.slice(BUILTIN_REFERENCE_PREFIX.length) : id;
}

/**
 * The lookup rule for an id a person names, on the command line or in an address.
 * A built-in-only reference is internal to rewritten registries, so it names nothing.
 */
function resolveAuthoredComponent(id, definitions) {
  return isBuiltinReference(id) ? null : resolveComponentDefinition(id, definitions);
}

module.exports = { authoredReference, builtinReference, resolveAuthoredComponent, resolveComponentDefinition };
