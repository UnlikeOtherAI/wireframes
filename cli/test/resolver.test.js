'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveTemplatePage } = require('../../engine/resolver');

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

test('resolver expands component references and applies propDefaults', () => {
  const template = {
    regions: [
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
            id: 'card_instance',
            use: 'metric_card',
            props: {
              title: 'Card Title',
            },
          },
        ],
      },
    ],
  };
  const components = {
    metric_card: {
      propDefaults: {
        visible: true,
      },
      root: {
        id: 'metric_card_root',
        component: 'section',
        props: {
          tone: 'neutral',
        },
        children: [
          {
            id: 'title',
            component: 'text',
          },
        ],
      },
    },
  };

  const result = resolveTemplatePage({
    template,
    page,
    components,
  });

  assert.equal(result.ok, true);
  assert.equal(result.roots[0].children[0].id, 'card_instance');
  assert.equal(result.roots[0].children[0].props.visible, true);
  assert.equal(result.roots[0].children[0].props.tone, 'neutral');
  assert.equal(result.roots[0].children[0].props.title, 'Card Title');
  assert.equal(result.roots[0].children[0].children[0].id, 'card_instance__title');
});

test('resolver expands nested component references', () => {
  const template = {
    regions: [
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
            id: 'feature_instance',
            use: 'feature_card',
          },
        ],
      },
    ],
  };
  const components = {
    feature_badge: {
      propDefaults: {
        text: 'Default badge',
      },
      root: {
        id: 'feature_badge_root',
        component: 'text',
      },
    },
    feature_card: {
      root: {
        id: 'feature_card_root',
        component: 'section',
        children: [
          {
            id: 'feature_slot',
            use: 'feature_badge',
            props: {
              text: 'From card',
            },
          },
        ],
      },
    },
  };

  const result = resolveTemplatePage({
    template,
    page,
    components,
  });

  assert.equal(result.ok, true);
  assert.equal(result.roots[0].children[0].id, 'feature_instance');
  assert.equal(result.roots[0].children[0].children[0].id, 'feature_instance__feature_slot');
  assert.equal(result.roots[0].children[0].children[0].props.text, 'From card');
});

test('resolver reports circular component references', () => {
  const template = {
    regions: [
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
            id: 'cycle_root',
            use: 'loop_a',
          },
        ],
      },
    ],
  };
  const components = {
    loop_a: {
      root: {
        id: 'loop_a_root',
        use: 'loop_b',
      },
    },
    loop_b: {
      root: {
        id: 'loop_b_root',
        use: 'loop_a',
      },
    },
  };

  const result = resolveTemplatePage({
    template,
    page,
    components,
  });

  assert.equal(result.ok, false);
});

test('resolver substitutes component props through nested component instances', () => {
  const template = {
    regions: [
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
            id: 'menu_instance',
            use: 'menu',
            props: {
              activeItem: 'Projects',
            },
          },
        ],
      },
    ],
  };
  const components = {
    menu_item: {
      root: {
        id: 'menu_item_root',
        component: 'button',
        props: {
          label: '{{props.label}}',
        },
        visibility: {
          condition: {
            type: 'compare',
            left: '{{props.active}}',
            op: 'eq',
            right: true,
          },
        },
      },
    },
    menu: {
      root: {
        id: 'menu_root',
        component: 'section',
        children: [
          {
            id: 'projects_item',
            use: 'menu_item',
            props: {
              label: '{{props.activeItem}}',
              active: true,
            },
          },
        ],
      },
    },
  };

  const result = resolveTemplatePage({
    template,
    page,
    components,
  });

  assert.equal(result.ok, true);
  assert.equal(result.roots[0].children[0].children[0].props.label, 'Projects');
  assert.equal(result.roots[0].children[0].children[0].visibility.condition.left, true);
});

test('resolver namespaces child node ids for repeated component instances', () => {
  const template = {
    regions: [
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
          { id: 'first_menu', use: 'menu' },
          { id: 'second_menu', use: 'menu' },
        ],
      },
    ],
  };
  const components = {
    menu: {
      root: {
        id: 'menu_root',
        component: 'section',
        children: [
          { id: 'item', component: 'button', props: { label: 'Item' } },
        ],
      },
    },
  };

  const result = resolveTemplatePage({
    template,
    page,
    components,
  });

  assert.equal(result.ok, true);
  assert.equal(result.roots[0].children[0].children[0].id, 'first_menu__item');
  assert.equal(result.roots[0].children[1].children[0].id, 'second_menu__item');
});
