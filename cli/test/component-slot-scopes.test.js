'use strict';

// Validation scopes for component slots: definitions only a page or a template
// imports are checked where they were imported, and slotted content inside
// overlays is checked as it renders.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { validateProject } = require('../../engine/validate');
const { loadComponentRegistryForDocuments } = require('../../engine/component-registry');
const { lintSources } = require('../../engine/lint/source');
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

/** Every YAML document of a project folder but `.wfrc.yaml`, as the sources the in-memory linter takes. */
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

test('N2 slot findings in a page or template import are underlined in the module that defines them', () => {
  for (const importer of ['page', 'template', 'two pages']) {
    const projectPath = createSlotsProject((docs) => {
      delete docs.components.imports;
      docs.page.imports = { kit: '../components/kit.yaml' };
      docs.kit.components.hollow = { root: { id: 'hollow', slot: 'default' } };
      docs.kit.components.wrapper = { root: { id: 'wrapper', component: 'card', children: [
        { id: 'inside', use: 'panel', slots: { typo: [{ id: 'dropped', component: 'text', props: { text: 'Dropped' } }] } },
      ] } };
      docs.page.page.slots[0].content = [{ id: 'empty', use: 'kit.hollow' }, { id: 'wrapped', use: 'kit.wrapper' }];
    });
    const pagePath = path.join(projectPath, 'pages', 'home.yaml');
    if (importer === 'template') {
      const templatesPath = path.join(projectPath, 'templates.yaml');
      const templates = readYaml(templatesPath);
      const page = readYaml(pagePath);
      templates.imports = { kit: 'components/kit.yaml' };
      templates.templates[page.page.template].regions[0].children = page.page.slots[0].content;
      delete page.imports;
      page.page.slots[0].content = [{ id: 'only', component: 'text', props: { text: 'Only' } }];
      writeYaml(templatesPath, templates);
      writeYaml(pagePath, page);
    } else if (importer === 'two pages') {
      const about = readYaml(pagePath);
      about.id = 'about';
      about.page.id = 'about';
      about.imports = { parts: '../components/kit.yaml' };
      about.page.slots[0].content = [{ id: 'about_empty', use: 'parts.hollow' }, { id: 'about_wrapped', use: 'parts.wrapper' }];
      writeYaml(path.join(projectPath, 'pages', 'about.yaml'), about);
    }

    // Each alias a module is imported under is a scope of its own, named in the
    // finding, so two pages importing it as `kit` and `parts` report it twice.
    const times = importer === 'two pages' ? 2 : 1;
    const sources = readSources(projectPath);
    const kitText = sources.find((source) => source.name === 'components/kit.yaml').text;
    const located = lintSources(sources).diagnostics
      .filter((entry) => ['SLOT_OUTSIDE_COMPONENT', 'UNKNOWN_COMPONENT_SLOT'].includes(entry.code));
    assert.deepEqual(located.map((entry) => [entry.code, entry.source, entry.path]), [
      ...Array(times).fill(['SLOT_OUTSIDE_COMPONENT', 'components/kit.yaml', '$.components.hollow.root.slot']),
      ...Array(times).fill(['UNKNOWN_COMPONENT_SLOT', 'components/kit.yaml', '$.components.wrapper.root.children[0].slots.typo']),
    ], `${importer}: ${JSON.stringify(located)}`);
    const underlined = located.map((entry) => kitText.slice(entry.range.start.offset, entry.range.end.offset));
    assert.deepEqual(underlined, [...Array(times).fill('slot'), ...Array(times).fill('typo')], importer);
    if (times === 2) {
      assert.deepEqual(located.map((entry) => entry.message.match(/"(kit|parts)\.(?:hollow|wrapper)"/)[1]).sort(), ['kit', 'kit', 'parts', 'parts']);
    }

    const disk = runValidate({ projectPath }).errors;
    assert.deepEqual(slotCodes(disk), [...Array(times).fill('SLOT_OUTSIDE_COMPONENT'), ...Array(times).fill('UNKNOWN_COMPONENT_SLOT')],
      `${importer}: once per alias on disk`);
  }
});

test('N2 an unused imported component is underlined in the module that defines it', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.page.page.slots[0].content = [{ id: 'only_panel', use: 'kit.panel' }];
  });
  const sources = readSources(projectPath);
  const unused = lintSources(sources).diagnostics.filter((entry) => entry.code === 'UNUSED_COMPONENT');
  assert.ok(unused.length > 0, 'the fixture leaves some kit components unused');
  for (const entry of unused) {
    const [, alias, localId] = /"(kit|kit\.ui)\.(\w+)"/.exec(entry.message);
    const file = alias === 'kit' ? 'components/kit.yaml' : 'components/ui.yaml';
    assert.deepEqual([entry.source, entry.path], [file, `$.components.${localId}`], entry.message);
    const text = sources.find((source) => source.name === file).text;
    // Underlined at the definition, as for a component of components.yaml: the first line of its value.
    assert.match(text.slice(0, entry.range.start.offset), new RegExp(`\\n {2}${localId}:\\s*$`), entry.message);
  }
});

/**
 * The probe for R2: one shared wrapper, imported on two pages under different
 * aliases, fills `footer` on `foreign.panel`, an alias the module does not own.
 * Each page gives `foreign` its own file: home's panel declares `footer`, the
 * other page's only `header`.
 */
function sharedAcrossScopesProject() {
  const doc = (id, components) => ({ documentType: 'components', specVersion: '1.1', id, components });
  const projectPath = createSlotsProject((docs) => {
    delete docs.components.imports;
    docs.page.imports = { first: '../components/shared.yaml', foreign: '../components/good.yaml' };
    docs.page.page.slots[0].content = [{ id: 'wrapper', use: 'first.wrapper' }];
  });
  const home = readYaml(path.join(projectPath, 'pages', 'home.yaml'));
  const other = structuredClone(home);
  other.id = 'second';
  other.page.id = 'second';
  other.imports = { second: '../components/shared.yaml', foreign: '../components/bad.yaml' };
  other.page.slots[0].content = [{ id: 'wrapper', use: 'second.wrapper' }];
  writeYaml(path.join(projectPath, 'pages', 'second.yaml'), other);
  const sitemapPath = path.join(projectPath, 'sitemap.yaml');
  const sitemap = readYaml(sitemapPath);
  sitemap.routes.push({ ...sitemap.routes[0], id: 'second', path: '/second', page: 'second' });
  writeYaml(sitemapPath, sitemap);
  writeYaml(path.join(projectPath, 'components', 'shared.yaml'), doc('shared', {
    wrapper: { root: { id: 'wrapper', component: 'stack', children: [{
      id: 'nested', use: 'foreign.panel', slots: { footer: [{ id: 'foot', component: 'text', props: { text: 'Footer from shared' } }] },
    }] } },
  }));
  writeYaml(path.join(projectPath, 'components', 'good.yaml'), doc('good', {
    panel: { root: { id: 'panel', component: 'stack', children: [{ id: 'foot', slot: 'footer' }] } },
  }));
  writeYaml(path.join(projectPath, 'components', 'bad.yaml'), doc('bad', {
    panel: { root: { id: 'panel', component: 'stack', children: [{ id: 'head', slot: 'header', children: [] }] } },
  }));
  return projectPath;
}

test('R2 a shared definition is slot-checked in every scope that imports it', () => {
  const projectPath = sharedAcrossScopesProject();
  const errors = runValidate({ projectPath }).errors;
  assert.deepEqual(errors.map((entry) => entry.code), ['UNKNOWN_COMPONENT_SLOT'], JSON.stringify(errors));
  assert.match(errors[0].message, /"nested" of component "foreign\.panel" in component "second\.wrapper" fills slot "footer".*Valid slots: "header"/);

  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => entry.severity === 'error');
  assert.deepEqual(located.map((entry) => [entry.code, entry.source, entry.path]), [
    ['UNKNOWN_COMPONENT_SLOT', 'components/shared.yaml', '$.components.wrapper.root.children[0].slots.footer'],
  ]);

  const build = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'wf.js'), 'build'], { cwd: projectPath, encoding: 'utf8' });
  assert.equal(build.status, 1, 'the build refuses the page that would drop the footer');
  assert.match(build.stderr, /Project validation failed/);
});

test('R2 only identical slot findings are reported once', () => {
  const projectPath = sharedAcrossScopesProject();
  // Both foreign panels now lack `footer` the same way: one finding, at the one place it is written.
  writeYaml(path.join(projectPath, 'components', 'good.yaml'), readYaml(path.join(projectPath, 'components', 'bad.yaml')));
  const errors = runValidate({ projectPath }).errors;
  assert.deepEqual(errors.map((entry) => entry.message.match(/in component "(\w+)\.wrapper"/)[1]).sort(), ['first', 'second'],
    'each alias names its own scope, so the two findings differ');

  const pagePath = path.join(projectPath, 'pages', 'second.yaml');
  const other = readYaml(pagePath);
  other.imports.first = other.imports.second;
  delete other.imports.second;
  other.page.slots[0].content[0].use = 'first.wrapper';
  writeYaml(pagePath, other);
  const same = runValidate({ projectPath }).errors;
  assert.deepEqual(same.map((entry) => entry.code), ['UNKNOWN_COMPONENT_SLOT'], `the same alias and target: ${JSON.stringify(same)}`);
  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => entry.severity === 'error');
  assert.deepEqual(located.map((entry) => entry.source), ['components/shared.yaml']);
});
