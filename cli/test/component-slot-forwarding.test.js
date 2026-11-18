'use strict';

// How the resolver scopes what it prepares: form ids written on a definition
// root follow the instance id.

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
