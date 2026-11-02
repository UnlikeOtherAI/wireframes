import { build } from 'esbuild';
import { readFileSync, statSync } from 'node:fs';

const isDev = process.argv.includes('--dev');
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const shared = {
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
// enforced here rather than noticed later.
const BUDGET_BYTES = 420 * 1024;
const size = statSync('bundle/wireframe-renderer.min.js').size;
if (size > BUDGET_BYTES) {
  console.error(`Bundle is ${(size / 1024).toFixed(0)} KB, over the ${BUDGET_BYTES / 1024} KB budget.`);
  process.exit(1);
}
console.log(`ESM bundle ${(size / 1024).toFixed(0)} KB (budget ${BUDGET_BYTES / 1024} KB)`);
