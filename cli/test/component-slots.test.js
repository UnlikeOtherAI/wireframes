'use strict';

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTreeTargets } = require('../../engine/tree');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { resolveTemplatePage } = require('../../engine/resolver');
const { removeComponent } = require('../../engine/component');
const { assertComponentExpansion } = require('../../engine/component-registry/expansion');
const { findComponentUsages } = require('../../engine/introspection/usage');
const { createSlotsProject, readYaml, writeYaml } = require('./fixtures/slots-project');

function mainNodes(projectPath) {
  const tree = buildTreeTargets({ projectPath, targetType: 'page', targetId: 'home' });
  assert.equal(tree.ok, true, tree.error);
  return tree.trees[0].roots.find((root) => root.id === 'main').children;
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

function resolveInSlot(content, components) {
  return resolveTemplatePage({
    template: { regions: [{ id: 'main', kind: 'slot' }] },
    page: { slots: [{ slotId: 'main', content }] },
    components,
  });
}

test('two-layer forwarding prepares each layer in its author scope', () => {
  const nodes = byId(mainNodes(createSlotsProject()));
  const panel = nodes.get('first_checkout__pay_panel');

  assert.equal(panel.component, 'card');
  assert.equal(panel.props.title, 'Order', 'checkout props flow into panel props');
  assert.deepEqual(panel.children.map((node) => node.id), [
    'first_checkout__note',
    'first_checkout__trust',
    'page_summary',
    'first_checkout__pay',
    'first_extra',
  ]);
  assert.equal(nodes.get('first_checkout__note').props.text, 'Review your order', 'checkout propDefaults fill its own tokens');
  assert.equal(nodes.get('first_checkout__trust').component, 'badge', 'the locally imported ui.badge resolves inside forwarded content');
  assert.equal(nodes.get('first_checkout__trust').props.text, 'Secure');
  assert.equal(nodes.get('page_summary').props.text, 'Two items', 'page fills keep page ids');
  assert.equal(nodes.get('first_checkout__pay').props.label, 'Pay Order');
  assert.deepEqual(nodes.get('first_checkout__pay').interaction, [{ type: 'submit', formId: 'first_checkout__pay_form' }]);
  assert.equal(nodes.get('first_extra').props.label, 'Save for later', 'the forwarded actions slot carries the page fill');
  assert.ok(!nodes.has('first_checkout__close'), 'a filled footer drops the fallback');
  for (const node of nodes.values()) {
    assert.ok(!Object.hasOwn(node, 'slot'), `placeholder ${node.id} must not survive resolution`);
    assert.ok(!Object.hasOwn(node, 'slots'), `slots on ${node.id} must not survive resolution`);
  }
});

test('two instances of the forwarding component keep ids and form references apart', () => {
  const projectPath = createSlotsProject();
  const nodes = byId(mainNodes(projectPath));
  assert.deepEqual(nodes.get('second_checkout__pay').interaction, [{ type: 'submit', formId: 'second_checkout__pay_form' }]);
  assert.ok(nodes.has('first_checkout__pay_form'));
  assert.ok(nodes.has('second_checkout__pay_form'));
  assert.equal(nodes.get('second_checkout__pay_panel').props.title, 'Gift');

  const result = runValidate({ projectPath });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.warnings, []);
});

test('fallbacks, explicit empty fills and empty slots', () => {
  const projectPath = createSlotsProject();
  const nodes = byId(mainNodes(projectPath));
  assert.deepEqual(nodes.get('plain_panel').children.map((node) => node.id), ['plain_panel__close'], 'omitted footer uses the fallback');
  assert.equal(nodes.get('plain_panel').props.title, 'Details', 'a root prop written as its own token falls back to propDefaults');
  assert.deepEqual(
    nodes.get('second_checkout__pay_panel').children.map((node) => node.id),
    ['second_checkout__note', 'second_checkout__trust', 'second_checkout__pay'],
    'actions: [] renders nothing and the unfilled default slot renders nothing',
  );

  const { info } = runValidate({ projectPath });
  const empty = info.filter((entry) => entry.code === 'EMPTY_COMPONENT_SLOT').map((entry) => entry.message);
  assert.equal(empty.length, 2);
  assert.match(empty[0], /"second_checkout".*slot "default"/);
  assert.match(empty[1], /"plain_panel".*slot "default"/);
  assert.ok(!empty.some((message) => message.includes('"actions"')), 'an explicit [] is intentional and reports nothing');
});

test('a caller-authored instance of the same component inside a fill is finite nesting', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.page.page.slots[0].content = [{
      id: 'outer_panel',
      use: 'kit.panel',
      children: [{
        id: 'inner_panel',
        use: 'kit.panel',
        props: { title: 'Inner' },
        children: [{ id: 'inner_text', component: 'text', props: { text: 'Nested' } }],
      }],
    }];
  });
  const nodes = byId(mainNodes(projectPath));
  assert.deepEqual(nodes.get('outer_panel').children.map((node) => node.id), ['inner_panel', 'outer_panel__close']);
  assert.deepEqual(nodes.get('inner_panel').children.map((node) => node.id), ['inner_text', 'inner_panel__close']);
  assert.equal(runValidate({ projectPath }).ok, true);
});

test('a definition cycle through a fallback is still an error', () => {
  const components = {
    looper: {
      root: {
        id: 'looper',
        component: 'stack',
        children: [{ id: 'more', slot: 'default', children: [{ id: 'again', use: 'looper' }] }],
      },
    },
  };
  const result = resolveInSlot([{ id: 'loop', use: 'looper' }], components);
  assert.equal(result.ok, false);
  assert.match(result.error, /Circular component reference detected for "looper"/);

  // Resolution only expands what renders: a filled slot never reaches the
  // cyclic fallback. Validation still reports the definition cycle.
  const filled = resolveInSlot([{ id: 'loop', use: 'looper', children: [{ id: 'safe', component: 'text' }] }], components);
  assert.equal(filled.ok, true);
  assert.throws(() => assertComponentExpansion([{ id: 'loop', use: 'looper', children: [] }], components), /Circular/);

  const projectPath = createSlotsProject((docs) => {
    docs.kit.components.looper = components.looper;
    docs.page.page.slots[0].content.push({ id: 'loop', use: 'kit.looper', children: [{ id: 'safe', component: 'text' }] });
  });
  const validation = runValidate({ projectPath });
  assert.ok(validation.errors.some((entry) => entry.code === 'CIRCULAR_TEMPLATE_REFERENCE' && /kit\.looper/.test(entry.message)));
});

test('a component used only inside a fill counts as used and cannot be removed', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.components.components = {
      chip: { root: { id: 'chip', component: 'badge', props: { text: 'New' } } },
    };
    docs.page.page.slots[0].content[0].slots.actions.push({ id: 'new_chip', use: 'chip' });
  });
  const result = runValidate({ projectPath });
  assert.ok(!result.warnings.some((entry) => entry.code === 'UNUSED_COMPONENT'), JSON.stringify(result.warnings));
  assert.ok(byId(mainNodes(projectPath)).has('new_chip'));

  const removal = removeComponent({ projectPath, componentId: 'chip' });
  assert.equal(removal.ok, false);
  assert.deepEqual(removal.details.usages, ['page:home']);

  const usages = findComponentUsages(projectPath, 'chip');
  assert.equal(usages.ok, true);
  assert.ok(JSON.stringify(usages).includes('page:home'), JSON.stringify(usages));
});

test('a component without placeholders keeps the override path', () => {
  const components = {
    menu: {
      root: {
        id: 'menu',
        component: 'section',
        props: { title: '{{props.title}}' },
        children: [{ id: 'item', component: 'button', props: { label: 'Item' } }],
      },
    },
  };
  const result = resolveInSlot([{
    id: 'custom_menu',
    use: 'menu',
    props: { title: 'Menu' },
    children: [{ id: 'own', component: 'text', props: { text: '{{props.title}}' } }],
  }], components);
  assert.equal(result.ok, true);
  const instance = result.roots[0].children[0];
  assert.deepEqual(instance.children.map((node) => node.id), ['custom_menu__own'], 'instance children replace the root children and are namespaced');
  assert.equal(instance.children[0].props.text, 'Menu', 'override children still get the component props, as before');
});

test('fills inside a component without placeholders of its own belong to it', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.kit.components.receipt = {
      root: {
        id: 'receipt',
        component: 'stack',
        children: [{
          id: 'receipt_panel',
          use: 'panel',
          slots: { footer: [{ id: 'print', component: 'button', props: { label: 'Print' } }] },
        }],
      },
    };
    docs.page.page.slots[0].content = [{ id: 'first_receipt', use: 'kit.receipt' }, { id: 'second_receipt', use: 'kit.receipt' }];
  });
  const nodes = byId(mainNodes(projectPath));
  assert.ok(nodes.has('first_receipt__print'));
  assert.ok(nodes.has('second_receipt__print'));
  assert.equal(runValidate({ projectPath }).errors.length, 0);
});

test('fixture files stay readable YAML', () => {
  const projectPath = createSlotsProject();
  const kit = readYaml(path.join(projectPath, 'components', 'kit.yaml'));
  assert.equal(kit.components.panel.root.children[1].slot, 'footer');
  writeYaml(path.join(projectPath, 'components', 'kit.yaml'), kit);
});
