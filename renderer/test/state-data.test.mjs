import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderPage,
  parseProject,
  extractAppStateDefaults,
  extractPageStateDefaults,
  resolveDataSources,
} from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, SITEMAP_BASIC, TEMPLATES_YAML, simplePage } from './fixtures.mjs';

const SITEMAP_WITH_STATE = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  appState:
    theme: light
    language: en
    user:
      name: Alice
  routes:
    - id: home
      path: /
      page: home
`;

const PAGE_WITH_STATE = `
documentType: page
specVersion: "1.1"
id: home
page:
  template: main
  viewport:
    device: web
  pageState:
    counter: 0
    show_panel: true
    filter: all
  slots:
    - slotId: body
      content:
        - component: text
          id: t1
          props:
            text: "Count: {{state.counter}}"
`;

const PAGE_WITH_DATA_BINDING = `
documentType: page
specVersion: "1.1"
id: home
page:
  template: main
  viewport:
    device: web
  dataSources:
    - id: products_source
      dataset: products
  slots:
    - slotId: body
      content:
        - component: section
          id: product_list
          binding:
            source: products_source
            itemVar: product
          children:
            - component: text
              id: product_name
              props:
                text: "{{product.name}}"
`;

const DATASET_YAML = `
documentType: dataset
specVersion: "1.1"
id: products
dataset:
  primaryKey: sku
  items:
    - sku: ABC123
      name: Widget A
      price: 19.99
    - sku: DEF456
      name: Widget B
      price: 29.99
    - sku: GHI789
      name: Widget C
      price: 39.99
`;

const DATASET_NESTED = `
documentType: dataset
specVersion: "1.1"
id: users
dataset:
  primaryKey: id
  items:
    - id: 1
      name: Alice
      address:
        city: Springfield
        state: IL
    - id: 2
      name: Bob
      address:
        city: Shelbyville
        state: IN
`;

const PAGE_WITH_NESTED_BINDING = `
documentType: page
specVersion: "1.1"
id: home
page:
  template: main
  viewport:
    device: web
  dataSources:
    - id: users_source
      dataset: users
  slots:
    - slotId: body
      content:
        - component: section
          id: user_list
          binding:
            source: users_source
            itemVar: user
          children:
            - component: text
              id: user_city
              props:
                text: "{{user.address.city}}"
`;

function buildFiles(overrides = {}) {
  return { 'manifest.yaml': MANIFEST_YAML, 'templates.yaml': TEMPLATES_YAML, ...overrides };
}

function parseWithState(sitemap, page) {
  return parseProject(buildFiles({ 'sitemap.yaml': sitemap, 'pages/home.yaml': page })).documentMap;
}

describe('extractAppStateDefaults', () => {
  it('is exported as a function', () => {
    assert.strictEqual(typeof extractAppStateDefaults, 'function');
  });

  it('extracts app state from sitemap', () => {
    const appState = extractAppStateDefaults(parseWithState(SITEMAP_WITH_STATE, PAGE_WITH_STATE));
    assert.strictEqual(appState.theme, 'light');
    assert.strictEqual(appState.language, 'en');
  });

  it('returns nested app state', () => {
    const appState = extractAppStateDefaults(parseWithState(SITEMAP_WITH_STATE, PAGE_WITH_STATE));
    assert.ok(appState.user, 'should have nested user state');
    assert.strictEqual(appState.user.name, 'Alice');
  });

  it('returns empty object when no app state', () => {
    const dm = parseWithState(SITEMAP_BASIC, simplePage('home', 'hello'));
    assert.deepStrictEqual(extractAppStateDefaults(dm), {});
  });
});

describe('extractPageStateDefaults', () => {
  it('is exported as a function', () => {
    assert.strictEqual(typeof extractPageStateDefaults, 'function');
  });

  it('extracts page state from page document', () => {
    const ps = extractPageStateDefaults(parseWithState(SITEMAP_WITH_STATE, PAGE_WITH_STATE), 'home');
    assert.strictEqual(ps.counter, 0);
    assert.strictEqual(ps.show_panel, true);
    assert.strictEqual(ps.filter, 'all');
  });

  it('returns empty object for missing page', () => {
    const dm = parseWithState(SITEMAP_BASIC, simplePage('home', 'hello'));
    assert.deepStrictEqual(extractPageStateDefaults(dm, 'nonexistent'), {});
  });

  it('returns empty object when page has no pageState', () => {
    const dm = parseWithState(SITEMAP_BASIC, simplePage('home', 'hello'));
    assert.deepStrictEqual(extractPageStateDefaults(dm, 'home'), {});
  });
});

describe('resolveDataSources', () => {
  it('is exported as a function', () => {
    assert.strictEqual(typeof resolveDataSources, 'function');
  });

  it('resolves data sources from page document', () => {
    const dm = parseProject(buildFiles({
      'sitemap.yaml': SITEMAP_BASIC,
      'pages/home.yaml': PAGE_WITH_DATA_BINDING,
      'data/products.yaml': DATASET_YAML,
    })).documentMap;
    const sources = resolveDataSources(dm, dm.pages.get('home')?.page);
    assert.ok(sources.products_source, 'should have products_source');
    assert.strictEqual(sources.products_source.items.length, 3);
    assert.strictEqual(sources.products_source.primaryKey, 'sku');
  });

  it('resolves dataset items with correct values', () => {
    const dm = parseProject(buildFiles({
      'sitemap.yaml': SITEMAP_BASIC,
      'pages/home.yaml': PAGE_WITH_DATA_BINDING,
      'data/products.yaml': DATASET_YAML,
    })).documentMap;
    const items = resolveDataSources(dm, dm.pages.get('home')?.page).products_source.items;
    assert.strictEqual(items[0].sku, 'ABC123');
    assert.strictEqual(items[0].name, 'Widget A');
    assert.strictEqual(items[1].name, 'Widget B');
  });

  it('returns empty object when no data sources', () => {
    const dm = parseProject(buildFiles({
      'sitemap.yaml': SITEMAP_BASIC,
      'pages/home.yaml': simplePage('home', 'hello'),
    })).documentMap;
    assert.deepStrictEqual(resolveDataSources(dm, dm.pages.get('home')?.page), {});
  });
});

describe('Data binding in rendered HTML', () => {
  const dataFiles = buildFiles({
    'sitemap.yaml': SITEMAP_BASIC,
    'pages/home.yaml': PAGE_WITH_DATA_BINDING,
    'data/products.yaml': DATASET_YAML,
  });

  it('collection binding clones children per dataset item', () => {
    const html = renderPage(dataFiles, 'home');
    assert.ok(html.includes('Widget A'), 'should render first item');
    assert.ok(html.includes('Widget B'), 'should render second item');
    assert.ok(html.includes('Widget C'), 'should render third item');
  });

  it('generates unique DOM IDs for cloned elements', () => {
    const html = renderPage(dataFiles, 'home');
    assert.ok(html.includes('product_name_0'), 'should have suffixed ID for first item');
    assert.ok(html.includes('product_name_1'), 'should have suffixed ID for second item');
    assert.ok(html.includes('product_name_2'), 'should have suffixed ID for third item');
  });

  it('nested dot notation resolves correctly', () => {
    const html = renderPage(buildFiles({
      'sitemap.yaml': SITEMAP_BASIC,
      'pages/home.yaml': PAGE_WITH_NESTED_BINDING,
      'data/users.yaml': DATASET_NESTED,
    }), 'home');
    assert.ok(html.includes('Springfield'), 'should resolve nested city for first item');
    assert.ok(html.includes('Shelbyville'), 'should resolve nested city for second item');
  });

  it('missing nested fields render empty in text content', () => {
    const incompleteDataset = `
documentType: dataset
specVersion: "1.1"
id: users
dataset:
  primaryKey: id
  items:
    - id: 1
      name: Alice
`;
    const html = renderPage(buildFiles({
      'sitemap.yaml': SITEMAP_BASIC,
      'pages/home.yaml': PAGE_WITH_NESTED_BINDING,
      'data/users.yaml': incompleteDataset,
    }), 'home');
    const cityNodeMatches = html.match(/id="user_city_0"[^>]*>([^<]*)</);
    const visibleText = cityNodeMatches ? cityNodeMatches[1].trim() : '';
    assert.ok(visibleText !== 'undefined', 'missing nested field should not render literal "undefined"');
  });
});

describe('State binding in rendered HTML', () => {
  it('state expression resolves to data-bind span', () => {
    const html = renderPage(buildFiles({
      'sitemap.yaml': SITEMAP_WITH_STATE, 'pages/home.yaml': PAGE_WITH_STATE,
    }), 'home');
    assert.ok(html.includes('data-bind="state.counter"'), 'should have data-bind for state binding');
  });

  it('appState expression resolves to data-bind span', () => {
    const pageWithAppState = `
documentType: page
specVersion: "1.1"
id: home
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: text
          id: theme_display
          props:
            text: "Theme: {{appState.theme}}"
`;
    const html = renderPage(buildFiles({
      'sitemap.yaml': SITEMAP_WITH_STATE, 'pages/home.yaml': pageWithAppState,
    }), 'home');
    assert.ok(html.includes('data-bind="appState.theme"'), 'should have data-bind for appState binding');
  });

  it('route.id expression resolves statically', () => {
    const pageWithRouteId = `
documentType: page
specVersion: "1.1"
id: home
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: text
          id: route_display
          props:
            text: "{{route.id}}"
`;
    const html = renderPage(buildFiles({
      'sitemap.yaml': SITEMAP_WITH_STATE, 'pages/home.yaml': pageWithRouteId,
    }), 'home');
    assert.ok(html.includes('home'), 'should resolve route.id statically');
  });
});
