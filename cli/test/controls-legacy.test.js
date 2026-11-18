'use strict';

// YAML that uses only the props controls had before the field contract must
// render what it always did. The only additions allowed are state and ARIA
// attributes, the ids those attributes point at, and the `data-wf-value` an
// option with its own `value` submits.

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { controlRenderers } = require('@wireframes/engine/renderer/primitives/controls');
const { renderSelectOptions } = require('@wireframes/engine/renderer/render-attrs');
const { legacyRenderers, legacySelectOptions } = require('./helpers/legacy-controls');

const legacyLib = { ...lib, renderSelectOptions: legacySelectOptions };

const STATE_ATTRIBUTES = [
  / data-wf-(?:disabled|readonly|required|invalid|loading|pressed|checked|selected|current|expanded)(?:="mixed")?(?=[ />])/g,
  / aria-(?:pressed|checked|disabled|readonly|required|invalid|busy|labelledby|describedby)="[^"]*"/g,
  / role="[^"]*"/g,
  / (?:disabled|required|readonly|selected)(?=[ />])/g,
  / id="[^"]*__(?:label|help|error)"/g,
  / data-wf-value="[^"]*"/g,
];

function strip(html) {
  return STATE_ATTRIBUTES.reduce((out, pattern) => out.replace(pattern, ''), String(html || ''));
}

function ctxFor(node) {
  return {
    bindingContext: { routeId: '', props: node.props || {}, item: {}, itemVar: 'item' },
    stateBindings: {},
    routeTable: {},
    navigationTarget: null,
    navAttrs: () => '',
  };
}

function render(renderers, renderLib, node) {
  const ctx = ctxFor(node);
  const result = renderers[node.component](node, ctx, renderLib);
  return { inner: result.inner, className: result.className, bindings: ctx.stateBindings };
}

const SELECT_OPTIONS = [null, undefined, true, false, 0, 7, '', 'Plain', ' padded ', ['nested'],
  { label: 'L', value: 'v' }, { value: 'only value' }, { label: 'only label' }, { label: '', value: '' }, {},
  { label: 0, value: 0 }, { title: 'ignored' }, { label: ' padded ' }, { label: 'Sel', selected: false }];
const CHOICE_OPTIONS = ['Free', { label: 'Pro', description: 'Best' }, { title: 'Titled' }, { label: '', title: 'blank kept' },
  { label: 'Icon', icon: 'star' }, 7];

const CORPUS = [
  { component: 'button', props: { label: 'Save' } },
  { component: 'button', props: { label: 'Delete', variant: 'danger', disabled: true } },
  { component: 'button', props: { icon: 'gear', iconOnly: true } },
  { component: 'button', props: { label: 'Saving', loading: true, size: 'sm' } },
  { component: 'button', props: { icon: 'plus', fab: true, variant: 'primary' } },
  { component: 'segmented', props: { options: ['Day', 'Week', 'Month'], value: 'Week', size: 'lg' } },
  { component: 'segmented', props: { options: CHOICE_OPTIONS, value: 'Pro' } },
  { component: 'segmented', props: { options: [] } },
  { component: 'segmented', props: { options: ['One', 'Two'] }, selection: { selectable: false } },
  { component: 'input', props: { label: 'Name', placeholder: 'Ada', required: true, help: 'Your full name' } },
  { component: 'input', props: { label: 'Ref', error: 'Taken', help: 'Hidden by the error', disabled: true } },
  { component: 'input', props: { placeholder: 'Search', inputType: 'search', icon: 'magnifying-glass', iconPosition: 'center' } },
  { component: 'input', props: { label: 'Price', prefix: '$', suffix: 'USD', value: 12 } },
  { component: 'input', props: { label: 'Seats', inputType: 'number', value: '250' } },
  { component: 'input', props: { label: 'Budget', inputType: 'range', value: 65 } },
  { component: 'input', props: { label: 'Budget', inputType: 'range' } },
  { component: 'input', props: { label: 'Budget', inputType: 'range', value: 150 } },
  { component: 'input', props: { label: 'Budget', inputType: 'range', value: null } },
  { component: 'input', props: { label: 'Budget', inputType: 'range', value: '' } },
  { component: 'input', props: { label: 'Code', inputType: 'otp', length: 4, help: 'Sent by SMS' } },
  { component: 'input', props: { label: 'Accent', inputType: 'color', value: '#0b172a' } },
  { component: 'input', props: { label: 'Accent', inputType: 'color', value: 'nope', disabled: true } },
  { component: 'input', props: { label: 'Guests', inputType: 'stepper', value: 3 } },
  { component: 'input', props: { label: 'Start', inputType: 'date', placeholder: '2026-11-02' } },
  { component: 'input', props: { label: 'Bound', value: '{{state.name}}', placeholder: '{{state.hint}}' } },
  { component: 'textarea', props: { label: 'Notes', rows: 4, maxLength: 280, help: 'Markdown', disabled: true } },
  { component: 'textarea', props: { label: 'Notes', error: 'Too long', required: true } },
  { component: 'select', props: { label: 'Status', options: SELECT_OPTIONS, placeholder: 'Choose' } },
  { component: 'select', props: { label: 'Owner', options: ['Ada', 'Grace'], searchable: true, multiple: true, disabled: true } },
  { component: 'select', props: { label: 'Role', options: ['A'], help: 'Pick one', required: true } },
  { component: 'select', props: { label: 'Role', options: ['A'], error: 'Required' } },
  { component: 'checkbox', props: { label: 'Remember me', checked: true } },
  { component: 'checkbox', props: { label: 'Managed', description: 'By your admin', disabled: true } },
  { component: 'radio', props: { label: 'Annual', description: 'Two months free', checked: true } },
  { component: 'radio', props: {} },
  { component: 'toggle', props: { label: 'Auto-save', checked: true } },
  { component: 'toggle', props: { label: 'Public' } },
  { component: 'choice_group', props: { label: 'Plan', kind: 'radio', value: 'Pro', options: CHOICE_OPTIONS } },
  { component: 'choice_group', props: { label: 'Alerts', kind: 'checkbox', options: ['Product', 'Security'], value: 'Security', inline: true } },
  { component: 'choice_group', props: { options: [] } },
  { component: 'tags_input', props: { label: 'Labels', tags: ['urgent', 'billing'], placeholder: 'Add' } },
  { component: 'upload', props: { label: 'Drop files', hint: 'Up to 10 MB', files: [{ name: 'a.pdf' }, 'b.png'] } },
  { component: 'upload', props: { label: 'Upload', variant: 'button', files: ['c.csv'] } },
  { component: 'upload', props: {} },
  { component: 'picker', props: { label: 'Repeat', options: ['Never', 'Daily', 'Weekly'], value: 'Daily' } },
  { component: 'picker', props: { options: CHOICE_OPTIONS, value: 'Titled' } },
  { component: 'picker', props: { options: ['A', { label: 'B', description: 'b' }, 'C'] } },
  { component: 'picker', props: { options: ['A', 'B'], value: 'missing' } },
  { component: 'picker', props: { options: ['A', '', 'B'] } },
  { component: 'picker', props: { options: ['A', { label: '' }, 'B'], value: '  ' } },
  { component: 'picker', props: { options: [{ label: 'Daily', value: 'd' }, 'Weekly'], value: 'Weekly' } },
  { component: 'editor', props: { label: 'Body', toolbar: false, rows: 3 } },
  { component: 'editor', props: {} },
];

test('legacy-only controls render what they did, plus state and ARIA attributes', () => {
  CORPUS.forEach((entry, index) => {
    const node = { id: `n${index}`, ...entry };
    const before = render(legacyRenderers, legacyLib, node);
    const after = render(controlRenderers, lib, node);
    const label = `${entry.component} ${JSON.stringify(entry.props)}`;
    assert.equal(strip(after.inner), strip(before.inner), label);
    assert.equal(after.className, before.className, label);
    assert.deepEqual(after.bindings, before.bindings, label);
  });
});

test('every legacy select option form gives the same options', () => {
  assert.equal(renderSelectOptions(SELECT_OPTIONS), legacySelectOptions(SELECT_OPTIONS));
  for (const entry of SELECT_OPTIONS) {
    assert.equal(renderSelectOptions([entry]), legacySelectOptions([entry]), JSON.stringify(entry));
  }
  assert.equal(renderSelectOptions(undefined), '');
  assert.equal(renderSelectOptions([]), '');
});

test('the only additions on legacy controls are the expected state attributes', () => {
  const html = (component, props) => render(controlRenderers, lib, { id: 'x', component, props }).inner;
  assert.match(html('button', { label: 'Off', disabled: true }), /<button disabled data-wf-disabled>/);
  assert.match(html('button', { label: 'Busy', loading: true }), /<button aria-busy="true" data-wf-loading>/);
  assert.match(html('segmented', { options: ['A', 'B'], value: 'B' }),
    /data-wf-choice-value="&quot;B&quot;" aria-pressed="true" data-wf-selected>/);
  assert.match(html('checkbox', { label: 'Agree' }),
    /<span class="wf-check-mark" role="checkbox" aria-labelledby="x__label" aria-checked="false"><\/span>/);
  assert.match(html('toggle', { label: 'On', checked: true }),
    /<span class="wf-toggle-track wf-toggle-on" role="switch" aria-labelledby="x__label" aria-checked="true" data-wf-checked>/);
  assert.match(html('choice_group', { label: 'Plan', kind: 'radio', options: ['A', 'B'], value: 'B' }),
    /<div class="wf-choice-list" role="radiogroup" aria-labelledby="x__label">.*role="radio" aria-checked="false".*role="radio" aria-checked="true" data-wf-checked/);
  assert.match(html('input', { label: 'Name', required: true }), /<input id="x__input"[^>]* required data-wf-required \/>/);
});

test('changes legacy YAML does see: stepper help and a numeric choice value', () => {
  const stepper = render(controlRenderers, lib, { id: 's', component: 'input', props: { inputType: 'stepper', help: 'Per room', error: '' } });
  assert.match(stepper.inner, /<span class="wf-field-help">Per room<\/span>/);
  const segmented = render(controlRenderers, lib, { id: 'g', component: 'segmented', props: { options: [1, 2, 3], value: 2 } });
  assert.equal((segmented.inner.match(/aria-pressed="true"/g) || []).length, 1);
  assert.match(segmented.inner, /&quot;2&quot;" aria-pressed="true"/);
});

test('with no value a picker still centres its first blank row, as it always did', () => {
  const picker = render(controlRenderers, lib, { id: 'p', component: 'picker', props: { options: ['A', '', 'B'] } });
  assert.match(picker.inner, /<span class="wf-picker-row">A<\/span><span class="wf-picker-row wf-picker-on" data-wf-selected><\/span><span class="wf-picker-row">B<\/span>/);
  // `selected: false` keeps the rule off that row; canonical selection still wins.
  const skipped = render(controlRenderers, lib, { id: 'q', component: 'picker', props: { options: ['A', { label: '', selected: false }, 'B'] } });
  assert.match(skipped.inner, /<span class="wf-picker-row wf-picker-on" data-wf-selected>A<\/span>/);
  const chosen = render(controlRenderers, lib, { id: 'r', component: 'picker', props: { options: ['A', '', { label: 'B', selected: true }] } });
  assert.match(chosen.inner, /<span class="wf-picker-row wf-picker-on" data-wf-selected>B<\/span>/);
});
