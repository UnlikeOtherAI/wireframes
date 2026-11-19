'use strict';

// Menubar titles without a menu are page links; current follows nav's rule
// (render polish item 5, plan §9.3).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('../../engine/renderer/primitives');

const ROUTES = { home: '#home', docs: '#docs' };
const bar = (items, extra = {}, routeId = 'home') => renderNode(
  { id: 'bar', component: 'menubar', props: { items }, ...extra },
  { routeTable: ROUTES, routeId },
);
const triggers = (html) => html.match(/<(a|span|button) [^>]*class="wf-menubar-trigger"[^>]*>|<(a|span|button) class="wf-menubar-trigger"[^>]*>/g) || [];

test('a title with a known route and no menu is a link in the bar', () => {
  const html = bar([{ label: 'Home', route: 'home' }, { label: 'Docs', route: 'docs' }], {}, 'other');
  assert.deepEqual(triggers(html), [
    '<a class="wf-menubar-trigger" href="#home" data-wf-route-target="home">',
    '<a class="wf-menubar-trigger" href="#docs" data-wf-route-target="docs">',
  ]);
});

test('unknown, missing and disabled routes, and an interactive bar, fall back to text as nav rows do', () => {
  assert.deepEqual(triggers(bar([{ label: 'Lost', route: 'nowhere' }, { label: 'Help' }, { label: 'Gone', route: 'docs', disabled: true }])), [
    '<span class="wf-menubar-trigger">',
    '<span class="wf-menubar-trigger">',
    '<span class="wf-menubar-trigger" aria-disabled="true" data-wf-disabled>',
  ]);
  const inert = bar([{ label: 'Home', route: 'home' }], { interaction: [{ type: 'navigation', targetRoute: 'docs' }] }, 'docs');
  assert.deepEqual(triggers(inert), ['<span class="wf-menubar-trigger">']);
});

test('current: explicit marks first, then the leaf on the rendered route', () => {
  const inferred = bar([{ label: 'Home', route: 'home' }, { label: 'Docs', route: 'docs' }]);
  assert.match(inferred, /href="#home" data-wf-route-target="home" aria-current="page" data-wf-current>Home/);
  assert.doesNotMatch(inferred, /data-wf-route-target="docs" aria-current/);

  const explicit = bar([{ label: 'Home', route: 'home' }, { label: 'Docs', route: 'docs', current: true }]);
  assert.match(explicit, /data-wf-route-target="docs" aria-current="page" data-wf-current>Docs/);
  assert.doesNotMatch(explicit, /data-wf-route-target="home" aria-current/, 'an explicit mark turns inference off');

  const vetoed = bar([{ label: 'Home', route: 'home', current: false }, { label: 'Docs', route: 'docs' }]);
  assert.doesNotMatch(vetoed, /aria-current/, 'an item marked false is never inferred');

  const both = bar([{ label: 'Home', route: 'home', current: true }, { label: 'Docs', route: 'docs', current: true }]);
  assert.equal((both.match(/aria-current="page"/g) || []).length, 2, 'every marked item is current');

  const disabled = bar([{ label: 'Home', route: 'home', disabled: true }]);
  assert.doesNotMatch(disabled, /aria-current/, 'a disabled leaf is never inferred current');
});

test('a title with a menu stays a disclosure button; current adds aria-current beside aria-expanded', () => {
  const html = renderNode({ id: 'bar', component: 'menubar', props: { open: 'View', items: [
    { label: 'File', items: ['New'] }, { label: 'View', current: true, items: ['Zoom'] },
  ] } }, { routeTable: ROUTES, routeId: 'home' });
  assert.deepEqual(triggers(html), [
    '<button type="button" class="wf-menubar-trigger" aria-expanded="false">',
    '<button type="button" class="wf-menubar-trigger" aria-current="page" aria-expanded="true" data-wf-current data-wf-expanded>',
  ]);
  // A trigger's own route is not used, and a trigger is never inferred current.
  const routed = renderNode({ id: 'bar', component: 'menubar', props: { items: [{ label: 'Home', route: 'home', items: ['A'] }] } },
    { routeTable: ROUTES, routeId: 'home' });
  assert.doesNotMatch(routed, /href=|aria-current/);
});
