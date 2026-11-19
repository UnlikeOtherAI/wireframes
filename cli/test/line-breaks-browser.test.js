'use strict';

// Authored newlines in prose are line breaks; folded YAML is unchanged (render polish item 3).

const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

// The props exactly as YAML parses them, so block and folded scalars are real.
const PROPS = yaml.load(`
literal: |-
  Monday - Friday: 7:00 AM - 5:00 PM
  Saturday - Sunday: 8:00 AM - 4:00 PM
clip: |
  Paragraph line one
  Paragraph line two
folded: >-
  Sip, savor, and relax in our charming atmosphere. We offer the finest coffee and
  pastries in town.
foldedBlank: >-
  First paragraph line one
  continues here.

  Second paragraph.
`);

const CONTENT = [
  { id: 'hours', component: 'section', props: { title: 'Opening Hours', description: PROPS.literal } },
  { id: 'welcome', component: 'card', props: { title: 'Welcome', description: PROPS.folded } },
  { id: 'paras', component: 'card', props: { title: 'Two paragraphs', description: PROPS.foldedBlank } },
  { id: 'para', component: 'paragraph', props: { text: PROPS.clip } },
  { id: 'line', component: 'text', props: { text: 'Text line one\nText line two' } },
  { id: 'head', component: 'heading', props: { text: 'Heading one\nHeading two', level: 3 } },
  { id: 'notice', component: 'alert', props: { title: 'Notice', text: 'Line one\nLine two' } },
  { id: 'empty', component: 'empty_state', props: { title: 'Nothing yet', text: 'Line one\nLine two' } },
  { id: 'rows', component: 'list', props: { items: [{ title: 'Hours', text: 'Mon-Fri 7-17\nSat-Sun 8-16' }] } },
];

// Distinct line boxes the element's text occupies.
const LINES = {
  '#hours .wf-block-desc': 2,
  '#welcome .wf-block-desc': 1,
  '#paras .wf-block-desc': 2,
  '#para p': 2,
  '#line': 2,
  '#head h3': 2,
  '#notice .wf-alert-text': 2,
  '#empty .wf-empty-text': 2,
  '#rows .wf-list-text': 1,
};

function countLines(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const tops = new Set();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) if (rect.width > 0) tops.add(Math.round(rect.top));
    }
    return tops.size;
  });
}

test('folded scalars carry no newline, so only block scalars and \\n break', () => {
  assert.equal(PROPS.folded.includes('\n'), false);
  assert.equal(PROPS.foldedBlank.split('\n').length, 2);
  assert.equal(PROPS.clip.endsWith('\n'), true);
});

for (const engine of engines()) {
  test(`authored newlines in prose are line breaks in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [device, width] of [['web', 1280], ['mobile', 390]]) {
          const result = renderPage(polishProject(CONTENT, { mode, device }), 'home', { deviceChrome: false });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.setContent(result.html);
          for (const [selector, lines] of Object.entries(LINES)) {
            // A phone wraps the long folded sentence; it must still not gain an authored break.
            if (device === 'mobile' && selector === '#welcome .wf-block-desc') continue;
            assert.equal(await countLines(page, selector), lines, `${engine.name} ${mode} ${device} ${selector}`);
          }
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
