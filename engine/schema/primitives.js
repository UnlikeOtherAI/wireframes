'use strict';

const { primitiveNames } = require('./primitive-registry');

const PRIMITIVE_COMPONENTS = new Set(primitiveNames());

const PRIMITIVE_PROP_KEYS = {
  heading: new Set(['text', 'label', 'level']),
  paragraph: new Set(['text', 'label']),
  text: new Set(['text', 'label', 'variant']),
  image: new Set(['src', 'alt', 'width', 'height']),
  icon: new Set(['name', 'style', 'size']),
  button: new Set(['label', 'icon', 'iconStyle', 'iconSize', 'variant']),
  tab_bar: new Set([]),
  bottom_tab_bar: new Set([]),
  input: new Set(['label', 'placeholder', 'inputType']),
  textarea: new Set(['label', 'placeholder', 'rows']),
  select: new Set(['label', 'placeholder', 'options']),
  checkbox: new Set(['label']),
  radio: new Set(['label']),
  toggle: new Set(['label']),
  chart: new Set(['chartType', 'title', 'label', 'data']),
  table: new Set(['columns', 'rows', 'emptyText', 'surface']),
  section: new Set(['title']),
  divider: new Set([]),
  spacer: new Set(['size']),
};

module.exports = { PRIMITIVE_COMPONENTS, PRIMITIVE_PROP_KEYS };
