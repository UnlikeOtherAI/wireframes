'use strict';

const { PRIMITIVE_COMPONENTS } = require('../../schema/primitives');

const PROP_CONTRACTS = {
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
  table: new Set(['columns', 'rows', 'emptyText']),
  section: new Set(['title']),
  divider: new Set([]),
  spacer: new Set(['size']),
};

const TEXT_PRIMITIVES = new Set(['heading', 'paragraph', 'text']);
const FIELD_PRIMITIVES = new Set(['input', 'select', 'textarea']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function addDiagnostic(result, severity, code, message) {
  if (!Array.isArray(result[severity])) {
    result[severity] = [];
  }
  result[severity].push({ code, message });
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function surfaceDepth(options = {}) {
  return Number.isInteger(options.surfaceDepth) && options.surfaceDepth > 0 ? options.surfaceDepth : 0;
}

function rendersAsSurface(node, component, options = {}) {
  if (node?.surface === true) return true;
  if (node?.surface === false) return false;
  if (component !== 'section' && component !== 'table') return false;
  return surfaceDepth(options) === 0 || options.parentLayoutIsGrid === true;
}

function validateKnownProps(result, component, props, context) {
  const contract = PROP_CONTRACTS[component];
  if (!contract || !isObject(props)) return;

  for (const propName of Object.keys(props)) {
    if (!contract.has(propName)) {
      addDiagnostic(
        result,
        'warnings',
        'UNKNOWN_PROP',
        `${context}: ${component} node uses unknown prop "${propName}".`,
      );
    }
  }
}

function validateTextProps(result, component, props, context) {
  if (!TEXT_PRIMITIVES.has(component)) return;
  const hasText = hasNonEmptyString(props?.text);
  const hasLabel = hasNonEmptyString(props?.label);
  if (!hasText && !hasLabel) {
    addDiagnostic(result, 'info', 'MISSING_TEXT', `${context}: ${component} node has no text or label prop.`);
  }
  if (hasLabel) {
    addDiagnostic(result, 'info', 'TEXT_PROP_ALIAS', `${context}: ${component} node uses label alias; prefer text.`);
  }
}

function validateFieldLabel(result, component, props, context) {
  if (!FIELD_PRIMITIVES.has(component)) return;
  if (!hasNonEmptyString(props?.label)) {
    addDiagnostic(result, 'info', 'UNLABELED_FIELD', `${context}: ${component} node has no label prop.`);
  }
}

function validateNestedSurface(result, node, component, isSurface, context) {
  if (component !== 'section' || isSurface) return;
  const size = isObject(node.size) ? node.size : {};
  if (size.width != null || size.height != null) {
    addDiagnostic(
      result,
      'info',
      'NESTED_SURFACE',
      `${context}: section with explicit size was demoted to a group; set surface: true if it should remain a card.`,
    );
  }
}

function childNodes(node) {
  if (!isObject(node)) return [];
  return [
    ...(Array.isArray(node.children) ? node.children : []),
    ...(Array.isArray(node.content) ? node.content : []),
    ...(Array.isArray(node.nodes) ? node.nodes : []),
  ];
}

function validatePrimitiveProps(result, node, context, options = {}) {
  if (!isObject(node)) return;

  const component = typeof node.component === 'string' ? node.component : '';
  const props = isObject(node.props) ? node.props : {};
  const isPrimitive = PRIMITIVE_COMPONENTS.has(component);
  const isSurface = isPrimitive ? rendersAsSurface(node, component, options) : false;

  if (isPrimitive) {
    validateKnownProps(result, component, props, context);
    validateTextProps(result, component, props, context);
    validateFieldLabel(result, component, props, context);
    validateNestedSurface(result, node, component, isSurface, context);
  }

  const layout = isObject(node.layout) ? node.layout : {};
  const nextDepth = surfaceDepth(options) + (isSurface || isObject(node.pane) ? 1 : 0);
  const nextOptions = {
    surfaceDepth: nextDepth,
    parentLayoutIsGrid: layout.type === 'grid',
  };

  for (const child of childNodes(node)) {
    const childId = typeof child?.id === 'string' ? child.id : 'node';
    validatePrimitiveProps(result, child, `${context} > ${childId}`, nextOptions);
  }
}

module.exports = {
  PROP_CONTRACTS,
  validatePrimitiveProps,
};
