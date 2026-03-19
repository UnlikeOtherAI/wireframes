import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const isDev = process.argv.includes('--dev');
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  outfile: 'bundle/wireframe-renderer.min.js',
  minify: !isDev,
  sourcemap: isDev,
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  banner: {
    js: `// @wireframes/renderer v${pkg.version} — ESM browser bundle`,
  },
  legalComments: 'none',
  treeShaking: true,
});
