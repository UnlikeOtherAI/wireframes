'use strict';

// Validation scopes for component slots: definitions only a page or a template
// imports are checked where they were imported, and slotted content inside
// overlays is checked as it renders.

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { loadComponentRegistryForDocuments } = require('../../engine/component-registry');
const { createSlotsProject, pageContent, readYaml, writeYaml } = require('./fixtures/slots-project');

const slotCodes = (entries) => entries.map((entry) => entry.code).filter((code) => /SLOT/.test(code)).sort();

// A module with a placeholder root and a fill for a slot its nested instance lacks.
const LIB = {
  documentType: 'components',
  specVersion: '1.1',
  id: 'lib',
  components: {
    bad_root: { root: { id: 'bad_root', slot: 'default' } },
    frame: { root: { id: 'frame', component: 'card', children: [{ id: 'frame_body', slot: 'default' }] } },
    wrapper: {
      root: {
        id: 'wrapper',
        component: 'stack',
        children: [{ id: 'framed', use: 'frame', slots: { typo: [{ id: 'dropped', component: 'text' }] } }],
      },
    },
  },
};

function libProject(mutate) {
  return createSlotsProject((docs) => {
    docs.page.page.slots[0].content.push({ id: 'lib_wrapper', use: 'lib.wrapper' });
    docs.page.imports = { lib: '../components/lib.yaml' };
    if (mutate) mutate(docs);
  });
}

function writeLib(projectPath) {
  writeYaml(path.join(projectPath, 'components', 'lib.yaml'), LIB);
}

test('definitions only a page imports are slot-checked, once each', () => {
  const projectPath = libProject();
  writeLib(projectPath);
  // A second page importing the same module reports nothing twice.
  const about = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  about.id = 'about';
  about.page.id = 'about';
  about.page.slots[0].content = [{ id: 'about_wrapper', use: 'lib.wrapper' }];
  writeYaml(path.join(projectPath, 'pages', 'about.yaml'), about);

  const result = runValidate({ projectPath });
  assert.deepEqual(slotCodes(result.errors), ['SLOT_OUTSIDE_COMPONENT', 'UNKNOWN_COMPONENT_SLOT'], JSON.stringify(result.errors));
  assert.match(result.errors.find((entry) => entry.code === 'UNKNOWN_COMPONENT_SLOT').message, /"framed".*"lib\.frame".*"typo"/);
  assert.match(result.errors.find((entry) => entry.code === 'SLOT_OUTSIDE_COMPONENT').message, /"lib\.bad_root"/);
});

test('definitions only the template imports are slot-checked', () => {
  const projectPath = createSlotsProject();
  writeLib(projectPath);
  const templates = readYaml(path.join(projectPath, 'templates.yaml'));
  templates.imports = { lib: 'components/lib.yaml' };
  writeYaml(path.join(projectPath, 'templates.yaml'), templates);

  const result = runValidate({ projectPath });
  assert.deepEqual(slotCodes(result.errors), ['SLOT_OUTSIDE_COMPONENT', 'UNKNOWN_COMPONENT_SLOT'], JSON.stringify(result.errors));
});

test('the in-memory validateProject checks page-imported definitions too', () => {
  const projectPath = libProject();
  writeLib(projectPath);
  const read = (relative) => yaml.load(fs.readFileSync(path.join(projectPath, relative), 'utf8'));
  const templates = read('templates.yaml');
  const home = read('pages/home.yaml');
  const registry = loadComponentRegistryForDocuments(projectPath, [
    { documentPath: path.join(projectPath, 'templates.yaml'), document: templates },
    { documentPath: path.join(projectPath, 'pages', 'home.yaml'), document: home },
  ]);
  assert.equal(registry.ok, true, registry.error);
  const result = validateProject({
    manifest: read('manifest.yaml'),
    sitemap: read('sitemap.yaml'),
    templates,
    components: read('components.yaml'),
    pages: new Map([['home', home]]),
    datasets: new Map(),
    componentRegistriesByPage: new Map([['home', registry.registry.components]]),
  });
  assert.deepEqual(slotCodes(result.errors), ['SLOT_OUTSIDE_COMPONENT', 'UNKNOWN_COMPONENT_SLOT'], JSON.stringify(result.errors));
});

test('the checkout fixture validates inside a page modal', () => {
  const projectPath = createSlotsProject((docs) => {
    const [first, second] = pageContent();
    docs.page.page.slots[0].content = [{ id: 'open_pay', component: 'button', props: { label: 'Pay' } }, second];
    docs.page.page.overlays = [{ id: 'pay_modal', type: 'modal', trigger: 'open_pay', content: [first] }];
  });
  const result = runValidate({ projectPath });
  assert.deepEqual(result.errors, []);
});

test('a broken submit inside a slotted page modal is still reported', () => {
  const projectPath = createSlotsProject((docs) => {
    const [first] = pageContent();
    first.slots.actions[0].interaction = [{ type: 'submit', formId: 'nowhere' }];
    docs.page.page.slots[0].content = [{ id: 'open_pay', component: 'button' }];
    docs.page.page.overlays = [{ id: 'pay_modal', type: 'modal', trigger: 'open_pay', content: [first] }];
  });
  const errors = runValidate({ projectPath }).errors;
  assert.deepEqual(errors.map((entry) => entry.code), ['INVALID_FORM_REFERENCE']);
  assert.match(errors[0].message, /"nowhere"/);
});

test('ids are unique across regions, page overlays and template overlays', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.page.page.slots[0].content = [
      { id: 'dup', component: 'text' },
      { id: 'dup_tpl', component: 'text' },
      { id: 'open_dup', component: 'button' },
    ];
    docs.page.page.overlays = [{ id: 'dup_modal', type: 'modal', trigger: 'open_dup', content: [{ id: 'dup', component: 'text' }] }];
  });
  const templates = readYaml(path.join(projectPath, 'templates.yaml'));
  templates.templates.public_template.overlays = [{
    id: 'help_modal',
    type: 'modal',
    trigger: 'app_logo',
    content: [{ id: 'dup_tpl', use: 'kit.panel' }, { id: 'help_form', component: 'form' }, {
      id: 'help_send', component: 'button', interaction: [{ type: 'submit', formId: 'help_form' }],
    }],
  }];
  writeYaml(path.join(projectPath, 'templates.yaml'), templates);

  const errors = runValidate({ projectPath }).errors;
  const duplicates = errors.filter((entry) => entry.code === 'DUPLICATE_NODE_ID').map((entry) => entry.message).sort();
  assert.equal(duplicates.length, 2, JSON.stringify(errors));
  assert.match(duplicates[0], /"dup"/);
  assert.match(duplicates[1], /"dup_tpl"/);
  assert.ok(!errors.some((entry) => entry.code === 'INVALID_FORM_REFERENCE'), 'a submit in template overlay content finds its form');
});
