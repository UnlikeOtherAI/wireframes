'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildProject } = require('../../engine/build');
const { validateProject } = require('../../engine/validate');
const { validateDocument } = require('../../engine/schema');
const { SUPPORTED_SPEC_VERSION } = require('../../engine/schema/constants');
const { resolveTemplatePage } = require('../../engine/resolver');
const { childNodeLists } = require('../../engine/component-registry/child-nodes');
const { componentSlotNames, isSlotPlaceholder } = require('../../engine/component-registry/slot-placeholders');
const { resolveComponentDefinition } = require('../../engine/component-registry/definition-lookup');
const { assertComponentExpansion } = require('../../engine/component-registry/expansion');
const {
  builtinComponentDefinition,
  builtinComponentIds,
  builtinComponentSource,
  builtinComponentSummary,
} = require('../../engine/stdlib');
const { memoryProject } = require('./fixtures/std-project');

const EXPECTED = [
  'std.data_page', 'std.hero', 'std.login', 'std.not_found',
  'std.settings_page', 'std.signup', 'std.site_footer', 'std.site_header',
];

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const list of childNodeLists(node)) for (const child of list) walk(child, visit);
}

function tokens(value, found = new Set()) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\{\{\s*props\.([a-zA-Z0-9_]+)/g)) found.add(match[1]);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) tokens(entry, found);
  }
  return found;
}

function resolveInSlot(content, components) {
  const resolved = resolveTemplatePage({
    template: { regions: [{ id: 'main', kind: 'slot' }] },
    page: { slots: [{ slotId: 'main', content }] },
    components,
  });
  assert.equal(resolved.ok, true, resolved.error);
  const ids = new Map();
  const visit = (node) => { ids.set(node.id, node); for (const child of node.children || []) visit(child); };
  resolved.roots[0].children.forEach(visit);
  return ids;
}

test('the first batch is exactly the eight patterns, each with a summary', () => {
  assert.deepEqual(builtinComponentIds(), EXPECTED);
  for (const id of EXPECTED) {
    assert.ok(builtinComponentSummary(id).length > 20, id);
    assert.equal(typeof builtinComponentSource(id), 'string');
  }
});

test('every pattern is a valid, self-contained component with documented props', () => {
  for (const id of EXPECTED) {
    const definition = builtinComponentDefinition(id);
    assert.ok(Object.isFrozen(definition) && Object.isFrozen(definition.root), `${id} is shared, so it is frozen`);
    const local = id.slice('std.'.length);
    validateDocument({ documentType: 'components', specVersion: '1.1', id: 'components', components: { [local]: structuredClone(definition) } },
      id, SUPPORTED_SPEC_VERSION);

    const ids = new Set();
    walk(definition.root, (node) => {
      assert.equal(node.use, undefined, `${id} uses "${node.use}": a pattern may use no other component`);
      assert.ok(isSlotPlaceholder(node) || typeof node.component === 'string', `${id} node ${node.id} is a primitive or a slot`);
      assert.ok(!ids.has(node.id), `${id} repeats node id ${node.id}`);
      ids.add(node.id);
    });

    const documented = new Set([...Object.keys(definition.propDefaults), ...Object.keys(definition.propHints)]);
    for (const prop of tokens(definition.root)) {
      assert.ok(documented.has(prop), `${id} uses {{props.${prop}}} without a default or a hint`);
    }
    for (const prop of Object.keys(definition.propDefaults)) {
      assert.ok(Object.hasOwn(definition.propHints, prop), `${id} prop ${prop} has no hint`);
    }
  }
});

test('the patterns cover named fills, fallbacks and an optional empty slot', () => {
  const slots = Object.fromEntries(EXPECTED.map((id) => [id, componentSlotNames(builtinComponentDefinition(id))]));
  assert.deepEqual(slots, {
    'std.data_page': ['filters'],
    'std.hero': ['actions', 'media'],
    'std.login': ['fields', 'alternatives', 'footer'],
    'std.not_found': ['actions'],
    'std.settings_page': ['default'],
    'std.signup': ['fields', 'alternatives', 'footer'],
    'std.site_footer': ['columns', 'social'],
    'std.site_header': ['actions'],
  });
});

for (const mode of ['card', 'line']) {
  test(`every pattern renders with its defaults in ${mode} mode and validates with no diagnostics`, () => {
    for (const id of EXPECTED) {
      const documentMap = memoryProject([{ id: 'shown', use: id }], mode);
      const validation = validateProject(documentMap);
      assert.deepEqual(validation.errors, [], id);
      assert.deepEqual(validation.info, [], `${id} leaves no slot without content or fallback`);
      const built = buildProject(documentMap, { platform: 'web', basePath: '/' });
      assert.equal(built.ok, true, `${id}: ${built.error}`);
      const html = built.pages[0].html;
      assert.match(html, /id="shown"/, id);
      assert.match(html, new RegExp(`wf-mode-${mode}`));
      const definition = builtinComponentDefinition(id);
      const firstText = Object.values(definition.propDefaults).find((value) => typeof value === 'string' && value.length > 3);
      assert.ok(html.includes(firstText.replace('&', '&amp;')), `${id} renders its default "${firstText}"`);
      assert.doesNotMatch(html, /\{\{/, `${id} leaves no unresolved token`);
    }
  });
}

test('slots fill, fall back, and stay empty on []', () => {
  const nodes = resolveInSlot([
    { id: 'hero', use: 'std.hero', slots: { media: [{ id: 'video', component: 'image', props: { kind: 'video' } }] } },
    { id: 'plain_hero', use: 'std.hero' },
    { id: 'quiet_hero', use: 'std.hero', slots: { actions: [] } },
    { id: 'settings', use: 'std.settings_page', children: [{ id: 'billing', component: 'card', props: { title: 'Billing' } }] },
  ], {});
  assert.ok(nodes.has('video') && !nodes.has('hero__media_image'), 'a fill replaces the fallback and keeps its page id');
  assert.ok(nodes.has('plain_hero__media_image') && nodes.has('plain_hero__primary'), 'omitted fills use the fallback');
  assert.ok(!nodes.has('quiet_hero__action_row') && nodes.has('quiet_hero__media_image'), '[] empties only that slot');
  assert.ok(nodes.has('billing') && !nodes.has('settings__profile'), 'instance children fill the default slot');
  assert.equal(nodes.get('hero__title').props.text, builtinComponentDefinition('std.hero').propDefaults.title);
});

test('props reach the pattern and a token without a default resolves to empty', () => {
  const nodes = resolveInSlot([{ id: 'nf', use: 'std.not_found', props: { title: 'Gone', homeRoute: 'home' } }], {});
  assert.equal(nodes.get('nf__state').props.title, 'Gone');
  assert.equal(nodes.get('nf__home').props.route, 'home');
  assert.equal(nodes.get('nf__support').props.route, '', 'no supportRoute default, so no link');
});

test('the same pattern twice on one page gets separate ids and validates', () => {
  const documentMap = memoryProject([
    { id: 'customers', use: 'std.data_page' },
    { id: 'invoices', use: 'std.data_page', props: { title: 'Invoices' }, slots: { filters: [] } },
  ]);
  assert.deepEqual(validateProject(documentMap).errors, []);
  const html = buildProject(documentMap, { platform: 'web', basePath: '/' }).pages[0].html;
  assert.match(html, /id="customers__table"/);
  assert.match(html, /id="invoices__table"/);
  assert.match(html, /Invoices/);
});

test('one lookup rule: own definitions first, built-ins as the fallback, nothing else', () => {
  const own = { title: 'mine' };
  const definitions = { 'std.login': { root: own } };
  assert.equal(resolveComponentDefinition('std.login', definitions).root, own);
  assert.equal(resolveComponentDefinition('std.hero', definitions), builtinComponentDefinition('std.hero'));
  assert.equal(resolveComponentDefinition('std.hero', null), builtinComponentDefinition('std.hero'));
  for (const id of ['std', 'std.', 'std.login.extra', 'xstd.login', 'login', 'std.constructor', 'std.__proto__', 'std.toString']) {
    assert.equal(resolveComponentDefinition(id, {}), null, id);
  }
  assert.equal(resolveComponentDefinition(undefined, definitions), null);
});

test('the expansion guard and the resolver use the same rule', () => {
  assert.ok(assertComponentExpansion([{ id: 'x', use: 'std.data_page' }], {}) > 20);
  assert.throws(() => assertComponentExpansion([{ id: 'x', use: 'std.missing' }], {}), /Unknown component: std\.missing/);
  const resolved = resolveTemplatePage({
    template: { regions: [{ id: 'main', kind: 'slot' }] },
    page: { slots: [{ slotId: 'main', content: [{ id: 'x', use: 'std.missing' }] }] },
  });
  assert.equal(resolved.ok, false);
  assert.match(resolved.error, /Unknown component reference "std\.missing"/);
});

test('rendering a pattern twice is byte-identical and never changes the built-in', () => {
  const before = JSON.stringify(EXPECTED.map((id) => builtinComponentDefinition(id)));
  const render = () => buildProject(memoryProject(EXPECTED.map((id, index) => ({ id: `p${index}`, use: id }))),
    { platform: 'web', basePath: '/' }).pages[0].html;
  assert.equal(render(), render());
  assert.equal(JSON.stringify(EXPECTED.map((id) => builtinComponentDefinition(id))), before);
});
