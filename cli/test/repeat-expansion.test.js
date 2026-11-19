'use strict';

// `repeat` renders one cell per keyed item, exactly as if the rows had been
// written by hand: same ids, author scope, form references and markup.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { resolveTemplatePage } = require('../../engine/resolver');
const { assertComponentExpansion } = require('../../engine/component-registry/expansion');
const { validateProject } = require('../../engine/validate');
const { COMPONENTS, PEOPLE, documentMap } = require('./fixtures/repeat-project');

function resolveInSlot(content, components = COMPONENTS) {
  return resolveTemplatePage({
    template: { regions: [{ id: 'main', kind: 'slot' }] },
    page: { slots: [{ slotId: 'main', content }] },
    components,
  });
}

function byId(nodes) {
  const map = new Map();
  const visit = (node) => {
    map.set(node.id, node);
    for (const child of node.children || []) visit(child);
  };
  nodes.forEach(visit);
  return map;
}

function resolvedById(content, components) {
  const result = resolveInSlot(content, components);
  assert.equal(result.ok, true, result.error);
  return byId(result.roots[0].children);
}

function html(content, options = {}) {
  const result = renderPage(documentMap(content, options), 'home');
  assert.equal(result.ok, true, result.error);
  return result.html;
}

const STATS = [
  { id: 'revenue', label: 'Revenue', value: '$12.4k', delta: '+8%', trend: 'up' },
  { id: 'users', label: 'Users', value: '1,204' },
];

for (const mode of ['card', 'line']) {
  test(`element cells render byte-identically to hand-written children (${mode})`, () => {
    const repeated = html([{
      id: 'kpis',
      component: 'row',
      children: [{ id: 'kpi_title', component: 'heading', props: { text: 'This week' } }],
      repeat: { cell: 'stat', items: STATS },
    }], { mode });
    const handWritten = html([{
      id: 'kpis',
      component: 'row',
      children: [
        { id: 'kpi_title', component: 'heading', props: { text: 'This week' } },
        ...STATS.map(({ id, ...props }) => ({ id: `kpis__${id}`, component: 'stat', props })),
      ],
    }], { mode });
    assert.equal(repeated, handWritten);
    assert.match(repeated, /id="kpis__revenue"/);
  });

  test(`component cells render byte-identically to hand-written instances (${mode})`, () => {
    const repeated = html([{ id: 'team', component: 'grid', layout: { type: 'grid', columns: 3 }, repeat: { cell: 'person_card', items: PEOPLE } }], { mode });
    const handWritten = html([{
      id: 'team',
      component: 'grid',
      layout: { type: 'grid', columns: 3 },
      children: PEOPLE.map(({ id, ...props }) => ({ id: `team__${id}`, use: 'person_card', props })),
    }], { mode });
    assert.equal(repeated, handWritten);
    assert.match(repeated, /id="team__grace__name"/);
  });
}

test('an element alias is an element cell; anything else is a component reference', () => {
  const nodes = resolvedById([{ id: 'kpis', component: 'row', repeat: { cell: 'kpi', items: [{ id: 'mrr', label: 'MRR' }] } }]);
  assert.equal(nodes.get('kpis__mrr').component, 'kpi');
  assert.deepEqual(nodes.get('kpis__mrr').props, { label: 'MRR' });
  const people = resolvedById([{ id: 'team', component: 'stack', repeat: { cell: 'person_card', items: [{ id: 'ada', name: 'Ada' }] } }]);
  assert.equal(people.get('team__ada').component, 'card');
  assert.equal(people.get('team__ada__name').props.text, 'Ada');
  assert.equal(people.get('team__ada__role').props.text, 'Member', 'an item key the cell does not get comes from propDefaults');
});

test('a rendered host has its rows instead of its repeat', () => {
  const nodes = resolvedById([{ id: 'kpis', component: 'row', repeat: { cell: 'stat', items: STATS } }]);
  assert.equal(Object.hasOwn(nodes.get('kpis'), 'repeat'), false);
  assert.deepEqual(nodes.get('kpis').children.map((node) => node.id), ['kpis__revenue', 'kpis__users']);
});

test('items: [] renders no rows', () => {
  const nodes = resolvedById([{ id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [] } }]);
  assert.deepEqual(nodes.get('kpis').children ?? [], []);
});

test('definition-owned items get the definition props, per instance', () => {
  const nodes = resolvedById([
    { id: 'core', use: 'team_section', props: { team: 'Core' } },
    { id: 'docs', use: 'team_section', props: { team: 'Docs', lead: 'Grace Hopper' } },
  ]);
  assert.equal(nodes.get('core__team__lead__name_field').props.value, 'Ada Lovelace');
  assert.equal(nodes.get('docs__team__lead__name_field').props.value, 'Grace Hopper');
  assert.ok(nodes.has('core__team__grace') && nodes.has('docs__team__grace'), 'rows are namespaced per instance');
  assert.ok(!nodes.has('team__lead'));
});

test('references between a definition row and its siblings are rewritten with the scope', () => {
  const nodes = resolvedById([
    { id: 'core', use: 'team_section' },
    { id: 'docs', use: 'team_section', props: { team: 'Docs' } },
  ]);
  assert.deepEqual(nodes.get('core__save_lead').interaction, [{ type: 'submit', formId: 'core__team__lead' }]);
  assert.deepEqual(nodes.get('docs__save_lead').interaction, [{ type: 'submit', formId: 'docs__team__lead' }]);
  assert.equal(nodes.get('docs__save_lead').props.label, 'Save Docs lead');
});

test("a form cell's own submit follows its row", () => {
  const nodes = resolvedById([{ id: 'team', component: 'stack', repeat: { cell: 'person_form', items: PEOPLE.map(({ id, name }) => ({ id, name })) } }]);
  assert.equal(nodes.get('team__grace').component, 'form');
  assert.deepEqual(nodes.get('team__grace__save').interaction, [{ type: 'submit', formId: 'team__grace' }]);
});

test('a page repeat in a fill forwarded through another component keeps page ids and page text', () => {
  const nodes = resolvedById([{
    id: 'outer',
    use: 'forwarder',
    children: [{ id: 'crew', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one', text: '{{props.name}}' }] } }],
  }]);
  assert.equal(nodes.get('crew__one').props.text, '{{props.name}}', 'caller rows get no callee substitution');
  assert.ok(!nodes.has('outer__crew__one'), 'caller rows are not namespaced by the callee');
  assert.deepEqual(nodes.get('outer__inner').children.map((node) => node.id), ['crew']);
});

test('a repeat on a use:, an injectable or a placeholder never renders', () => {
  const nodes = resolvedById([
    { id: 'card_use', use: 'person_card', repeat: { cell: 'text', items: [{ id: 'x', text: 'X' }] } },
  ]);
  assert.ok(![...nodes.keys()].some((id) => id.endsWith('__x')));
  const slotted = {
    ...COMPONENTS,
    holder: { root: { id: 'holder', component: 'stack', children: [{ id: 'spot', slot: 'default', repeat: { cell: 'text', items: [{ id: 'y' }] } }] } },
  };
  const filled = resolvedById([{ id: 'h', use: 'holder', children: [{ id: 'fill', component: 'text' }] }], slotted);
  assert.deepEqual(filled.get('h').children.map((node) => node.id), ['fill']);
});

test('validation accepts form references to and from rows and an overlay trigger on a row', () => {
  const map = documentMap([
    { id: 'team', component: 'stack', repeat: { cell: 'person_form', items: [{ id: 'ada', name: 'Ada' }] } },
    { id: 'submit_ada', component: 'button', props: { label: 'Submit Ada' }, interaction: [{ type: 'submit', formId: 'team__ada' }] },
    { id: 'core', use: 'team_section' },
  ], {
    page: {
      overlays: [{ id: 'ada_menu', type: 'dropdown', trigger: 'team__ada', placement: 'bottom', content: [{ id: 'menu_text', component: 'text', props: { text: 'Menu' } }] }],
    },
  });
  const result = validateProject(map);
  assert.deepEqual(result.errors, []);
  const page = renderPage(map, 'home');
  assert.equal(page.ok, true, page.error);
  assert.match(page.html, /id="ada_menu"[^>]*data-wf-overlay-trigger="team__ada"/);
  assert.match(page.html, /<form id="team__ada"/);
});

test('assertComponentExpansion counts every row a component cell expands to', () => {
  const definitions = structuredClone(COMPONENTS);
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, name: 'P' }));
  const one = assertComponentExpansion([{ id: 'team', component: 'stack', repeat: { cell: 'person_card', items: items.slice(0, 1) } }], definitions);
  const ten = assertComponentExpansion([{ id: 'team', component: 'stack', repeat: { cell: 'person_card', items } }], definitions);
  const card = assertComponentExpansion([{ id: 'one', use: 'person_card' }], definitions);
  assert.ok(ten - one >= 9 * card, `ten rows (${ten}) cost at least nine more cards than one (${one}, card ${card})`);
});

function fanOut(levels, width) {
  const components = {};
  for (let level = 0; level < levels; level += 1) {
    const cell = level === levels - 1 ? 'text' : `level_${level + 1}`;
    components[`level_${level}`] = {
      root: {
        id: `level_${level}`,
        component: 'stack',
        repeat: { cell, items: Array.from({ length: width }, (_, index) => ({ id: `i${index}` })) },
      },
    };
  }
  return components;
}

test('nested fan-out stops at the budget before it allocates', () => {
  const components = fanOut(4, 200);
  const started = Date.now();
  const result = resolveInSlot([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }, { id: 'b' }] } }], components);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'repeat-budget');
  assert.equal(result.host?.id, 'wall', 'the outermost repeat is the one reported');
  assert.ok(Date.now() - started < 2000, 'nothing close to 3.2 billion rows was materialized');
  assert.throws(() => assertComponentExpansion([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }] } }], components), /too large/);
});

test('a real definition cycle through a cell is still a cycle', () => {
  const components = {
    looper: { root: { id: 'looper', component: 'stack', repeat: { cell: 'looper', items: [{ id: 'again' }] } } },
  };
  const result = resolveInSlot([{ id: 'loop', use: 'looper' }], components);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'circular-component');
  assert.throws(() => assertComponentExpansion([{ id: 'loop', use: 'looper' }], components), /Circular/);
});

// Each node is expanded once: before, every level resolved its children again,
// so the work doubled per level and the row budget could not count nodes.
test('a deep tree resolves each node once', () => {
  let node = { id: 'leaf', component: 'text' };
  for (let depth = 22; depth > 0; depth -= 1) node = { id: `level_${depth}`, component: 'stack', children: [node] };
  const started = Date.now();
  assert.equal(resolveInSlot([node]).ok, true);
  assert.ok(Date.now() - started < 1000, `took ${Date.now() - started} ms`);
});

// Item values are plain props (REPEAT_ITEM_TOKEN), so a row prints an item token
// as written; outside rows, and inside a collection in a row, tokens resolve as before.
test('an {{item.…}} token in a row renders as written; elsewhere it is unchanged', () => {
  const bound = { source: 'people' };
  const components = {
    greeter: { root: { id: 'greeter', component: 'text', props: { text: '{{props.greeting}}' } } },
    people_list: { root: { id: 'people_list', component: 'stack', children: [{ id: 'person', component: 'text', binding: bound, props: { text: '{{item.name}}' } }] } },
  };
  const map = documentMap([
    { id: 'token', component: 'stack', repeat: { cell: 'text', items: [{ id: 'one', text: 'Hi {{item.name}}' }] } },
    { id: 'greet', component: 'stack', repeat: { cell: 'greeter', items: [{ id: 'ada', greeting: 'Hello {{item.name}}' }] } },
    { id: 'fields', component: 'form', repeat: { cell: 'input', items: [{ id: 'q', label: 'Query', placeholder: 'e.g. {{item.hint}}' }] } },
    { id: 'loose', component: 'text', props: { text: 'Bye {{item.name}}' } },
    { id: 'lists', component: 'stack', repeat: { cell: 'people_list', items: [{ id: 'one' }] } },
  ], { components, page: { dataSources: [{ id: 'people', dataset: 'people_data' }] } });
  map.datasets.set('people_data', {
    documentType: 'dataset', specVersion: '1.1', id: 'people_data',
    dataset: { id: 'people_data', primaryKey: 'name', items: [{ name: 'Ada' }, { name: 'Grace' }] },
  });
  const result = renderPage(map, 'home');
  assert.equal(result.ok, true, result.error);
  assert.match(result.html, /id="token__one"[^>]*>Hi \{\{item\.name\}\}</);
  assert.match(result.html, /id="greet__ada"[^>]*>Hello \{\{item\.name\}\}</);
  assert.match(result.html, /placeholder="e\.g\. \{\{item\.hint\}\}"/);
  assert.match(result.html, /id="loose"[^>]*>Bye <span class="wf-bar"/, 'outside a row the token is still a skeleton');
  assert.match(result.html, /id="lists__one__person_0"[^>]*>Ada</, 'a collection inside a row still binds its items');
  assert.match(result.html, /id="lists__one__person_1"[^>]*>Grace</);
});
