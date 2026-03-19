import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderProject } from '../bundle/wireframe-renderer.min.js';

const MANIFEST_YAML = `
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  name: Test Project
  schemaVersion: "1.1"
`;

const SITEMAP_YAML = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  routes:
    - id: home
      path: /
      page: home
`;

const TEMPLATES_YAML = `
documentType: templates
specVersion: "1.1"
id: templates
templates:
  main:
    layout:
      type: stack
    regions:
      - id: header
        kind: persistent
        children:
          - component: heading
            id: site-title
            props:
              text: Test Site
              level: 1
      - id: body
        kind: slot
`;

const HOME_PAGE_YAML = `
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
        - component: paragraph
          id: intro
          props:
            text: Hello from the renderer
`;

describe('renderProject', () => {
  it('exports renderProject as a function', () => {
    assert.strictEqual(typeof renderProject, 'function');
  });

  it('renders a minimal YAML project into HTML', () => {
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': HOME_PAGE_YAML,
    });

    assert.ok(result, 'result should be truthy');
    assert.ok(Array.isArray(result.pages), 'result.pages should be an array');
    assert.ok(result.pages.length > 0, 'should have at least one page');
    assert.strictEqual(typeof result.css, 'string');
    assert.strictEqual(typeof result.js, 'string');
    assert.ok(
      typeof result.routeTable === 'object' && result.routeTable !== null,
      'routeTable should be an object',
    );
  });

  it('produces HTML containing the page content', () => {
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': HOME_PAGE_YAML,
    });

    const homePage = result.pages.find((p) => p.pageId === 'home');
    assert.ok(homePage, 'should have a home page');
    assert.ok(homePage.html.includes('<!doctype html'), 'should be full HTML');
    assert.ok(
      homePage.html.includes('Hello from the renderer'),
      'should contain page text',
    );
    assert.ok(
      homePage.html.includes('Test Site'),
      'should contain template heading',
    );
  });

  it('generates CSS with wireframe styles', () => {
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': HOME_PAGE_YAML,
    });

    assert.ok(result.css.length > 0, 'CSS should not be empty');
    assert.ok(result.css.includes('wf-'), 'CSS should have wf- prefixed rules');
  });

  it('builds a route table', () => {
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': HOME_PAGE_YAML,
    });

    assert.ok('home' in result.routeTable, 'route table should have home');
  });

  it('throws on invalid YAML', () => {
    assert.throws(
      () => renderProject({ 'bad.yaml': '{{invalid: yaml::: content' }),
      /Invalid YAML/,
    );
  });

  it('throws when page references missing template', () => {
    const badPage = `
documentType: page
specVersion: "1.1"
id: orphan
page:
  template: nonexistent
  viewport:
    device: web
`;
    assert.throws(() =>
      renderProject({
        'manifest.yaml': MANIFEST_YAML,
        'sitemap.yaml': SITEMAP_YAML,
        'templates.yaml': TEMPLATES_YAML,
        'pages/orphan.yaml': badPage,
      }),
    );
  });

  it('accepts platform option', () => {
    const result = renderProject(
      {
        'manifest.yaml': MANIFEST_YAML,
        'sitemap.yaml': SITEMAP_YAML,
        'templates.yaml': TEMPLATES_YAML,
        'pages/home.yaml': HOME_PAGE_YAML,
      },
      { platform: 'web' },
    );

    assert.ok(result.pages.length > 0);
    assert.ok(
      result.pages.every((p) => p.platform === 'web'),
      'all pages should be web platform',
    );
  });

  it('produces deterministic output', () => {
    const input = {
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/home.yaml': HOME_PAGE_YAML,
    };

    const first = renderProject(input);
    const second = renderProject(input);

    assert.deepStrictEqual(first.pages, second.pages);
    assert.strictEqual(first.css, second.css);
    assert.strictEqual(first.js, second.js);
    assert.deepStrictEqual(first.routeTable, second.routeTable);
  });
});
