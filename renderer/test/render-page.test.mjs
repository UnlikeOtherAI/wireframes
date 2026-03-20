import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderPage, parseProject, renderProject } from '../bundle/wireframe-renderer.min.js';

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
    - id: about
      path: /about
      page: about
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
            text: Welcome home
`;

const ABOUT_PAGE_YAML = `
documentType: page
specVersion: "1.1"
id: about
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: paragraph
          id: about-text
          props:
            text: About us
`;

function baseFiles() {
  return {
    'manifest.yaml': MANIFEST_YAML,
    'sitemap.yaml': SITEMAP_YAML,
    'templates.yaml': TEMPLATES_YAML,
    'pages/home.yaml': HOME_PAGE_YAML,
    'pages/about.yaml': ABOUT_PAGE_YAML,
  };
}

describe('renderPage', () => {
  it('exports renderPage as a function', () => {
    assert.strictEqual(typeof renderPage, 'function');
  });

  it('renders a single page with template resolution', () => {
    const html = renderPage(baseFiles(), 'home');
    assert.ok(html.includes('Welcome home'), 'should contain page content');
    assert.ok(html.includes('Test Site'), 'should contain template heading');
    assert.ok(html.includes('<!doctype html'), 'should be full HTML');
  });

  it('renders a different page correctly', () => {
    const html = renderPage(baseFiles(), 'about');
    assert.ok(html.includes('About us'), 'should contain about page content');
    assert.ok(html.includes('Test Site'), 'should contain template heading');
  });

  it('throws for missing page ID', () => {
    assert.throws(
      () => renderPage(baseFiles(), 'nonexistent'),
      /not found|missing/i,
    );
  });

  it('throws for invalid YAML', () => {
    assert.throws(
      () => renderPage({ 'bad.yaml': '{{broken yaml' }, 'home'),
      /Invalid YAML/,
    );
  });

  it('produces deterministic output', () => {
    const files = baseFiles();
    const first = renderPage(files, 'home');
    const second = renderPage(files, 'home');
    assert.strictEqual(first, second);
  });

  it('options.mode overrides page-level rendering mode', () => {
    const files = baseFiles();
    const lineHtml = renderPage(files, 'home', { mode: 'line' });
    const cardHtml = renderPage(files, 'home', { mode: 'card' });

    const lineBody = lineHtml.match(/<body[^>]*class="([^"]*)"/);
    const cardBody = cardHtml.match(/<body[^>]*class="([^"]*)"/);
    assert.ok(lineBody, 'line HTML should have body with class');
    assert.ok(cardBody, 'card HTML should have body with class');
    assert.ok(lineBody[1].includes('wf-mode-line'), 'line mode body should have wf-mode-line');
    assert.ok(!lineBody[1].includes('wf-mode-card'), 'line mode body should not have wf-mode-card');
    assert.ok(cardBody[1].includes('wf-mode-card'), 'card mode body should have wf-mode-card');
    assert.ok(!cardBody[1].includes('wf-mode-line'), 'card mode body should not have wf-mode-line');
    assert.notStrictEqual(lineHtml, cardHtml, 'different modes produce different HTML');
  });
});

describe('parseProject', () => {
  it('exports parseProject as a function', () => {
    assert.strictEqual(typeof parseProject, 'function');
  });

  it('returns documentMap, pageIds, and routeIds', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.documentMap, 'should have documentMap');
    assert.ok(Array.isArray(result.pageIds), 'should have pageIds array');
    assert.ok(Array.isArray(result.routeIds), 'should have routeIds array');
  });

  it('lists all page IDs', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.pageIds.includes('home'), 'should have home page');
    assert.ok(result.pageIds.includes('about'), 'should have about page');
  });

  it('lists all route IDs', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.routeIds.includes('home'), 'should have home route');
    assert.ok(result.routeIds.includes('about'), 'should have about route');
  });

  it('documentMap has parsed manifest', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.documentMap.manifest, 'should have manifest');
  });

  it('documentMap has parsed sitemap', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.documentMap.sitemap, 'should have sitemap');
  });

  it('documentMap has parsed templates', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.documentMap.templates, 'should have templates');
  });

  it('documentMap pages is a Map with expected entries', () => {
    const result = parseProject(baseFiles());
    assert.ok(result.documentMap.pages instanceof Map, 'pages should be a Map');
    assert.ok(result.documentMap.pages.has('home'), 'should have home page');
    assert.ok(result.documentMap.pages.has('about'), 'should have about page');
  });

  it('throws on invalid YAML', () => {
    assert.throws(
      () => parseProject({ 'bad.yaml': '{{broken yaml' }),
      /Invalid YAML/,
    );
  });
});

describe('Multi-platform build', () => {
  it('builds pages for multiple platforms', () => {
    const mobilePage = `
documentType: page
specVersion: "1.1"
id: mobile_home
page:
  template: main
  viewport:
    device: mobile
    orientation: portrait
  slots:
    - slotId: body
      content:
        - component: text
          id: t1
          props:
            text: Mobile
`;
    const webPage = `
documentType: page
specVersion: "1.1"
id: web_home
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: text
          id: t2
          props:
            text: Web
`;
    const sitemapYaml = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  routes:
    - id: mobile_home
      path: /mobile
      page: mobile_home
    - id: web_home
      path: /web
      page: web_home
`;
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': sitemapYaml,
      'templates.yaml': TEMPLATES_YAML,
      'pages/mobile.yaml': mobilePage,
      'pages/web.yaml': webPage,
    });
    assert.ok(result.pages.has('mobile_home'), 'should have mobile page');
    assert.ok(result.pages.has('web_home'), 'should have web page');
    assert.ok(result.pages.get('mobile_home').includes('Mobile'), 'mobile page should have Mobile text');
    assert.ok(result.pages.get('web_home').includes('Web'), 'web page should have Web text');
  });
});
