const test = require('node:test');
const assert = require('node:assert/strict');

const { renderNode } = require('../shared/renderer/primitives');

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
