'use strict';

// `wf component copy`: where it may write, and that it adds a definition to an
// existing document without rewriting what the author wrote.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { insertComponentDefinition } = require('../../engine/component/insert-definition');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { createStdProject, readYaml } = require('./fixtures/std-project');

const WF = path.join(__dirname, '..', 'bin', 'wf.js');

function wf(projectPath, ...args) {
  return spawnSync(process.execPath, [WF, ...args], { cwd: projectPath, encoding: 'utf8' });
}

const componentsDoc = (id, components) => ({ documentType: 'components', specVersion: '1.1', id, components });

const COMMENTED = `# Shared components. Keep this header.
documentType: components
specVersion: '1.1'
id: components
components:
  # The card everyone reuses
  panel:
    root:
      id: panel
      component: card   # card mode only
      props: { title: Panel }
# trailing note
`;

test('#16 copy keeps the comments and formatting of the document it adds to', () => {
  const projectPath = createStdProject([{ id: 'p', use: 'panel' }, { id: 'lost', use: 'not_found' }]);
  const filePath = path.join(projectPath, 'components.yaml');
  fs.writeFileSync(filePath, COMMENTED, 'utf8');
  const copied = wf(projectPath, 'component', 'copy', 'std.not_found');
  assert.equal(copied.status, 0, copied.stderr);
  const text = fs.readFileSync(filePath, 'utf8');
  assert.ok(text.startsWith(COMMENTED.slice(0, COMMENTED.indexOf('# trailing note'))), 'the authored text is kept as written');
  assert.match(text, /# trailing note\n$/);
  assert.match(text, /\n {6}props: \{ title: Panel \}\n {2}not_found:\n {4}propDefaults:\n/, 'the copy follows the last component');
  assert.match(text, /\n {4}root:\n {6}id: not_found\n/);
  assert.deepEqual(Object.keys(readYaml(filePath).components), ['panel', 'not_found']);
  assert.deepEqual(runValidate({ projectPath }).errors, []);
  assert.deepEqual(fs.readdirSync(projectPath).filter((name) => name.includes('.tmp')), [], 'no temp file is left behind');
});

test('#16 copy adds to an empty map, a flow map, a JSON document and a CRLF document', () => {
  const cases = {
    'empty flow map': 'documentType: components\nspecVersion: "1.1"\nid: components\ncomponents: {} # none yet\n',
    'flow map': 'documentType: components\nspecVersion: "1.1"\nid: components\ncomponents: { spare: { root: { id: spare, component: section } } }\n',
    'json document': JSON.stringify(componentsDoc('components', { spare: { root: { id: 'spare', component: 'section' } } }), null, 2),
    'crlf document': '# kept\r\ndocumentType: components\r\nspecVersion: "1.1"\r\nid: components\r\ncomponents:\r\n  spare:\r\n    root: { id: spare, component: section }\r\n',
  };
  for (const [name, source] of Object.entries(cases)) {
    const projectPath = createStdProject([]);
    const filePath = path.join(projectPath, 'components.yaml');
    fs.writeFileSync(filePath, source, 'utf8');
    const copied = wf(projectPath, 'component', 'copy', 'std.login');
    assert.equal(copied.status, 0, `${name}: ${copied.stderr}`);
    const parsed = readYaml(filePath);
    assert.equal(parsed.components.login.root.id, 'login', name);
    assert.equal(parsed.components.spare !== undefined, /spare/.test(source), name);
    const text = fs.readFileSync(filePath, 'utf8');
    if (source.includes('#')) assert.match(text, /# (none yet|kept)/, `${name}: comment kept`);
    if (source.includes('\r\n')) assert.doesNotMatch(text.replace(/\r\n/g, ''), /\n/, `${name}: line endings kept`);
  }
});

test('#16 copy refuses a --file outside the project, however it is spelled', () => {
  const projectPath = createStdProject([]);
  const outside = path.join(path.dirname(projectPath), 'outside.yaml');
  const outsideText = 'documentType: components\nspecVersion: "1.1"\nid: outside\ncomponents: {}\n';
  fs.writeFileSync(outside, outsideText, 'utf8');
  for (const file of ['../outside.yaml', outside, 'components/../../outside.yaml']) {
    const result = wf(projectPath, 'component', 'copy', 'std.login', '--file', file);
    assert.equal(result.status, 1, file);
    assert.match(result.stderr, /is outside the project/, file);
    assert.match(result.stderr, /--file components\/<name>\.yaml/, `${file}: says how to fix the call`);
  }
  assert.equal(fs.readFileSync(outside, 'utf8'), outsideText, 'the outside file is untouched');
});

test('#16 copy refuses a link inside the project that points outside it, and writes through one that stays inside', (t) => {
  const projectPath = createStdProject([]);
  const outside = path.join(path.dirname(projectPath), 'shared.yaml');
  const outsideText = 'documentType: components\nspecVersion: "1.1"\nid: shared\ncomponents: {}\n';
  fs.writeFileSync(outside, outsideText, 'utf8');
  const link = path.join(projectPath, 'components', 'shared.yaml');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  try {
    fs.symlinkSync(outside, link, 'file');
  } catch (error) {
    t.skip(`symbolic links are not available here: ${error.code}`);
    return;
  }
  const refused = wf(projectPath, 'component', 'copy', 'std.login', '--file', 'components/shared.yaml');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /links to .*outside the project/);
  assert.equal(fs.readFileSync(outside, 'utf8'), outsideText);

  const inner = path.join(projectPath, 'components', 'real.yaml');
  fs.writeFileSync(inner, outsideText.replace('shared', 'real'), 'utf8');
  const innerLink = path.join(projectPath, 'components', 'alias.yaml');
  fs.symlinkSync(inner, innerLink, 'file');
  const written = wf(projectPath, 'component', 'copy', 'std.login', '--file', 'components/alias.yaml');
  assert.equal(written.status, 0, written.stderr);
  assert.ok(fs.lstatSync(innerLink).isSymbolicLink(), 'the link stays a link');
  assert.equal(readYaml(inner).components.login.root.id, 'login');
});

test('#16 a copy that would not validate leaves the file byte for byte', () => {
  const projectPath = createStdProject([]);
  const filePath = path.join(projectPath, 'components.yaml');
  const source = COMMENTED;
  fs.writeFileSync(filePath, source, 'utf8');
  const result = wf(projectPath, 'component', 'copy', 'std.login', '--as', 'panel');
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(filePath, 'utf8'), source);
});

test('#16 the inserted definition is the only text that changes, wherever the components map ends', () => {
  const definition = { root: { id: 'extra', component: 'section', children: [{ id: 'note', component: 'text', props: { text: 'a: b # c' } }] } };
  const head = 'documentType: components\nspecVersion: "1.1"\nid: c\n';
  const cases = {
    'trailing comment, no final newline, four-space indent': `${head}components:\n    a:\n        root: { id: a, component: section }  # keep me`,
    'keys after the map': 'documentType: components\ncomponents:\n  a:\n    root: {id: a, component: section}\n# about imports\nimports: {}\nid: c\nspecVersion: "1.1"\n',
    'byte order mark': `\uFEFF${head}components:\n  a:\n    root: {id: a, component: section}\n`,
  };
  for (const [name, source] of Object.entries(cases)) {
    const output = insertComponentDefinition(source, 'extra', definition);
    const expected = yaml.load(source);
    expected.components.extra = definition;
    assert.deepEqual(yaml.load(output), expected, name);
    let prefix = 0;
    while (prefix < source.length && source[prefix] === output[prefix]) prefix += 1;
    const suffix = source.length - prefix;
    assert.equal(output.slice(0, prefix) + output.slice(output.length - suffix), source, `${name}: only an insertion`);
  }
});

test('N4 copy into an empty flow map keeps the comments inside its braces', () => {
  const definition = { root: { id: 'extra', component: 'section' } };
  const head = 'documentType: components\nspecVersion: "1.1"\nid: c\n';
  const commented = `${head}components: { # inner mapping note\n  # empty on purpose\n} # outside note\n`;
  const cases = {
    'comments before the closing brace': commented,
    'indented closing brace': `${head}components: {\n    # empty on purpose\n  }\n`,
    crlf: commented.replace(/\n/g, '\r\n'),
    'anchored, with a comment': `${head}components: &defs { # inner mapping note\n}\n`,
    'tagged, with a comment': `${head}components: !!map { # inner mapping note\n}\n`,
  };
  for (const [name, source] of Object.entries(cases)) {
    const output = insertComponentDefinition(source, 'extra', definition);
    const expected = yaml.load(source);
    expected.components.extra = definition;
    assert.deepEqual(yaml.load(output), expected, name);
    for (const comment of source.match(/# [a-z ]+/g)) assert.ok(output.includes(comment), `${name}: "${comment}" kept`);
    for (const property of source.match(/&defs|!!map/g) || []) assert.ok(output.includes(property), `${name}: ${property} kept`);
    let prefix = 0;
    while (prefix < source.length && source[prefix] === output[prefix]) prefix += 1;
    const suffix = source.length - prefix;
    assert.equal(output.slice(0, prefix) + output.slice(output.length - suffix), source, `${name}: only an insertion`);
    if (source.includes('\r\n')) assert.doesNotMatch(output.replace(/\r\n/g, ''), /\n/, `${name}: line endings kept`);
  }

  const projectPath = createStdProject([]);
  const filePath = path.join(projectPath, 'components.yaml');
  fs.writeFileSync(filePath, cases['comments before the closing brace'], 'utf8');
  const copied = wf(projectPath, 'component', 'copy', 'std.hero');
  assert.equal(copied.status, 0, copied.stderr);
  const text = fs.readFileSync(filePath, 'utf8');
  for (const comment of ['# inner mapping note', '# empty on purpose', '# outside note']) assert.ok(text.includes(comment), comment);
  assert.equal(readYaml(filePath).components.hero.root.id, 'hero');

  // An anchored empty map with nothing between its braces still becomes a block mapping.
  const anchored = `${head}components: &defs {} # keep\n`;
  const filled = insertComponentDefinition(anchored, 'extra', definition);
  assert.deepEqual(yaml.load(filled).components, { extra: definition });
  assert.match(filled, /components: +# keep\n {2}extra:\n/);
});

test('N5 a project folder whose name starts with two dots is inside the project', () => {
  const projectPath = createStdProject([]);
  const filePath = path.join(projectPath, '..components', 'kit.yaml');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'documentType: components\nspecVersion: "1.1"\nid: kit\ncomponents: {} # keep\n', 'utf8');
  const copied = wf(projectPath, 'component', 'copy', 'std.login', '--file', '..components/kit.yaml');
  assert.equal(copied.status, 0, copied.stderr);
  assert.equal(readYaml(filePath).components.login.root.id, 'login');
  assert.match(fs.readFileSync(filePath, 'utf8'), /# keep/);

  const { projectFileTarget } = require('../../engine/component-registry/project-file');
  assert.equal(projectFileTarget(projectPath, '..components/kit.yaml').inside, true);
  assert.equal(projectFileTarget(projectPath, '..').inside, false, 'the parent folder itself');
  assert.equal(projectFileTarget(projectPath, '../kit.yaml').inside, false);
  assert.equal(projectFileTarget(projectPath, path.join('..', 'kit.yaml')).inside, false, 'the platform separator');
  if (path.sep === '\\') assert.equal(projectFileTarget(projectPath, '..\\kit.yaml').inside, false, 'either separator on Windows');
  assert.equal(projectFileTarget(projectPath, path.join(path.dirname(projectPath), 'kit.yaml')).inside, false, 'an absolute path outside');
});
