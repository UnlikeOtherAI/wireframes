import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createWireframe } from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, TEMPLATES_YAML, simplePage } from './fixtures.mjs';

const SITEMAP = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  routes:
    - { id: home, path: /, page: home }
    - { id: about, path: /about, page: about }
`;

const FILES = {
  'manifest.yaml': MANIFEST_YAML,
  'sitemap.yaml': SITEMAP,
  'templates.yaml': TEMPLATES_YAML,
  'pages/home.yaml': simplePage('home', 'Home'),
  'pages/about.yaml': simplePage('about', 'About'),
};

// Just enough DOM for createWireframe: every srcdoc write is a new page with
// its own window, and the test fires that page's load event itself.
function fakeDom() {
  const frame = {
    style: {},
    listeners: {},
    pages: [],
    setAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    remove() {},
    set srcdoc(html) {
      this.contentWindow = { html, messages: [], postMessage(message) { this.messages.push(message); } };
      this.pages.push(this.contentWindow);
    },
    load() { for (const fn of this.listeners.load || []) fn(); },
  };
  globalThis.document = { createElement: () => frame };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  return { frame, container: { appendChild() {} } };
}

describe('createWireframe setMeasure', () => {
  let saved;
  before(() => { saved = { document: globalThis.document, window: globalThis.window }; });
  after(() => { globalThis.document = saved.document; globalThis.window = saved.window; });

  it('switches the mounted page and survives every re-render', () => {
    const { frame, container } = fakeDom();
    const wf = createWireframe(container, FILES);
    frame.load();
    assert.deepEqual(frame.contentWindow.messages, [], 'nothing is sent while measurement is off');

    wf.setMeasure(true);
    assert.deepEqual(frame.contentWindow.messages, [{ type: 'wf:measure', on: true }]);

    for (const rerender of [() => wf.setPage('about'), () => wf.setMode('line'), () => wf.setPlatform('ios'), () => wf.navigate('home')]) {
      const before = frame.pages.length;
      rerender();
      assert.equal(frame.pages.length, before + 1, 'the call renders a new page');
      frame.load();
      assert.deepEqual(frame.contentWindow.messages, [{ type: 'wf:measure', on: true }]);
    }
    assert.match(frame.contentWindow.html, /Home/);

    wf.setMeasure(false);
    assert.deepEqual(frame.contentWindow.messages.at(-1), { type: 'wf:measure', on: false });
    wf.setPage('about');
    frame.load();
    assert.deepEqual(frame.contentWindow.messages, [], 'a page loaded after switching off stays off');
  });
});
