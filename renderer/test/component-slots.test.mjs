import test from 'node:test';
import assert from 'node:assert/strict';
import { assertComponentExpansion, parseProject, renderPage, renderProject } from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, SITEMAP_BASIC, TEMPLATES_YAML } from './fixtures.mjs';

const doc = (value) => JSON.stringify({ specVersion: '1.1', ...value });

// A module whose `checkout` forwards its own placeholders into `panel`, with a
// locally imported badge inside the forwarded content.
const files = () => ({
  'manifest.yaml': MANIFEST_YAML,
  'sitemap.yaml': SITEMAP_BASIC,
  'templates.yaml': TEMPLATES_YAML,
  'components.yaml': doc({ documentType: 'components', id: 'components', components: {}, imports: { kit: 'components/kit.yaml' } }),
  'components/kit.yaml': doc({
    documentType: 'components', id: 'kit', imports: { ui: './ui.yaml' }, components: {
      panel: {
        propDefaults: { title: 'Details' },
        root: { id: 'panel', component: 'card', props: { title: '{{props.title}}' }, children: [
          { id: 'body', slot: 'default' },
          { id: 'footer', slot: 'footer', children: [{ id: 'close', component: 'button', props: { label: 'Close panel' } }] },
        ] },
      },
      checkout: {
        propDefaults: { heading: 'Checkout' },
        root: { id: 'checkout', component: 'stack', children: [
          { id: 'pay_form', component: 'stack', children: [{ id: 'card_number', component: 'input', props: { label: 'Card number' } }] },
          { id: 'pay_panel', use: 'panel', props: { title: '{{props.heading}}' },
            children: [{ id: 'trust', use: 'ui.badge' }, { id: 'checkout_body', slot: 'default' }],
            slots: { footer: [
              { id: 'pay', component: 'button', props: { label: 'Pay now' }, interaction: [{ type: 'submit', formId: 'pay_form' }] },
              { id: 'checkout_actions', slot: 'actions' },
            ] } },
        ] },
      },
    },
  }),
  'components/ui.yaml': doc({ documentType: 'components', id: 'ui', components: {
    badge: { root: { id: 'badge', component: 'badge', props: { text: 'Secure checkout' } } },
  } }),
  'pages/home.yaml': doc({ documentType: 'page', id: 'home', page: { template: 'main', viewport: { device: 'web' }, slots: [{
    slotId: 'body', content: [
      { id: 'order', use: 'kit.checkout', props: { heading: 'Your order' },
        children: [{ id: 'summary_line', component: 'text', props: { text: 'Two items in your basket' } }],
        slots: { actions: [{ id: 'save_later', component: 'button', props: { label: 'Save for later' } }] } },
      { id: 'gift', use: 'kit.checkout', props: { heading: 'Gift' }, slots: { actions: [] } },
      { id: 'plain', use: 'kit.panel' },
    ],
  }] } }),
});

test('the browser renderer resolves forwarded slots from an in-memory project', () => {
  const source = files();
  const original = JSON.stringify(source);
  const html = renderProject(source).pages.get('home');
  assert.equal(JSON.stringify(source), original, 'rendering must not rewrite the source files');

  assert.match(html, /Your order/);
  assert.match(html, /Two items in your basket/);
  assert.match(html, /id="summary_line"/, 'page fills keep page ids');
  assert.match(html, /id="save_later"/);
  assert.match(html, /id="order__trust"[^>]*>[\s\S]*?Secure checkout/, 'the locally imported badge renders inside the forwarded content');
  assert.match(html, /id="order__pay"/);
  assert.match(html, /id="gift__pay"/);
  assert.match(html, /id="order__pay"[^>]*data-wf-interactions="[^"]*&quot;formId&quot;:&quot;order__pay_form&quot;/, 'submit points at its own instance form');
  assert.match(html, /id="gift__pay"[^>]*data-wf-interactions="[^"]*&quot;formId&quot;:&quot;gift__pay_form&quot;/);
  assert.match(html, /id="plain__close"[^>]*>[\s\S]*?Close panel/, 'an omitted fill renders the fallback');
  assert.doesNotMatch(html, /id="order__close"/, 'a filled slot drops the fallback');
  assert.doesNotMatch(html, /\{\{props\./, 'no token survives');
  assert.match(html, /Details/, 'a root prop written as its own token takes the default');
});

test('the expansion guard accepts slot fills and still refuses definition cycles', () => {
  const { documentMap } = parseProject(files());
  const definitions = documentMap.componentRegistriesByPage.get('home');
  const roots = [{ id: 'outer', use: 'kit.panel', children: [{ id: 'inner', use: 'kit.panel' }] }];
  assert.ok(assertComponentExpansion(roots, definitions) > 0);
  const cyclic = { ...definitions, looper: { root: { id: 'looper', component: 'stack',
    children: [{ id: 'more', slot: 'default', children: [{ id: 'again', use: 'looper' }] }] } } };
  assert.throws(() => assertComponentExpansion([{ id: 'loop', use: 'looper' }], cyclic), /Circular/);
});

test('renderPage renders a page whose fill holds an instance of the same component', () => {
  const source = files();
  source['pages/home.yaml'] = doc({ documentType: 'page', id: 'home', page: { template: 'main', viewport: { device: 'web' },
    slots: [{ slotId: 'body', content: [{ id: 'outer', use: 'kit.panel', props: { title: 'Outer' },
      children: [{ id: 'inner', use: 'kit.panel', props: { title: 'Inner' } }] }] }] } });
  const html = renderPage(source, 'home');
  assert.match(html, /id="outer"[\s\S]*id="inner"[\s\S]*id="inner__close"[\s\S]*id="outer__close"/);
});
