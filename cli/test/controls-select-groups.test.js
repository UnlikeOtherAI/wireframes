'use strict';

// A select resolves its selection once, across the options of every group,
// and AMBIGUOUS_VALUE reads the options the same way (design §4.1).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSelectOptions } = require('@wireframes/engine/renderer/render-attrs');
const { validatePrimitiveProps } = require('@wireframes/engine/lint/rules/primitive-props');

const selected = (html) => [...html.matchAll(/<option value="([^"]*)"[^>]* selected[^>]*>([^<]*)</g)].map((m) => m[2]);

const GROUPS = [
  { type: 'group', label: 'People', items: [{ label: 'Person', value: 'id' }, 'Ada'] },
  { type: 'group', label: 'Teams', items: [{ label: 'Group', value: 'id' }, 'Core'] },
];

function ambiguous(component, props) {
  const result = { errors: [], warnings: [], info: [] };
  validatePrimitiveProps(result, { id: 'n', component, props }, 'page "home"');
  return result.info.filter((entry) => entry.code === 'AMBIGUOUS_VALUE');
}

test('a value matching options in two groups selects only the first', () => {
  assert.deepEqual(selected(renderSelectOptions(GROUPS, { value: 'id' })), ['Person']);
  // Multiple keeps every match.
  assert.deepEqual(selected(renderSelectOptions(GROUPS, { value: ['id'], multiple: true })), ['Person', 'Group']);
});

test('an explicit selected item in one group beats a value match in another', () => {
  const options = [
    { type: 'group', label: 'A', items: [{ label: 'One', value: 'x' }] },
    { type: 'group', label: 'B', items: [{ label: 'Two', value: 'y', selected: true }] },
  ];
  assert.deepEqual(selected(renderSelectOptions(options, { value: 'x' })), ['Two']);
  // selected: false in one group skips that match; the next one wins.
  const skipped = [
    { type: 'group', label: 'A', items: [{ label: 'One', value: 'x', selected: false }] },
    { type: 'group', label: 'B', items: [{ label: 'Two', value: 'x' }] },
  ];
  assert.deepEqual(selected(renderSelectOptions(skipped, { value: 'x' })), ['Two']);
  // Top-level options and groups count as one list, in document order.
  assert.deepEqual(selected(renderSelectOptions([{ type: 'group', label: 'G', items: ['B'] }, 'B'], { value: 'B' })), ['B']);
  assert.match(renderSelectOptions([{ type: 'group', label: 'G', items: ['B'] }, 'B'], { value: 'B' }),
    /<optgroup label="G"><option value="B" selected>B<\/option><\/optgroup><option value="B">B<\/option>/);
});

test('AMBIGUOUS_VALUE reads select options through every group, with the select profile', () => {
  const [info] = ambiguous('select', { options: GROUPS, value: 'id' });
  assert.equal(info?.code, 'AMBIGUOUS_VALUE');
  assert.match(info.message, /select\.value "id" matches more than one of its options/);
  assert.deepEqual(ambiguous('select', { options: GROUPS, value: 'id', multiple: true }), []);
  assert.deepEqual(ambiguous('select', { options: GROUPS, value: 'Ada' }), []);
  // Booleans are select options, as they render; other choice controls drop them.
  assert.equal(ambiguous('select', { options: [true, 'true'], value: 'true' }).length, 1);
  assert.deepEqual(ambiguous('segmented', { options: [true, 'true'], value: 'true' }), []);
  // `title` labels a choice option, as it renders, but not a select option.
  assert.equal(ambiguous('segmented', { options: [{ title: 'A' }, 'A'], value: 'A' }).length, 1);
  assert.deepEqual(ambiguous('select', { options: [{ title: 'A' }, 'A'], value: 'A' }), []);
});
