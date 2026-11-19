'use strict';

// The iPad's empty std.site_footer spans the full width with its brand on one
// line, in normal and adaptive renders, card and line mode.

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject } = require('./fixtures/polish-project');
const { CAFE_FOOTER, BOOKING_FORM } = require('./fixtures/cafe-footer');
const { engines } = require('./helpers/browsers');

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
}
