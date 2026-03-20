import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderProject,
  renderPage,
  buildRuntimeJs,
  buildRuntimeJsFromWindowContext,
} from '../bundle/wireframe-renderer.min.js';
import {
  MANIFEST_YAML,
  TEMPLATES_YAML,
  sitemapWithAppState,
  simplePage,
} from './fixtures.mjs';

function pageWithInteraction(pageId, interaction) {
  const entries = Object.entries(interaction)
    .filter(([k]) => k !== 'type')
    .map(([k, v]) => `              ${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `
documentType: page
specVersion: "1.1"
id: ${pageId}
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: button
          id: action_btn
          props:
            label: Click me
          interaction:
            - type: ${interaction.type}
${entries}
`;
}

function pageWithStateBinding(pageId) {
  return `
documentType: page
specVersion: "1.1"
id: ${pageId}
page:
  template: main
  viewport:
    device: web
  pageState:
    counter: 0
    show_panel: true
  slots:
    - slotId: body
      content:
        - component: text
          id: counter_display
          props:
            text: "{{state.counter}}"
        - component: section
          id: panel
          visibility:
            type: state_equals
            scope: page
            key: show_panel
            equals: true
          children:
            - component: text
              id: panel_text
              props:
                text: Panel content
`;
}

function pageWithSelection(pageId) {
  return `
documentType: page
specVersion: "1.1"
id: ${pageId}
page:
  template: main
  viewport:
    device: web
  pageState:
    selected_item: ""
  slots:
    - slotId: body
      content:
        - component: text
          id: item_a
          props:
            text: Item A
          selection:
            scope: page
            stateKey: selected_item
        - component: text
          id: item_b
          props:
            text: Item B
          selection:
            scope: page
            stateKey: selected_item
`;
}

const defaultOpts = {
  routeId: 'home',
  routeTable: { home: '/web/home.html' },
  appStateDefaults: {},
  pageStateDefaults: {},
  platform: 'web',
};

describe('buildRuntimeJs', () => {
  it('is exported and generates a JS string', () => {
    assert.strictEqual(typeof buildRuntimeJs, 'function');
    const js = buildRuntimeJs(defaultOpts);
    assert.strictEqual(typeof js, 'string');
    assert.ok(js.length > 0);
  });

  it('includes navigation, overlay, condition, toast, selection', () => {
    const js = buildRuntimeJs(defaultOpts);
    for (const fn of ['wfNavigate', 'openOverlay', 'closeOverlay', 'evalCondition', 'showToast', 'wf-selectable', 'wf-selected']) {
      assert.ok(js.includes(fn), `should include ${fn}`);
    }
  });

  it('includes state management', () => {
    const js = buildRuntimeJs({ ...defaultOpts, appStateDefaults: { theme: 'light' }, pageStateDefaults: { counter: 0 } });
    assert.ok(js.includes('WF_PAGE_STATE') && js.includes('WF_APP_STATE') && js.includes('sessionStorage'));
  });

  it('includes gesture handling for mobile', () => {
    const js = buildRuntimeJs({ ...defaultOpts, platform: 'mobile' });
    assert.ok(js.includes('bindGestures') && js.includes('swipe_left'));
  });

  it('preview mode adds postMessage bridge', () => {
    const js = buildRuntimeJs({ ...defaultOpts, preview: true });
    assert.ok(js.includes('postMessage') && js.includes('wf:navigate'));
  });

  it('non-preview mode has no postMessage bridge', () => {
    assert.ok(!buildRuntimeJs({ ...defaultOpts, preview: false }).includes('wf:navigate'));
  });

  it('generates deterministic output', () => {
    assert.strictEqual(buildRuntimeJs(defaultOpts), buildRuntimeJs(defaultOpts));
  });
});

describe('buildRuntimeJsFromWindowContext', () => {
  it('generates runtime that reads WF_RUNTIME_CONTEXT', () => {
    assert.strictEqual(typeof buildRuntimeJsFromWindowContext, 'function');
    assert.ok(buildRuntimeJsFromWindowContext().includes('WF_RUNTIME_CONTEXT'));
  });

  it('preview mode adds postMessage bridge', () => {
    assert.ok(buildRuntimeJsFromWindowContext({ preview: true }).includes('postMessage'));
  });
});

describe('Interaction runtime in rendered HTML', () => {
  const settingsPage = simplePage('settings', 'Settings page');

  it('navigation interaction renders data attributes', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithInteraction('home', { type: 'navigation', targetRoute: 'settings' }),
      'pages/settings.yaml': settingsPage,
    };
    const html = renderPage(files, 'home');
    assert.ok(html.includes('data-wf-interactions') && html.includes('navigation') && html.includes('wf-interactive'));
  });

  it('set_state interaction is encoded', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithInteraction('home', { type: 'set_state', scope: 'page', stateKey: 'counter', value: 1 }),
    };
    const html = renderPage(files, 'home');
    assert.ok(html.includes('set_state') && html.includes('counter'));
  });

  it('toggle interaction is encoded', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithInteraction('home', { type: 'toggle', scope: 'page', stateKey: 'is_visible' }),
    };
    assert.ok(renderPage(files, 'home').includes('toggle'));
  });

  it('action interaction encodes actionId', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithInteraction('home', { type: 'action', actionId: 'save_changes' }),
    };
    assert.ok(renderPage(files, 'home').includes('save_changes'));
  });

  it('submit interaction encodes formId', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithInteraction('home', { type: 'submit', formId: 'my_form' }),
    };
    const html = renderPage(files, 'home');
    assert.ok(html.includes('submit') && html.includes('my_form'));
  });
});

describe('State binding in rendered HTML', () => {
  it('state expression renders data-bind span', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithStateBinding('home'),
    };
    assert.ok(renderPage(files, 'home').includes('data-bind="state.counter"'));
  });

  it('visibility condition renders data-wf-visibility', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithStateBinding('home'),
    };
    const html = renderPage(files, 'home');
    assert.ok(html.includes('data-wf-visibility') && html.includes('state_equals') && html.includes('show_panel'));
  });

  it('page state defaults are embedded in per-page HTML', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithStateBinding('home'),
    };
    assert.ok(renderProject(files).pages.get('home').includes('counter'));
  });

  it('app state defaults are embedded in per-page HTML', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({ theme: 'light', lang: 'en' }),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithStateBinding('home'),
    };
    assert.ok(renderProject(files).pages.get('home').includes('theme'));
  });
});

describe('Selection rendering', () => {
  it('selectable nodes have wf-selectable class and data-selection-key', () => {
    const files = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': pageWithSelection('home'),
    };
    const html = renderPage(files, 'home');
    assert.ok(html.includes('wf-selectable'));
    assert.ok(html.includes('data-selection-key="selected_item"'));
  });
});

describe('Preview mode', () => {
  function baseFiles() {
    return {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapWithAppState({}),
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': simplePage('home', 'hello'),
    };
  }

  it('renderProject preview JS includes postMessage bridge', () => {
    const result = renderProject(baseFiles(), { preview: true });
    assert.ok(result.js.includes('postMessage') && result.js.includes('wf:navigate'));
  });

  it('renderPage preview mode injects bridge script', () => {
    const html = renderPage(baseFiles(), 'home', { preview: true });
    assert.ok(html.includes('postMessage') && html.includes('wf:navigate'));
  });

  it('non-preview renderProject does not include postMessage', () => {
    assert.ok(!renderProject(baseFiles()).js.includes('wf:navigate'));
  });
});
