'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');
const { renderNode } = require('../../engine/renderer/primitives');
const { buildInteractionRuntime } = require('../../engine/renderer/interactions');

test('buildInteractionRuntime embeds route map and state defaults', () => {
  const script = buildInteractionRuntime({
    routeId: 'home',
    routeTable: { home: 'home.html', settings: 'settings.html' },
    appStateDefaults: { user: { theme: 'light' } },
    pageStateDefaults: { showPanel: true },
    platform: 'mobile',
  });

  assert.equal(script.includes('\"routeId\":\"home\"'), true);
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

test('renderWireframeMarkup emits overlay roots as actual overlay containers', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'menu_overlay',
        kind: 'overlay',
        type: 'menu',
        trigger: 'menu_button',
        placement: 'bottom',
        dismissOn: ['outside', 'escape'],
        nodes: [
          {
            id: 'menu_panel',
            component: 'section',
            children: [
              {
                id: 'menu_item',
                component: 'text',
                props: { text: 'Profile' },
              },
            ],
          },
        ],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'home',
    routeTable: { home: 'home.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    projectPath: process.cwd(),
  });

  assert.equal(html.includes('id="menu_overlay"'), true);
  assert.equal(html.includes('data-wf-overlay-type="menu"'), true);
  assert.equal(html.includes('data-wf-overlay-trigger="menu_button"'), true);
  assert.equal(html.includes('menu_item'), true);
});

test('renderWireframeMarkup keeps slot roots frameless and counts persistent roots as surfaces', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'body',
        kind: 'slot',
        nodes: [
          { id: 'slot_card', component: 'section', children: [] },
        ],
      },
      {
        id: 'header',
        kind: 'persistent',
        nodes: [
          { id: 'header_group', component: 'section', children: [] },
        ],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'home',
    routeTable: { home: 'home.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    projectPath: process.cwd(),
  });

  const slotRoot = html.match(/<section class="wf-root wf-root-container wf-root-slot"/);
  const headerRoot = html.match(/<section class="wf-root wf-root-container wf-surface"/);
  const slotCard = html.match(/id="slot_card" class="([^"]+)"/);
  const headerGroup = html.match(/id="header_group" class="([^"]+)"/);

  assert.ok(slotRoot);
  assert.ok(headerRoot);
  assert.equal(slotCard?.[1].includes('wf-surface'), true);
  assert.equal(headerGroup?.[1].includes('wf-group'), true);
  assert.equal(headerGroup?.[1].includes('wf-surface'), false);
});

test('renderWireframeMarkup applies full template body layout styles', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'body',
        kind: 'slot',
        nodes: [{ id: 'login_card', component: 'section', children: [] }],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'login',
    routeTable: { login: 'login.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    projectPath: process.cwd(),
    bodyLayoutType: 'stack',
    bodyLayout: {
      type: 'stack',
      align: 'center',
      justify: 'center',
      gap: 24,
      padding: 32,
    },
  });

  assert.equal(html.includes('class="wf-body-column" style="display:flex;flex-direction:column'), true);
  assert.equal(html.includes('align-items:center'), true);
  assert.equal(html.includes('justify-content:center'), true);
  assert.equal(html.includes('gap:24px'), true);
  assert.equal(html.includes('padding:32px'), true);
});

test('renderWireframeMarkup resets surface depth inside overlays', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'menu_overlay',
        kind: 'overlay',
        type: 'modal',
        nodes: [
          { id: 'modal_card', component: 'section', children: [] },
        ],
      },
    ],
    pageViewport: { width: 390, height: 844, device: 'mobile' },
    pageRouteId: 'home',
    routeTable: { home: 'home.html' },
    appStateDefaults: {},
    pageStateDefaults: {},
    projectPath: process.cwd(),
  });

  const modalCard = html.match(/id="modal_card" class="([^"]+)"/);
  assert.equal(modalCard?.[1].includes('wf-surface'), true);
});

test('renderNode renders anchor fallbacks for navigation buttons and text links', () => {
  const buttonHtml = renderNode({
    id: 'go_dashboard',
    component: 'button',
    props: { label: 'Dashboard' },
    interaction: [{ type: 'navigation', targetRoute: 'dashboard' }],
  }, {
    routeTable: { dashboard: '/web/dashboard.html' },
    mode: 'card',
  });

  const textHtml = renderNode({
    id: 'go_mobile',
    component: 'text',
    props: { text: 'Open mobile app' },
    interaction: [{ type: 'navigation', targetRoute: 'iphone_home' }],
  }, {
    routeTable: { iphone_home: '/mobile/iphone_home_mobile.html' },
  });

  assert.equal(buttonHtml.includes('href="/web/dashboard.html"'), true);
  assert.equal(buttonHtml.includes('data-wf-route-target="dashboard"'), true);
  assert.equal(textHtml.includes('href="/mobile/iphone_home_mobile.html"'), true);
  assert.equal(textHtml.includes('wf-inline-link'), true);
});

test('renderNode renders tab bars as dedicated surface containers', () => {
  const html = renderNode({
    id: 'tabs',
    component: 'tab_bar',
    children: [
      {
        id: 'home_tab',
        component: 'button',
        props: { label: 'Home' },
      },
      {
        id: 'account_tab',
        component: 'button',
        props: { label: 'Account' },
      },
    ],
  }, {
    mode: 'card',
    rendering: { mode: 'card' },
  });

  assert.equal(html.includes('wf-tab-bar'), true);
  assert.equal(html.includes('wf-surface'), true);
  assert.equal(html.includes('wf-tab-bar-body'), true);
  assert.equal(html.includes('wf-divide-x'), false);
});

test('renderNode renders tables from bound datasets with header and body rows', () => {
  const html = renderNode({
    id: 'ops_table',
    component: 'table',
    binding: { source: 'ops_table' },
    props: {
      columns: [
        { key: 'market', label: 'Market', width: '2fr' },
        { key: 'status', label: 'Status' },
        { key: 'spend', label: 'Spend', width: 120 },
      ],
    },
  }, {
    mode: 'card',
    rendering: { mode: 'card' },
    dataSources: {
      ops_table: {
        items: [
          { market: 'North America retail', status: 'Needs approval', spend: '$1.2M' },
          { market: 'EMEA partner launch', status: 'Ready', spend: '$860K' },
        ],
      },
    },
  });

  assert.equal(html.includes('wf-table'), true);
  assert.equal(html.includes('wf-table-header'), true);
  assert.equal(html.includes('grid-template-columns:2fr minmax(0,1fr) 120px'), true);
  assert.equal(html.includes('North America retail'), true);
  assert.equal(html.includes('EMEA partner launch'), true);
  assert.equal(html.includes('data-wf-table-row="1"'), true);
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

test('renderNode accepts label alias on text primitives and keeps text authoritative', () => {
  const labelOnly = renderNode({
    id: 'label_heading',
    component: 'heading',
    props: { label: 'Alias title', level: 2 },
  });
  const textWins = renderNode({
    id: 'text_heading',
    component: 'heading',
    props: { text: 'Canonical title', label: 'Alias title', level: 2 },
  });

  assert.equal(labelOnly.includes('Alias title'), true);
  assert.equal(textWins.includes('Canonical title'), true);
  assert.equal(textWins.includes('Alias title'), false);
});

test('renderNode emits skeletons for missing text content and unresolved props/item bindings', () => {
  const missingHeading = renderNode({
    id: 'missing_heading',
    component: 'heading',
    props: { level: 3 },
  });
  const missingParagraph = renderNode({
    id: 'missing_paragraph',
    component: 'paragraph',
    props: {},
  });
  const missingText = renderNode({
    id: 'missing_text',
    component: 'text',
    props: {},
  });
  const missingButton = renderNode({
    id: 'missing_button',
    component: 'button',
    props: {},
  });
  const unresolvedBinding = renderNode({
    id: 'unresolved',
    component: 'text',
    props: { text: 'Owner {{props.owner}} / {{item.status}}' },
  });

  assert.equal(missingHeading.includes('wf-skeleton'), true);
  assert.equal(missingHeading.includes('Heading'), false);
  assert.equal(missingParagraph.includes('width:100%'), true);
  assert.equal(missingParagraph.includes('width:60%'), true);
  assert.equal(missingText.includes('width:8ch'), true);
  assert.equal(missingButton.includes('width:6ch'), true);
  assert.equal(unresolvedBinding.match(/wf-skeleton/g)?.length, 2);
});

test('renderBoundText skeleton fallback does not replace runtime state bindings', () => {
  const html = renderNode({
    id: 'stateful_text',
    component: 'text',
    props: { text: '{{state.mode}} {{appState.user}} {{props.missing}}' },
  });

  assert.equal(html.includes('data-bind=\"state.mode\"'), true);
  assert.equal(html.includes('data-bind=\"appState.user\"'), true);
  assert.equal(html.includes('wf-skeleton'), true);
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

test('renderNode renders labels for text input, textarea, and select controls', () => {
  const inputHtml = renderNode({
    id: 'project_name',
    component: 'input',
    props: { label: 'Project Name', placeholder: 'Acme' },
  });
  const textareaHtml = renderNode({
    id: 'project_notes',
    component: 'textarea',
    props: { label: 'Notes', placeholder: 'Internal notes' },
  });
  const selectHtml = renderNode({
    id: 'project_status',
    component: 'select',
    props: { label: 'Status', options: ['Draft'] },
  });
  const unlabeledHtml = renderNode({
    id: 'search',
    component: 'input',
    props: { placeholder: 'Search' },
  });

  assert.equal(inputHtml.includes('<label class="wf-field-label">Project Name</label>'), true);
  assert.equal(textareaHtml.includes('<label class="wf-field-label">Notes</label>'), true);
  assert.equal(selectHtml.includes('<label class="wf-field-label">Status</label>'), true);
  assert.equal(unlabeledHtml.includes('wf-field-label'), false);
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

test('renderNode emits pane classes and runtime metadata', () => {
  const html = renderNode({
    id: 'sidebar',
    component: 'section',
    pane: {
      side: 'left',
      defaultSize: 260,
      minSize: 180,
      maxSize: 400,
      resizable: true,
      collapsible: true,
      collapsedSize: 48,
      state: {
        scope: 'page',
        sizeKey: 'sidebarSize',
        collapsedKey: 'sidebarCollapsed',
      },
    },
    children: [
      {
        id: 'title',
        component: 'text',
        props: { text: 'Navigation' },
      },
    ],
  }, { parentLayoutType: 'row' });

  assert.equal(html.includes('wf-pane'), true);
  assert.equal(html.includes('wf-pane-left'), true);
  assert.equal(html.includes('data-wf-pane'), true);
  assert.equal(html.includes('pane-left'), true);
  assert.equal(html.includes('resize:horizontal'), true);
  assert.equal(html.includes('width:260px'), true);
  assert.equal(html.includes('min-width:180px'), true);
  assert.equal(html.includes('max-width:400px'), true);
});

test('buildInteractionRuntime applies pane collapse size during initialization', () => {
  function createFakeElement(id, attrs = {}) {
    return {
      id,
      style: {},
      _attributes: { ...attrs },
      setAttribute(name, value) { this._attributes[name] = value; },
      getAttribute(name) { return Object.prototype.hasOwnProperty.call(this._attributes, name) ? this._attributes[name] : null; },
      removeAttribute(name) { delete this._attributes[name]; },
      classList: {
        add() {},
        remove() {},
        toggle() {},
      },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
  }

  function createFakeDocument() {
    const paneNode = createFakeElement('left_pane', {
      'data-wf-pane': JSON.stringify({
        side: 'left',
        axis: 'width',
        defaultSize: 280,
        minSize: 180,
        maxSize: 420,
        collapsedSize: 72,
        resizable: true,
        collapsible: true,
        state: {
          scope: 'page',
          sizeKey: 'leftSize',
          collapsedKey: 'leftCollapsed',
        },
      }),
    });
    return {
      _nodes: [paneNode],
      body: {
        appendChild() {},
        removeChild() {},
      },
      querySelectorAll(selector) {
        if (selector === '[data-wf-pane]') {
          return this._nodes;
        }
        return [];
      },
      getElementById(id) {
        return this._nodes.find((node) => node.id === id) || null;
      },
      createTextNode() { return {}; },
    };
  }

  const fakeDocument = createFakeDocument();
  const fakeStorage = {
    _values: {},
    getItem(key) { return Object.prototype.hasOwnProperty.call(this._values, key) ? this._values[key] : null; },
    setItem(key, value) { this._values[key] = value; },
  };
  const fakeWindow = {
    sessionStorage: fakeStorage,
    addEventListener() {},
  };

  vm.runInNewContext(buildInteractionRuntime({
    routeId: 'home',
    routeTable: {},
    appStateDefaults: {},
    pageStateDefaults: {
      leftSize: 320,
      leftCollapsed: true,
    },
    platform: 'web',
  }), {
    window: fakeWindow,
    document: fakeDocument,
    console: console,
    setTimeout,
    clearTimeout,
    ResizeObserver: undefined,
  });

  assert.equal(fakeDocument._nodes[0].style.width, '72px');
  assert.equal(fakeDocument._nodes[0].getAttribute('data-wf-pane-collapsed'), 'true');
});

test('renderNode renders icon component with Font Awesome classes', () => {
  const html = renderNode({
    id: 'settings_icon',
    component: 'icon',
    props: { name: 'gear', size: 'lg' },
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('wf-icon'), true);
  assert.equal(html.includes('fa-solid fa-gear fa-lg'), true);
});

test('renderNode renders icon with regular style', () => {
  const html = renderNode({
    id: 'heart_icon',
    component: 'icon',
    props: { name: 'heart', style: 'regular' },
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('fa-regular fa-heart'), true);
});

test('renderNode renders icon with brands style', () => {
  const html = renderNode({
    id: 'github_icon',
    component: 'icon',
    props: { name: 'github', style: 'brands' },
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('fa-brands fa-github'), true);
});

test('renderNode renders button with icon prop', () => {
  const html = renderNode({
    id: 'save_btn',
    component: 'button',
    props: { label: 'Save', icon: 'floppy-disk' },
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('fa-solid fa-floppy-disk'), true);
  assert.equal(html.includes('Save'), true);
});

test('renderNode renders button without icon when icon prop is absent', () => {
  const html = renderNode({
    id: 'plain_btn',
    component: 'button',
    props: { label: 'Click Me' },
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('fa-solid'), false);
  assert.equal(html.includes('Click Me'), true);
});

test('renderNode renders bottom_tab_bar with stretched button layout', () => {
  const html = renderNode({
    id: 'bottom_nav',
    component: 'bottom_tab_bar',
    children: [
      { id: 'home_tab', component: 'button', props: { label: 'Home', icon: 'house' } },
      { id: 'search_tab', component: 'button', props: { label: 'Search', icon: 'magnifying-glass' } },
    ],
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('wf-bottom-tab-bar'), true);
  assert.equal(html.includes('wf-surface'), true);
  assert.equal(html.includes('fa-solid fa-house'), true);
  assert.equal(html.includes('fa-solid fa-magnifying-glass'), true);
});

test('renderNode renders tab_bar without stretched buttons', () => {
  const html = renderNode({
    id: 'page_tabs',
    component: 'tab_bar',
    children: [
      { id: 'tab1', component: 'button', props: { label: 'Overview' } },
      { id: 'tab2', component: 'button', props: { label: 'Details' } },
    ],
  }, { mode: 'card', rendering: { mode: 'card' } });

  assert.equal(html.includes('wf-tab-bar'), true);
  assert.equal(html.includes('wf-bottom-tab-bar'), false);
});

test('renderWireframeMarkup includes local Font Awesome CSS link', () => {
  const html = renderWireframeMarkup({
    roots: [],
    pageViewport: { device: 'web', width: 1280, height: 900 },
    rendering: { mode: 'card' },
  });

  assert.equal(html.includes('_shared/fa/css/all.min.css'), true);
  assert.equal(html.includes('cdnjs.cloudflare.com'), false);
});
