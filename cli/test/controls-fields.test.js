'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('@wireframes/engine/renderer/primitives');
const { getPrimitive, itemProps } = require('@wireframes/engine/schema/primitive-registry');
const { FIELD_PROPS } = require('@wireframes/engine/schema/primitive-registry/shared');
const { validatePrimitiveProps } = require('@wireframes/engine/lint/rules/primitive-props');

const FIELD_CONTROLS = ['input', 'textarea', 'select', 'checkbox', 'radio', 'toggle', 'choice_group',
  'tags_input', 'upload', 'picker', 'editor', 'segmented'];

const html = (component, props, extra = {}) => renderNode({ id: 'f', component, props, ...extra }, {});
const tag = (markup, pattern) => (markup.match(pattern) || [''])[0];

function lint(component, props) {
  const result = { errors: [], warnings: [], info: [] };
  validatePrimitiveProps(result, { id: 'f', component, props }, 'page "home"');
  return [...result.warnings, ...result.info].filter((entry) => ['UNKNOWN_PROP_VALUE', 'HELP_PROP_ALIAS'].includes(entry.code));
}

test('every control takes the shared field props, and choice options take items', () => {
  for (const name of FIELD_CONTROLS) {
    const props = getPrimitive(name).props;
    for (const key of Object.keys(FIELD_PROPS)) assert.ok(props[key], `${name}.${key}`);
  }
  assert.equal(getPrimitive('segmented').props.label.primary, undefined, 'segmented keeps options as its shorthand');
  for (const name of ['select', 'segmented', 'choice_group', 'picker']) assert.deepEqual(itemProps(name), ['options'], name);
  assert.deepEqual(itemProps('toolbar'), ['items']);
  assert.ok(getPrimitive('upload').props.fieldLabel);
});

test('help plus error: the error replaces the help and the control names it', () => {
  const props = { label: 'Ref', help: 'Shown on invoices', error: 'Already used' };
  const input = html('input', props);
  assert.match(input, /<span class="wf-field-error" id="f__error">Already used<\/span>/);
  assert.doesNotMatch(input, /Shown on invoices/);
  assert.match(tag(input, /<input [^>]*>/), /aria-invalid="true" data-wf-invalid aria-describedby="f__error"/);
  assert.match(input, /class="wf-node wf-input wf-field wf-field-invalid"/);
  assert.match(tag(html('input', { label: 'Ref', help: 'Shown on invoices' }), /<input [^>]*>/), /aria-describedby="f__help"/);
  assert.match(tag(html('textarea', props), /<textarea[^>]*>/), /aria-invalid="true" data-wf-invalid aria-describedby="f__error"/);
  assert.match(tag(html('select', props), /<select[^>]*>/), /aria-invalid="true" data-wf-invalid aria-describedby="f__error"/);
  assert.match(tag(html('tags_input', props), /<input [^>]*>/), /aria-describedby="f__error"/);
  const group = html('choice_group', { ...props, kind: 'radio', options: ['A'] });
  assert.match(group, /role="radiogroup" aria-labelledby="f__label" aria-describedby="f__error" aria-invalid="true" data-wf-invalid/);
  assert.match(group, /<span class="wf-field-error" id="f__error">/);
  // Inline choices: help is the description, and the error sits below the row.
  const box = html('checkbox', { label: 'Agree', help: 'Required to continue', description: 'ignored', error: 'Tick it' });
  assert.match(box, /aria-describedby="f__help f__error"/);
  assert.match(box, /<span class="wf-choice-desc" id="f__help">Required to continue<\/span><\/span><\/label><span class="wf-field-error" id="f__error">Tick it<\/span>/);
  assert.doesNotMatch(box, /ignored/);
  assert.match(html('toggle', { label: 'Sync', description: 'Nightly' }), /<span class="wf-choice-desc" id="f__help">Nightly/);
});

test('required marks the visible label of every kind of control', () => {
  for (const [component, props] of [['input', {}], ['select', { options: ['A'] }], ['choice_group', { options: ['A'] }],
    ['segmented', { options: ['A'] }], ['checkbox', {}], ['toggle', {}], ['picker', { options: ['A'] }], ['editor', {}]]) {
    assert.match(html(component, { label: 'Field', required: true, ...props }), /Field<span class="wf-req">\*<\/span>/, component);
  }
  assert.match(html('upload', { fieldLabel: 'Attachments', required: true }), /Attachments<span class="wf-req">\*<\/span>/);
});

test('readonly plus disabled: both written, on the element that owns them', () => {
  const both = { label: 'Code', value: 'ABC', readonly: true, disabled: true };
  assert.match(tag(html('input', both), /<input [^>]*>/), / value="ABC" disabled readonly data-wf-disabled data-wf-readonly \/>/);
  assert.match(tag(html('input', { ...both, disabled: false }), /<input [^>]*>/), / value="ABC" readonly data-wf-readonly \/>/);
  assert.match(tag(html('textarea', both), /<textarea[^>]*>/), / disabled readonly data-wf-disabled data-wf-readonly/);
  assert.match(tag(html('select', { ...both, options: ['A'] }), /<select[^>]*>/), /<select disabled aria-readonly="true" data-wf-disabled data-wf-readonly>/);
  assert.match(html('checkbox', { label: 'Lock', readonly: true, disabled: true }),
    /role="checkbox"[^>]*aria-disabled="true" aria-readonly="true" aria-checked="false" data-wf-disabled data-wf-readonly/);
  // A radio has no aria-readonly; its data attribute still says so.
  assert.match(html('radio', { label: 'R', readonly: true }), /role="radio" aria-labelledby="f__label" aria-checked="false" data-wf-readonly>/);
  assert.match(html('choice_group', { kind: 'radio', readonly: true, options: ['A'] }), /role="radiogroup" aria-readonly="true" data-wf-readonly/);
  assert.match(html('choice_group', { kind: 'checkbox', readonly: true, options: ['A'] }), /role="checkbox" aria-readonly="true" aria-checked="false" data-wf-readonly/);
  const segmented = html('segmented', { options: ['A', 'B'], readonly: true, value: 'A' });
  assert.match(segmented, /<div class="wf-segment-track" role="group" data-wf-readonly>/);
  // Read-only adds the node class that draws the read-only look (rendering-controls.md).
  assert.match(segmented, /class="wf-node wf-segmented wf-field-readonly wf-segmented-md wf-segmented-field"/);
  const off = html('segmented', { options: ['A'], disabled: true });
  assert.match(off, /<div class="wf-segment-track" role="group" data-wf-disabled><button type="button" class="wf-segment" data-wf-choice-value="&quot;A&quot;" disabled aria-pressed="false" data-wf-disabled>/);
  assert.match(html('picker', { options: ['A'], readonly: true }), /<div class="wf-picker-wheel" data-wf-readonly>/);
  // Colour: the hex field is natively read-only, the picker only says so.
  const colour = html('input', { inputType: 'color', value: '#112233', readonly: true });
  assert.match(colour, /data-wf-color-picker [^>]*value="#112233" data-wf-readonly \/>/);
  assert.match(colour, /spellcheck="false" readonly data-wf-readonly \/>/);
});

test('readonly tags, editor and upload drop their input affordances but keep the content', () => {
  const tags = html('tags_input', { label: 'Labels', tags: ['urgent'], readonly: true });
  assert.doesNotMatch(tags, /wf-tag-x/);
  assert.match(tags, /<span class="wf-tag">urgent<\/span><input type="text" placeholder="" readonly data-wf-readonly \/>/);
  const editor = html('editor', { label: 'Body', readonly: true });
  assert.doesNotMatch(editor, /wf-editor-toolbar/);
  assert.match(editor, /<div class="wf-editor-body" data-wf-readonly style=/);
  const upload = html('upload', { label: 'Drop here', fieldLabel: 'Files', readonly: true, files: ['a.pdf'] });
  assert.match(upload, /^<div id="f" class="wf-node wf-upload wf-surface wf-field-readonly wf-upload-field" data-wf-frame="surface"/);
  // The decorative lock follows the label text.
  assert.match(upload, /<label class="wf-field-label">Files<span class="wf-field-lock"><i aria-hidden="true" class="wf-icon-glyph fa-solid fa-lock"[^>]*><\/i><\/span><\/label><div class="wf-upload-zone" data-wf-readonly><div class="wf-upload-files">/);
  assert.doesNotMatch(upload, /Drop here|cloud-arrow-up/);
  const field = html('upload', { label: 'Drop here', fieldLabel: 'Files', help: 'PDF only', disabled: true });
  assert.match(field, /<div class="wf-upload-zone" data-wf-disabled><span class="wf-upload-glyph">.*Drop here.*<\/div><span class="wf-field-help" id="f__help">PDF only<\/span>/);
  assert.match(html('upload', { variant: 'button', fieldLabel: 'CV', disabled: true }), /<div class="wf-upload-row" data-wf-disabled><button class="wf-act wf-button-secondary" disabled data-wf-disabled>/);
});

test('select.value: initial selection, a list with multiple, and selection precedence', () => {
  const options = (props) => tag(html('select', { label: 'S', ...props }), /<select[\s\S]*<\/select>/);
  assert.match(options({ options: ['A', 'B'], value: 'B' }), /<option value="A">A<\/option><option value="B" selected>B<\/option>/);
  assert.match(options({ options: [{ label: 'One', value: 1 }, { label: 'Two', value: 2 }], value: 2 }), /<option value="2" selected>Two/);
  const multi = options({ options: ['A', 'B', 'C'], value: ['A', 'C'], multiple: true });
  assert.match(multi, /<select multiple>.*value="A" selected.*value="B">.*value="C" selected/);
  // Single choice keeps the first match only.
  assert.equal((options({ options: ['A', 'B', 'C'], value: ['A', 'C'] }).match(/ selected/g) || []).length, 1);
  // An item's own selected wins over the element value, and selected: false beats a match.
  assert.match(options({ options: ['A', { label: 'B', selected: true }], value: 'A' }), /value="A">A<\/option><option value="B" selected>/);
  assert.match(options({ options: [{ label: 'A', selected: false }, 'A'], value: 'A' }), /<option value="A">A<\/option><option value="A" selected>/);
  assert.match(options({ options: ['A', { label: 'B', disabled: true }] }), /<option value="B" disabled>B/);
  assert.match(options({ options: [{ type: 'group', label: 'Team', items: ['Ada'] }, { type: 'separator' }, 'Z'] }),
    /<optgroup label="Team"><option value="Ada">Ada<\/option><\/optgroup><hr><option value="Z">Z/);
  // Templates resolve like an input value; a state template binds the select.
  assert.match(renderNode({ id: 't', component: 'select', props: { options: ['A', 'B'], value: '{{props.pick}}', pick: 'B' } }, {}), /value="B" selected/);
  assert.match(html('select', { options: ['A'], value: '{{state.choice}}' }), /data-wf-state-bindings="\{&quot;value&quot;:&quot;\{\{state.choice\}\}&quot;\}"/);
});

test('choice selection: values first, labels otherwise, and item selected wins', () => {
  const pressed = (props) => (html('segmented', props).match(/aria-pressed="true"[^>]*>[^<]*</g) || []).join('|');
  assert.match(pressed({ options: [{ label: 'Day', value: 'd' }, { label: 'Week', value: 'w' }], value: 'w' }), />Week</);
  assert.match(pressed({ options: ['Day', { label: 'Week', selected: true }], value: 'Day' }), />Week</);
  assert.equal(pressed({ options: [{ label: 'Day', selected: false }], value: 'Day' }), '');
  const group = html('choice_group', { kind: 'checkbox', options: ['A', 'B', 'C'], value: ['A', 'C'] });
  assert.equal((group.match(/aria-checked="true"/g) || []).length, 2);
  assert.match(html('choice_group', { kind: 'checkbox', options: [{ label: 'Some', checked: 'mixed' }] }), /aria-checked="mixed" data-wf-checked="mixed"/);
  const picker = html('picker', { options: ['A', { label: 'B', selected: true }, 'C'], value: 'C' });
  assert.match(picker, /<span class="wf-picker-row wf-picker-on" data-wf-selected>B<\/span>/);
  // Row zero only when nothing selects, and never an item marked selected: false.
  assert.match(html('picker', { options: [{ label: 'A', selected: false }, 'B'] }), /wf-picker-on" data-wf-selected>B</);
});

test('checkbox.indeterminate draws the mixed state and wins over checked', () => {
  const mixed = html('checkbox', { label: 'Some', indeterminate: true, checked: true });
  assert.match(mixed, /role="checkbox" aria-labelledby="f__label" aria-checked="mixed" data-wf-checked="mixed"/);
  assert.match(mixed, /<label class="wf-choice">/, 'not drawn as fully checked');
  assert.match(html('checkbox', { label: 'All', checked: true }), /<label class="wf-choice wf-choice-on">.*aria-checked="true" data-wf-checked>/);
  assert.match(html('checkbox', { label: 'None', indeterminate: false }), /aria-checked="false">/);
  // Only a checkbox has an indeterminate state.
  assert.match(html('toggle', { label: 'T', indeterminate: true }), /aria-checked="false">/);
});

test('button.pressed makes a toggle button, also with iconOnly; a link only mirrors it', () => {
  assert.match(html('button', { label: 'Bold', pressed: true }), /<button aria-pressed="true" data-wf-pressed>/);
  assert.match(html('button', { label: 'Bold', pressed: false }), /<button aria-pressed="false">/);
  assert.match(html('button', { icon: 'bold', iconOnly: true, label: 'Bold', pressed: true }), /<button aria-pressed="true" data-wf-pressed aria-label="Bold">/);
  assert.match(html('button', { label: 'Bold', pressed: true, disabled: true }), /<button disabled aria-pressed="true" data-wf-disabled data-wf-pressed>/);
  assert.doesNotMatch(html('button', { label: 'Plain' }), /aria-pressed/);
  const link = renderNode({ id: 'l', component: 'button', props: { label: 'Go', pressed: true }, interaction: [{ type: 'navigation', targetRoute: 'home' }] }, { routeTable: { home: 'home.html' } });
  assert.match(link, /<a class="wf-button-link" href="home.html" data-wf-route-target="home" data-wf-pressed>/);
});

test('toolbar: named icon buttons, toggles, separators, groups, size, orientation and labels', () => {
  const bar = html('toolbar', {
    items: [
      { label: 'Bold', icon: 'bold', pressed: true },
      { label: 'Italic', icon: 'italic', pressed: false },
      { type: 'separator' },
      { label: 'Wrap', icon: 'paragraph', checked: true },
      { label: 'Delete', icon: 'trash', disabled: true },
      { type: 'group', label: 'Align', items: [{ label: 'Left', icon: 'align-left' }] },
      'Text only',
    ],
  });
  assert.match(bar, /^<div id="f" class="wf-node wf-toolbar wf-toolbar-md" data-wf-frame="content"/);
  assert.match(bar, /<div class="wf-toolbar-items" role="toolbar">/);
  assert.match(bar, /<button type="button" class="wf-toolbar-item wf-toolbar-icon" aria-label="Bold" aria-pressed="true" data-wf-pressed>/);
  assert.match(bar, /aria-label="Italic" aria-pressed="false">/);
  assert.match(bar, /<span class="wf-toolbar-sep" role="separator" aria-orientation="vertical"><\/span>/);
  assert.match(bar, /aria-label="Wrap" role="checkbox" aria-checked="true" data-wf-checked>/);
  assert.match(bar, /aria-label="Delete" disabled data-wf-disabled>/);
  assert.match(bar, /<span class="wf-toolbar-group" role="group" aria-label="Align"><button[^>]*aria-label="Left">/);
  assert.match(bar, /<button type="button" class="wf-toolbar-item"><span class="wf-toolbar-label">Text only<\/span><\/button>/);
  const stack = html('toolbar', { items: [{ label: 'Bold', icon: 'bold' }, { type: 'separator' }], orientation: 'stack', size: 'lg', labels: true });
  assert.match(stack, /class="wf-node wf-toolbar wf-toolbar-lg wf-toolbar-stack"/);
  assert.match(stack, /role="toolbar" aria-orientation="vertical"/);
  assert.match(stack, /<button type="button" class="wf-toolbar-item">.*fa-bold.*<span class="wf-toolbar-label">Bold<\/span><\/button>/);
  assert.match(stack, /role="separator" aria-orientation="horizontal"/);
  assert.equal((html('toolbar', {}).match(/<button /g) || []).length, 3, 'an empty toolbar draws placeholders');
  assert.match(html('toolbar', { size: 'huge', items: ['A'] }), /wf-toolbar-md/);
});

test('input bounds: defaults, swaps, equal bounds, clamping and the default thumb', () => {
  const thumbs = (props) => (html('input', { inputType: 'range', ...props }).match(/"left:[-0-9.]+%/g) || []).join(' ').replace(/"/g, '');
  const fill = (props) => tag(html('input', { inputType: 'range', ...props }), /class="wf-range-fill" style="[^"]*"/);
  assert.equal(thumbs({}), 'left:40%');
  assert.equal(thumbs({ min: 0, max: 10 }), 'left:40%', 'no value keeps the 40% thumb');
  assert.equal(thumbs({ value: 65 }), 'left:65%');
  assert.equal(thumbs({ value: 5, min: 0, max: 10 }), 'left:50%');
  assert.equal(thumbs({ value: 5, min: 10, max: 0 }), 'left:50%', 'reversed bounds are swapped');
  assert.equal(thumbs({ value: 7, min: 3, max: 3 }), 'left:0%', 'equal bounds put the thumb at the start');
  assert.equal(thumbs({ value: 150 }), 'left:100%');
  assert.equal(thumbs({ value: -20, min: -10, max: 10 }), 'left:0%');
  assert.equal(thumbs({ value: 1, min: 0, max: 3 }), 'left:33.3333%');
  assert.equal(thumbs({ value: 25, max: 50 }), 'left:50%', 'min defaults to 0');
  assert.equal(thumbs({ value: 150, min: 100 }), 'left:0%', 'max defaults to 100, then the pair is swapped');
  // Two thumbs: exactly two finite numbers, sorted and clamped.
  assert.equal(thumbs({ value: [80, 20] }), 'left:20% left:80%');
  assert.equal(fill({ value: [80, 20] }), 'class="wf-range-fill" style="margin-left:20%;width:60%"');
  assert.equal(thumbs({ value: [-5, 500], min: 0, max: 50 }), 'left:0% left:100%');
  assert.equal(thumbs({ value: [1, 2, 3] }), 'left:40%');
  assert.equal(thumbs({ value: [1, 'x'] }), 'left:40%');
  // Templated values resolve through the binding helpers.
  const templated = renderNode({ id: 't', component: 'input', props: { inputType: 'range', value: '{{props.v}}', max: '{{props.top}}', v: 30, top: 60 } }, {});
  assert.match(templated, /left:50%/);
  const pair = renderNode({ id: 't', component: 'input', props: { inputType: 'range', value: ['{{props.a}}', 90], a: 10 } }, {});
  assert.match(pair, /left:10%.*left:90%/);
});

test('input bounds on number and stepper: clamp only when bounded, step sets the decimals', () => {
  const field = (props) => tag(html('input', { label: 'N', inputType: 'number', ...props }), /<input [^>]*>/);
  assert.match(field({ value: '250' }), / value="250" \/>/, 'no bounds: unchanged');
  assert.match(field({ value: '250', max: 99 }), / value="99" min="0" max="99" \/>/);
  assert.match(field({ value: '2', min: 1, max: 9, step: 0.5 }), / value="2.0" min="1" max="9" step="0.5" \/>/);
  assert.match(field({ value: '2.25', step: 0.5 }), / value="2.25" step="0.5" \/>/, 'step never drops decimals');
  assert.match(field({ value: '13', step: 5 }), / value="13" step="5" \/>/, 'nothing snaps to the step');
  assert.match(field({ value: 'lots', max: 5 }), / value="lots" min="0" max="5" \/>/);
  const stepper = (props) => tag(html('input', { inputType: 'stepper', ...props }), /<span class="wf-numstepper"[\s\S]*?<\/span><\/span>|<span class="wf-numstepper"[\s\S]*<\/button><\/span>/);
  assert.match(stepper({ value: 3 }), /<button class="wf-numstepper-btn">−<\/button><span class="wf-numstepper-value">3<\/span><button class="wf-numstepper-btn">\+<\/button>/);
  assert.match(stepper({ value: 12, min: 1, max: 10 }), /<span class="wf-numstepper-value">10<\/span><button class="wf-numstepper-btn" disabled data-wf-disabled>\+/);
  assert.match(stepper({ value: 1, min: 1, max: 10, step: 0.25 }), /<button class="wf-numstepper-btn" disabled data-wf-disabled>−<\/button><span class="wf-numstepper-value">1.00<\/span>/);
  assert.match(stepper({ value: 2, disabled: true }), /<span class="wf-numstepper" data-wf-disabled><button class="wf-numstepper-btn" disabled data-wf-disabled>/);
  assert.match(renderNode({ id: 't', component: 'input', props: { inputType: 'stepper', value: '{{props.n}}', n: 4 } }, {}), /wf-numstepper-value">4</);
});

test('lint: a value list outside a range, and help with description', () => {
  assert.deepEqual(lint('input', { inputType: 'range', value: [20, 80] }), []);
  assert.deepEqual(lint('input', { inputType: 'range', value: ['{{props.lo}}', 80] }), []);
  const [misuse] = lint('input', { inputType: 'number', value: [1, 2] });
  assert.equal(misuse.code, 'UNKNOWN_PROP_VALUE');
  assert.match(misuse.message, /page "home": input.value is a list, which only inputType: range takes/);
  assert.equal(lint('input', { value: [1, 2] }).length, 1, 'text is the default inputType');
  assert.match(lint('input', { inputType: 'range', value: [1, 2, 3] })[0].message, /exactly two numbers/);
  assert.match(lint('input', { inputType: 'range', value: [1, 'x'] })[0].message, /exactly two numbers/);
  assert.deepEqual(lint('input', { inputType: 'range', value: 40 }), []);
  for (const component of ['checkbox', 'radio', 'toggle']) {
    const [alias] = lint(component, { label: 'A', help: 'H', description: 'D' });
    assert.equal(alias.code, 'HELP_PROP_ALIAS', component);
    assert.deepEqual(lint(component, { label: 'A', description: 'D' }), []);
  }
  assert.deepEqual(lint('input', { help: 'H', description: 'D' }).filter((entry) => entry.code === 'HELP_PROP_ALIAS'), []);
});

test('AMBIGUOUS_VALUE treats a checkbox choice_group as multiple choice', () => {
  const ambiguous = (props) => {
    const result = { errors: [], warnings: [], info: [] };
    validatePrimitiveProps(result, { id: 'g', component: 'choice_group', props }, 'page "home"');
    return result.info.filter((entry) => entry.code === 'AMBIGUOUS_VALUE').length;
  };
  assert.equal(ambiguous({ kind: 'checkbox', options: ['A', 'B'], value: ['A', 'B'] }), 0);
  assert.equal(ambiguous({ options: ['A', 'B'], value: ['A', 'B'] }), 0, 'checkbox is the default kind');
  assert.equal(ambiguous({ kind: 'radio', options: ['A', 'B'], value: ['A', 'B'] }), 1);
});
