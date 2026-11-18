'use strict';

// The shared item model: one shape for nav, menu, tab, list, tree, accordion
// and choice entries. Each consumer passes the profile naming the legacy keys
// it read before the model existed, with today's precedence, so YAML written
// before the model renders exactly as it did. Everything here is pure: input
// is never mutated, and a boolean the author left out is never defaulted.

const { isObject } = require('./render-utils');

const ITEM_TYPES = new Set(['item', 'separator', 'heading', 'group']);

function nonblank(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * The value of the first key in `keys` that supplies text. With `skipBlank`,
 * a nonblank string wins over an earlier blank one. Otherwise the canonical
 * key counts whenever it is set, even blank, and a legacy alias only when it
 * is a string, which is how `lib.items` copied `title` into `label`.
 */
function pick(entry, keys, canonical, skipBlank) {
  if (skipBlank) {
    const filled = keys.find((key) => nonblank(entry[key]));
    if (filled) return entry[filled];
  }
  const present = keys.find((key) => (
    key === canonical ? entry[key] !== undefined : typeof entry[key] === 'string'
  ));
  return present === undefined ? undefined : entry[present];
}

function setOrDelete(item, key, value) {
  if (value === undefined) delete item[key];
  else item[key] = value;
}

function profile(spec) {
  return Object.freeze({
    name: spec.name,
    labelKeys: spec.labelKeys || ['label'],
    skipBlankLabel: spec.skipBlankLabel === true,
    descriptionKeys: spec.descriptionKeys || ['description'],
    // legacy key → canonical key. The legacy key wins when it is set.
    renames: Object.freeze({ ...(spec.renames || {}) }),
    // entry → canonical overrides for legacy markers such as `divider: true`.
    legacy: spec.legacy || null,
    consumes: Object.freeze([...(spec.consumes || [])]),
    scalarValue: spec.scalarValue === true,
    booleans: spec.booleans === true,
    nested: spec.nested || null,
  });
}

function scalarItem(raw, rules) {
  const label = String(raw);
  return rules.scalarValue ? { type: 'item', label, value: label } : { type: 'item', label };
}

function normalizeEntry(entry, rules) {
  if (typeof entry === 'string' || typeof entry === 'number') return scalarItem(entry, rules);
  if (typeof entry === 'boolean' && rules.booleans) return scalarItem(entry, rules);
  if (!isObject(entry)) return null;

  // Keys outside the model pass through, so element data such as a list
  // row's `side` or an action's `variant` stays available to the consumer.
  const item = { ...entry };
  const label = pick(entry, rules.labelKeys, 'label', rules.skipBlankLabel);
  const description = pick(entry, rules.descriptionKeys, 'description', true);
  for (const key of [...rules.labelKeys, ...rules.descriptionKeys]) delete item[key];
  setOrDelete(item, 'label', label);
  setOrDelete(item, 'description', description);

  for (const [legacyKey, canonicalKey] of Object.entries(rules.renames)) {
    if (entry[legacyKey] !== undefined) item[canonicalKey] = entry[legacyKey];
    delete item[legacyKey];
  }

  const overrides = rules.legacy ? rules.legacy(entry) : null;
  for (const key of rules.consumes) delete item[key];
  item.type = ITEM_TYPES.has(entry.type) ? entry.type : 'item';
  for (const [key, value] of Object.entries(overrides || {})) setOrDelete(item, key, value);

  if (item.items !== undefined) item.items = normalizeItems(item.items, rules.nested || rules);
  return item;
}

/**
 * Normalize a list prop into canonical items:
 * `{ type, label, description, value, icon, …, selected, current, checked,
 * disabled, expanded, items }`, keeping only the keys the entry supplies.
 * Strings and numbers become `{ type: 'item', label }`, plus `value` for
 * choice profiles. Other non-objects are dropped.
 */
function normalizeItems(value, rules = itemProfiles.canonical) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => normalizeEntry(entry, rules)).filter(Boolean);
}

function navHeading(entry) {
  return entry.group != null || entry.heading != null
    ? { type: 'heading', label: entry.group || entry.heading }
    : null;
}

function menuMarkers(entry) {
  return {
    ...(entry.divider === true ? { type: 'separator' } : {}),
    ...(entry.danger === true ? { tone: 'danger' } : {}),
  };
}

const LABEL_OR_TITLE = ['label', 'title'];
const navChild = profile({
  name: 'nav',
  labelKeys: LABEL_OR_TITLE,
  renames: { active: 'selected', children: 'items' },
});
const listRules = {
  labelKeys: ['title', 'label'],
  skipBlankLabel: true,
  descriptionKeys: ['text', 'description'],
};

/**
 * One profile per consumer. `canonical` reads the model's keys only; the
 * others add exactly the legacy keys their consumer honoured before.
 */
const itemProfiles = Object.freeze({
  canonical: profile({ name: 'canonical' }),
  // `title` fills an absent `label`: breadcrumbs, steps and actions.
  basic: profile({ name: 'basic', labelKeys: LABEL_OR_TITLE }),
  // Nonblank `title` before `label`, `text` as the description: list rows and carousel slides.
  list: profile({ name: 'list', ...listRules }),
  accordion: profile({ name: 'accordion', ...listRules, renames: { open: 'expanded' } }),
  // Nonblank `label` before `title`; `children` nest; `open` is `expanded`.
  tree: profile({
    name: 'tree',
    labelKeys: LABEL_OR_TITLE,
    skipBlankLabel: true,
    renames: { open: 'expanded', children: 'items' },
  }),
  // Top-level `{group}`/`{heading}` entries are headings; nested children are plain items.
  nav: profile({
    name: 'nav',
    labelKeys: LABEL_OR_TITLE,
    renames: { active: 'selected', children: 'items' },
    legacy: navHeading,
    consumes: ['group', 'heading'],
    nested: navChild,
  }),
  // `divider: true` is a separator and `danger: true` the danger tone: menu and action_sheet.
  menu: profile({
    name: 'menu',
    labelKeys: LABEL_OR_TITLE,
    legacy: menuMarkers,
    consumes: ['divider', 'danger'],
  }),
  // `active` is `selected`: tab_bar, bottom_tab_bar and page_header tabs.
  tabs: profile({ name: 'tabs', labelKeys: LABEL_OR_TITLE, renames: { active: 'selected' } }),
  // Scalar options also become values: segmented, choice_group and picker.
  choice: profile({ name: 'choice', labelKeys: LABEL_OR_TITLE, scalarValue: true }),
  // select reads no `title`, and keeps rendering boolean options literally.
  select: profile({ name: 'select', scalarValue: true, booleans: true }),
});

function identity(raw) {
  return typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'
    ? String(raw).trim()
    : '';
}

function selectable(item) {
  return isObject(item) && (item.type === undefined || item.type === 'item');
}

/**
 * Which items are selected. Identity is `value`, else `label`, compared as
 * trimmed strings; a blank identity never matches. Precedence:
 *  1. any item with `selected: true` → exactly the items marked true;
 *  2. a match on the element `value` (an array when `multiple`), skipping
 *     items marked `selected: false`; single choice keeps the first match
 *     and reports `ambiguous` when there were more;
 *  3. nothing: `source` is null and the consumer applies its legacy rule.
 */
function resolveSelection(items, { value, multiple = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const explicit = list.map((item) => selectable(item) && item.selected === true);
  if (explicit.includes(true)) return { selected: explicit, source: 'item', ambiguous: false };

  const wanted = new Set((Array.isArray(value) ? value : [value]).map(identity).filter(Boolean));
  const matches = list.map((item) => (
    selectable(item) && item.selected !== false
    && wanted.has(identity(item.value) || identity(item.label))
  ));
  const count = matches.filter(Boolean).length;
  if (count === 0) return { selected: list.map(() => false), source: null, ambiguous: false };
  if (multiple === true) return { selected: matches, source: 'value', ambiguous: false };
  const first = matches.indexOf(true);
  return { selected: list.map((_, index) => index === first), source: 'value', ambiguous: count > 1 };
}

/**
 * `lib.items` as it has always behaved: strings and numbers become
 * `{ [key]: String(v) }`, objects pass through, and with the default key a
 * string `title` fills an absent `label`. Data arrays (table, chart,
 * calendar, kanban, tags, files) keep using it.
 */
function legacyItems(value, key = 'label') {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (entry == null) return null;
      if (typeof entry === 'string' || typeof entry === 'number') return { [key]: String(entry) };
      if (!isObject(entry)) return null;
      // List rows call their heading title; nav/menu rows call it label.
      // Preserve explicit labels (including blank ones), and all other fields.
      return key === 'label' && entry.label === undefined && typeof entry.title === 'string'
        ? { ...entry, label: entry.title } : entry;
    })
    .filter(Boolean);
}

module.exports = {
  normalizeItems,
  resolveSelection,
  itemProfiles,
  legacyItems,
};
