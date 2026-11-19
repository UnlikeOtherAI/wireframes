'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ENGINE_ROOT = path.resolve(__dirname, '..', '..', 'engine');

const CORE_MODULES = [
  'build/index.js',
  'screenshots/renderer.js',
  'validate/index.js',
  'addressing/index.js',
];

const FORBIDDEN_IMPORTS = [
  /require\s*\(\s*['"]node:fs['"]\s*\)/,
  /require\s*\(\s*['"]node:path['"]\s*\)/,
];

for (const modulePath of CORE_MODULES) {
  test(`engine core module ${modulePath} has no node:fs or node:path imports`, () => {
    const fullPath = path.join(ENGINE_ROOT, modulePath);
    const source = fs.readFileSync(fullPath, 'utf8');

    for (const pattern of FORBIDDEN_IMPORTS) {
      const match = source.match(pattern);
      assert.equal(
        match,
        null,
        `${modulePath} contains forbidden import: ${match?.[0]}`,
      );
    }
  });
}

// The browser bundle (renderer/src/index.ts) enters the engine through
// build/index.js and component-registry/expansion.js. Following their relative
// requires proves the std patterns ship in the bundle, and that nothing on the
// way to them needs the filesystem.
function reachableModules(entries) {
  const seen = new Set();
  const queue = entries.map((entry) => path.join(ENGINE_ROOT, entry));
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const base = path.resolve(path.dirname(file), match[1]);
      const resolved = [base, `${base}.js`, path.join(base, 'index.js')]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (resolved && resolved.endsWith('.js')) queue.push(resolved);
    }
  }
  return seen;
}

test('the browser bundle entry reaches every std pattern, with no filesystem on the way', () => {
  const reachable = reachableModules(['build/index.js', 'component-registry/expansion.js']);
  const stdlibDir = path.join(ENGINE_ROOT, 'stdlib');
  const stdlibFiles = [path.join(stdlibDir, 'index.js'),
    ...fs.readdirSync(path.join(stdlibDir, 'patterns')).map((name) => path.join(stdlibDir, 'patterns', name))];
  for (const file of [...stdlibFiles, path.join(ENGINE_ROOT, 'component-registry', 'definition-lookup.js')]) {
    assert.ok(reachable.has(file), `${path.relative(ENGINE_ROOT, file)} is not reachable from the bundle entry`);
    const source = fs.readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN_IMPORTS) {
      assert.equal(source.match(pattern), null, `${path.relative(ENGINE_ROOT, file)} imports the filesystem`);
    }
  }
});
