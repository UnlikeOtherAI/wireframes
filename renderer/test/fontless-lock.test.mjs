import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// The iPad app renders through the bundle's default mount, which drops the icon
// stylesheet. The read-only lock must still draw there, in both modes, in
// Chromium and (where installed) WebKit. Playwright comes from the CLI package,
// which owns the browser dependency.

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', '..', 'cli', 'package.json'));
const playwright = require('playwright');
const BUNDLE = fs.readFileSync(path.join(here, '..', 'bundle', 'wireframe-renderer.iife.js'), 'utf8');

const FILES = {
  'manifest.yaml': 'documentType: manifest\nspecVersion: "1.1"\nid: manifest\nmanifest:\n  projectId: lock\n  name: Lock\n  schemaVersion: "1.1"\n',
  'sitemap.yaml': 'documentType: sitemap\nspecVersion: "1.1"\nid: sitemap\ndefaultTemplate: main\nroutes:\n  - { id: home, path: /, page: home, template: main }\n',
  'templates.yaml': 'documentType: templates\nspecVersion: "1.1"\nid: templates\ntemplates:\n  main:\n    layout: { type: stack }\n    regions:\n      - { id: main, kind: slot, role: main, layout: { type: stack, gap: 16, padding: 16 } }\n',
  'pages/home.yaml': [
    'documentType: page', 'specVersion: "1.1"', 'id: home', 'page:', '  id: home', '  template: main',
    '  viewport: { device: web }', '  slots:', '    - slotId: main', '      content:',
    '        - { id: plan, component: select, props: { label: Plan, options: [Free, Pro], value: Free, readonly: true } }',
    '        - { id: terms, component: checkbox, props: { label: Accepted, checked: true, readonly: true } }', '',
  ].join('\n'),
};

function installed(type) {
  try { return fs.existsSync(playwright[type].executablePath()); } catch { return false; }
}

for (const name of ['chromium', 'webkit']) {
  test(`the read-only lock draws in a fontless bundle mount in ${name}`, { skip: name === 'webkit' && !installed('webkit') ? 'Playwright WebKit is not installed on this host' : false }, async () => {
    const browser = await playwright[name].launch({ headless: true });
    try {
      for (const mode of ['card', 'line']) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
        await page.setContent('<!doctype html><html><body><div id="host" style="width:1280px;height:600px"></div></body></html>');
        await page.addScriptTag({ content: BUNDLE });
        await page.evaluate(({ files, mode }) => new Promise((resolve) => {
          const host = document.getElementById('host');
          window.Wireframes.createWireframe(host, files, { mode });
          host.querySelector('iframe').addEventListener('load', () => resolve(), { once: true });
        }), { files: FILES, mode });
        const frame = page.frames().find((f) => f !== page.mainFrame());
        assert.ok(frame, 'the mount renders into an iframe');
        assert.equal(await frame.locator('link[href*="fa/css"]').count(), 0, 'the default mount has no icon stylesheet');
        for (const id of ['plan', 'terms']) {
          const lock = await frame.locator(`#${id} .wf-field-lock`).evaluate((el) => {
            const box = el.getBoundingClientRect();
            const drawn = [...el.querySelectorAll('path, rect')].some((part) => part.getBBox().width > 0);
            return { width: box.width, height: box.height, drawn, color: getComputedStyle(el).color };
          });
          assert.ok(lock.width >= 8 && lock.height >= 8, `${name} ${mode} ${id}: the lock has a size (${lock.width}x${lock.height})`);
          assert.equal(lock.drawn, true, `${name} ${mode} ${id}: the lock is drawn without the icon font`);
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });
}
