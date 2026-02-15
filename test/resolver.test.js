'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveTemplatePage } = require('../shared/resolver');

function toIds(nodes) {
  return nodes.map((node) => node.id);
}

test('resolver fills slot regions and injectables', () => {
  const template = {
    regions: [
      {
        id: 'app_header',
        kind: 'persistent',
        children: [
          { id: 'logo', component: 'text' },
          { id: 'page_actions', injectable: true },
        ],
      },
      {
        id: 'main',
        kind: 'slot',
      },
    ],
  };
  const page = {
    slots: [
      {
        slotId: 'main',
        content: [
          {
            id: 'main_content',
            component: 'section',
            children: [{ id: 'title', component: 'heading' }],
          },
        ],
      },
    ],
    injectables: [
      {
        injectableId: 'page_actions',
        content: [{ id: 'save_button', component: 'button' }],
      },
    ],
  };

  const result = resolveTemplatePage({ template, page });

  assert.equal(result.ok, true);
  assert.equal(result.roots.length, 2);

  const header = result.roots.find((node) => node.id === 'app_header');
  const main = result.roots.find((node) => node.id === 'main');

  assert.deepEqual(toIds(header.children), ['logo', 'save_button']);
  assert.equal(main.children[0].id, 'main_content');
  assert.equal(main.children[0].children[0].id, 'title');
});

test('resolver uses template slot fallback when page slot is not provided', () => {
  const template = {
    regions: [
      {
        id: 'main',
        kind: 'slot',
        children: [
          { id: 'fallback_content', component: 'text' },
        ],
      },
    ],
  };
  const page = {
    slots: [],
    injectables: [],
  };

  const result = resolveTemplatePage({ template, page });

  assert.equal(result.ok, true);
  assert.equal(result.roots.length, 1);
  assert.equal(result.roots[0].id, 'main');
  assert.equal(result.roots[0].children[0].id, 'fallback_content');
});
