import test from 'node:test';
import assert from 'node:assert/strict';
import { assertComponentExpansion, renderPage, renderProject } from '../bundle/wireframe-renderer.min.js';
import { MANIFEST_YAML, SITEMAP_BASIC, TEMPLATES_YAML } from './fixtures.mjs';

const doc = (value) => JSON.stringify({ specVersion: '1.1', ...value });

const components = {
  person_card: {
    propDefaults: { role: 'Member' },
    root: { id: 'person_card', component: 'card', children: [
      { id: 'name', component: 'heading', props: { text: '{{props.name}}', level: 3 } },
      { id: 'role', component: 'text', props: { text: '{{props.role}}' } },
    ] },
  },
  team_section: {
    propDefaults: { team: 'Core' },
    root: { id: 'team_section', component: 'section', props: { title: '{{props.team}} team' }, children: [
      { id: 'team', component: 'grid', layout: { type: 'grid', columns: 2 }, repeat: { cell: 'person_card', items: [
        { id: 'lead', name: '{{props.team}} lead' },
      ] } },
    ] },
  },
};

function files(content, extraComponents = {}) {
  return {
    'manifest.yaml': MANIFEST_YAML,
    'sitemap.yaml': SITEMAP_BASIC,
    'templates.yaml': TEMPLATES_YAML,
    'components.yaml': doc({ documentType: 'components', id: 'components', components: { ...components, ...extraComponents } }),
    'pages/home.yaml': doc({ documentType: 'page', id: 'home', page: { template: 'main', viewport: { device: 'web' }, slots: [{ slotId: 'body', content }] } }),
  };
}

test('repeat renders its rows from an in-memory project', () => {
  const html = renderPage(files([
    { id: 'kpis', component: 'row', repeat: { cell: 'stat', items: [{ id: 'revenue', label: 'Revenue', value: '$12.4k' }, { id: 'users', label: 'Users', value: '1,204' }] } },
    { id: 'people', component: 'grid', layout: { type: 'grid', columns: 3 }, repeat: { cell: 'person_card', items: [{ id: 'ada', name: 'Ada Lovelace', role: 'Admin' }, { id: 'grace', name: 'Grace Hopper' }] } },
    { id: 'docs', use: 'team_section', props: { team: 'Docs' } },
  ]), 'home');
  for (const id of ['kpis__revenue', 'kpis__users', 'people__ada', 'people__grace__name', 'docs__team__lead__name']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  assert.match(html, /Ada Lovelace/);
  assert.match(html, /Docs lead/);
  assert.ok(html.indexOf('Ada Lovelace') < html.indexOf('Grace Hopper'), 'rows keep item order');
});

test('the browser build stops a fan-out at the budget before it allocates', () => {
  const levels = {};
  for (let level = 0; level < 3; level += 1) {
    levels[`level_${level}`] = { root: { id: `level_${level}`, component: 'stack', repeat: {
      cell: level === 2 ? 'text' : `level_${level + 1}`,
      items: Array.from({ length: 200 }, (_, index) => ({ id: `i${index}` })),
    } } };
  }
  const started = Date.now();
  assert.throws(() => renderProject(files([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }] } }], levels)),
    /Repeat on "wall" would expand to \d+ more nodes/);
  assert.ok(Date.now() - started < 3000);
  assert.throws(() => assertComponentExpansion([{ id: 'wall', component: 'stack', repeat: { cell: 'level_0', items: [{ id: 'a' }] } }], levels), /too large/);
});
