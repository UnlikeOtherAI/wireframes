import { Project } from './project.js';

/** A valid, empty project, so the model always has something to edit. */
export function newProject(name: string): string {
  const project = new Project([
    {
      documentType: 'manifest',
      specVersion: '1.1',
      id: 'manifest',
      manifest: { projectId: 'project', name, schemaVersion: '1.1' },
    },
    {
      documentType: 'sitemap',
      specVersion: '1.1',
      id: 'sitemap',
      defaultTemplate: 'main',
      routes: [{ id: 'home', path: '/', page: 'home', template: 'main' }],
    },
    {
      documentType: 'templates',
      specVersion: '1.1',
      id: 'templates',
      templates: {
        main: {
          layout: { type: 'stack', gap: 0, padding: 0 },
          regions: [{ id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } }],
        },
      },
    },
    {
      documentType: 'page',
      specVersion: '1.1',
      id: 'home',
      page: {
        id: 'home',
        title: 'Home',
        template: 'main',
        viewport: { device: 'web' },
        slots: [{ slotId: 'main', content: [] }],
      },
    },
  ]);
  return project.serialize();
}
