'use strict';

// A labelled editor draws like every other field: the label above its box and
// the note below, instead of pressed into the corner of a frame that adds no
// inset because the editor pads itself.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const editor = (id, props) => ({ id, component: 'editor', props: { rows: 3, ...props } });
const CONTENT = [
  // The iPad case: straight in the page, card mode, device web.
  editor('doc', { label: 'Document', help: 'Formatting is kept when you paste.' }),
  editor('locked', { label: 'Release notes', readonly: true }),
  editor('wrong', { label: 'Summary', error: 'Write at least one line.' }),
  editor('bare', {}),
  { id: 'notes', component: 'textarea', props: { label: 'Notes' } },
  { id: 'panel', component: 'card', props: { title: 'In a card' }, children: [editor('carded', { label: 'Draft' })] },
];

// The frame, the label, the box that draws the edge, and the note.
const parts = (page, id) => page.locator(`#${id}`).evaluate((node) => {
  const rect = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
  const box = node.querySelector(':scope > .wf-editor-box, :scope > textarea');
  const edge = (el) => {
    const s = getComputedStyle(el);
    return { border: s.borderTopStyle, outline: s.outlineStyle, shadow: s.boxShadow, fill: s.backgroundColor, color: s.borderTopColor };
  };
  return {
    frame: edge(node),
    label: rect(node.querySelector(':scope > .wf-field-label')),
    box: rect(box),
    edge: box ? edge(box) : null,
    note: rect(node.querySelector(':scope > .wf-field-help, :scope > .wf-field-error')),
  };
});

for (const engine of engines()) {
  test(`a labelled editor puts its label above its box and its note below in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(CONTENT, { mode }), 'home', { deviceChrome: false });
        assert.equal(result.ok, true, result.error);
        const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;
        const drawn = (edge) => (mode === 'card' ? edge.border : edge.outline);
        const notes = await parts(page, 'notes');
        for (const id of ['doc', 'locked', 'wrong', 'carded']) {
          const p = await parts(page, id);
          assert.ok(p.box, `${label}: ${id} draws a box under its label`);
          assert.ok(p.label.bottom <= p.box.top, `${label}: ${id} label sits above its box`);
          assert.ok(Math.abs(p.label.left - p.box.left) <= 0.5, `${label}: ${id} label lines up with its box`);
          assert.ok(Math.abs((p.box.top - p.label.bottom) - (notes.box.top - notes.label.bottom)) <= 1, `${label}: ${id} label gap matches a textarea's`);
          assert.equal(p.frame.border, 'none', `${label}: ${id} frame draws no border`);
          assert.equal(p.frame.outline, 'none', `${label}: ${id} frame draws no outline`);
          assert.equal(p.frame.shadow, 'none', `${label}: ${id} frame draws no shadow`);
          assert.notEqual(drawn(p.edge), 'none', `${label}: ${id} box draws the edge`);
          if (p.note) assert.ok(p.note.top >= p.box.bottom, `${label}: ${id} note sits below its box`);
        }
        assert.equal(drawn((await parts(page, 'locked')).edge), 'dashed', `${label}: a read-only box is dashed`);
        const wrong = await parts(page, 'wrong');
        assert.equal(mode === 'card' ? wrong.edge.color : 'skip', mode === 'card' ? 'rgb(192, 68, 60)' : 'skip', `${label}: an invalid box takes the danger tone`);
        // Without a label or a note the frame is the box, as before.
        const bare = await parts(page, 'bare');
        assert.equal(bare.box, null, `${label}: a bare editor has no inner box`);
        assert.notEqual(drawn(bare.frame), 'none', `${label}: a bare editor's frame draws the edge`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${label}: no page overflow`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
