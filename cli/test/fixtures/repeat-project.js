'use strict';

// A project that exercises `repeat`: element and component cells, a component
// that owns a repeat with `{{props}}` in its items, a form cell with its own
// submit, and a forwarding wrapper whose fill carries a page repeat.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const { initProject } = require('../../../engine/init');

const COMPONENTS = {
  person_card: {
    propDefaults: { name: 'Someone', role: 'Member' },
    root: {
      id: 'person_card',
      component: 'card',
      children: [
        { id: 'name', component: 'heading', props: { text: '{{props.name}}', level: 3 } },
        { id: 'role', component: 'text', props: { text: '{{props.role}}' } },
      ],
    },
  },
  person_form: {
    propDefaults: { name: 'Someone' },
    root: {
      id: 'person_form',
      component: 'form',
      children: [
        { id: 'name_field', component: 'input', props: { label: 'Name', value: '{{props.name}}' } },
        { id: 'save', component: 'button', props: { label: 'Save' }, interaction: [{ type: 'submit', formId: 'person_form' }] },
      ],
    },
  },
  team_section: {
    propDefaults: { team: 'Core', lead: 'Ada Lovelace' },
    root: {
      id: 'team_section',
      component: 'section',
      props: { title: '{{props.team}}' },
      children: [
        {
          id: 'team',
          component: 'grid',
          layout: { type: 'grid', columns: 2 },
          repeat: {
            cell: 'person_form',
            items: [
              { id: 'lead', name: '{{props.lead}}' },
              { id: 'grace', name: 'Grace Hopper' },
            ],
          },
        },
        {
          id: 'save_lead',
          component: 'button',
          props: { label: 'Save {{props.team}} lead' },
          interaction: [{ type: 'submit', formId: 'team__lead' }],
        },
      ],
    },
  },
  framed: {
    root: {
      id: 'framed',
      component: 'card',
      children: [{ id: 'framed_body', slot: 'default' }],
    },
  },
  forwarder: {
    propDefaults: { name: 'Callee' },
    root: {
      id: 'forwarder',
      component: 'stack',
      children: [{ id: 'inner', use: 'framed', children: [{ id: 'forwarded', slot: 'default' }] }],
    },
  },
};

const MANIFEST = { documentType: 'manifest', specVersion: '1.1', id: 'manifest', manifest: { projectId: 'repeat', name: 'Repeat', schemaVersion: '1.1' } };
const SITEMAP = { documentType: 'sitemap', specVersion: '1.1', id: 'sitemap', routes: [{ id: 'home', path: '/', page: 'home', template: 'main' }] };
const TEMPLATES = {
  documentType: 'templates',
  specVersion: '1.1',
  id: 'templates',
  templates: { main: { layout: { type: 'stack' }, regions: [{ id: 'main', kind: 'slot' }] } },
};

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', role: 'Admin' },
  { id: 'grace', name: 'Grace Hopper', role: 'Editor' },
  { id: 'alan', name: 'Alan Turing', role: 'Viewer' },
];

function pageDocument(content, extra = {}) {
  return {
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: { id: 'home', template: 'main', viewport: { device: 'web' }, slots: [{ slotId: 'main', content }], ...extra },
  };
}

function componentsDocument(components = COMPONENTS) {
  return { documentType: 'components', specVersion: '1.1', id: 'components', components: structuredClone(components) };
}

/** The in-memory document map `renderPage` and `validateProject` take. */
function documentMap(content, { components = COMPONENTS, page = {}, mode } = {}) {
  const pageDoc = pageDocument(content, page);
  if (mode) pageDoc.page.rendering = { mode };
  return {
    manifest: structuredClone(MANIFEST),
    sitemap: structuredClone(SITEMAP),
    templates: structuredClone(TEMPLATES),
    components: componentsDocument(components),
    pages: new Map([['home', pageDoc]]),
    datasets: new Map(),
  };
}

function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(value), 'utf8');
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

/** The same project on disk, for the commands that read and write files. */
function createRepeatProject(content, { components = COMPONENTS, page = {} } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-repeat-'));
  const projectPath = path.join(base, 'project');
  initProject({ projectName: 'Repeat', projectPath });
  writeYaml(path.join(projectPath, 'templates.yaml'), TEMPLATES);
  writeYaml(path.join(projectPath, 'sitemap.yaml'), SITEMAP);
  writeYaml(path.join(projectPath, 'components.yaml'), componentsDocument(components));
  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), pageDocument(content, page));
  return projectPath;
}

module.exports = { COMPONENTS, PEOPLE, createRepeatProject, documentMap, pageDocument, readYaml, writeYaml };
