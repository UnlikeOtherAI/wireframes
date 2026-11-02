import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const shared = {
  bundle: true,
  target: 'es2020',
  platform: 'browser',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': '"production"' },
};

await build({ ...shared, entryPoints: [join(here, 'src/host.ts')], format: 'iife', minify: true, outfile: join(dist, 'host.js') });

// The same logic for the Node tests, which have no WebKit to run the host in.
await build({ ...shared, entryPoints: [join(here, 'src/core.ts')], format: 'esm', outfile: join(here, '.test-build/core.mjs') });

cpSync(join(here, 'src/host.html'), join(dist, 'host.html'));

// Icons ship with the app, because the page has to render with no connection.
const engineRequire = createRequire(join(here, '../../engine/package.json'));
const iconsDir = dirname(engineRequire.resolve('@fortawesome/fontawesome-free/package.json'));
mkdirSync(join(dist, 'fa/css'), { recursive: true });
cpSync(join(iconsDir, 'css/all.min.css'), join(dist, 'fa/css/all.min.css'));
cpSync(join(iconsDir, 'webfonts'), join(dist, 'fa/webfonts'), { recursive: true });

// A real project for the app's UI tests to open.
const { Project } = await import(join(here, '.test-build/core.mjs').replace(/^([A-Za-z]):/, 'file:///$1:'));
const yaml = createRequire(join(here, 'package.json'))('js-yaml');
const example = join(here, '../../examples/quickstart');
const documents = [
  ...['manifest', 'sitemap', 'templates', 'components'].map((name) => join(example, `${name}.yaml`)),
  ...readdirSync(join(example, 'pages')).sort().map((name) => join(example, 'pages', name)),
].map((file) => yaml.load(readFileSync(file, 'utf8')));
writeFileSync(join(dist, 'sample.wf'), new Project(documents).serialize());

console.log(`host.js ${(statSync(join(dist, 'host.js')).size / 1024).toFixed(0)} KB`);
