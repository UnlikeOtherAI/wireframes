'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { parseDocument, parsePath, locate, findById } = require('../../engine/lint/source/positions');

const TEXT = [
  'a: 1',
  'b:',
  '  - x',
  '  -',
  '  - {k, m: 2}',
  '  - id: n1',
  '    component: button   # trailing',
  '    props: { label: Save, variant: primary }',
  'c: |',
  '  line1',
  '  line2',
  '# comment',
  'd:',
  'e: &anc [1, 2]',
  'f: *anc',
  '"q k": v # comment',
  'g:',
  '  h: "quoted"',
  '',
].join('\n');

function textAt(path) {
  const parsed = parseDocument(TEXT);
  const hit = locate(parsed.root, parsePath(path));
  return {
    complete: hit.complete,
    kind: hit.node.kind,
    value: TEXT.slice(hit.node.start, hit.node.end),
    key: hit.key ? TEXT.slice(hit.key.start, hit.key.end) : null,
  };
}

test('the parsed value is js-yaml\'s own', () => {
  const parsed = parseDocument(TEXT);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, yaml.load(TEXT, { schema: yaml.CORE_SCHEMA }));
});

test('a scalar value and its key are found', () => {
  assert.deepEqual(textAt('$.a'), { complete: true, kind: 'scalar', value: '1', key: 'a' });
  assert.deepEqual(textAt('$.b[3].component'), { complete: true, kind: 'scalar', value: 'button', key: 'component' });
  assert.deepEqual(textAt('$.g.h'), { complete: true, kind: 'scalar', value: '"quoted"', key: 'h' });
  assert.deepEqual(textAt('$["q k"]'), { complete: true, kind: 'scalar', value: 'v', key: '"q k"' });
});

test('a block mapping ends at its last value, before any comment', () => {
  const node = textAt('$.b[3]');
  assert.equal(node.kind, 'mapping');
  assert.ok(node.value.startsWith('id: n1'));
  assert.ok(node.value.endsWith('variant: primary }'));
});

test('a flow collection includes its brackets, with or without an anchor', () => {
  assert.equal(textAt('$.b[3].props').value, '{ label: Save, variant: primary }');
  assert.equal(textAt('$.b[3].props.variant').value, 'primary');
  assert.equal(textAt('$.b[2]').value, '{k, m: 2}');
  assert.equal(textAt('$.e').value, '&anc [1, 2]');
  assert.equal(textAt('$.e[1]').value, '2');
});

test('a block scalar covers its lines and stops before a comment', () => {
  assert.equal(textAt('$.c').value, '|\n  line1\n  line2');
});

test('an empty value sits after its key, and a flow key may have none', () => {
  assert.deepEqual(textAt('$.d'), { complete: true, kind: 'null', value: '', key: 'd' });
  assert.deepEqual(textAt('$.b[2].k'), { complete: true, kind: 'null', value: '', key: 'k' });
});

test('an alias is found where it is written', () => {
  assert.deepEqual(textAt('$.f'), { complete: true, kind: 'alias', value: '*anc', key: 'f' });
});

test('a path that does not resolve stops at the nearest ancestor', () => {
  assert.equal(textAt('$.zzz').complete, false);
  assert.equal(textAt('$.zzz').kind, 'mapping');
  const missingItem = textAt('$.b[9].x');
  assert.equal(missingItem.complete, false);
  assert.equal(missingItem.key, 'b');
  // An empty `-` entry composes no node.
  assert.equal(textAt('$.b[1]').complete, false);
});

test('a node is found by its id', () => {
  const parsed = parseDocument(TEXT);
  const hit = findById(parsed.root, 'n1');
  assert.equal(TEXT.slice(hit.id.start, hit.id.end), 'n1');
  assert.equal(findById(parsed.root, 'nope'), null);
});

test('a syntax error says what and where', () => {
  const cases = [
    ['a: 1\n  b: 2\n', 'bad indentation of a mapping entry'],
    ['a: 1\na: 2\n', 'duplicated mapping key'],
    ['a: [1, 2\nb: 3\n', 'missed comma between flow collection entries'],
    ['a:\n\t- x\n', 'tab characters must not be used in indentation'],
  ];
  for (const [text, message] of cases) {
    const parsed = parseDocument(text);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.message, message);
    assert.ok(parsed.error.offset >= 0 && parsed.error.offset <= text.length);
  }
  assert.equal(parseDocument('a: 1\na: 2\n').error.offset, 5);
});

function slices(text, paths) {
  const parsed = parseDocument(text);
  return paths.map((path) => {
    const hit = locate(parsed.root, parsePath(path));
    return hit.complete ? text.slice(hit.node.start, hit.node.end) : null;
  });
}

test('an empty `-` entry does not shift the items after it', () => {
  assert.deepEqual(slices('-\n- null\n-\n- value\n', ['$[0]', '$[1]', '$[2]', '$[3]']), [null, 'null', null, 'value']);
});

test('items with the same value are told apart by where they are', () => {
  const text = 't:\n  - x\n  - x\n  - x\n';
  const parsed = parseDocument(text);
  const starts = [0, 1, 2].map((index) => locate(parsed.root, ['t', index]).node.start);
  assert.deepEqual(starts, [7, 13, 19]);
});

test('an alias stops before a comment, and an empty value before one stays empty', () => {
  assert.deepEqual(slices('a: &x {b: 1}\nc: *x #comment\nd: x\n', ['$.c', '$.d']), ['*x', 'x']);
  assert.deepEqual(slices('a:  # comment\nb: null\n', ['$.a', '$.b']), ['', 'null']);
});

test('a sequence at its key\'s own indentation, and nested sequences', () => {
  assert.deepEqual(slices('key:\n- a\n- b\nother: 1\n', ['$.key', '$.key[1]', '$.other']), ['- a\n- b', 'b', '1']);
  assert.deepEqual(slices('n:\n  - - x\n    - y\n  - z\n', ['$.n[0][1]', '$.n[1]']), ['y', 'z']);
});

test('a flow pair entry falls back to its sequence; the entries after it are still found', () => {
  assert.deepEqual(slices('s: [a: 1, plain, {k: v}]\n', ['$.s[0]', '$.s[1]', '$.s[2].k']), [null, 'plain', 'v']);
});

test('schema paths parse into segments', () => {
  assert.deepEqual(parsePath('$.page.slots[0].content[12]["odd key"].x'), ['page', 'slots', 0, 'content', 12, 'odd key', 'x']);
  assert.deepEqual(parsePath('$'), []);
});
