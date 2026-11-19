'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { stateAttrs, STATE_OWNERS } = require('@wireframes/engine/renderer/render-attrs');
const { renderNode } = require('@wireframes/engine/renderer/primitives');

const { str, escapeHtml, iconSpan, renderSkeleton, isObject, toSafeClass, navigationAttrs } = lib;

const ALL_ARIA = {
  disabled: 'aria-disabled',
  readonly: 'aria-readonly',
  required: 'aria-required',
  invalid: 'aria-invalid',
  loading: 'aria-busy',
  pressed: 'aria-pressed',
  checked: 'aria-checked',
  selected: 'aria-selected',
  current: 'aria-current',
  expanded: 'aria-expanded',
};

test('each state that is on writes a presence-only data attribute', () => {
  for (const name of Object.keys(ALL_ARIA)) {
    assert.equal(stateAttrs({ [name]: true }), ` data-wf-${name}`, name);
    assert.equal(stateAttrs({ [name]: false }), '', name);
    assert.equal(stateAttrs({ [name]: 'yes' }), '', name);
  }
  assert.equal(stateAttrs({}), '');
  assert.equal(stateAttrs(null), '');
  assert.equal(stateAttrs({ unknown: true }), '');
});

test('every state maps to the ARIA attribute the owner supports', () => {
  const owner = { aria: ALL_ARIA };
  const on = Object.fromEntries(Object.keys(ALL_ARIA).map((name) => [name, true]));
  assert.equal(
    stateAttrs(on, { owner }),
    ' aria-disabled="true" aria-readonly="true" aria-required="true" aria-invalid="true" aria-busy="true"'
      + ' aria-pressed="true" aria-checked="true" aria-selected="true" aria-current="true" aria-expanded="true"'
      + ' data-wf-disabled data-wf-readonly data-wf-required data-wf-invalid data-wf-loading'
      + ' data-wf-pressed data-wf-checked data-wf-selected data-wf-current data-wf-expanded',
  );
});

test('toggleable states keep explicit false ARIA; the others are omitted when off', () => {
  const owner = { aria: ALL_ARIA };
  assert.equal(
    stateAttrs({}, { owner }),
    ' aria-pressed="false" aria-checked="false" aria-selected="false" aria-expanded="false"',
  );
  assert.equal(stateAttrs({ pressed: false }, { owner: STATE_OWNERS.toggle }), ' aria-pressed="false"');
  assert.equal(stateAttrs({ checked: false }, { owner: STATE_OWNERS.check }), ' aria-checked="false"');
  assert.equal(stateAttrs({ expanded: false }, { owner: STATE_OWNERS.disclosure }), ' aria-expanded="false"');
  assert.equal(stateAttrs({ disabled: false, invalid: false }, { owner: STATE_OWNERS.check }), ' aria-checked="false"');
});

test('checked and pressed can be mixed', () => {
  assert.equal(stateAttrs({ checked: 'mixed' }, { owner: STATE_OWNERS.check }), ' aria-checked="mixed" data-wf-checked="mixed"');
  assert.equal(stateAttrs({ pressed: 'mixed' }, { owner: STATE_OWNERS.toggle }), ' aria-pressed="mixed" data-wf-pressed="mixed"');
  assert.equal(stateAttrs({ selected: 'mixed', expanded: 'mixed' }, { owner: { aria: ALL_ARIA } }), ' aria-pressed="false" aria-checked="false" aria-selected="false" aria-expanded="false"');
});

test('native states are bare attributes and never duplicated as ARIA', () => {
  assert.equal(
    stateAttrs({ disabled: true, readonly: true, required: true, invalid: true }, { owner: STATE_OWNERS.field }),
    ' disabled readonly required aria-invalid="true" data-wf-disabled data-wf-readonly data-wf-required data-wf-invalid',
  );
  // select has no native readonly, so readonly goes to ARIA.
  assert.equal(
    stateAttrs({ readonly: true, required: true }, { owner: STATE_OWNERS.select }),
    ' required aria-readonly="true" data-wf-readonly data-wf-required',
  );
  assert.equal(stateAttrs({ disabled: true, loading: true }, { owner: STATE_OWNERS.button }), ' disabled aria-busy="true" data-wf-disabled data-wf-loading');
  // Only disabled, readonly and required can be native.
  assert.equal(stateAttrs({ pressed: true }, { owner: { native: ['pressed'] } }), ' data-wf-pressed');
});

test('readonly with disabled: both are written', () => {
  assert.equal(
    stateAttrs({ disabled: true, readonly: true }, { owner: STATE_OWNERS.check }),
    ' aria-disabled="true" aria-readonly="true" aria-checked="false" data-wf-disabled data-wf-readonly',
  );
});

test('owners pick the aria-current token and tabs announce selection as pressed', () => {
  assert.equal(stateAttrs({ current: true }, { owner: STATE_OWNERS.link }), ' aria-current="page" data-wf-current');
  assert.equal(stateAttrs({ current: true }, { owner: STATE_OWNERS.item }), ' aria-current="true" data-wf-current');
  assert.equal(stateAttrs({ current: true }, { owner: { ...STATE_OWNERS.item, current: 'step' } }), ' aria-current="step" data-wf-current');
  assert.equal(stateAttrs({ current: false, disabled: true }, { owner: STATE_OWNERS.link }), ' aria-disabled="true" data-wf-disabled');
  assert.equal(stateAttrs({ selected: true }, { owner: STATE_OWNERS.tab }), ' aria-pressed="true" data-wf-selected');
  assert.equal(stateAttrs({}, { owner: STATE_OWNERS.tab }), ' aria-pressed="false"');
  // Two states mapped onto one attribute: the first in state order wins.
  assert.equal(
    stateAttrs({ selected: true }, { owner: { aria: { pressed: 'aria-pressed', selected: 'aria-pressed' } } }),
    ' aria-pressed="false" data-wf-selected',
  );
});

test('display-only owners carry no widget roles', () => {
  for (const key of ['item', 'link']) {
    const markup = stateAttrs({ current: true, disabled: true, selected: true, expanded: true }, { owner: STATE_OWNERS[key] });
    assert.doesNotMatch(markup, /role=|aria-selected|aria-expanded/, key);
  }
});

// actionButtons as it was at 64b4567, kept as the byte-identity oracle.
function legacyActionButtons(value, ctx) {
  const list = lib.items(value);
  if (list.length === 0) return '';
  const buttons = list.map((action) => {
    const variant = str(action.variant) || 'secondary';
    const label = str(action.label);
    const glyph = iconSpan(action.icon);
    const inner = label ? `${glyph}${escapeHtml(label)}` : glyph || renderSkeleton(5);
    const route = str(action.route);
    const href = route && isObject(ctx.routeTable) && typeof ctx.routeTable[route] === 'string'
      ? ctx.routeTable[route]
      : '';
    const cls = `wf-act wf-button-${toSafeClass(variant)}${label ? '' : ' wf-act-icon'}`;
    return href
      ? `<a class="${cls}" ${navigationAttrs({ href, routeId: route }).join(' ')}>${inner}</a>`
      : `<button class="${cls}">${inner}</button>`;
  });
  return `<div class="wf-actions">${buttons.join('')}</div>`;
}

const ROUTES = { routeTable: { home: '/index.html', 'odd"route': '/odd.html' } };
const LEGACY_ACTIONS = [
  undefined, null, 'Save', [], ['Save', 'Cancel'], [null, true, 3, ['x']],
  [{ label: 'Open', route: 'home' }, { label: 'Missing', route: 'nowhere' }, { label: 'Odd', route: 'odd"route' }],
  [{ title: 'From title', variant: 'primary' }, { label: '', title: 'blank kept', icon: 'plus' }, { icon: 'gear' }, {}],
  [{ label: '<b>', variant: 'weird variant!' }, { label: 'Danger', variant: 'danger', route: 'home', icon: 'trash' }],
  [{ label: 'Typed', route: 5 }, { label: 'Spaces', route: ' home ' }],
];

test('actionButtons is byte-identical for actions that use only today\'s keys', () => {
  for (const value of LEGACY_ACTIONS) {
    for (const ctx of [ROUTES, {}, { routeTable: null }]) {
      assert.equal(lib.actionButtons(value, ctx), legacyActionButtons(value, ctx), JSON.stringify(value));
    }
  }
});

test('a disabled routed action renders no link', () => {
  const markup = lib.actionButtons([{ label: 'Open', route: 'home', disabled: true }], ROUTES);
  assert.equal(markup, '<div class="wf-actions"><button class="wf-act wf-button-secondary" aria-disabled="true" data-wf-disabled>Open</button></div>');
  assert.doesNotMatch(markup, /<a |href=|data-wf-route-target=/);
  // An unknown route renders a plain button, disabled or not.
  assert.equal(
    lib.actionButtons([{ label: 'Lost', route: 'nowhere' }], ROUTES),
    '<div class="wf-actions"><button class="wf-act wf-button-secondary">Lost</button></div>',
  );
  // disabled must be the boolean true.
  assert.match(lib.actionButtons([{ label: 'Open', route: 'home', disabled: 'true' }], ROUTES), /<a class="wf-act wf-button-secondary" href="\/index.html"/);
});

test('pressed actions are toggle buttons with explicit ARIA', () => {
  assert.equal(
    lib.actionButtons([{ label: 'Bold', pressed: true }, { label: 'Italic', pressed: false }], {}),
    '<div class="wf-actions"><button class="wf-act wf-button-secondary" aria-pressed="true" data-wf-pressed>Bold</button>'
      + '<button class="wf-act wf-button-secondary" aria-pressed="false">Italic</button></div>',
  );
  assert.equal(
    lib.actionButtons([{ label: 'Off', pressed: false, disabled: true }], {}),
    '<div class="wf-actions"><button class="wf-act wf-button-secondary" aria-disabled="true" aria-pressed="false" data-wf-disabled>Off</button></div>',
  );
  // A link cannot be pressed, so a routed pressed action keeps only the data attribute.
  assert.equal(
    lib.actionButtons([{ label: 'Home', route: 'home', pressed: true }], ROUTES),
    '<div class="wf-actions"><a class="wf-act wf-button-secondary" href="/index.html" data-wf-route-target="home" data-wf-pressed>Home</a></div>',
  );
});

test('tone adds the shared tone class; unknown tones add nothing', () => {
  assert.equal(
    lib.actionButtons([{ label: 'Delete', tone: 'danger' }, { label: 'Note', tone: 'info' }, { label: 'Plain', tone: 'neutral' }, { label: 'Bad', tone: 'pink' }], {}),
    '<div class="wf-actions"><button class="wf-act wf-button-secondary wf-tone-danger">Delete</button>'
      + '<button class="wf-act wf-button-secondary wf-tone-info">Note</button>'
      + '<button class="wf-act wf-button-secondary">Plain</button>'
      + '<button class="wf-act wf-button-secondary">Bad</button></div>',
  );
});

test('card and page_header render the new action states', () => {
  const card = renderNode({ id: 'c', component: 'card', props: { title: 'Card', actions: [{ label: 'Go', route: 'home', disabled: true }] } }, ROUTES);
  assert.match(card, /<button class="wf-act wf-button-secondary" aria-disabled="true" data-wf-disabled>Go<\/button>/);
  const header = renderNode({ id: 'h', component: 'page_header', props: { title: 'Page', actions: [{ label: 'Go', route: 'home' }] } }, ROUTES);
  assert.match(header, /<a class="wf-act wf-button-secondary" href="\/index.html" data-wf-route-target="home">Go<\/a>/);
});
