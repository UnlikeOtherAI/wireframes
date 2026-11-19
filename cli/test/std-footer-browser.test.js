'use strict';

// The iPad's empty std.site_footer spans the full width with its brand on one
// line, in normal and adaptive renders, card and line mode.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { CAFE_FOOTER, BOOKING_FORM } = require('./fixtures/cafe-footer');
const { engines } = require('./helpers/browsers');

const BRAND = 'Happy Paws with Your Dog Walker';
const HUGE = 'The Extraordinarily Long Name of a Neighbourhood Dog Walking and Pet Sitting Cooperative';
const BRANDS = [
  { id: 'header', use: 'std.site_header', props: { brand: BRAND } },
  { id: 'acme', use: 'std.site_header', props: { brand: 'Acme' } },
  { id: 'huge', use: 'std.site_header', props: { brand: HUGE } },
  { id: 'footer', use: 'std.site_footer', role: 'contentinfo', slots: { social: [] }, props: { brand: BRAND, tagline: 'Walks, visits and sitting.' } },
];

// Each brand box: its size, its parent's width, its caption's lines, and whether it clips.
const brandBoxes = (page) => page.locator('.wf-company-logo').evaluateAll((logos) => logos.map((logo) => {
  const caption = logo.querySelector('.wf-image-caption');
  const line = parseFloat(getComputedStyle(caption).lineHeight) || parseFloat(getComputedStyle(caption).fontSize) * 1.3;
  const box = logo.getBoundingClientRect();
  let parent = logo.parentElement;
  while (parent.getBoundingClientRect().width === 0) parent = parent.parentElement;
  return {
    id: logo.id.split('__')[0], width: box.width, height: box.height, parent: parent.getBoundingClientRect().width,
    lines: Math.round((caption.getBoundingClientRect().height - 4) / line), clipped: logo.scrollHeight > logo.clientHeight + 1,
  };
}));

const CASES = [
  ['web', 1280, {}],
  ['adaptive tablet', 820, { adaptive: true, viewportOverride: { device: 'tablet', orientation: 'portrait' } }],
  ['adaptive phone', 390, { adaptive: true, viewportOverride: { device: 'mobile', orientation: 'portrait' } }],
];

for (const engine of engines()) {
  test(`the iPad footer spans the width with its brand on one line in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const result = renderPage(polishProject([BOOKING_FORM, CAFE_FOOTER], { mode }), 'home', { deviceChrome: false, ...options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.setContent(result.html);
          const m = await page.evaluate(() => {
            const footer = document.getElementById('footer');
            const form = document.getElementById('booking');
            const caption = footer.querySelector('#footer__logo .wf-image-caption');
            const line = parseFloat(getComputedStyle(caption).lineHeight) || parseFloat(getComputedStyle(caption).fontSize) * 1.3;
            return {
              footer: footer.getBoundingClientRect().width,
              form: form.getBoundingClientRect().width,
              captionLines: Math.round(caption.getBoundingClientRect().height / line),
              overflow: document.documentElement.scrollWidth - innerWidth,
            };
          });
          const label = `${engine.name} ${mode} ${name}`;
          assert.ok(Math.abs(m.footer - m.form) < 1, `${label}: footer ${m.footer}px spans the content (${m.form}px)`);
          assert.equal(m.captionLines, 1, `${label}: the brand sits on one line`);
          assert.ok(m.overflow <= 0, `${label}: no horizontal overflow`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });

  test(`a long brand grows its box to one line, up to 24rem, in the header and footer in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        for (const [name, width, options] of CASES) {
          const result = renderPage(polishProject(BRANDS, { mode }), 'home', { deviceChrome: false, ...options });
          assert.equal(result.ok, true, result.error);
          const page = await browser.newPage({ viewport: { width, height: 900 } });
          await page.setContent(result.html);
          const label = `${engine.name} ${mode} ${name}`;
          const boxes = Object.fromEntries((await brandBoxes(page)).map((b) => [b.id, b]));
          for (const b of Object.values(boxes)) {
            assert.ok(b.width <= Math.min(b.parent, 384) + 0.5, `${label}: ${b.id} box ${b.width}px stays within ${b.parent}px and 24rem`);
            assert.equal(b.clipped, false, `${label}: ${b.id} brand is not cut off`);
          }
          if (name !== 'adaptive phone') {
            for (const id of ['header', 'footer']) {
              assert.equal(boxes[id].lines, 1, `${label}: ${id} brand "${BRAND}" sits on one line`);
              assert.ok(boxes[id].width > 160, `${label}: ${id} box grew past 160px (${boxes[id].width}px)`);
            }
            assert.ok(boxes.huge.lines >= 2 && Math.abs(boxes.huge.width - 384) <= 0.5, `${label}: a brand past 24rem wraps at 24rem`);
          }
          assert.equal(Math.round(boxes.acme.width), Math.min(160, Math.round(boxes.acme.parent)), `${label}: a short brand keeps the 160px box`);
          assert.equal(Math.round(boxes.acme.height), 40, `${label}: a short brand keeps the 40px height`);
          if (name === 'web') {
            const tops = await page.locator('#acme .wf-nav-item').evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().top)));
            assert.equal(new Set(tops).size, 1, `${label}: the Acme header menu stays on one line`);
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${label}: no horizontal overflow`);
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
}
