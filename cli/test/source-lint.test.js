'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');
const { builtinModules } = require('node:module');

const { lintSources, splitSource } = require('../../engine/lint/source');

const lintSource = (text) => lintSources([{ name: 'project.wf', text }]);
const { runLint } = require('../../engine/lint');
const { packDocuments, fileNameFor } = require('../../engine/wf-format');
const iconIndex = require('../../engine/icons/catalogue');

const REPO = path.resolve(__dirname, '..', '..');
const QUICKSTART = path.join(REPO, 'examples', 'quickstart');

function readProject(root) {
  const names = ['manifest.yaml', 'sitemap.yaml', 'templates.yaml', 'components.yaml'];
  for (const folder of ['data', 'pages']) {
    if (fs.existsSync(path.join(root, folder))) {
      names.push(...fs.readdirSync(path.join(root, folder)).sort().map((name) => `${folder}/${name}`));
    }
  }
  return names.map((name) => ({ name, text: fs.readFileSync(path.join(root, name), 'utf8').replace(/\r\n/g, '\n') }));
}

/** The quickstart project with one file's text changed. */
function quickstartWith(name, change) {
  return readProject(QUICKSTART).map((source) => (source.name === name ? { name, text: change(source.text) } : source));
}

function replaceOnce(text, from, to) {
  assert.ok(text.includes(from), `fixture no longer contains ${JSON.stringify(from)}`);
  return text.replace(from, to);
}

/** The text a finding underlines. */
function underlined(sources, diagnostic) {
  const text = sources.find((source) => source.name === diagnostic.source).text;
  return text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset);
}

function only(result, code) {
  const matches = result.diagnostics.filter((diagnostic) => diagnostic.code === code);
  assert.equal(matches.length, 1, `expected one ${code}, got ${JSON.stringify(result.diagnostics.map((d) => d.code))}`);
  return matches[0];
}

test('a clean project has no findings and lists its documents as files', () => {
  const result = lintSources(readProject(QUICKSTART), { iconIndex });
  assert.equal(result.ok, true);
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.documents.map((document) => document.file), [
    'manifest.yaml', 'sitemap.yaml', 'templates.yaml', 'components.yaml',
    'pages/billing.yaml', 'pages/overview.yaml', 'pages/team.yaml',
  ]);
});

for (const project of ['examples/quickstart', 'examples/interactive-workspace', 'admin_wireframes', 'web_wireframes', 'engine/renderer/__fixtures__/gallery']) {
  test(`${project}: the same findings as wf lint, each inside its own source`, () => {
    const root = path.join(REPO, project);
    const sources = readProject(root);
    const result = lintSources(sources, { iconIndex });
    const cli = runLint({ projectPath: root });
    const tally = (list) => list.map((entry) => entry.code).sort();
    assert.deepEqual(tally(result.diagnostics), tally([...cli.errors, ...cli.warnings, ...(cli.info || [])]));
    for (const diagnostic of result.diagnostics) {
      const source = sources.find((entry) => entry.name === diagnostic.source);
      assert.ok(source, `${diagnostic.code} names a source`);
      assert.ok(diagnostic.range.start.offset < diagnostic.range.end.offset, `${diagnostic.code} has a range`);
      assert.ok(diagnostic.range.end.offset <= source.text.length);
      const lines = source.text.split('\n');
      assert.ok(diagnostic.range.start.column <= lines[diagnostic.range.start.line].length);
    }
  });
}

test('an unknown key is underlined at the key', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, '          component: page_header\n', '          component: page_header\n          colour: red\n'));
  const result = lintSources(sources);
  const finding = only(result, 'SCHEMA_ADDITIONAL_PROPERTIES');
  assert.equal(result.ok, false);
  assert.equal(finding.severity, 'error');
  assert.equal(finding.source, 'pages/billing.yaml');
  assert.equal(finding.document, 'page:billing');
  assert.equal(underlined(sources, finding), 'colour');
});

// The alert's variant is an enum in the schema.
const wrongEnum = (text) => replaceOnce(text, 'variant: warning', 'variant: warnin');

test('a wrong enum value is underlined at the value', () => {
  const sources = quickstartWith('pages/billing.yaml', wrongEnum);
  const finding = only(lintSources(sources), 'SCHEMA_ENUM');
  assert.equal(underlined(sources, finding), 'warnin');
});

test('a missing required property points at the mapping that lacks it', () => {
  const sources = quickstartWith('sitemap.yaml', (text) => replaceOnce(text, '  - id: billing\n', '  - label: Billing\n'));
  const result = lintSources(sources);
  const finding = result.diagnostics.find((diagnostic) => diagnostic.code === 'SCHEMA_REQUIRED' && diagnostic.message.includes('"id"'));
  assert.ok(finding);
  assert.equal(finding.source, 'sitemap.yaml');
  assert.ok(underlined(sources, finding).startsWith('label: Billing'));
});

test('an element that does not exist is underlined at its name', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, 'component: page_header', 'component: page_heder'));
  const finding = only(lintSources(sources), 'BROKEN_COMPONENT_REFERENCE');
  assert.equal(underlined(sources, finding), 'page_heder');
});

test('an unknown prop is a warning at the prop, with a suggestion', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, 'title: Storage almost full', 'titel: Storage almost full'));
  const result = lintSources(sources);
  const finding = only(result, 'UNKNOWN_PROP');
  assert.equal(result.ok, true);
  assert.equal(finding.severity, 'warning');
  assert.equal(underlined(sources, finding), 'titel');
  assert.match(finding.message, /Did you mean "title"\?/);
});

test('a route to a page that does not exist is underlined in the sitemap', () => {
  const sources = quickstartWith('sitemap.yaml', (text) => replaceOnce(text, 'page: billing', 'page: biling'));
  const finding = only(lintSources(sources), 'ORPHAN_ROUTE');
  assert.equal(finding.source, 'sitemap.yaml');
  assert.equal(underlined(sources, finding), 'biling');
});

test('an action on an overlay that does not exist is underlined at the node', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, 'targetOverlay: confirm_cancel', 'targetOverlay: confirm_cancl'));
  const finding = only(lintSources(sources), 'INVALID_TARGET_OVERLAY');
  assert.equal(finding.source, 'pages/billing.yaml');
  assert.equal(finding.document, 'page:billing');
  assert.equal(underlined(sources, finding), 'danger_action');
});

test('a syntax error is reported where it is, and the other documents are still checked', () => {
  const sources = quickstartWith('pages/team.yaml', (text) => replaceOnce(text, 'documentType: page\n', 'documentType: page\n    oops: [1, 2\n'))
    .map((source) => (source.name === 'pages/billing.yaml' ? { name: source.name, text: wrongEnum(source.text) } : source));
  const result = lintSources(sources);
  const syntax = only(result, 'INVALID_YAML');
  assert.equal(syntax.source, 'pages/team.yaml');
  assert.ok(syntax.range.start.line >= 1);
  assert.equal(underlined(sources, only(result, 'SCHEMA_ENUM')), 'warnin');
  // The route to the page that failed to parse is not reported as broken.
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'ORPHAN_ROUTE'), false);
});

test('a duplicated key is a syntax error at the second key', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, 'documentType: page\n', 'documentType: page\ndocumentType: page\n'));
  const finding = only(lintSources(sources), 'INVALID_YAML');
  assert.equal(finding.message, 'duplicated mapping key');
  assert.equal(finding.range.start.line, 1);
});

test('a whole .wf stream lints as one source, with ranges in the stream', () => {
  const documents = readProject(QUICKSTART).map((source) => yaml.load(source.text));
  const packed = packDocuments(documents, (list) => list.map((document) => yaml.dump(document, { lineWidth: 100, noRefs: true })).join('---\n'));
  assert.equal(packed.ok, true);
  assert.deepEqual(lintSource(packed.text).diagnostics, []);

  const broken = wrongEnum(packed.text);
  const result = lintSource(broken);
  const finding = only(result, 'SCHEMA_ENUM');
  assert.equal(broken.slice(finding.range.start.offset, finding.range.end.offset), 'warnin');
  assert.equal(broken.split('\n')[finding.range.start.line].slice(finding.range.start.column, finding.range.end.column), 'warnin');
  assert.equal(result.documents.length, 7);
  assert.equal(result.documents[0].type, 'manifest');
});

test('the format marker is read off the manifest, and another format is refused', () => {
  const sources = quickstartWith('manifest.yaml', (text) => `format: wf/1\n${text}`);
  assert.deepEqual(lintSources(sources).diagnostics, []);
  const wrong = quickstartWith('manifest.yaml', (text) => `format: wf/9\n${text}`);
  const finding = only(lintSources(wrong), 'UNSUPPORTED_FORMAT');
  assert.equal(underlined(wrong, finding), 'wf/9');
});

test('text with no documents needs a manifest', () => {
  for (const text of ['', '# only a comment\n', '---\n']) {
    const result = lintSource(text);
    assert.equal(result.ok, false);
    assert.equal(only(result, 'MISSING_MANIFEST').severity, 'error');
    assert.deepEqual(result.documents, []);
  }
});

test('two pages with one id are refused at the second', () => {
  const sources = readProject(QUICKSTART);
  const copy = sources.find((source) => source.name === 'pages/team.yaml');
  const result = lintSources([...sources, { name: 'pages/team_copy.yaml', text: copy.text }]);
  assert.equal(only(result, 'DUPLICATE_PAGE_ID').source, 'pages/team_copy.yaml');
});

test('CRLF text keeps exact offsets', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => wrongEnum(text).replace(/\n/g, '\r\n'));
  const finding = only(lintSources(sources), 'SCHEMA_ENUM');
  assert.equal(underlined(sources, finding), 'warnin');
});

test('splitSource keeps offsets, keeps `---` and skips empty documents', () => {
  const text = '# header\n---\na: 1\n---\n\n--- \nb: 2\n...\n';
  const chunks = splitSource(text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].text, '---\na: 1\n');
  assert.equal(chunks[1].text, '--- \nb: 2\n');
  for (const chunk of chunks) assert.equal(text.slice(chunk.start, chunk.end), chunk.text);
});

test('splitSource reads a document end marker, content on a marker line and directives', () => {
  const ended = splitSource('a: 1\n...\nb: 2\n');
  assert.deepEqual(ended.map((chunk) => chunk.text), ['a: 1\n', '   \nb: 2\n']);
  assert.equal(ended[1].start, 5);

  assert.deepEqual(splitSource('a: 1\n--- {b: 2}\n').map((chunk) => chunk.text), ['a: 1\n', '--- {b: 2}\n']);
  // `---x` is a plain scalar, not a marker.
  assert.equal(splitSource('a: 1\n---x: 2\n').length, 1);
  // A directive stays with the document it precedes.
  assert.deepEqual(splitSource('%YAML 1.2\n---\na: 1\n').map((chunk) => chunk.text), ['%YAML 1.2\n---\na: 1\n']);
  assert.equal(splitSource('\uFEFFa: 1\n')[0].start, 1);
});

test('a finding about the whole project has no source and no range', () => {
  const sources = readProject(QUICKSTART).filter((source) => source.name !== 'manifest.yaml');
  const finding = only(lintSources(sources), 'MISSING_MANIFEST');
  assert.equal(finding.source, null);
  assert.equal(finding.range, null);
});

test('a document that does not say what it is holds back findings about missing things', () => {
  const sources = quickstartWith('pages/team.yaml', (text) => replaceOnce(text, 'documentType: page\n', ''));
  const result = lintSources(sources);
  assert.equal(result.ok, false);
  assert.equal(only(result, 'MISSING_DOCUMENT_TYPE').source, 'pages/team.yaml');
  assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'ORPHAN_ROUTE'), false);
});

test('a recursive alias is refused, and the other documents are still checked', () => {
  const loop = { name: 'data/loop.yaml', text: 'documentType: dataset\nspecVersion: "1.1"\nid: loop\nrows: &rows [*rows]\n' };
  const sources = [...quickstartWith('pages/billing.yaml', wrongEnum), loop];
  const result = lintSources(sources, { iconIndex });
  assert.equal(only(result, 'RECURSIVE_ALIAS').source, 'data/loop.yaml');
  assert.equal(underlined(sources, only(result, 'SCHEMA_ENUM')), 'warnin');
});

test('a repeated node id is underlined where it was repeated', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => replaceOnce(text, '- id: quota\n', '- id: summary\n'));
  const finding = only(lintSources(sources), 'DUPLICATE_NODE_ID');
  const text = sources.find((source) => source.name === 'pages/billing.yaml').text;
  assert.equal(underlined(sources, finding), 'summary');
  assert.equal(finding.range.start.offset, text.lastIndexOf('id: summary') + 4);
});

const FOOTER = [
  'documentType: components', 'specVersion: "1.1"', 'id: footer_module', 'components:', '  footer:', '    root:',
  '      id: footer', '      component: paragraph', '      props:', '        text: Made here.', '',
].join('\n');
const importing = (text, file) => replaceOnce(text, 'page:\n', `imports:\n  shared: ${file}\npage:\n`);
const usingFooter = (text) => replaceOnce(text, '          use: plan_summary\n', '          use: shared.footer\n');

test('a page uses a component it imports from another source', () => {
  const sources = [
    ...quickstartWith('pages/billing.yaml', (text) => usingFooter(importing(text, '../components/footer.yaml'))),
    { name: 'components/footer.yaml', text: FOOTER },
  ];
  const result = lintSources(sources);
  assert.deepEqual(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'), []);
});

test('an import that is not among the sources is reported at the import', () => {
  const sources = quickstartWith('pages/billing.yaml', (text) => usingFooter(importing(text, '../components/missing.yaml')));
  const result = lintSources(sources);
  const findings = result.diagnostics.filter((diagnostic) => diagnostic.code === 'COMPONENT_IMPORT_ERROR');
  assert.ok(findings.length >= 1);
  assert.match(findings[0].message, /Imported components file does not exist: components\/missing\.yaml/);
  assert.equal(findings[0].source, 'pages/billing.yaml');
  assert.equal(underlined(sources, findings[0]), 'imports');
});

test('wf lint output is unchanged: no finding carries a location', () => {
  const cli = runLint({ projectPath: path.join(REPO, 'admin_wireframes') });
  const all = [...cli.errors, ...cli.warnings, ...(cli.info || [])];
  assert.ok(all.length > 0);
  for (const entry of all) assert.deepEqual(Object.keys(entry).filter((key) => key !== 'path').sort(), ['code', 'message']);
});

test('the source linter and everything it requires stay free of Node built-ins', () => {
  const engine = path.join(REPO, 'engine');
  const seen = new Set();
  const queue = [path.join(engine, 'lint', 'source', 'index.js')];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/require\(\s*['"]([^.'"][^'"]*)['"]\s*\)/g)) {
      const name = match[1].replace(/^node:/, '');
      assert.equal(match[1].startsWith('node:') || builtinModules.includes(name), false, `${path.relative(REPO, file)} requires the Node built-in ${match[1]}`);
    }
    assert.equal(/require\(\s*path\./.test(source), false, `${path.relative(REPO, file)} builds a require path at run time`);
    for (const match of source.matchAll(/require\(\s*['"](\.[^'"]+)['"]\s*\)/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      const resolved = [target, `${target}.js`, path.join(target, 'index.js')].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved && resolved.endsWith('.js')) queue.push(resolved);
    }
  }
  assert.ok(seen.size > 10);
});

test('two documents never unpack to one file name', () => {
  const seen = new Map();
  const names = ['foo', 'foo_2', 'Foo', 'foo'].map((id) => fileNameFor({ documentType: 'page', id }, seen));
  assert.deepEqual(names, ['pages/foo.yaml', 'pages/foo_2.yaml', 'pages/foo_3.yaml', 'pages/foo_4.yaml']);
  const modules = new Map();
  assert.deepEqual([1, 2].map(() => fileNameFor({ documentType: 'components', id: 'components' }, modules)), ['components.yaml', 'components_2.yaml']);
});
