import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyEdit, contextFor, elementSheet, newProject, Project } from '../.test-build/core.mjs';

const ADD_HEADER = `changes:
  - op: append
    node: main
    value:
      id: title
      component: heading
      props: { text: Billing, level: 1 }
`;

function seeded() {
  const result = applyEdit(newProject('Acme'), ADD_HEADER, 'home');
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.wf;
}

describe('newProject', () => {
  it('is a project the edit engine accepts', () => {
    const project = Project.parse(newProject('Acme'));
    assert.equal(project.name(), 'Acme');
    assert.deepEqual(project.pages().map((page) => page.id), ['home']);
  });

  it('gives each page a path', () => {
    assert.deepEqual(Project.parse(newProject('Acme')).pages()[0].path, '/');
  });

  it('serializes the same way twice', () => {
    assert.equal(newProject('Acme'), newProject('Acme'));
  });
});

describe('applyEdit', () => {
  it('appends to the page slot', () => {
    const page = Project.parse(seeded()).pageDocument('home').page;
    assert.equal(page.slots[0].content[0].id, 'title');
  });

  it('sets a prop by path', () => {
    const result = applyEdit(seeded(), 'changes:\n  - { op: set, node: title, path: props.text, value: Invoices }', 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(Project.parse(result.wf).pageDocument('home').page.slots[0].content[0].props.text, 'Invoices');
  });

  it('inserts after a node and names unnamed nodes', () => {
    const output = 'changes:\n  - op: insertAfter\n    node: title\n    value: { component: paragraph, props: { text: Hello } }';
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const content = Project.parse(result.wf).pageDocument('home').page.slots[0].content;
    assert.deepEqual(content.map((node) => node.id), ['title', 'paragraph_1']);
  });

  it('removes a node', () => {
    const result = applyEdit(seeded(), 'changes:\n  - { op: remove, node: title }', 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(Project.parse(result.wf).pageDocument('home').page.slots[0].content.length, 0);
  });

  it('adds new nodes to the page when the place named does not exist', () => {
    for (const op of ['append', 'insertAfter']) {
      const result = applyEdit(seeded(), `changes:\n  - { op: ${op}, node: ghost, value: { id: note, component: paragraph, props: { text: Hi } } }`, 'home');
      assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
      assert.equal(Project.parse(result.wf).pageDocument('home').page.slots[0].content.at(-1).id, 'note');
    }
  });

  it('accepts a dotted or addressed node reference', () => {
    assert.equal(applyEdit(seeded(), 'changes:\n  - { op: remove, node: main.title }', 'home').ok, true);
    assert.equal(applyEdit(seeded(), 'changes:\n  - { op: remove, node: "page:home#title" }', 'home').ok, true);
  });

  it('lists the valid ids when a change names a missing node', () => {
    const result = applyEdit(seeded(), 'changes:\n  - { op: remove, node: ghost }', 'home');
    assert.match(result.diagnostics[0].message, /ids on this page are: .*title/);
  });

  it('adds a linked page and moves to it', () => {
    const output = `changes:
  - op: addPage
    id: team
    title: Team
    content:
      - { id: team_title, component: heading, props: { text: Team } }
  - op: insertAfter
    node: title
    value:
      id: to_team
      component: button
      props: { label: Team, route: team }
`;
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.page, 'team');
    assert.deepEqual(Project.parse(result.wf).pages().map((page) => page.id), ['home', 'team']);
  });

  it('turns a route prop on a new node into a working link', () => {
    const output = 'changes:\n  - op: append\n    node: main\n    value: { id: go, component: button, props: { label: Go, route: home } }';
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    const button = Project.parse(result.wf).pageDocument('home').page.slots[0].content.at(-1);
    assert.deepEqual(button.interaction, [{ type: 'navigation', targetRoute: 'home' }]);
    assert.equal(button.props.route, undefined);
  });

  it('creates an empty page for a link to one that does not exist', () => {
    const output = 'changes:\n  - op: append\n    node: main\n    value: { id: tabs, component: nav, props: { items: [{ label: Walks, route: walks }] } }';
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.page, 'home');
    assert.deepEqual(Project.parse(result.wf).pages().map((page) => page.id), ['home', 'walks']);
  });

  it('applies changes after addPage to the page the user was on', () => {
    const output = 'changes:\n  - { op: addPage, id: team, content: [] }\n  - { op: append, node: main, value: { id: note, component: paragraph, props: { text: Hi } } }';
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(Project.parse(result.wf).pageDocument('home').page.slots[0].content.at(-1).id, 'note');
    assert.equal(result.page, 'team');
  });

  it('drops spacing written as a string', () => {
    const output = 'changes:\n  - { op: append, node: main, value: { id: s, component: stack, props: { padding: 16px } } }';
    assert.equal(applyEdit(seeded(), output, 'home').ok, true);
  });

  it('removes a page and its route', () => {
    const added = applyEdit(seeded(), 'changes:\n  - { op: addPage, id: team, content: [] }', 'home');
    const result = applyEdit(added.wf, 'changes:\n  - { op: removePage, id: team }', 'team');
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
    assert.equal(result.page, 'home');
    assert.deepEqual(Project.parse(result.wf).routes().map((route) => route.id), ['home']);
  });

  it('reads an answer wrapped in a fence and prose', () => {
    const output = `Here you go:\n\n\`\`\`yaml\n${ADD_HEADER}\`\`\`\nDone.`;
    assert.equal(applyEdit(newProject('Acme'), output, 'home').ok, true);
  });

  for (const [name, output, code] of [
    ['broken YAML', 'changes: [', 'INVALID_YAML'],
    ['prose with no edit', 'I would add a header.', 'INVALID_ENVELOPE'],
    ['an empty edit', 'changes: []', 'NO_CHANGES'],
    ['an unknown operation', 'changes:\n  - { op: rewrite, node: title }', 'UNKNOWN_OP'],
    ['an unknown node', 'changes:\n  - { op: remove, node: ghost }', 'UNKNOWN_NODE'],
    ['a forbidden path', 'changes:\n  - { op: set, node: title, path: id, value: x }', 'PATH_NOT_ALLOWED'],
    ['removing the last page', 'changes:\n  - { op: removePage, id: home }', 'LAST_PAGE'],
    ['a link that cannot be a page', 'changes:\n  - { op: append, node: main, value: { id: x, component: nav, props: { items: [{ label: X, route: "Not A Page" }] } } }', 'UNKNOWN_ROUTE'],
    ['a duplicate id', 'changes:\n  - { op: append, node: main, value: { id: title, component: heading, props: { text: x } } }', 'DUPLICATE_ID'],
  ]) {
    it(`rejects ${name} and reports ${code}`, () => {
      const result = applyEdit(seeded(), output, 'home');
      assert.equal(result.ok, false);
      assert.equal(result.wf, undefined);
      assert.ok(result.diagnostics.some((entry) => entry.code === code), JSON.stringify(result.diagnostics));
    });
  }

  it('rejects an element the schema does not know', () => {
    const output = 'changes:\n  - { op: append, node: main, value: { id: x, component: not_an_element } }';
    const result = applyEdit(seeded(), output, 'home');
    assert.equal(result.ok, false, 'an unknown element must not reach the page');
  });

  it('applies nothing when a later change fails', () => {
    const wf = seeded();
    const output = 'changes:\n  - { op: set, node: title, path: props.text, value: Changed }\n  - { op: remove, node: ghost }';
    assert.equal(applyEdit(wf, output, 'home').ok, false);
    assert.equal(Project.parse(wf).pageDocument('home').page.slots[0].content[0].props.text, 'Billing');
  });
});

describe('elementSheet', () => {
  it('lists each element with its props', () => {
    assert.match(elementSheet(), /^heading: /m);
    assert.match(elementSheet(), /^button: label, icon, variant\(primary\|secondary\|ghost\|danger\|link\)/m);
  });
});

describe('contextFor', () => {
  it('outlines the page and marks the current one', () => {
    const context = contextFor(seeded(), 'home', null);
    assert.match(context.pages, /home \(current\): Home/);
    assert.match(context.outline, /- title \(heading\) "Billing"/);
    assert.equal(context.selected, '');
  });

  it('includes the selected node as YAML', () => {
    const context = contextFor(seeded(), 'home', 'page:home#title');
    assert.match(context.selected, /id: title/);
    assert.equal(context.shared, false);
  });

  it('flags a selection owned by a template as shared', () => {
    assert.equal(contextFor(seeded(), 'home', 'template:main#main').shared, true);
  });
});
