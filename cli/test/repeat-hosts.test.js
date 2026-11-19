'use strict';

// Which elements may host repeat rows comes from the renderers themselves, and
// a rendered row is stamped with where its item is written.

const test = require('node:test');
const assert = require('node:assert/strict');

const { PRIMITIVE_RENDERERS } = require('../../engine/renderer/primitives/index');
const lib = require('../../engine/renderer/render-lib');
const { primitiveNames } = require('../../engine/schema/primitive-registry');
const { rendersAuthoredChildren } = require('../../engine/renderer/child-hosts');
const { renderPage } = require('../../engine/build');
const { documentMap } = require('./fixtures/repeat-project');

const CONTEXT = {
  bindingContext: { props: {}, item: {}, itemVar: 'item' },
  stateBindings: {},
  routeTable: {},
  navAttrs: () => '',
  link: (body) => body,
  tableRows: () => [],
  cellValue: () => null,
  imageOptions: {},
  currentRoute: '',
};

/** What the element's renderer says about the node: it lays out the children only with `useChildren`. */
function renderLaysOutChildren(node) {
  const result = PRIMITIVE_RENDERERS[node.component](node, CONTEXT, lib);
  return typeof result === 'object' && result?.useChildren === true;
}

test('the hosts are exactly the elements whose renderer lays out authored children', () => {
  const children = [{ id: 'child', component: 'text', props: { text: 'Child' } }];
  const cases = [
    ...primitiveNames().map((name) => ({ id: 'host', component: name, children })),
    { id: 'host', component: 'tab_bar', props: { tabs: [{ label: 'One' }] }, children },
    { id: 'host', component: 'bottom_tab_bar', props: { tabs: [{ label: 'One' }] }, children },
    { id: 'host', component: 'app_bar', props: { title: 'Title' }, children },
  ];
  for (const node of cases) {
    assert.equal(rendersAuthoredChildren(node), renderLaysOutChildren(node), `${node.component} ${JSON.stringify(node.props || {})}`);
  }
  assert.equal(rendersAuthoredChildren({ id: 'h', component: 'kpi' }), false, 'an alias is its element');
  assert.equal(rendersAuthoredChildren({ id: 'h', component: 'tabs' }), true);
});

for (const mode of ['card', 'line']) {
  test(`a host that drops children renders no rows (${mode})`, () => {
    const { html } = renderPage(documentMap([
      { id: 'tile', component: 'stat', props: { label: 'Users' }, repeat: { cell: 'text', items: [{ id: 'lost', text: 'Lost row' }] } },
      { id: 'tabs', component: 'tab_bar', props: { tabs: [{ label: 'A' }] }, repeat: { cell: 'text', items: [{ id: 'gone', text: 'Gone row' }] } },
    ], { mode }), 'home');
    assert.doesNotMatch(html, /Lost row|Gone row|tile__lost|tabs__gone/);
  });
}

test('a rendered row is stamped with its document and its item path', () => {
  const { html } = renderPage(documentMap([
    { id: 'team', component: 'stack', repeat: { cell: 'person_card', items: [{ id: 'ada', name: 'Ada' }] } },
    { id: 'core', use: 'team_section' },
  ]), 'home', { annotateSource: true });
  assert.match(html, /id="team__ada"[^>]*data-wf-source="page:home#team__ada" data-wf-source-path="page\.slots\[0\]\.content\[0\]\.repeat\.items\[0\]"/);
  assert.match(html, /id="core__team__lead"[^>]*data-wf-source="component:team_section#team__lead" data-wf-source-path="root\.children\[0\]\.repeat\.items\[0\]"/);
  assert.match(html, /id="team__ada__name"[^>]*data-wf-source="component:person_card#name"/, 'a cell\'s internals point at its definition');
});
