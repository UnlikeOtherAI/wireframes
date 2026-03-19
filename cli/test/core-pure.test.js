'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildProject, renderPage } = require('../../engine/build');
const { validateProject } = require('../../engine/validate');

function createMinimalDocumentMap() {
  return {
    manifest: {
      documentType: 'manifest',
      specVersion: '1.1',
      id: 'manifest',
      manifest: {
        projectId: 'test_app',
        name: 'Test App',
        schemaVersion: '1.1',
      },
    },
    sitemap: {
      documentType: 'sitemap',
      specVersion: '1.1',
      id: 'sitemap',
      routes: [
        { id: 'home', path: '/', page: 'home' },
      ],
    },
    templates: {
      documentType: 'templates',
      specVersion: '1.1',
      id: 'templates',
      templates: {
        main_template: {
          layout: { type: 'stack' },
          regions: [
            { id: 'main', kind: 'slot' },
          ],
        },
      },
    },
    components: {
      documentType: 'components',
      specVersion: '1.1',
      id: 'components',
      components: {},
    },
    pages: new Map([
      ['home', {
        documentType: 'page',
        specVersion: '1.1',
        id: 'home',
        page: {
          id: 'home',
          template: 'main_template',
          viewport: { device: 'web' },
          wireframeStyle: {
            border: { style: 'solid', width: 'thin' },
            corner: { style: 'rounded', radius: 8 },
          },
          slots: [
            {
              slotId: 'main',
              content: [
                { id: 'hero', component: 'section', surface: false },
              ],
            },
          ],
        },
      }],
    ]),
    datasets: new Map(),
  };
}

test('buildProject produces BuildOutput from in-memory DocumentMap', () => {
  const documentMap = createMinimalDocumentMap();
  const result = buildProject(documentMap);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.pages));
  assert.ok(result.pages.length > 0);
  assert.equal(typeof result.css, 'string');
  assert.equal(typeof result.js, 'string');
  assert.ok(result.css.length > 0);
  assert.ok(result.js.length > 0);
  assert.equal(typeof result.indexHtml, 'string');
  assert.ok(result.indexHtml.includes('<!doctype html>'));
  assert.ok(typeof result.routeTable === 'object');
  assert.ok(typeof result.platformIndexes === 'object');

  const webPage = result.pages.find((p) => p.platform === 'web' && p.pageId === 'home');
  assert.ok(webPage);
  assert.equal(typeof webPage.html, 'string');
  assert.ok(webPage.html.includes('<!doctype html>'));
});

test('buildProject with platform filter returns only matching pages', () => {
  const documentMap = createMinimalDocumentMap();
  const result = buildProject(documentMap, { platform: 'mobile' });

  assert.equal(result.ok, true);
  assert.equal(result.pages.length, 0);
});

test('renderPage renders a single page from in-memory DocumentMap', () => {
  const documentMap = createMinimalDocumentMap();
  const result = renderPage(documentMap, 'home');

  assert.equal(result.ok, true);
  assert.equal(result.pageId, 'home');
  assert.equal(typeof result.html, 'string');
  assert.ok(result.html.length > 0);
});

test('renderPage returns error for missing page', () => {
  const documentMap = createMinimalDocumentMap();
  const result = renderPage(documentMap, 'nonexistent');

  assert.equal(result.ok, false);
  assert.ok(result.error.includes('nonexistent'));
});

test('validateProject validates in-memory DocumentMap', () => {
  const documentMap = createMinimalDocumentMap();
  const result = validateProject(documentMap);

  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.errors));
  assert.ok(Array.isArray(result.warnings));
  assert.equal(result.errors.length, 0);
});

test('validateProject detects missing template reference', () => {
  const documentMap = createMinimalDocumentMap();
  documentMap.pages.get('home').page.template = 'nonexistent_template';

  const result = validateProject(documentMap);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'MISSING_TEMPLATE'));
});

test('validateProject returns error for invalid input', () => {
  const result = validateProject(null);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'INVALID_INPUT'));
});

test('validateProject with strict mode promotes warnings to errors', () => {
  const documentMap = createMinimalDocumentMap();
  const result = validateProject(documentMap, { strict: true });

  assert.equal(typeof result.ok, 'boolean');
  assert.ok(Array.isArray(result.errors));
  assert.equal(result.warnings.length, 0);
});

test('buildProject works with plain object pages (not Map)', () => {
  const documentMap = createMinimalDocumentMap();
  documentMap.pages = Object.fromEntries(documentMap.pages);
  documentMap.datasets = {};

  const result = buildProject(documentMap);
  assert.equal(result.ok, true);
  assert.ok(result.pages.length > 0);
});

test('renderPage works with plain object pages (not Map)', () => {
  const documentMap = createMinimalDocumentMap();
  documentMap.pages = Object.fromEntries(documentMap.pages);

  const result = renderPage(documentMap, 'home');
  assert.equal(result.ok, true);
  assert.equal(typeof result.html, 'string');
});
