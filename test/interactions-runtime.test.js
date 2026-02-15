'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderWireframeMarkup } = require('../shared/screenshots/renderer');
const { renderNode } = require('../shared/renderer/primitives');
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

test('renderNode resolves route, props, item, and state bindings in text', () => {
  const html = renderNode({
    id: 'title',
    component: 'heading',
    props: {
      text: 'Welcome {{route.id}} / {{props.user}} / {{item.name}} — {{state.mode}}',
      level: 2,
      user: 'Alice',
    },
  }, {
    routeId: 'dashboard',
    itemContext: { name: 'Widget' },
  });

  assert.equal(html.includes('Welcome dashboard / Alice / Widget'), true);
  assert.equal(html.includes('data-bind=\"state.mode\"'), true);
});

test('renderNode renders collection bindings with custom itemVar and nested item paths', () => {
  const html = renderNode({
    id: 'product_list',
    component: 'section',
    binding: {
      source: 'products',
      itemVar: 'product',
    },
    children: [
      {
        id: 'product_name',
        component: 'text',
        props: {
          text: '{{product.name}} - {{product.address.city}}',
        },
      },
    ],
  }, {
    dataSources: {
      products: [
        { name: 'Laptop', address: { city: 'Chicago' } },
        { name: 'Phone', address: { city: 'Seattle' } },
      ],
    },
  });

  assert.equal(html.includes('Laptop - Chicago'), true);
  assert.equal(html.includes('Phone - Seattle'), true);
  assert.equal(html.includes('id="product_name_0"'), true);
  assert.equal(html.includes('id="product_name_1"'), true);
});

test('renderNode serializes state-bound attributes for runtime updates', () => {
  const html = renderNode({
    id: 'search_box',
    component: 'input',
    props: {
      placeholder: 'Find {{appState.query}}',
      inputType: 'text',
    },
  });

  assert.equal(
    html.includes('data-wf-state-bindings=\"{&quot;placeholder&quot;:&quot;{{appState.query}}&quot;}\"'),
    true,
  );
  assert.equal(html.includes('placeholder=\"Find \"'), true);
});

test('renderNode stores selection value for collection-bound items', () => {
  const html = renderNode({
    id: 'product_list',
    component: 'section',
    binding: { source: 'products', itemVar: 'product' },
    children: [
      {
        id: 'row',
        component: 'text',
        selection: {
          scope: 'page',
          stateKey: 'selected_product',
        },
        props: {
          text: '{{product.name}}',
        },
      },
    ],
  }, {
    dataSources: {
      products: {
        items: [
          { id: 101, name: 'Phone' },
          { id: 102, name: 'Laptop' },
        ],
        primaryKey: 'id',
      },
    },
  });

  assert.equal(html.includes('data-selection-key=\"selected_product\"'), true);
  assert.equal(html.includes('data-selection-value=\"101\"'), true);
  assert.equal(html.includes('data-selection-value=\"102\"'), true);
});

test('buildInteractionRuntime reads selection value attribute and respects selectable flag', () => {
  const script = buildInteractionRuntime({
    routeId: 'home',
    routeTable: { home: 'home.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    platform: 'web',
  });

  assert.equal(script.includes('selectionValueForNode'), true);
  assert.equal(script.includes('data-selection-selectable'), true);
});

test('renderWireframeMarkup resolves route-bound text before runtime', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'root',
        kind: 'container',
        nodes: [
          {
            id: 'route_label',
            component: 'text',
            props: {
              text: 'Route {{route.id}}',
            },
          },
        ],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'settings',
    routeTable: { settings: 'settings.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    projectPath: process.cwd(),
  });

  assert.equal(html.includes('Route settings'), true);
});
