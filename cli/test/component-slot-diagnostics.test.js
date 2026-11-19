'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { checkComponentSlots } = require('../../engine/doctor/component-slots');
const { runLint } = require('../../engine/lint');
const { lintSources } = require('../../engine/lint/source');
const { createSlotsProject } = require('./fixtures/slots-project');

const codes = (entries) => entries.map((entry) => entry.code);

function validateWith(mutate) {
  return runValidate({ projectPath: createSlotsProject(mutate) });
}

/** A project folder as the sources the in-memory linter takes: every YAML document but `.wfrc.yaml`. */
function readSources(root, folder = '') {
  return fs.readdirSync(path.join(root, folder), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const name = folder ? `${folder}/${entry.name}` : entry.name;
      if (entry.isDirectory()) return readSources(root, name);
      if (!/\.ya?ml$/.test(entry.name) || entry.name === '.wfrc.yaml') return [];
      return [{ name, text: fs.readFileSync(path.join(root, name), 'utf8') }];
    });
}

/** Disk and memory agree on every slot finding; memory also says where each is. */
test('the source linter reports the same slot findings as wf validate, each with a range', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.page.page.slots[0].content[2].slots = { header: [{ id: 'oops', component: 'text' }] };
    docs.page.page.slots[0].content.push({ id: 'loose', component: 'stack', slots: { footer: [] } });
  });
  const slotCodes = /SLOT|SLOTS_WITHOUT_USE/;
  const disk = runValidate({ projectPath });
  const memory = lintSources(readSources(projectPath));
  const tally = (entries) => entries.map((entry) => entry.code).filter((code) => slotCodes.test(code)).sort();
  assert.deepEqual(tally(memory.diagnostics), tally([...disk.errors, ...disk.info]));
  assert.ok(tally(memory.diagnostics).length >= 3);
  for (const diagnostic of memory.diagnostics.filter((entry) => slotCodes.test(entry.code))) {
    assert.equal(diagnostic.source, 'pages/home.yaml', `${diagnostic.code} ${diagnostic.message}`);
    assert.ok(diagnostic.range.start.offset < diagnostic.range.end.offset);
  }
});

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

test('lint checks ids and props inside named fills, on pages and in components', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.page.page.slots[0].content[0].slots.actions.push({ id: 'Bad_Id', component: 'button', props: { lable: 'Oops' } });
    // Lint reads the project's own components.yaml, not imported files.
    docs.components.components = {
      local_card: {
        root: {
          id: 'local_card',
          component: 'stack',
          children: [{
            id: 'inner_panel',
            use: 'kit.panel',
            slots: { footer: [{ id: 'bad_footer', component: 'button', props: { colour: 'red' } }] },
          }],
        },
      },
    };
  });
  const result = runLint({ projectPath });
  const messages = [...result.errors, ...result.warnings, ...result.info].map((entry) => `${entry.code} ${entry.message}`);
  const all = messages.join('\n');
  assert.ok(messages.some((message) => /UPPERCASE_ID .*"Bad_Id"/.test(message)), all);
  assert.ok(messages.some((message) => /UNKNOWN_PROP .*Bad_Id.*"lable"/.test(message)), all);
  assert.ok(messages.some((message) => /UNKNOWN_PROP .*bad_footer.*"colour"/.test(message)), all);
});

// A nested instance's ids are namespaced under it when it renders, so a
// component may reuse an id that a component it nests also uses. Only a real
// duplicate inside one definition is an error.
test('a component may reuse an id that a nested component also uses', () => {
  const withLayout = (extra) => (docs) => {
    docs.components.components = {
      ...docs.components.components,
      panel: {
        root: {
          id: 'panel',
          component: 'card',
          children: [{ id: 'body', slot: 'default' }, { id: 'close', component: 'button', props: { label: 'Close' } }],
        },
      },
      layout: {
        root: {
          id: 'layout',
          component: 'stack',
          children: [
            { id: 'body', component: 'heading', props: { text: 'Settings' } },
            { id: 'profile', use: 'panel', slots: { default: [{ id: 'content', slot: 'default' }] } },
            ...extra,
          ],
        },
      },
    };
    docs.page.page.slots[0].content.push(
      { id: 'settings', use: 'layout', children: [{ id: 'name', component: 'input' }] },
      { id: 'second', use: 'layout' },
    );
  };
  const duplicates = (result) => result.errors.filter((error) => error.code === 'DUPLICATE_NODE_ID');
  const inMemory = (projectPath) => lintSources(readSources(projectPath)).diagnostics
    .filter((diagnostic) => diagnostic.code === 'DUPLICATE_NODE_ID');

  const reused = createSlotsProject(withLayout([]));
  assert.deepEqual(duplicates(runValidate({ projectPath: reused })), []);
  assert.deepEqual(inMemory(reused), [], 'the source linter walks nested definitions in their own id scope too');

  const repeated = createSlotsProject(withLayout([{ id: 'body', component: 'text' }]));
  const real = duplicates(runValidate({ projectPath: repeated }));
  assert.ok(real.some((error) => /"layout".*"body"/.test(error.message)), JSON.stringify(real));
  const located = inMemory(repeated).find((diagnostic) => /"layout".*"body"/.test(diagnostic.message));
  assert.ok(located, 'the source linter reports the real duplicate');
  assert.equal(located.source, 'components.yaml');
});
