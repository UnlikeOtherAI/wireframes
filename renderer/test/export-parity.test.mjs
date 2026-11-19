import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { renderProject } from '../bundle/wireframe-renderer.min.js';

// A project exported with `wf export` renders the same grid tracks and
// menubar links through the browser bundle as `wf build` does from disk.

const require = createRequire(import.meta.url);
const { runExport } = require('../../engine/export');
const { runBuild } = require('../../engine/build/fs-writer');

const FILES = {
  '.wfrc.yaml': 'cli:\n  strictValidation: false\n',
  'manifest.yaml': 'documentType: manifest\nspecVersion: "1.1"\nid: manifest\nmanifest:\n  projectId: parity\n  name: Parity\n  schemaVersion: "1.1"\n',
  'sitemap.yaml': [
    'documentType: sitemap', 'specVersion: "1.1"', 'id: sitemap', 'defaultTemplate: main', 'routes:',
    '  - { id: home, path: /, page: home, template: main }',
    '  - { id: docs, path: /docs, page: docs, template: main }', '',
  ].join('\n'),
  'templates.yaml': [
    'documentType: templates', 'specVersion: "1.1"', 'id: templates', 'templates:', '  main:',
    '    layout: { type: stack, gap: 0, padding: 0 }',
    '    regions:', '      - { id: main, kind: slot, role: main, layout: { type: stack, gap: 16, padding: 16 } }', '',
  ].join('\n'),
  'components.yaml': 'documentType: components\nspecVersion: "1.1"\nid: components\ncomponents: {}\n',
  'pages/home.yaml': [
    'documentType: page', 'specVersion: "1.1"', 'id: home', 'page:', '  id: home', '  template: main',
    '  viewport: { device: web }', '  slots:', '    - slotId: main', '      content:',
    '        - id: bar', '          component: menubar',
    '          props: { items: [{ label: Home, route: home }, { label: Docs, route: docs }, { label: Help, items: [About] }] }',
    '        - id: tiles', '          component: grid',
    '          repeat: { cell: card, items: [{ id: a, title: Alpha }, { id: b, title: Beta }, { id: c, title: Gamma }] }', '',
  ].join('\n'),
  'pages/docs.yaml': [
    'documentType: page', 'specVersion: "1.1"', 'id: docs', 'page:', '  id: docs', '  template: main',
    '  viewport: { device: web }', '  slots:', '    - slotId: main', '      content:',
    '        - { id: title, component: heading, props: { text: Docs } }', '',
  ].join('\n'),
};

function writeProject(dir) {
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

function extract(zip, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const unzip = spawnSync('unzip', ['-q', '-o', zip, '-d', dest], { encoding: 'utf8' });
  if (unzip.status === 0) return;
  const ps = spawnSync('powershell', ['-NoProfile', '-Command', 'Expand-Archive -Path $env:WF_ZIP -DestinationPath $env:WF_DEST -Force'], {
    encoding: 'utf8', env: { ...process.env, WF_ZIP: zip, WF_DEST: dest },
  });
  assert.equal(ps.status, 0, ps.stderr || unzip.stderr);
}

function readTree(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readTree(full, base, out);
    else if (entry.name.endsWith('.yaml')) out[path.relative(base, full).split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
  }
  return out;
}

const tracks = (html) => (html.match(/id="tiles"[^>]*grid-template-columns:([^;"]+)/) || [])[1];
const links = (html) => [...html.matchAll(/<a class="wf-menubar-trigger"[^>]*data-wf-route-target="([^"]+)"/g)].map((m) => m[1]);

test('an exported project renders the same grid and menubar links in the bundle as in wf build', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-parity-'));
  try {
    const project = path.join(root, 'project');
    writeProject(project);
    const zip = path.join(root, 'parity.zip');
    const exported = runExport({ projectPath: project, output: zip });
    assert.equal(exported.ok, true, exported.error);
    const unpacked = path.join(root, 'unpacked');
    extract(zip, unpacked);
    const bundled = renderProject(readTree(unpacked)).pages.get('home');

    const built = runBuild({ projectPath: project, output: path.join(root, 'build'), platform: 'web', clean: true });
    assert.equal(built.ok, true, built.error);
    const html = fs.readFileSync(path.join(root, 'build', 'web', 'home.html'), 'utf8');

    assert.equal(tracks(html), 'repeat(auto-fit,minmax(min(220px,100%),1fr))');
    assert.equal(tracks(bundled), tracks(html));
    assert.deepEqual(links(html), ['home', 'docs']);
    assert.deepEqual(links(bundled), links(html));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
