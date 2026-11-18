'use strict';

// Validation scopes for component slots: definitions only a page or a template
// imports are checked where they were imported.

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { loadComponentRegistryForDocuments } = require('../../engine/component-registry');
const { createSlotsProject, readYaml, writeYaml } = require('./fixtures/slots-project');

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
