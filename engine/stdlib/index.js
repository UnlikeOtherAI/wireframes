'use strict';

// The built-in `std` screen patterns. Each pattern is YAML text in its own
// module, parsed with the bundled js-yaml the first time something asks for
// it, so the library works the same in the CLI and in the browser bundle and
// never touches the filesystem. Parsed definitions are frozen and shared:
// every consumer clones before it changes anything.

const yaml = require('js-yaml');

const STD_PREFIX = 'std.';

const PATTERNS = {
  login: require('./patterns/login'),
  signup: require('./patterns/signup'),
  settings_page: require('./patterns/settings-page'),
  data_page: require('./patterns/data-page'),
  site_header: require('./patterns/site-header'),
  site_footer: require('./patterns/site-footer'),
  hero: require('./patterns/hero'),
  not_found: require('./patterns/not-found'),
};

const parsed = new Map();

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value)) deepFreeze(entry);
  }
  return value;
}

function patternName(id) {
  if (typeof id !== 'string' || !id.startsWith(STD_PREFIX)) return null;
  const name = id.slice(STD_PREFIX.length);
  return Object.hasOwn(PATTERNS, name) ? name : null;
}

/** The parsed, frozen definition of `std.<name>`, or null when there is no such built-in. */
function builtinComponentDefinition(id) {
  const name = patternName(id);
  if (!name) return null;
  if (!parsed.has(name)) parsed.set(name, deepFreeze(yaml.load(PATTERNS[name].source)));
  return parsed.get(name);
}

/** Built-in ids, sorted: `std.data_page`, `std.hero`, ... */
function builtinComponentIds() {
  return Object.keys(PATTERNS).sort().map((name) => `${STD_PREFIX}${name}`);
}

/** One line on what a built-in is for. */
function builtinComponentSummary(id) {
  const name = patternName(id);
  return name ? PATTERNS[name].summary : null;
}

/** What to tell someone who tries to change a built-in. */
function builtinCopyHint(id) {
  return `Component "${id}" is a built-in std pattern and is read-only. `
    + `Run \`wf component copy ${id}\` to copy it into components.yaml and edit the copy.`;
}

/** The YAML a built-in is written in, exactly as authored. */
function builtinComponentSource(id) {
  const name = patternName(id);
  return name ? PATTERNS[name].source : null;
}

module.exports = {
  STD_PREFIX,
  builtinCopyHint,
  builtinComponentDefinition,
  builtinComponentIds,
  builtinComponentSource,
  builtinComponentSummary,
};
