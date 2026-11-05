const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('../../engine/renderer/primitives');

test('renderNode renders overlay roots from nodes and emits overlay attributes', () => {
  const html = renderNode({
    id: 'settings_overlay',
    kind: 'overlay',
    type: 'modal',
    trigger: 'open_settings',
    placement: 'center',
    dismissOn: ['backdrop', 'escape'],
    nodes: [
      {
        id: 'overlay_title',
        component: 'text',
        props: {
          text: 'Overlay Title',
        },
      },
    ],
  });

  assert.equal(html.includes('data-wf-overlay-type="modal"'), true);
  assert.equal(html.includes('data-wf-overlay-trigger="open_settings"'), true);
  assert.equal(html.includes('data-wf-overlay-placement="center"'), true);
  assert.equal(html.includes('data-wf-overlay-dismiss="[&quot;backdrop&quot;,&quot;escape&quot;]"'), true);
  assert.equal(html.includes('wf-overlay-modal'), true);
  assert.equal(html.includes('overlay_title'), true);
  assert.equal(html.includes('inset:0'), true);
  assert.equal(html.includes('wf-overlay-backdrop'), true);
});

// A page overlay's `props` were dropped on the way from the document to the
// renderer, so every modal in every project rendered without its title bar,
// its close button and its footer actions.
test('a page overlay keeps its own chrome', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { runBuild } = require('@wireframes/engine/build/fs-writer');

  const gallery = path.join(__dirname, '..', '..', 'engine', 'renderer', '__fixtures__', 'gallery');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-overlay-chrome-'));
  try {
    const result = runBuild({ projectPath: gallery, output, platform: 'web', clean: true });
    assert.equal(result.ok, true, result.error);

    const html = fs.readFileSync(path.join(output, 'web', 'overlays_elements.html'), 'utf8');
    assert.match(html, /wf-overlay-title">Delete this project\?/, 'the overlay lost its title');
    assert.match(html, /wf-overlay-close" aria-label="Close">/, 'a dismissible overlay lost its close button');
    assert.match(html, /wf-overlay-foot">[\s\S]*?Cancel[\s\S]*?Delete/, 'the overlay lost its footer actions');
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
