'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildWireframeStyles } = require('@wireframes/engine/renderer/styles');
const { primitiveNames } = require('@wireframes/engine/schema/primitive-registry');
const { renderNode } = require('@wireframes/engine/renderer/primitives');

// Every node carries `wf-<element>`. Three real bugs came from an internal
// class reusing one of those names (.wf-page vs the page shell, .wf-skeleton vs
// the skeleton bar, .wf-badge-dot vs the dot inside it), so the element
// namespace is reserved: an internal class may extend `wf-<element>-...` but
// must never be exactly `wf-<element>`.
test('no internal class collides with an element class name', () => {
  const reserved = new Set(primitiveNames().map((name) => `wf-${name.replace(/_/g, '_')}`));
  reserved.add('wf-page');
  reserved.add('wf-node');
  reserved.add('wf-root');
  reserved.add('wf-surface');
  reserved.add('wf-group');

  const css = buildWireframeStyles();
  const markup = [
    renderNode({ id: 'n1', component: 'skeleton', props: { lines: 2, avatar: true } }, {}),
    renderNode({ id: 'n2', component: 'badge', props: { text: 'Live', variant: 'dot' } }, {}),
    renderNode({ id: 'n3', component: 'pagination', props: { page: 2, pages: 9 } }, {}),
    renderNode({ id: 'n4', component: 'toggle', props: { label: 'On', checked: true } }, {}),
  ].join('\n');

  // Classes the renderer emits on anything that is not the node's own root.
  const emitted = new Set();
  for (const match of markup.matchAll(/class="([^"]+)"/g)) {
    for (const cls of match[1].split(/\s+/)) {
      if (cls.startsWith('wf-')) emitted.add(cls);
    }
  }

  const rootClasses = new Set(['wf-node', 'wf-skeleton', 'wf-badge', 'wf-pagination', 'wf-toggle',
    'wf-surface', 'wf-group', 'wf-badge-dot', 'wf-pagination-numbers']);
  for (const cls of emitted) {
    if (rootClasses.has(cls)) continue;
    assert.ok(
      !reserved.has(cls),
      `internal class "${cls}" collides with the element class of the same name`,
    );
  }

  // The reserved names must still be styled somewhere, or elements are unstyled.
  assert.ok(css.includes('.wf-badge'), 'badge element has no styles');
  assert.ok(css.includes('.wf-bar{'), 'skeleton bar must use .wf-bar, not .wf-skeleton');
});

test('every primitive has a renderer and renders without throwing', () => {
  for (const name of primitiveNames()) {
    const html = renderNode({ id: `probe_${name}`, component: name }, {});
    assert.ok(html.includes(`wf-${name}`), `${name} did not render its element class`);
    assert.ok(html.includes('data-wf-frame='), `${name} did not emit a frame decision`);
  }
});

// A wireframe is greyscale. The four severity hues are the single exception,
// and they exist to answer one question: how bad is this? Letting them reach
// anything else — a heading, a chart series, a primary button, a fill — turns
// the wireframe into a visual design. This test is the fence around that rule.
test('hue marks severity, validity and destruction, and nothing else', () => {
  const css = buildWireframeStyles();
  const allowed = new Set([
    ':root',                 // the token definitions themselves
    '.wf-tone-info', '.wf-tone-success', '.wf-tone-warning', '.wf-tone-danger',
    '.wf-alert-info', '.wf-alert-success', '.wf-alert-warning', '.wf-alert-error',
    '.wf-button-danger',     // destructive action
    '.wf-field-invalid',     // a field that failed validation
    '.wf-field-error',       // the message under it
    '.wf-menu-danger', '.wf-sheet-danger', // destructive rows
  ]);

  for (const rule of css.split('\n')) {
    if (!/--wf-(info|success|warning|danger)\b/.test(rule)) continue;
    const selector = rule.slice(0, rule.indexOf('{'));
    const owner = selector.split(/[\s,>]+/).find((part) => allowed.has(part));
    assert.ok(owner, `"${selector}" paints a severity hue but is not in the severity allowlist`);
  }

  // The greyscale commitments that make the exception meaningful.
  assert.ok(!/\.wf-chart[^{]*\{[^}]*--wf-(info|success|warning|danger)/.test(css), 'charts must stay greyscale');
  assert.ok(!/\.wf-metric[^{]*\{[^}]*--wf-(info|success|warning|danger)/.test(css), 'metric trends must stay greyscale');
});
