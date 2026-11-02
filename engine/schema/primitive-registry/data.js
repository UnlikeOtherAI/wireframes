'use strict';

const dataPrimitives = [
  {
    name: 'table',
    family: 'data',
    frame: 'C',
    summary: 'Data table with typed columns, selection, sorting and loading/empty states.',
    props: {
      columns: { type: 'array', primary: true },
      rows: { type: 'array' },
      caption: { type: 'string' },
      selectable: { type: 'boolean' },
      state: { enum: ['default', 'loading', 'empty'] },
      emptyText: { type: 'string' },
      dense: { type: 'boolean' },
      pagination: { type: 'boolean' },
    },
    sizing: ['row.height'],
    example: '- table: { columns: [Name, Status, Owner], rows: [[Dashboard, Draft, Lee]] }',
  },
  {
    name: 'list',
    family: 'data',
    frame: 'C',
    summary: 'List rows. kind covers plain, avatar, action, file, chat and timeline shapes.',
    props: {
      items: { type: 'array', primary: true },
      kind: { enum: ['plain', 'avatar', 'action', 'file', 'chat', 'timeline'] },
      divided: { type: 'boolean' },
      selectable: { type: 'boolean' },
      refreshable: { type: 'boolean' },
    },
    sizing: ['row.height'],
    example: '- list: { kind: avatar, items: [{ title: Ada, text: Invited you }] }',
  },
  {
    name: 'chart',
    family: 'data',
    frame: 'C',
    summary: 'Greeked chart placeholder in nine shapes. Deterministic, never random.',
    props: {
      chartType: {
        enum: [
          'bar', 'vertical', 'horizontal', 'line', 'area',
          'pie', 'donut', 'gauge', 'sparkline', 'heatmap',
        ],
        primary: true,
      },
      title: { type: 'string' },
      label: { type: 'string', aliasOf: 'title' },
      data: { type: 'array' },
      series: { type: 'number' },
      legend: { type: 'boolean' },
      axes: { type: 'boolean' },
      height: { type: 'number' },
    },
    sizing: ['chart.height'],
    example: '- chart: { chartType: area, title: Signups, legend: true }',
  },
  {
    name: 'calendar',
    family: 'data',
    frame: 'S',
    summary: 'Month, week, day or compact picker grid.',
    props: {
      view: { enum: ['month', 'week', 'day', 'picker'], primary: true },
      date: { type: 'string' },
      events: { type: 'array' },
    },
    aliases: { date_picker: 'calendar' },
    example: '- calendar: { view: month, date: 2026-11 }',
  },
  {
    name: 'kanban',
    family: 'data',
    frame: 'N',
    summary: 'Board of columns; each column is a framed surface, the board is not.',
    props: {
      columns: { type: 'array', primary: true },
    },
    aliases: { board: 'kanban' },
    example: '- kanban: { columns: [{ title: Todo, cards: [Fix login] }] }',
  },
  {
    name: 'tree',
    family: 'data',
    frame: 'C',
    summary: 'Nested tree or file browser.',
    props: {
      items: { type: 'array', primary: true },
      expanded: { type: 'boolean' },
    },
    example: '- tree: { items: [{ label: src, children: [{ label: index.js }] }] }',
  },
  {
    name: 'accordion',
    family: 'data',
    frame: 'C',
    summary: 'Collapsible rows; set open on the item that starts expanded.',
    props: {
      items: { type: 'array', primary: true },
    },
    example: '- accordion: { items: [{ title: Billing, text: ..., open: true }] }',
  },
];

module.exports = { dataPrimitives };
