'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runBuild } = require('@wireframes/engine/build/fs-writer');
const { resolvePageTargets, renderWireframeMarkup } = require('@wireframes/engine/screenshots');
const { primitiveNames } = require('@wireframes/engine/schema/primitive-registry');

const galleryPath = path.resolve(__dirname, '..', '..', 'engine', 'renderer', '__fixtures__', 'gallery');

function renderAll() {
  const result = resolvePageTargets(galleryPath);
  assert.equal(result.ok, true, result.error);
  return result.targets.map((target) => ({
    pageId: target.pageId,
    html: renderWireframeMarkup({
      roots: target.roots,
      pageViewport: target.viewport,
      pageRouteId: target.pageRouteId,
      routeTable: target.routeTable,
      appStateDefaults: target.appStateDefaults,
      pageStateDefaults: target.pageStateDefaults,
      pageStyle: target.wireframeStyle,
      rendering: target.rendering || {},
      defaultGridColumns: target.defaultGridColumns,
      bodyLayoutType: target.bodyLayoutType || 'row',
      bodyLayout: target.bodyLayout,
      projectPath: galleryPath,
      dataSources: target.dataSources,
      sizing: target.sizing,
    }),
  }));
}

test('the gallery renders every page and exercises every element', () => {
  const pages = renderAll();
  assert.ok(pages.length >= 10, `expected the full gallery, got ${pages.length} pages`);

  const all = pages.map((page) => page.html).join('\n');
  const missing = primitiveNames().filter((name) => !all.includes(`wf-${name}`));
  assert.deepEqual(missing, [], `elements with no gallery coverage: ${missing.join(', ')}`);
});

test('the gallery demonstrates each frame decision', () => {
  const containers = renderAll().find((page) => page.pageId === 'containers');
  assert.ok(containers, 'containers page is missing');
  const { html } = containers;

  // card is unconditional, row never frames, a grid child is a tile.
  assert.match(html, /id="nested_card"[^>]*data-wf-frame="surface"/);
  assert.match(html, /id="row_never_framed"[^>]*data-wf-frame="group"/);
  assert.match(html, /id="tile_one"[^>]*data-wf-frame="surface"/);
  // Inside a frame a section is a group; surface: true overrides that.
  assert.match(html, /id="nested_section"[^>]*data-wf-frame="group"/);
  assert.match(html, /id="forced_surface"[^>]*data-wf-frame="surface"/);
  // An untitled row at the top of a page is a toolbar, not a panel.
  assert.match(html, /id="toolbar_row"[^>]*data-wf-frame="group"/);
  // A divided parent draws the strokes instead of its children.
  assert.match(html, /id="divided_a"[^>]*data-wf-frame="group"/);
  assert.match(html, /id="divided_a"[^>]*data-wf-edge="after"/);

  // `rendering.explain: true` records the rule behind each decision.
  assert.match(html, /data-wf-why="\d+:[a-z-]/);
});

test('a roled region gets its proportions from the sizing tokens', () => {
  const page = renderAll().find((entry) => entry.pageId === 'content');
  assert.ok(page, 'content page is missing');
  // role: sidebar, with no explicit size anywhere in the template.
  const nav = page.html.match(/<section[^>]*id="gallery_nav"[^>]*>/);
  assert.ok(nav, 'sidebar region is missing');
  assert.match(nav[0], /width:256px/);
  assert.match(nav[0], /min-width:200px/);
  assert.match(nav[0], /flex:0 0 auto/);
  // The slot takes the rest; it must not be pinned to a width.
  assert.match(page.html, /<section[^>]*id="main"[^>]*wf-root-slot/);
});

test('a native platform changes chrome, not elements', () => {
  const pages = renderAll();
  const ios = pages.find((page) => page.pageId === 'mobile');
  const android = pages.find((page) => page.pageId === 'android');
  assert.ok(ios && android);

  assert.match(ios.html, /class="wf wf-mode-card wf-platform-ios/);
  assert.match(android.html, /class="wf wf-mode-card wf-platform-android/);
  // Both get a status bar; only iOS gets the home indicator. Match the markup,
  // not the stylesheet, which carries both class names on every page.
  const body = (html) => html.slice(html.indexOf('<body'));
  assert.ok(body(ios.html).includes('class="wf-status-bar"'));
  assert.ok(body(android.html).includes('class="wf-status-bar"'));
  assert.ok(body(ios.html).includes('class="wf-home-indicator"'));
  assert.ok(!body(android.html).includes('class="wf-home-indicator"'));
  // Control height comes from the platform, not the element.
  assert.match(ios.html, /--wf-control-h:44px/);
  assert.match(android.html, /--wf-control-h:48px/);
});

test('the gallery builds to disk', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-gallery-'));
  try {
    const build = runBuild({ projectPath: galleryPath, output: outputDir, platform: 'web', clean: true });
    assert.equal(build.ok, true, build.error);

    const page = fs.readFileSync(path.join(outputDir, 'web', 'containers.html'), 'utf8');
    assert.ok(page.includes('data-wf-frame='), 'built pages carry the frame contract');

    const css = fs.readFileSync(path.join(outputDir, 'web', '_shared', 'wireframe.css'), 'utf8');
    assert.ok(css.includes('[data-wf-frame="surface"]'), 'the stylesheet keys on the frame contract');
    assert.ok(css.includes('.wf-visible'), 'overlay visibility survives the build');
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
