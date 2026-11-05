import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const { renderPage } = require('../../engine/build/index.js');

const root = fileURLToPath(new URL('../../examples/quickstart/', import.meta.url));

function loadQuickstart() {
  const map = { manifest: null, sitemap: null, templates: null, components: null, pages: new Map(), datasets: new Map() };
  const files = [
    ...['manifest', 'sitemap', 'templates', 'components'].map((name) => join(root, `${name}.yaml`)),
    ...readdirSync(join(root, 'pages')).map((name) => join(root, 'pages', name)),
  ];
  for (const file of files) {
    const doc = yaml.load(readFileSync(file, 'utf8'));
    if (doc.documentType === 'page') map.pages.set(doc.id, doc);
    else map[doc.documentType] = doc;
  }
  return map;
}

const stripAnnotations = (html) => html.replace(/ data-wf-(source|definition|row|component|variant)="[^"]*"/g, '');

describe('source annotation', () => {
  it('leaves default output free of annotations', () => {
    const { html } = renderPage(loadQuickstart(), 'billing');
    assert.doesNotMatch(html, /data-wf-(source|definition|row|component|variant)=/);
  });

  it('changes nothing but the annotations when enabled', () => {
    const plain = renderPage(loadQuickstart(), 'billing');
    const annotated = renderPage(loadQuickstart(), 'billing', { annotateSource: true });
    assert.equal(stripAnnotations(annotated.html), plain.html);
  });

  it('does not change the document map it is given', () => {
    const map = loadQuickstart();
    const before = JSON.stringify(map.pages.get('billing'));
    renderPage(map, 'billing', { annotateSource: true });
    assert.equal(JSON.stringify(map.pages.get('billing')), before);
  });

  it('maps a page node to its page document', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { annotateSource: true });
    assert.match(html, /data-wf-source="page:billing#invoice_table"/);
  });

  it('keeps instance and definition apart on a component root', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { annotateSource: true });
    assert.match(html, /<[a-z]+[^>]*\bid="summary"[^>]*data-wf-source="page:billing#summary"[^>]*data-wf-definition="component:plan_summary"/);
  });

  it('maps a component child to its definition, keeping the occurrence id', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { annotateSource: true });
    assert.match(html, /<[a-z]+[^>]*\bid="summary__[^"]+"[^>]*data-wf-source="component:plan_summary#/);
  });

  it('annotates template regions', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { annotateSource: true });
    assert.match(html, /<section[^>]*data-wf-source="template:app#/);
  });
});

describe('adaptive layout', () => {
  const phone = { viewportOverride: { device: 'mobile', orientation: 'portrait' } };

  it('is off unless asked for', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', phone);
    assert.doesNotMatch(html, /wf-adapt-/);
  });

  it('adapts a page shown smaller than it was designed for', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { ...phone, adaptive: true });
    assert.match(html, /<body class="wf wf-adapt-mobile /);
    assert.match(html, /\.wf-adapt-mobile \.wf-body-row\{flex-direction:column!important\}/);
  });

  it('adapts to a tablet too', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', {
      viewportOverride: { device: 'tablet', orientation: 'portrait' },
      adaptive: true,
    });
    assert.match(html, /<body class="wf wf-adapt-tablet /);
  });

  it('leaves a page at the size it was designed for alone', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', { adaptive: true });
    assert.doesNotMatch(html, /wf-adapt-/);
  });

  it('never enlarges a page designed for a phone', () => {
    const map = loadQuickstart();
    map.pages.get('billing').page.viewport = { device: 'mobile', orientation: 'portrait' };
    const { html } = renderPage(map, 'billing', { adaptive: true });
    assert.doesNotMatch(html, /wf-adapt-/);
  });
});

describe('render overrides', () => {
  it('lays out at an explicit viewport without changing the source', () => {
    const map = loadQuickstart();
    const before = JSON.stringify(map.pages.get('billing'));
    const { html } = renderPage(map, 'billing', {
      viewportOverride: { device: 'tablet', orientation: 'landscape', width: 900, height: 700 },
    });
    assert.match(html, /class="wf-page" style="width:900px;min-height:700px;"/);
    assert.equal(JSON.stringify(map.pages.get('billing')), before);
  });

  it('uses the device preset when no size is given', () => {
    const { html } = renderPage(loadQuickstart(), 'billing', {
      viewportOverride: { device: 'mobile', orientation: 'portrait' },
    });
    assert.match(html, /class="wf-page" style="width:390px;min-height:844px;"/);
  });

  it('drops the fake status bar on request', () => {
    const options = { viewportOverride: { device: 'mobile', orientation: 'portrait', platform: 'ios' } };
    const withChrome = renderPage(loadQuickstart(), 'billing', options);
    const without = renderPage(loadQuickstart(), 'billing', { ...options, deviceChrome: false });
    assert.match(withChrome.html, /<div class="wf-status-bar"/);
    assert.doesNotMatch(without.html, /<div class="wf-status-bar"/);
    assert.doesNotMatch(without.html, /<div class="wf-home-indicator"/);
  });
});
