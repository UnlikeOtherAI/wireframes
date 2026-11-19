'use strict';

// What validation and lint say about `repeat`: authored checks on the cell, the
// host and the item ids, rendered checks on the rows with each finding at the
// YAML that holds it, and each defect reported once.

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { lintSources } = require('../../engine/lint/source');
const { validateProject } = require('../../engine/validate');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { COMPONENTS, createRepeatProject, documentMap } = require('./fixtures/repeat-project');

const dump = (value) => yaml.dump(value, { lineWidth: -1 });

function sources(content, { components = COMPONENTS, page = {}, templates, extra = [], imports } = {}) {
  const map = documentMap(content, { components, page });
  const componentsDoc = imports ? { ...map.components, imports } : map.components;
  return [
    { name: 'manifest.yaml', text: dump(map.manifest) },
    { name: 'sitemap.yaml', text: dump(map.sitemap) },
    { name: 'templates.yaml', text: dump(templates || map.templates) },
    { name: 'components.yaml', text: dump(componentsDoc) },
    { name: 'pages/home.yaml', text: dump(map.pages.get('home')) },
    ...extra,
  ];
}

function underlined(list, diagnostic) {
  const text = list.find((source) => source.name === diagnostic.source).text;
  return text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset);
}

function only(result, code) {
  const matches = result.diagnostics.filter((diagnostic) => diagnostic.code === code);
  assert.equal(matches.length, 1, `expected one ${code}, got ${JSON.stringify(result.diagnostics.map((d) => `${d.code} ${d.path} ${d.message}`), null, 1)}`);
  return matches[0];
}

const codes = (result) => result.diagnostics.map((diagnostic) => diagnostic.code);
const host = (repeat, extra = {}) => ({ id: 'team', component: 'grid', layout: { type: 'grid', columns: 2 }, repeat, ...extra });
const PEOPLE = [{ id: 'ada', name: 'Ada' }, { id: 'grace', name: 'Grace' }];

test('a valid repeat lints clean', () => {
  const list = sources([
    host({ cell: 'person_card', items: PEOPLE }),
    { id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [{ id: 'mrr', label: 'MRR', value: '$1k' }] } },
    { id: 'core', use: 'team_section' },
    { id: 'framed_crew', use: 'forwarder', children: [{ id: 'crew', component: 'stack', repeat: { cell: 'person_form', items: [{ id: 'one' }] } }] },
  ]);
  assert.deepEqual(lintSources(list).diagnostics.filter((d) => d.severity !== 'info'), []);
});

test('an unknown cell is reported once, at the cell, with the nearest name', () => {
  const list = sources([host({ cell: 'person_crad', items: PEOPLE }), { id: 'kpis', component: 'row', repeat: { cell: 'statt', items: [{ id: 'mrr' }] } }]);
  const result = lintSources(list);
  const found = result.diagnostics.filter((d) => d.code === 'UNKNOWN_REPEAT_CELL');
  assert.equal(found.length, 2, JSON.stringify(result.diagnostics));
  assert.deepEqual(found.map((d) => underlined(list, d)), ['person_crad', 'statt']);
  assert.match(found[0].message, /Did you mean "person_card"\?/);
  assert.match(found[1].message, /Did you mean "stat"\?/);
  assert.ok(!codes(result).includes('BROKEN_COMPONENT_REFERENCE'), 'the expansion failure is not reported again');
  assert.equal(validateProject(documentMap([host({ cell: 'statt', items: [] })])).errors[0].code, 'UNKNOWN_REPEAT_CELL');
});

test('an authored builtin: cell is refused by the schema', () => {
  const result = lintSources(sources([host({ cell: 'builtin:std.hero', items: [{ id: 'one' }] })]));
  const pattern = only(result, 'SCHEMA_PATTERN');
  assert.equal(pattern.path, '$.page.slots[0].content[0].repeat.cell');
  assert.deepEqual(codes(result).filter((code) => code.includes('REPEAT')), []);
});

test('every invalid host is reported once, at its repeat key', () => {
  const rows = { cell: 'text', items: [{ id: 'one', text: 'One' }] };
  const components = {
    ...COMPONENTS,
    holder: { root: { id: 'holder', component: 'stack', children: [{ id: 'spot', slot: 'default', repeat: rows }] } },
  };
  const templates = {
    documentType: 'templates', specVersion: '1.1', id: 'templates',
    templates: { main: {
      layout: { type: 'stack' },
      regions: [
        { id: 'top', kind: 'persistent', repeat: rows, children: [{ id: 'marker', injectable: true, repeat: rows }] },
        { id: 'main', kind: 'slot' },
      ],
      overlays: [{ id: 'tip', type: 'modal', repeat: rows, content: [{ id: 'tip_text', component: 'text', props: { text: 'Tip' } }] }],
    } },
  };
  const list = sources([
    { id: 'card_use', use: 'person_card', repeat: rows },
    { id: 'save', component: 'button', props: { label: 'Save' }, repeat: rows },
    { id: 'tabs', component: 'tab_bar', props: { tabs: [{ label: 'A' }] }, repeat: rows },
    { id: 'free_tabs', component: 'tab_bar', repeat: rows },
    { id: 'h', use: 'holder', children: [{ id: 'filler', component: 'text', props: { text: 'Fill' } }] },
  ], {
    components,
    templates,
    page: { overlays: [{ id: 'sheet', type: 'modal', repeat: rows, content: [{ id: 'sheet_text', component: 'text', props: { text: 'Sheet' } }] }] },
  });
  const result = lintSources(list);
  const found = result.diagnostics.filter((d) => d.code === 'REPEAT_INVALID_HOST');
  assert.deepEqual(found.map((d) => `${d.source} ${d.path}`).sort(), [
    'components.yaml $.components.holder.root.children[0].repeat',
    'pages/home.yaml $.page.overlays[0].repeat',
    'pages/home.yaml $.page.slots[0].content[0].repeat',
    'pages/home.yaml $.page.slots[0].content[1].repeat',
    'pages/home.yaml $.page.slots[0].content[2].repeat',
    'templates.yaml $.templates.main.overlays[0].repeat',
    'templates.yaml $.templates.main.regions[0].children[0].repeat',
    'templates.yaml $.templates.main.regions[0].repeat',
  ]);
  for (const diagnostic of found) assert.equal(underlined(list, diagnostic), 'repeat');
});

test('a duplicate item id is reported once, at the repeated id', () => {
  const list = sources([host({ cell: 'person_card', items: [{ id: 'ada' }, { id: 'grace' }, { id: 'ada', name: 'Again' }] })]);
  const duplicate = only(lintSources(list), 'DUPLICATE_REPEAT_ITEM_ID');
  assert.equal(duplicate.path, '$.page.slots[0].content[0].repeat.items[2].id');
  assert.equal(underlined(list, duplicate), 'ada');
  assert.ok(!codes(lintSources(list)).includes('DUPLICATE_NODE_ID'));
});

test('a row id that collides with an authored id is DUPLICATE_NODE_ID, once, at the item', () => {
  const list = sources([
    host({ cell: 'person_card', items: PEOPLE }),
    { id: 'team__grace', component: 'text', props: { text: 'Hand-written Grace' } },
  ]);
  const duplicate = only(lintSources(list), 'DUPLICATE_NODE_ID');
  assert.equal(duplicate.path, '$.page.slots[0].content[0].repeat.items[1].id');
  assert.equal(underlined(list, duplicate), 'grace');
  assert.equal(runValidate({ projectPath: createRepeatProject([host({ cell: 'person_card', items: PEOPLE }), { id: 'team__ada', component: 'text' }]) })
    .errors.filter((e) => e.code === 'DUPLICATE_NODE_ID').length, 1);
});

test('a row id that collides inside a definition is located in the definition file', () => {
  const components = {
    ...COMPONENTS,
    crew: { root: { id: 'crew', component: 'stack', children: [
      { id: 'list', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one', text: 'One' }] } },
      { id: 'list__one', component: 'text', props: { text: 'Clash' } },
    ] } },
  };
  const list = sources([{ id: 'crew_a', use: 'crew' }], { components });
  const duplicate = only(lintSources(list), 'DUPLICATE_NODE_ID');
  assert.equal(duplicate.source, 'components.yaml');
  assert.equal(duplicate.path, '$.components.crew.root.children[0].repeat.items[0].id');
});

test('collection binding cannot clone rows; a single-value binding can stay', () => {
  const bound = { source: 'people' };
  const cases = [
    host({ cell: 'person_card', items: PEOPLE }, { binding: bound }),
    { id: 'wrap', component: 'stack', binding: bound, children: [{ id: 'inner', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one' }] } }] },
    { id: 'bound_cells', component: 'stack', repeat: { cell: 'bound_card', items: [{ id: 'one' }] } },
  ];
  const components = { ...COMPONENTS, bound_card: { root: { id: 'bound_card', component: 'card', binding: bound } } };
  const list = sources(cases, { components });
  const found = lintSources(list).diagnostics.filter((d) => d.code === 'REPEAT_WITH_BINDING');
  assert.deepEqual(found.map((d) => d.path), [
    '$.page.slots[0].content[0].repeat',
    '$.page.slots[0].content[1].children[0].repeat',
    '$.page.slots[0].content[2].repeat',
  ]);
  const single = sources([host({ cell: 'person_card', items: PEOPLE }, { binding: { source: '{{state.team}}' } })]);
  assert.ok(!codes(lintSources(single)).includes('REPEAT_WITH_BINDING'));
});

test('a component cell counts as a usage and a dependency edge', () => {
  const list = sources([host({ cell: 'person_card', items: PEOPLE })], {
    components: { person_card: COMPONENTS.person_card, unused_one: { root: { id: 'unused_one', component: 'text' } } },
  });
  const unused = lintSources(list).diagnostics.filter((d) => d.code === 'UNUSED_COMPONENT');
  assert.deepEqual(unused.map((d) => d.message), ['Component "unused_one" is not referenced by any page or template.']);

  const loop = {
    ping: { root: { id: 'ping', component: 'stack', repeat: { cell: 'pong', items: [{ id: 'a' }] } } },
    pong: { root: { id: 'pong', component: 'stack', repeat: { cell: 'ping', items: [{ id: 'b' }] } } },
  };
  const cycle = lintSources(sources([{ id: 'p', use: 'ping' }], { components: loop }));
  assert.deepEqual(codes(cycle).filter((code) => code.startsWith('CIRCULAR') || code === 'BROKEN_COMPONENT_REFERENCE'), ['CIRCULAR_TEMPLATE_REFERENCE']);
});

test('a cell referenced only from an imported module is used there, and its typo is located there', () => {
  const kit = {
    documentType: 'components', specVersion: '1.1', id: 'kit',
    components: {
      crew: { root: { id: 'crew', component: 'stack', repeat: { cell: 'persn', items: [{ id: 'one' }] } } },
      person: { root: { id: 'person', component: 'text' } },
    },
  };
  const list = sources([{ id: 'team', use: 'kit.crew' }], { components: {}, imports: { kit: 'components/kit.yaml' }, extra: [{ name: 'components/kit.yaml', text: dump(kit) }] });
  const unknown = only(lintSources(list), 'UNKNOWN_REPEAT_CELL');
  assert.equal(unknown.source, 'components/kit.yaml');
  assert.equal(unknown.path, '$.components.crew.root.repeat.cell');
  assert.equal(underlined(list, unknown), 'persn');
});

test('element prop contracts run on each row, underlining the item key', () => {
  const list = sources([
    { id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [{ id: 'mrr', label: 'MRR', lable: 'Typo', trend: 'sideways' }] } },
    host({ cell: 'person_card', items: [{ id: 'ada', nickname: 'Countess' }] }),
  ]);
  const result = lintSources(list);
  const prop = only(result, 'UNKNOWN_PROP');
  assert.equal(prop.path, '$.page.slots[0].content[0].repeat.items[0].lable');
  assert.equal(underlined(list, prop), 'lable');
  const value = only(result, 'UNKNOWN_PROP_VALUE');
  assert.equal(value.path, '$.page.slots[0].content[0].repeat.items[0].trend');
  assert.ok(!codes(result).includes('EMPTY_CONTAINER'), 'rows count as the host\'s children');
});

test('an empty repeat and an item token are info', () => {
  const list = sources([
    { id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [] } },
    { id: 'crew', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one', text: 'Hi {{item.name}}' }] } },
  ]);
  const result = lintSources(list);
  const empty = only(result, 'EMPTY_REPEAT');
  assert.equal(empty.severity, 'info');
  assert.equal(empty.path, '$.page.slots[0].content[0].repeat.items');
  const token = only(result, 'REPEAT_ITEM_TOKEN');
  assert.equal(token.severity, 'info');
  assert.equal(token.path, '$.page.slots[0].content[1].repeat.items[0].text');
});

function fanOut(levels, width) {
  const components = {};
  for (let level = 0; level < levels; level += 1) {
    components[`level_${level}`] = { root: { id: `level_${level}`, component: 'stack', repeat: {
      cell: level === levels - 1 ? 'text' : `level_${level + 1}`,
      items: Array.from({ length: width }, (_, index) => ({ id: `i${index}` })),
    } } };
  }
  return components;
}

test('a fan-out over the budget is reported once, at the outermost repeat', () => {
  const list = sources([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }] } }], { components: fanOut(3, 200) });
  const result = lintSources(list);
  const budget = only(result, 'REPEAT_BUDGET_EXCEEDED');
  assert.equal(budget.path, '$.page.slots[0].content[0].repeat');
  assert.ok(!codes(result).includes('BROKEN_COMPONENT_REFERENCE'));
  const onDisk = runValidate({ projectPath: createRepeatProject([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }] } }], { components: fanOut(3, 200) }) });
  assert.deepEqual(onDisk.errors.map((e) => e.code), ['REPEAT_BUDGET_EXCEEDED']);
});

test('an expansion failure inside a row is REPEAT_ROW_FAILED, at its item, in the file that writes it', () => {
  const components = {
    ...COMPONENTS,
    broken: { root: { id: 'broken', component: 'stack', children: [{ id: 'gone', use: 'nowhere' }] } },
    crew: { root: { id: 'list', component: 'stack', repeat: { cell: 'broken', items: [{ id: 'one' }] } } },
  };
  const crew = { id: 'crew', component: 'stack', repeat: { cell: 'broken', items: [{ id: 'one' }, { id: 'two' }] } };
  const list = sources([crew], { components });
  const result = lintSources(list);
  const failed = only(result, 'REPEAT_ROW_FAILED');
  assert.equal(failed.path, '$.page.slots[0].content[0].repeat.items[0]');
  assert.equal(underlined(list, failed), 'id: one');
  assert.equal(failed.severity, 'error');
  assert.match(failed.message, /Item "one" of the repeat on "crew" cannot be expanded: Unknown component reference "nowhere"/);
  assert.ok(!codes(result).includes('BROKEN_COMPONENT_REFERENCE'));

  const inDefinition = only(lintSources(sources([{ id: 'team', use: 'crew' }], { components })), 'REPEAT_ROW_FAILED');
  assert.deepEqual([inDefinition.source, inDefinition.path], ['components.yaml', '$.components.crew.root.repeat.items[0]']);
  const onDisk = runValidate({ projectPath: createRepeatProject([crew], { components }) });
  assert.deepEqual(onDisk.errors.map((e) => e.code), ['REPEAT_ROW_FAILED']);
});
