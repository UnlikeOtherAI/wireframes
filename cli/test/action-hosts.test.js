'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { renderNode } = require('@wireframes/engine/renderer/primitives');
const { getPrimitive } = require('@wireframes/engine/schema/primitive-registry');
const { validatePrimitiveProps } = require('@wireframes/engine/lint/rules/primitive-props');
const { validateDocument } = require('@wireframes/engine/schema');
const schema = require('@wireframes/engine/schema/schema.json');

const ROUTES = { routeTable: { home: '/index.html', billing: '/billing.html' } };

function overlay(actions, options = ROUTES) {
  return renderNode({ id: 'dialog', kind: 'overlay', type: 'modal', props: { title: 'Dialog', actions }, content: [] }, options);
}

function footer(markup) {
  const match = markup.match(/<footer class="wf-overlay-foot">.*?<\/footer>/);
  return match ? match[0] : '';
}

// The overlay footer as it was at 8872d67, kept as the byte-identity oracle.
function legacyFooter(actions) {
  return Array.isArray(actions) && actions.length > 0
    ? `<footer class="wf-overlay-foot">${actions.map((action) => {
      const entry = lib.isObject(action) ? action : { label: String(action) };
      const variant = typeof entry.variant === 'string' ? entry.variant : 'secondary';
      return `<button class="wf-act wf-button-${lib.toSafeClass(variant)}">${lib.escapeHtml(String(entry.label ?? ''))}</button>`;
    }).join('')}</footer>`
    : '';
}

test('overlay footers render schema-valid legacy actions byte for byte', () => {
  const cases = [
    undefined,
    [],
    [{ label: 'Cancel' }, { label: 'Delete', variant: 'danger' }],
    [{ label: 'Reset' }, { label: 'Apply', variant: 'primary' }, { label: 'More', variant: 'ghost' }, { label: 'Docs', variant: 'link' }],
    [{ label: '<Close & leave>', variant: 'secondary' }],
  ];
  for (const actions of cases) {
    assert.equal(footer(overlay(actions)), legacyFooter(actions), JSON.stringify(actions));
  }
});

test('overlay footers render disabled, toned and routed actions through the shared helper', () => {
  const html = overlay([
    { label: 'Cancel' },
    { label: 'Billing', route: 'billing' },
    { label: 'Upgrade', route: 'billing', disabled: true, variant: 'primary' },
    { label: 'Lost', route: 'nowhere' },
    { label: 'Delete', variant: 'danger', tone: 'danger' },
  ]);
  assert.equal(
    footer(html),
    '<footer class="wf-overlay-foot">'
      + '<button class="wf-act wf-button-secondary">Cancel</button>'
      + '<a class="wf-act wf-button-secondary" href="/billing.html" data-wf-route-target="billing">Billing</a>'
      + '<button class="wf-act wf-button-primary" aria-disabled="true" data-wf-disabled>Upgrade</button>'
      + '<button class="wf-act wf-button-secondary">Lost</button>'
      + '<button class="wf-act wf-button-danger wf-tone-danger">Delete</button>'
      + '</footer>',
  );
});

test('a disabled routed overlay action renders no link', () => {
  const markup = footer(overlay([{ label: 'Upgrade', route: 'billing', disabled: true }]));
  assert.doesNotMatch(markup, /<a |href=|data-wf-route-target=/);
  assert.match(markup, /aria-disabled="true" data-wf-disabled>Upgrade</);
});

function pageWithOverlayActions(actions) {
  return {
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: {
      id: 'home',
      template: 'shell',
      viewport: { device: 'web', orientation: 'landscape' },
      slots: [{ slotId: 'main', content: [] }],
      overlays: [{ id: 'dialog', type: 'modal', content: [], props: { title: 'Dialog', actions } }],
    },
  };
}

test('the overlay actions schema takes disabled, tone and route and still rejects unknown keys', () => {
  const action = schema.$defs.Overlay.properties.props.properties.actions.items;
  assert.equal(action.additionalProperties, false);
  assert.deepEqual(Object.keys(action.properties), ['label', 'variant', 'route', 'disabled', 'tone']);
  assert.deepEqual(action.properties.disabled, { type: 'boolean' });
  assert.deepEqual(action.properties.tone.enum, ['neutral', 'info', 'success', 'warning', 'danger']);

  validateDocument(pageWithOverlayActions([
    { label: 'Upgrade', variant: 'primary', route: 'billing', disabled: true, tone: 'success' },
  ]), 'home.yaml');
  for (const bad of [{ label: 'Go', icon: 'star' }, { label: 'Go', pressed: true }, { label: 'Go', tone: 'pink' }, { label: 'Go', disabled: 'yes' }]) {
    assert.throws(
      () => validateDocument(pageWithOverlayActions([bad]), 'home.yaml'),
      (error) => error.details.errors.some((entry) => entry.path.startsWith('$.page.overlays[0].props.actions[0]')),
      JSON.stringify(bad),
    );
  }
});

test('card and alert declare actions as an item prop, so lint no longer warns', () => {
  for (const name of ['card', 'alert']) {
    assert.deepEqual(getPrimitive(name).props.actions, { type: 'array', items: true }, name);
    const result = { errors: [], warnings: [], info: [] };
    validatePrimitiveProps(result, { id: 'x', component: name, props: { title: 'T', actions: [{ label: 'Go' }] } }, 'page "home"');
    assert.deepEqual(result.warnings.filter((entry) => entry.code === 'UNKNOWN_PROP'), [], name);
  }
  // empty_state keeps its single action string.
  assert.deepEqual(getPrimitive('empty_state').props.action, { type: 'string' });
  assert.equal(getPrimitive('empty_state').props.actions, undefined);
});

test('card actions render in the head block with their states', () => {
  const html = renderNode({
    id: 'plan',
    component: 'card',
    props: { title: 'Plan', actions: [{ label: 'Manage', route: 'billing' }, { label: 'Cancel', tone: 'danger', disabled: true }] },
  }, ROUTES);
  assert.match(html, /<header class="wf-block-head"><div class="wf-block-text"><div class="wf-card-title">Plan<\/div><\/div><div class="wf-actions">/);
  assert.match(html, /<a class="wf-act wf-button-secondary" href="\/billing.html" data-wf-route-target="billing">Manage<\/a>/);
  assert.match(html, /<button class="wf-act wf-button-secondary wf-tone-danger" aria-disabled="true" data-wf-disabled>Cancel<\/button>/);
});

test('alert actions render below the text; an alert without actions is unchanged', () => {
  const props = { title: 'Payment failed', text: 'Update your card.', variant: 'error' };
  const plain = renderNode({ id: 'a', component: 'alert', props });
  assert.match(plain, /<div class="wf-alert-body"><div class="wf-alert-title">Payment failed<\/div><div class="wf-alert-text">Update your card\.<\/div><\/div>/);
  assert.doesNotMatch(plain, /wf-actions/);

  const html = renderNode({
    id: 'a',
    component: 'alert',
    props: { ...props, actions: [{ label: 'Update card', variant: 'primary', route: 'billing' }, { label: 'Retry', disabled: true }] },
  }, ROUTES);
  assert.match(html, /<div class="wf-alert-text">Update your card\.<\/div><div class="wf-actions"><a class="wf-act wf-button-primary" href="\/billing.html" data-wf-route-target="billing">Update card<\/a><button class="wf-act wf-button-secondary" aria-disabled="true" data-wf-disabled>Retry<\/button><\/div><\/div>/);
});
