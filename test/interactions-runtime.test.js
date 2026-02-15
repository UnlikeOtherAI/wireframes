'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderWireframeMarkup } = require('../shared/screenshots/renderer');
const { buildInteractionRuntime } = require('../shared/renderer/interactions');

test('buildInteractionRuntime embeds route map and state defaults', () => {
  const script = buildInteractionRuntime({
    routeId: 'home',
    routeTable: { home: 'home.html', settings: 'settings.html' },
    appStateDefaults: { user: { theme: 'light' } },
    pageStateDefaults: { showPanel: true },
    platform: 'mobile',
  });

  assert.equal(script.includes('WF_ROUTE_ID = "home"'), true);
  assert.equal(script.includes('"home":"home.html"'), true);
  assert.equal(script.includes('"settings":"settings.html"'), true);
  assert.equal(script.includes('"theme":"light"'), true);
  assert.equal(script.includes('"showPanel":true'), true);
});

test('renderWireframeMarkup includes runtime script and interaction attributes', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'root',
        kind: 'container',
        nodes: [
          {
            id: 'go_button',
            component: 'button',
            props: { label: 'Go Settings' },
            interaction: [{ type: 'navigation', targetRoute: 'settings' }],
          },
        ],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'home',
    routeTable: { home: 'home.html', settings: 'settings.html' },
    appStateDefaults: { theme: 'light' },
    pageStateDefaults: { show_panel: true },
    projectPath: process.cwd(),
  });

  assert.equal(html.includes('data-wf-interactions='), true);
  assert.equal(html.includes('<script>'), true);
  assert.equal(html.includes('wf-runtime-toast'), true);
});
