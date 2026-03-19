import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');

function readPage(name) {
  const filePath = resolve(distDir, name);
  assert.ok(existsSync(filePath), `Expected ${name} to exist in dist/`);
  return readFileSync(filePath, 'utf-8');
}

function getInternalLinks(html) {
  const linkPattern = /href="([^"]*?)"/g;
  const links = [];
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    links.push(match[1]);
  }
  return links;
}

describe('Home page (index.html)', () => {
  const html = readPage('index.html');

  it('contains hero section', () => {
    assert.ok(html.includes('id="hero-heading"'), 'Missing hero heading');
    assert.ok(html.includes('Get Started'), 'Missing CTA button');
  });

  it('contains features section', () => {
    assert.ok(html.includes('id="features"'), 'Missing features section');
    assert.ok(html.includes('Declarative YAML Specs'), 'Missing feature item');
    assert.ok(html.includes('Template + Page System'), 'Missing feature item');
    assert.ok(html.includes('Component Reuse'), 'Missing feature item');
    assert.ok(html.includes('Data Binding'), 'Missing feature item');
    assert.ok(html.includes('Interactive Prototypes'), 'Missing feature item');
    assert.ok(html.includes('Two Rendering Modes'), 'Missing feature item');
    assert.ok(html.includes('Multi-Device Support'), 'Missing feature item');
    assert.ok(html.includes('CLI Tooling'), 'Missing feature item');
    assert.ok(html.includes('Online Editor with AI Chat'), 'Missing feature item');
    assert.ok(html.includes('Preview Sharing'), 'Missing feature item');
  });

  it('contains how-it-works section', () => {
    assert.ok(html.includes('id="how-it-works"'), 'Missing how-it-works section');
    assert.ok(html.includes('Define'), 'Missing Define step');
    assert.ok(html.includes('Preview'), 'Missing Preview step');
    assert.ok(html.includes('Share'), 'Missing Share step');
  });

  it('contains pricing section', () => {
    assert.ok(html.includes('id="pricing"'), 'Missing pricing section');
    assert.ok(html.includes('Free'), 'Missing free tier');
  });

  it('contains footer', () => {
    assert.ok(html.includes('</footer>'), 'Missing footer');
    assert.ok(html.includes('2026'), 'Missing copyright year');
  });
});

describe('Pricing page (pricing.html)', () => {
  const html = readPage('pricing.html');

  it('contains pricing section', () => {
    assert.ok(html.includes('id="pricing"'), 'Missing pricing section');
    assert.ok(html.includes('Free'), 'Missing free tier');
    assert.ok(html.includes('Pro'), 'Missing pro tier');
  });

  it('contains CTA section', () => {
    assert.ok(html.includes('id="cta-heading"'), 'Missing CTA section');
  });

  it('contains footer', () => {
    assert.ok(html.includes('</footer>'), 'Missing footer');
  });
});

describe('Meta tags', () => {
  const html = readPage('index.html');

  it('has title tag', () => {
    assert.match(html, /<title>.+<\/title>/);
  });

  it('has meta description', () => {
    assert.match(html, /<meta name="description" content="[^"]+"/);
  });

  it('has og:title', () => {
    assert.match(html, /<meta property="og:title" content="[^"]+"/);
  });

  it('has og:description', () => {
    assert.match(html, /<meta property="og:description" content="[^"]+"/);
  });

  it('has og:type', () => {
    assert.match(html, /<meta property="og:type" content="website"/);
  });

  it('has twitter card', () => {
    assert.match(html, /<meta name="twitter:card"/);
  });

  it('has charset', () => {
    assert.match(html, /<meta charset="utf-8"/);
  });

  it('has viewport', () => {
    assert.match(html, /<meta name="viewport"/);
  });

  it('has sitemap link', () => {
    assert.match(html, /rel="sitemap"/);
  });
});

describe('Internal links', () => {
  const pages = {
    'index.html': readPage('index.html'),
    'pricing.html': readPage('pricing.html'),
  };

  const defined = new Set(Object.keys(pages));

  for (const [page, html] of Object.entries(pages)) {
    it(`${page} has no broken internal links`, () => {
      const links = getInternalLinks(html);
      for (const link of links) {
        if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('#')) {
          continue;
        }
        if (link.startsWith('/')) {
          const pathname = link.split('#')[0].split('?')[0];
          if (pathname === '/' || pathname === '') continue;
          if (pathname === '/favicon.svg' || pathname === '/sitemap-index.xml') continue;
          if (pathname.startsWith('/_astro/')) continue;
          const file = pathname.replace(/^\//, '') + (pathname.endsWith('.html') ? '' : '.html');
          assert.ok(
            defined.has(file),
            `Broken link in ${page}: "${link}" (resolved to ${file})`,
          );
        }
      }
    });
  }
});

describe('Determinism', () => {
  it('does not contain runtime-computed year references', () => {
    const indexHtml = readPage('index.html');
    const pricingHtml = readPage('pricing.html');
    assert.ok(!indexHtml.includes('getFullYear'), 'Found getFullYear in index.html output');
    assert.ok(!pricingHtml.includes('getFullYear'), 'Found getFullYear in pricing.html output');
  });
});
