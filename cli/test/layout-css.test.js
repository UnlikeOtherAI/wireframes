'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  layoutToCss,
  layoutItemCss,
  resolveSeparatorPolicy,
} = require('../../engine/renderer/layout');
const { renderNode } = require('../../engine/renderer/primitives');

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

test('layoutToCss scales gap and padding for compact density and exposes separator style', () => {
  const css = layoutToCss(
    {
      type: 'row',
      gap: 16,
      padding: 20,
      separatorStyle: 'dashed',
    },
    {},
    { density: 'compact' },
  );

  assert.equal(css.includes('gap:10px'), true);
  assert.equal(css.includes('padding:13px'), true);
  assert.equal(css.includes('--wf-divider-style:dashed'), true);
});

test('renderNode and stylesheet support striped tables', () => {
  const html = renderNode({
    id: 'summary_table',
    component: 'table',
    props: {
      columns: [
        { key: 'label', label: 'Label' },
        { key: 'value', label: 'Value' },
      ],
      rows: [
        { label: 'Revenue', value: '$4.8M' },
        { label: 'Orders', value: '26' },
      ],
    },
  }, {
    mode: 'card',
    rendering: { mode: 'card' },
  });

  assert.equal(html.includes('wf-table-row'), true);
  assert.equal(html.includes('Revenue'), true);
  assert.equal(html.includes('$4.8M'), true);
});

test('resolveSeparatorPolicy prefers gutters for positive gap and explicit divide for flush layouts', () => {
  assert.equal(resolveSeparatorPolicy({ gap: 16, separatorPolicy: 'divide' }), 'gutters');
  assert.equal(resolveSeparatorPolicy({ gap: 0, separatorPolicy: 'divide' }), 'divide');
  assert.equal(resolveSeparatorPolicy({ gap: 0, separators: 'between' }), 'divide');
  assert.equal(resolveSeparatorPolicy({ gap: 0, separatorPolicy: 'none' }), 'none');
});

test('renderNode respects explicit surface flags and elevation overrides', () => {
  const noSurface = renderNode({
    id: 'layout_only',
    component: 'section',
    surface: false,
  }, {
    mode: 'card',
    rendering: { mode: 'card' },
  });

  const forcedSurface = renderNode({
    id: 'custom_surface',
    component: 'text',
    props: { text: 'Custom' },
    surface: true,
    elevation: 3,
  }, {
    mode: 'card',
    rendering: { mode: 'card' },
  });

  assert.equal(noSurface.includes('wf-surface'), false);
  assert.equal(forcedSurface.includes('wf-surface'), true);
  assert.equal(forcedSurface.includes('--wf-surface-shadow:0 12px 28px rgba(0,0,0,0.16)'), true);
});
