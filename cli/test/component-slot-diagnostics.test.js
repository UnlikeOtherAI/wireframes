'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { checkComponentSlots } = require('../../engine/doctor/component-slots');
const { createSlotsProject } = require('./fixtures/slots-project');

const codes = (entries) => entries.map((entry) => entry.code);

function validateWith(mutate) {
  return runValidate({ projectPath: createSlotsProject(mutate) });
}

test('a fill for a slot the component lacks lists the valid slots', () => {
  const result = validateWith((docs) => {
    docs.page.page.slots[0].content[2].slots = { header: [{ id: 'oops', component: 'text' }] };
  });
  const entry = result.errors.find((error) => error.code === 'UNKNOWN_COMPONENT_SLOT');
  assert.ok(entry, JSON.stringify(result.errors));
  assert.match(entry.message, /"plain_panel".*"header".*Valid slots: "default", "footer"\./);
});

test('children on an instance without a default slot are an unknown fill', () => {
  const result = validateWith((docs) => {
    docs.kit.components.panel.root.children.shift();
    docs.page.page.slots[0].content[2].children = [{ id: 'stray', component: 'text' }];
  });
  assert.ok(result.errors.some((error) => error.code === 'UNKNOWN_COMPONENT_SLOT' && /children.*"default"/.test(error.message)));
});

test('slots on an instance of a component without placeholders are unknown', () => {
  const result = validateWith((docs) => {
    docs.page.page.slots[0].content.push({ id: 'badge_instance', use: 'kit.ui.badge', slots: { label: [] } });
  });
  assert.ok(result.errors.some((error) => error.code === 'UNKNOWN_COMPONENT_SLOT' && /declares no slots/.test(error.message)));
});

test('two placeholders with one name are a duplicate slot', () => {
  const result = validateWith((docs) => {
    docs.kit.components.panel.root.children.push({ id: 'footer_again', slot: 'footer' });
  });
  assert.ok(result.errors.some((error) => error.code === 'DUPLICATE_COMPONENT_SLOT' && /"kit\.panel".*"footer" 2 times/.test(error.message)));
});

test('children and slots.default together are an error', () => {
  const result = validateWith((docs) => {
    docs.page.page.slots[0].content[0].slots.default = [{ id: 'second_default', component: 'text' }];
  });
  assert.ok(result.errors.some((error) => error.code === 'DUPLICATE_DEFAULT_SLOT_FILL' && /"first_checkout"/.test(error.message)));
});

test('a placeholder in a page is outside a component', () => {
  const result = validateWith((docs) => {
    docs.page.page.slots[0].content[0].children.push({ id: 'page_slot', slot: 'default' });
    docs.page.page.slots[0].content.push({ id: 'top_slot', slot: 'default' });
  });
  const messages = result.errors.filter((error) => error.code === 'SLOT_OUTSIDE_COMPONENT').map((error) => error.message);
  assert.equal(messages.length, 2, JSON.stringify(result.errors));
  assert.match(messages[0], /"page_slot".*page "home"/);
  assert.match(messages[1], /"top_slot".*page "home"/);
});

test('a placeholder as a component root is outside a component', () => {
  const result = validateWith((docs) => {
    docs.kit.components.hollow = { root: { id: 'hollow', slot: 'default' } };
    docs.page.page.slots[0].content.push({ id: 'hollow_instance', use: 'kit.hollow' });
  });
  assert.ok(result.errors.some((error) => error.code === 'SLOT_OUTSIDE_COMPONENT' && /"kit\.hollow" has a slot placeholder as its root/.test(error.message)));
});

test('a placeholder in a template is outside a component', () => {
  const templateResult = checkComponentSlots({
    templates: { main: { regions: [{ id: 'header', kind: 'persistent', children: [{ id: 'x', slot: 'default' }] }] } },
  });
  assert.deepEqual(codes(templateResult), ['SLOT_OUTSIDE_COMPONENT']);
  assert.match(templateResult[0].message, /template "main"/);
});

test('slots on a node without use: are an error', () => {
  const result = validateWith((docs) => {
    docs.page.page.slots[0].content.push({ id: 'loose', component: 'stack', slots: { footer: [] } });
    docs.kit.components.panel.root.slots = { footer: [] };
  });
  const messages = result.errors.filter((error) => error.code === 'SLOTS_WITHOUT_USE').map((error) => error.message);
  assert.equal(messages.length, 2, JSON.stringify(result.errors));
  assert.ok(messages.some((message) => /"loose" in page "home"/.test(message)));
  assert.ok(messages.some((message) => /"panel" in component "kit\.panel"/.test(message)));
});

test('a component-internal instance that leaves a slot empty reports info', () => {
  const result = validateWith((docs) => {
    docs.kit.components.wrapper = {
      root: { id: 'wrapper', component: 'stack', children: [{ id: 'inner', use: 'panel' }] },
    };
    docs.page.page.slots[0].content.push({ id: 'wrapped', use: 'kit.wrapper' });
  });
  assert.equal(result.ok, true);
  assert.ok(result.info.some((entry) => entry.code === 'EMPTY_COMPONENT_SLOT' && /"inner".*component "kit\.wrapper".*"default"/.test(entry.message)));
});

test('the in-memory validate entry point reports slot diagnostics', () => {
  const definitions = {
    panel: {
      root: {
        id: 'panel',
        component: 'card',
        children: [{ id: 'body', slot: 'default' }, { id: 'footer', slot: 'footer', children: [] }],
      },
    },
  };
  const page = (content) => ({
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: { id: 'home', template: 'main', viewport: { device: 'web' }, slots: [{ slotId: 'main', content }] },
  });
  const documentMap = {
    templates: { documentType: 'templates', specVersion: '1.1', id: 'templates',
      templates: { main: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } } },
    components: { documentType: 'components', specVersion: '1.1', id: 'components', components: definitions },
    pages: new Map([['home', page([
      { id: 'instance', use: 'panel', children: [{ id: 'a', component: 'text' }], slots: { default: [], aside: [] } },
      { id: 'quiet', use: 'panel' },
      { id: 'loose', component: 'stack', slots: { footer: [] } },
    ])]]),
  };
  const result = validateProject(documentMap);
  assert.deepEqual(codes(result.errors).sort(), ['DUPLICATE_DEFAULT_SLOT_FILL', 'SLOTS_WITHOUT_USE', 'UNKNOWN_COMPONENT_SLOT']);
  assert.deepEqual(codes(result.info), ['EMPTY_COMPONENT_SLOT'], 'footer has an empty fallback, so only quiet/default is empty');
});

test('the projects without slots report no slot diagnostics', () => {
  const result = runValidate({ projectPath: createSlotsProject((docs) => {
    docs.page.page.slots[0].content = [{ id: 'just_text', component: 'text', props: { text: 'Hi' } }];
  }) });
  const slotCodes = /SLOT|SLOTS_WITHOUT_USE/;
  assert.ok(![...result.errors, ...result.info].some((entry) => slotCodes.test(entry.code)));
});
