'use strict';

// How the resolver scopes what it prepares: page fills forwarded through a
// component without slots stay the page's, and form ids written on a
// definition root follow the instance id.

const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { resolveTemplatePage } = require('../../engine/resolver');
const { buildTreeTargets } = require('../../engine/tree');
const { createSlotsProject } = require('./fixtures/slots-project');

function resolveInSlot(content, components) {
  const result = resolveTemplatePage({
    template: { regions: [{ id: 'main', kind: 'slot' }] },
    page: { slots: [{ slotId: 'main', content }] },
    components,
  });
  assert.equal(result.ok, true, result.error);
  return result.roots[0].children;
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

const LEGACY = {
  // No placeholders: instance children replace the root's children.
  legacy_card: {
    propDefaults: { snippet: 'Callee' },
    root: { id: 'legacy', component: 'card', children: [{ id: 'legacy_text', component: 'text' }] },
  },
  // Slotted, and forwards its default slot through the legacy card's children.
  root_forward: {
    propDefaults: { snippet: 'Wrapper' },
    root: {
      id: 'root_forward',
      use: 'legacy_card',
      children: [
        { id: 'own_note', component: 'text', props: { text: '{{props.snippet}}' } },
        { id: 'fwd', slot: 'default' },
      ],
    },
  },
  nested_forward: {
    root: {
      id: 'nested_forward',
      component: 'stack',
      children: [{ id: 'inner_card', use: 'legacy_card', children: [{ id: 'fwd', slot: 'default' }] }],
    },
  },
};

const pageFill = () => [{ id: 'author_id', component: 'text', props: { text: '{{props.snippet}}' } }];

test('a page fill forwarded through a root use of a slotless component keeps its id and text', () => {
  const nodes = byId(resolveInSlot([{ id: 'outer', use: 'root_forward', children: pageFill() }], LEGACY));
  const outer = nodes.get('outer');
  assert.equal(outer.component, 'card');
  assert.equal(nodes.get('author_id')?.props.text, '{{props.snippet}}', 'page fills get no callee substitution');
  assert.ok(!nodes.has('outer__author_id'), 'page fills are not namespaced by the callee');
  // Children the wrapper writes directly on the slotless instance keep the legacy override path.
  assert.deepEqual(outer.children.map((node) => node.id), ['outer__outer__own_note', 'author_id']);
  assert.equal(nodes.get('outer__outer__own_note').props.text, 'Wrapper');
});

test('a page fill forwarded through a nested slotless instance keeps its id and text', () => {
  const nodes = byId(resolveInSlot([{ id: 'outer', use: 'nested_forward', children: pageFill() }], LEGACY));
  assert.deepEqual(nodes.get('outer__inner_card').children.map((node) => node.id), ['author_id']);
  assert.equal(nodes.get('author_id').props.text, '{{props.snippet}}');
});

test('children written on a slotless instance still take its props and namespace', () => {
  const nodes = byId(resolveInSlot([{ id: 'direct', use: 'legacy_card', children: pageFill() }], LEGACY));
  assert.deepEqual(nodes.get('direct').children.map((node) => node.id), ['direct__author_id']);
  assert.equal(nodes.get('direct__author_id').props.text, 'Callee');
});

test('a forwarded page fill validates and renders under its page id in a project', () => {
  const projectPath = createSlotsProject((docs) => {
    Object.assign(docs.kit.components, LEGACY);
    docs.page.page.slots[0].content = [
      { id: 'first_forward', use: 'kit.root_forward', children: [{ id: 'first_fill', component: 'text' }] },
      { id: 'second_forward', use: 'kit.root_forward', children: [{ id: 'second_fill', component: 'text' }] },
    ];
  });
  assert.deepEqual(runValidate({ projectPath }).errors, []);
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  const nodes = byId(tree.trees[0].roots.find((root) => root.id === 'main').children);
  assert.deepEqual(nodes.get('second_forward').children.map((node) => node.id), ['second_forward__second_forward__own_note', 'second_fill']);
});

const FORMS = {
  slotted_form: {
    root: {
      id: 'typed',
      component: 'form',
      children: [
        { id: 'fields', slot: 'default' },
        { id: 'send', component: 'button', interaction: [{ type: 'submit', formId: 'typed' }] },
      ],
    },
  },
  legacy_form: {
    root: {
      id: 'typed',
      component: 'form',
      children: [{ id: 'send', component: 'button', interaction: [{ type: 'submit', formId: 'typed' }] }],
    },
  },
  // The root submits a form inside itself.
  root_submit: {
    root: {
      id: 'root_submit',
      component: 'stack',
      interaction: [{ type: 'submit', formId: 'inner_form' }],
      children: [{ id: 'inner_form', component: 'form' }, { id: 'more', slot: 'more' }],
    },
  },
};

test('a submit inside a component targets its own instance root, per instance', () => {
  for (const use of ['slotted_form', 'legacy_form']) {
    const nodes = byId(resolveInSlot([{ id: 'first', use }, { id: 'second', use }], FORMS));
    assert.deepEqual(nodes.get('first__send').interaction, [{ type: 'submit', formId: 'first' }], use);
    assert.deepEqual(nodes.get('second__send').interaction, [{ type: 'submit', formId: 'second' }], use);
  }
});

test('interactions authored on a definition root follow renamed ids; the caller\'s do not', () => {
  const nodes = byId(resolveInSlot([
    { id: 'own', use: 'root_submit' },
    { id: 'caller', use: 'root_submit', interaction: [{ type: 'submit', formId: 'inner_form' }] },
    { id: 'inner_form', component: 'form' },
  ], FORMS));
  assert.deepEqual(nodes.get('own').interaction, [{ type: 'submit', formId: 'own__inner_form' }]);
  assert.deepEqual(nodes.get('caller').interaction, [{ type: 'submit', formId: 'inner_form' }], 'caller overrides are the caller\'s scope');

  const legacy = { root_submit: { root: { ...FORMS.root_submit.root, children: [{ id: 'inner_form', component: 'form' }] } } };
  const legacyNodes = byId(resolveInSlot([
    { id: 'own', use: 'root_submit' },
    { id: 'caller', use: 'root_submit', interaction: [{ type: 'submit', formId: 'inner_form' }] },
  ], legacy));
  assert.deepEqual(legacyNodes.get('own').interaction, [{ type: 'submit', formId: 'own__inner_form' }]);
  assert.deepEqual(legacyNodes.get('caller').interaction, [{ type: 'submit', formId: 'inner_form' }]);
});

test('two instances of a slotted form validate and each submits to its own root', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.kit.components.slotted_form = FORMS.slotted_form;
    docs.page.page.slots[0].content = [
      { id: 'login_form', use: 'kit.slotted_form', children: [{ id: 'email', component: 'input' }] },
      { id: 'signup_form', use: 'kit.slotted_form', children: [{ id: 'name', component: 'input' }] },
    ];
  });
  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  const nodes = byId(tree.trees[0].roots.find((root) => root.id === 'main').children);
  assert.deepEqual(nodes.get('login_form__send').interaction, [{ type: 'submit', formId: 'login_form' }]);
  assert.deepEqual(nodes.get('signup_form__send').interaction, [{ type: 'submit', formId: 'signup_form' }]);
});
