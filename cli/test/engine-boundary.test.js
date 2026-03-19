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
