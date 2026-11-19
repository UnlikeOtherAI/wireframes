'use strict';

// An in-memory project for the render polish tests: one page whose main slot
// holds `content`, on the given device, in the given mode. `manifest` adds
// manifest keys (e.g. defaultGridColumns); `regions` replaces the template's
// single main slot.

function document(documentType, id, content) {
  return { documentType, id, specVersion: '1.1', ...content };
}

function polishProject(content, { device = 'web', mode = 'card', manifest = {}, regions = null, routes = [] } = {}) {
  const viewport = device === 'web' ? { device: 'web' } : { device, orientation: 'portrait' };
  const pages = new Map([['home', document('page', 'home', { page: {
    id: 'home', template: 'main', viewport, renderMode: mode,
    slots: [{ slotId: 'main', content }],
  } })]]);
  for (const route of routes) {
    pages.set(route, document('page', route, { page: { id: route, template: 'main', viewport, renderMode: mode, slots: [] } }));
  }
  return {
    manifest: document('manifest', 'manifest', { manifest: { projectId: 'polish', name: 'Polish', schemaVersion: '1.1', ...manifest } }),
    sitemap: document('sitemap', 'sitemap', {
      defaultTemplate: 'main',
      routes: [{ id: 'home', path: '/', page: 'home' }, ...routes.map((id) => ({ id, path: `/${id}`, page: id }))],
    }),
    templates: document('templates', 'templates', { templates: { main: {
      layout: { type: regions ? 'row' : 'stack', gap: 0, padding: 0 },
      regions: regions || [{ id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } }],
    } } }),
    components: document('components', 'components', { components: {} }),
    pages,
    datasets: new Map(),
  };
}

const ROUTE_TABLE = { home: '#home', docs: '#docs', settings: '#settings' };

/**
 * The same project on disk, for `runBuild`: a built page links the bundled
 * icon font, which `setContent` pages cannot reach.
 */
function writePolishProject(dir, content, options = {}) {
  const fs = require('node:fs');
  const path = require('node:path');
  const yaml = require('js-yaml');
  const map = polishProject(content, options);
  const write = (rel, doc) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), yaml.dump(doc, { lineWidth: -1 }));
  };
  write('.wfrc.yaml', { cli: { strictValidation: false } });
  for (const key of ['manifest', 'sitemap', 'templates', 'components']) write(`${key}.yaml`, map[key]);
  for (const [id, page] of map.pages) write(`pages/${id}.yaml`, page);
  return dir;
}

module.exports = { polishProject, writePolishProject, ROUTE_TABLE };
