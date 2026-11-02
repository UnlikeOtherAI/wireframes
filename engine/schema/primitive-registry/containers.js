'use strict';

// Frame classes: S = always a framed surface, C = frame rules decide,
// N = never a container frame, E = draws one divider edge only.

const containerPrimitives = [
  {
    name: 'section',
    family: 'containers',
    frame: 'C',
    summary: 'Generic container. The frame rules decide whether it gets a box.',
    props: {
      title: { type: 'string', primary: true },
      description: { type: 'string' },
    },
    example: '- section: { title: Billing, children: [...] }',
  },
  {
    name: 'card',
    family: 'containers',
    frame: 'S',
    summary: 'Always a framed card, at any nesting depth.',
    props: {
      title: { type: 'string', primary: true },
      description: { type: 'string' },
      media: { type: 'string' },
      footer: { type: 'boolean' },
    },
    example: '- card: { title: Revenue, children: [...] }',
  },
  {
    name: 'stack',
    family: 'containers',
    frame: 'N',
    summary: 'Vertical layout group. Never framed.',
    props: {
      gap: { type: 'number' },
      padding: { type: 'number' },
      align: { type: 'string' },
    },
    example: '- stack: { gap: 12, children: [...] }',
  },
  {
    name: 'row',
    family: 'containers',
    frame: 'N',
    summary: 'Horizontal layout group. Never framed.',
    props: {
      gap: { type: 'number' },
      padding: { type: 'number' },
      align: { type: 'string' },
      justify: { type: 'string' },
      wrap: { type: 'boolean' },
    },
    example: '- row: { gap: 8, justify: space-between, children: [...] }',
  },
  {
    name: 'grid',
    family: 'containers',
    frame: 'N',
    summary: 'Grid layout group. Never framed; its children become framed tiles.',
    props: {
      columns: { type: 'number' },
      gap: { type: 'number' },
      minItemWidth: { type: 'number' },
    },
    example: '- grid: { columns: 3, children: [...] }',
  },
  {
    name: 'split',
    family: 'containers',
    frame: 'N',
    summary: 'Side-by-side resizable panes. The panes are framed, the split is not.',
    props: {
      gap: { type: 'number' },
      orientation: { enum: ['row', 'stack'] },
    },
    example: '- split: { children: [{ card: ... }, { card: ... }] }',
  },
  {
    name: 'form',
    family: 'containers',
    frame: 'N',
    summary: 'Groups fields and a submit action. Never framed; wrap in a card for a box.',
    props: {
      title: { type: 'string', primary: true },
      submit: { type: 'string' },
      columns: { type: 'number' },
    },
    example: '- form: { title: Profile, submit: Save, children: [...] }',
  },
  {
    name: 'carousel',
    family: 'containers',
    frame: 'C',
    summary: 'Horizontal slide strip with dots/arrows.',
    props: {
      dots: { type: 'boolean' },
      arrows: { type: 'boolean' },
      items: { type: 'array' },
    },
    example: '- carousel: { dots: true, items: [Slide one, Slide two] }',
  },
];

module.exports = { containerPrimitives };
