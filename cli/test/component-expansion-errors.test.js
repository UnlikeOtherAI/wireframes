'use strict';

// Content that cannot be expanded is a validation error where it is written, so
// `wf validate` fails before `wf build` does. A cause the reference or cycle checks
// already report is not reported twice.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { lintSources } = require('../../engine/lint/source');
const { createSlotsProject, readYaml, writeYaml } = require('./fixtures/slots-project');

const WF = path.join(__dirname, '..', 'bin', 'wf.js');
const node = (id, component, props, extra) => ({ id, component, props, ...extra });
const loop = { root: node('loop', 'stack', {}, { children: [{ id: 'again', use: 'loop' }] }) };
const missing = { root: node('missing', 'stack', {}, { children: [{ id: 'gone', use: 'nowhere' }] }) };

/** `kit` reaches the page only through the page's own imports. */
function pageImportProject(mutate) {
  return createSlotsProject((docs) => {
    delete docs.components.imports;
    docs.page.imports = { kit: '../components/kit.yaml' };
    docs.kit.components.loop = loop;
    docs.kit.components.missing = missing;
    docs.page.page.slots[0].content = [node('home', 'text', { text: 'Home' })];
    mutate(docs);
  });
}

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

const expansionErrors = (errors) => errors.filter((entry) => /cannot be expanded/.test(entry.message));

test('N1 an overlay whose page-imported component cycles fails validation before the build', () => {
  const projectPath = pageImportProject((docs) => {
    docs.page.page.overlays = [{ id: 'dialog', type: 'modal', trigger: 'manual', content: [
      { id: 'show', use: 'kit.loop' },
      node('bad', 'button', { label: 'Send' }, { interaction: [{ type: 'submit', formId: 'missing' }] }),
    ] }];
  });
  const errors = runValidate({ projectPath }).errors;
  assert.deepEqual(errors.map((entry) => entry.code), ['CIRCULAR_TEMPLATE_REFERENCE'], JSON.stringify(errors));
  assert.match(errors[0].message, /Node "show" in page "home" overlay "dialog" cannot be expanded: Circular component reference detected for "kit\.loop"/);

  const build = spawnSync(process.execPath, [WF, 'build'], { cwd: projectPath, encoding: 'utf8' });
  assert.equal(build.status, 1);
  assert.match(build.stderr, /Project validation failed/, 'validation stops the build before it expands anything');

  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => entry.code === 'CIRCULAR_TEMPLATE_REFERENCE');
  assert.deepEqual(located.map((entry) => [entry.source, entry.path]), [['pages/home.yaml', '$.page.overlays[0].content[0]']]);
});

test('N1 content in page slots and template overlays that cannot expand is reported where it is written', () => {
  const projectPath = pageImportProject((docs) => {
    docs.page.page.slots[0].content.push({ id: 'broken', use: 'kit.missing' }, { id: 'cycled', use: 'kit.loop' });
  });
  const templatesPath = path.join(projectPath, 'templates.yaml');
  const templates = readYaml(templatesPath);
  const templateId = readYaml(path.join(projectPath, 'pages', 'home.yaml')).page.template;
  templates.templates[templateId].overlays = [{ id: 'help', type: 'modal', trigger: 'manual', content: [{ id: 'help_body', use: 'kit.missing' }] }];
  writeYaml(templatesPath, templates);

  const errors = expansionErrors(runValidate({ projectPath }).errors);
  assert.deepEqual(errors.map((entry) => entry.code).sort(),
    ['BROKEN_COMPONENT_REFERENCE', 'BROKEN_COMPONENT_REFERENCE', 'CIRCULAR_TEMPLATE_REFERENCE'], JSON.stringify(errors));
  assert.ok(errors.some((entry) => /"broken" in page "home" slot "main".*Unknown component reference "nowhere"/.test(entry.message)));
  assert.ok(errors.some((entry) => /"cycled" in page "home" slot "main".*"kit\.loop"/.test(entry.message)), 'every failing entry, not only the first');
  assert.ok(errors.some((entry) => new RegExp(`"help_body" in template "${templateId}" overlay "help" of page "home"`).test(entry.message)));

  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => /cannot be expanded/.test(entry.message));
  assert.deepEqual(located.map((entry) => [entry.source, entry.path]).sort(), [
    ['pages/home.yaml', '$.page.slots[0].content[1]'],
    ['pages/home.yaml', '$.page.slots[0].content[2]'],
    ['templates.yaml', `$.templates.${templateId}.overlays[0].content[0]`],
  ]);
});

test('N1 a cause the reference or cycle checks already report is not reported twice', () => {
  const direct = createSlotsProject((docs) => {
    docs.page.page.slots[0].content.push({ id: 'typo', use: 'nope' });
    docs.page.page.overlays = [{ id: 'dialog', type: 'modal', trigger: 'manual', content: [{ id: 'typo_too', use: 'nope' }] }];
  });
  const directErrors = runValidate({ projectPath: direct }).errors;
  assert.deepEqual(directErrors.map((entry) => entry.code), ['BROKEN_COMPONENT_REFERENCE', 'BROKEN_COMPONENT_REFERENCE'], JSON.stringify(directErrors));
  assert.deepEqual(expansionErrors(directErrors), []);

  const cycled = createSlotsProject((docs) => {
    docs.kit.components.loop = loop;
    docs.page.page.slots[0].content.push({ id: 'cycled', use: 'kit.loop' });
  });
  const cycleErrors = runValidate({ projectPath: cycled }).errors;
  assert.deepEqual(cycleErrors.map((entry) => entry.code), ['CIRCULAR_TEMPLATE_REFERENCE'], JSON.stringify(cycleErrors));
  assert.deepEqual(expansionErrors(cycleErrors), [], 'the project cycle check already names kit.loop');
});

/**
 * The probe for R1: the page fills `main`, so the template's fallback for it, which
 * holds the `fallback_target` placeholder, never renders, and neither does the
 * page's injection for it.
 */
function overriddenFallbackProject(mutate) {
  const projectPath = pageImportProject((docs) => {
    docs.page.page.slots[0].content = [{ id: 'real_failure', use: 'kit.loop' }];
    docs.page.page.injectables = [{ injectableId: 'fallback_target', content: [{ id: 'unused', use: 'kit.missing' }] }];
    if (mutate) mutate(docs);
  });
  const templatesPath = path.join(projectPath, 'templates.yaml');
  const templates = readYaml(templatesPath);
  const templateId = readYaml(path.join(projectPath, 'pages', 'home.yaml')).page.template;
  templates.templates[templateId].regions.find((region) => region.id === 'main').children = [
    node('fallback_target', 'stack', {}, { injectable: true }),
  ];
  writeYaml(templatesPath, templates);
  return projectPath;
}

test('R1 an injection whose placeholder does not render is not reported when a region fails', () => {
  const projectPath = overriddenFallbackProject();
  const errors = runValidate({ projectPath }).errors;
  assert.deepEqual(errors.map((entry) => entry.code), ['CIRCULAR_TEMPLATE_REFERENCE'], JSON.stringify(errors));
  assert.match(errors[0].message, /Node "real_failure" in page "home" slot "main" cannot be expanded/);
  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => /cannot be expanded/.test(entry.message));
  assert.deepEqual(located.map((entry) => [entry.code, entry.path]), [['CIRCULAR_TEMPLATE_REFERENCE', '$.page.slots[0].content[0]']]);

  // With the cycle fixed the page builds, and the injection still never renders.
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const page = readYaml(pagePath);
  page.page.slots[0].content = [node('replacement', 'text', { text: 'Replaced fallback' })];
  writeYaml(pagePath, page);
  assert.deepEqual(runValidate({ projectPath }).errors, []);
});

test('R1 an injection a rendered placeholder reaches is still reported when a region fails', () => {
  // `page_actions` is a placeholder in the template's persistent header; its content
  // holds a second placeholder, so `relayed` renders through it.
  const projectPath = overriddenFallbackProject((docs) => {
    docs.page.page.injectables.push(
      { injectableId: 'page_actions', content: [node('relay', 'stack', {}, { children: [{ id: 'relayed', injectable: true }] }), { id: 'shown', use: 'kit.missing' }] },
      { injectableId: 'relayed', content: [{ id: 'deep', use: 'kit.loop' }] },
    );
  });
  const errors = expansionErrors(runValidate({ projectPath }).errors);
  assert.deepEqual(errors.map((entry) => entry.message.match(/^Node "(\w+)"/)[1]).sort(), ['deep', 'real_failure', 'shown'], JSON.stringify(errors));
  const located = lintSources(readSources(projectPath)).diagnostics.filter((entry) => /cannot be expanded/.test(entry.message));
  assert.deepEqual(located.map((entry) => entry.path).sort(), [
    '$.page.injectables[1].content[1]',
    '$.page.injectables[2].content[0]',
    '$.page.slots[0].content[0]',
  ]);
});
