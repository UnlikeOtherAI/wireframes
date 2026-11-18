'use strict';

const { builtinComponentIds } = require('../stdlib');

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

/**
 * STD_ALIAS_SHADOWED (info): a document imports components under the alias
 * `std`. Nothing is reserved, so the project's own `std.<name>` wins over the
 * built-in pattern of the same name. Works on in-memory documents, so the CLI
 * doctor and the in-memory `validateProject` entry point share it.
 *
 * `entries` are `{ label, document, definitions }`, where `definitions` is the
 * registry that document resolves against. Returns `{ severity, code, message }`.
 */
function checkStdAlias(entries) {
  const diagnostics = [];
  for (const { label, document, definitions } of entries) {
    if (!isObject(document?.imports) || !Object.hasOwn(document.imports, 'std')) continue;
    const shadowed = isObject(definitions)
      ? builtinComponentIds().filter((id) => Object.hasOwn(definitions, id))
      : [];
    diagnostics.push({
      severity: 'info',
      code: 'STD_ALIAS_SHADOWED',
      message: `${label} imports components as "std", so its std.<name> components win over the built-in std patterns`
        + `${shadowed.length > 0 ? ` (shadowed: ${shadowed.join(', ')})` : ''}. `
        + 'Other std.<name> ids still resolve to the built-ins; rename the alias to use both.',
    });
  }
  return diagnostics;
}

module.exports = { checkStdAlias };
