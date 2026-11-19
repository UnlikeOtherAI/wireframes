'use strict';

// Menubar leaves navigate by keyboard, current reads differently from an open
// menu, and an interactive bar keeps its own interaction (render polish item 5).

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../../engine/build');
const { polishProject, ROUTE_TABLE } = require('./fixtures/polish-project');
const { engines } = require('./helpers/browsers');

const CONTENT = [
  // First, so no open panel hangs over it.
  { id: 'owned', component: 'menubar', interaction: [{ type: 'navigation', targetRoute: 'settings' }], props: { items: [
    { label: 'Inbox', route: 'docs' }, { label: 'Sent', route: 'docs' },
  ] } },
  { id: 'bar', component: 'menubar', props: { open: 'Edit', items: [
    { label: 'Home', route: 'home' },
    { label: 'Docs', route: 'docs' },
    { label: 'Edit', items: [{ label: 'Undo', shortcut: 'Ctrl+Z' }] },
  ] } },
  // An explicit mark turns route inference off, so the current open trigger gets its own bar.
  { id: 'viewbar', component: 'menubar', props: { open: 'View', items: [{ label: 'View', current: true, items: ['Zoom in'] }] } },
];

const look = (locator) => locator.evaluate((el) => {
  const s = getComputedStyle(el);
  return { weight: s.fontWeight, shadow: s.boxShadow, fill: s.backgroundColor, outline: s.outlineStyle };
});

for (const engine of engines()) {
  test(`menubar leaves, current and an interactive bar in ${engine.name}`, { skip: engine.skip }, async () => {
    const browser = await engine.launch();
    try {
      for (const mode of ['card', 'line']) {
        const result = renderPage(polishProject(CONTENT, { mode, routes: ['docs', 'settings'] }), 'home', {
          deviceChrome: false, routeTable: ROUTE_TABLE,
        });
        assert.equal(result.ok, true, result.error);
        const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
        await page.setContent(result.html);
        const label = `${engine.name} ${mode}`;
        const home = page.locator('#bar').getByRole('link', { name: 'Home', exact: true });
        assert.equal(await home.getAttribute('aria-current'), 'page', `${label}: the rendered route is current`);

        // Current is an underline and bold; expanded is a fill (card) or a dashed outline (line).
        const current = await look(home);
        const expanded = await look(page.locator('#bar').getByRole('button', { name: 'Edit', exact: true }));
        const both = await look(page.locator('#viewbar').getByRole('button', { name: 'View', exact: true }));
        assert.equal(current.weight, '600');
        assert.match(current.shadow, /inset/);
        assert.doesNotMatch(expanded.shadow, /inset/, `${label}: an open menu is not drawn as current`);
        if (mode === 'card') assert.notEqual(expanded.fill, current.fill);
        else assert.equal(expanded.outline, 'dashed');
        assert.match(both.shadow, /inset/, `${label}: a current trigger keeps its underline`);

        // Keyboard: Tab reaches the leaf links and Enter follows them.
        const docs = page.locator('#bar').getByRole('link', { name: 'Docs', exact: true });
        await home.focus();
        // Safari's WebKit moves focus between links with Option-Tab; plain Tab skips them.
        await page.keyboard.press(engine.name === 'webkit' ? 'Alt+Tab' : 'Tab');
        assert.equal(await docs.evaluate((el) => el === document.activeElement), true, `${label}: Tab moves to Docs`);
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => location.hash), '#docs', `${label}: Enter follows the link`);

        // A bar with its own interaction draws no links, so anchors never nest and its interaction runs.
        assert.equal(await page.locator('#owned a').count(), 0);
        await page.locator('#owned').getByText('Sent', { exact: true }).click();
        assert.equal(await page.evaluate(() => location.hash), '#settings', `${label}: the bar's interaction runs`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
