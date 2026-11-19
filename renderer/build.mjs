import { build } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const isDev = process.argv.includes('--dev');
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// The engine's CJS `require('js-yaml')` (std patterns) and the renderer's ESM
// import must share one copy of the parser, or the bundle ships it twice.
const jsYamlEsm = join(dirname(createRequire(import.meta.url).resolve('js-yaml/package.json')), 'dist', 'js-yaml.mjs');

const shared = {
  alias: { 'js-yaml': jsYamlEsm },
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'es2020',
  minify: !isDev,
  sourcemap: isDev,
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  legalComments: 'none',
  treeShaking: true,
};

await build({
  ...shared,
  format: 'esm',
  outfile: 'bundle/wireframe-renderer.min.js',
  banner: { js: `// @wireframes/renderer v${pkg.version} — ESM browser bundle` },
});

// A script-tag build for hosts that do not bundle, exposing window.Wireframes.
await build({
  ...shared,
  format: 'iife',
  globalName: 'Wireframes',
  outfile: 'bundle/wireframe-renderer.iife.js',
  banner: { js: `// @wireframes/renderer v${pkg.version} — browser global build` },
});

// The bundle has to stay small enough to ship with an app, so the budget is
// enforced here rather than noticed later. Raised from 420 KB on 18 November
// 2026: the component library expansion (five elements, the measurement
// runtime, slots, the item model and the std patterns) took the bundle from
// 329 KB (90 KB gzip) to 426 KB (114 KB gzip).
const BUDGET_BYTES = 460 * 1024;
const size = statSync('bundle/wireframe-renderer.min.js').size;
if (size > BUDGET_BYTES) {
  console.error(`Bundle is ${(size / 1024).toFixed(0)} KB, over the ${BUDGET_BYTES / 1024} KB budget.`);
  process.exit(1);
}
console.log(`ESM bundle ${(size / 1024).toFixed(0)} KB (budget ${BUDGET_BYTES / 1024} KB)`);
