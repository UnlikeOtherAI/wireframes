'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  layoutToCss,
  layoutItemCss,
} = require('../shared/renderer/layout');
const { renderNode } = require('../shared/renderer/primitives');

test('layoutToCss reads sizing from size object', () => {
  const css = layoutToCss(
    { type: 'stack', gap: 8 },
    { width: 120, height: '50%' },
    { defaultGridColumns: 10 },
  );

  assert.equal(css.includes('gap:8px'), true);
  assert.equal(css.includes('width:120px'), true);
  assert.equal(css.includes('height:50%'), true);
});

test('layoutToCss uses manifest default grid columns when columns omitted', () => {
  const explicit = layoutToCss({ type: 'grid' }, {}, { defaultGridColumns: 9 });
  const fallback = layoutToCss({ type: 'grid' });

  assert.equal(explicit.includes('grid-template-columns:repeat(9,1fr)'), true);
  assert.equal(fallback.includes('grid-template-columns:repeat(12,1fr)'), true);
});

test('layoutItemCss uses gridItem keys', () => {
  const css = layoutItemCss({ span: 2, offset: 1, row: 3, column: 4 });

  assert.equal(css.includes('grid-column:span 2'), true);
  assert.equal(css.includes('grid-column-start:2'), true);
  assert.equal(css.includes('grid-row:3'), true);
  assert.equal(css.includes('grid-column:4'), true);
});

test('renderNode applies layout size and grid item fields', () => {
  const node = {
    id: 'grid_item',
    component: 'text',
    props: {
      text: 'Item',
    },
    layout: {
      type: 'grid',
    },
    size: {
      width: 120,
    },
    gridItem: {
      span: 4,
      offset: 0,
    },
  };

  const html = renderNode(node, { defaultGridColumns: 8 });

  assert.equal(html.includes('grid-template-columns:repeat(8,1fr)'), true);
  assert.equal(html.includes('width:120px'), true);
  assert.equal(html.includes('grid-column:span 4'), true);
  assert.equal(html.includes('grid-column-start:1'), true);
});

