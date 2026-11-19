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

module.exports = { polishProject, ROUTE_TABLE };
