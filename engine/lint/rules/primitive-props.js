'use strict';

const {
  PRIMITIVE_COMPONENTS,
  PRIMITIVE_PROP_KEYS,
} = require('../../schema/primitives');

const TEXT_COMPONENTS = new Set(['heading', 'paragraph', 'text']);
const FIELD_COMPONENTS = new Set(['input', 'select', 'textarea']);

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function addDiagnostic(result, severity, code, message) {
  result[severity].push({ code, message });
}

function lintUnknownProps(result, component, props, context) {
  const allowed = PRIMITIVE_PROP_KEYS[component];
  if (!allowed || !isObject(props)) {
    return;
  }

  for (const key of Object.keys(props)) {
    if (!allowed.has(key)) {
      addDiagnostic(
        result,
        'warnings',
        'UNKNOWN_PROP',
        `${context}: prop "${key}" is not defined for primitive "${component}".`,
      );
    }
  }
}

function lintTextProps(result, component, props, context) {
  if (!TEXT_COMPONENTS.has(component)) {
    return;
  }

  if (!hasText(props.text) && !hasText(props.label)) {
    addDiagnostic(
      result,
      'info',
      'MISSING_TEXT',
      `${context}: ${component} has no text or label prop; renderer will show a skeleton placeholder.`,
    );
    return;
  }

  if (hasText(props.label)) {
    addDiagnostic(
      result,
      'info',
      'TEXT_PROP_ALIAS',
      `${context}: ${component} uses label as a text alias; prefer props.text.`,
    );
  }
}

function lintFieldLabels(result, component, props, context) {
  if (!FIELD_COMPONENTS.has(component) || hasText(props.label)) {
    return;
  }

  addDiagnostic(
    result,
    'info',
    'UNLABELED_FIELD',
    `${context}: ${component} has no label prop.`,
  );
}

function lintNestedSurface(result, node, component, traversal, context) {
  if (component !== 'section' || !isObject(node.size)) {
    return;
  }
  const hasExplicitSize = node.size.width != null || node.size.height != null;
  if (!hasExplicitSize || traversal.rendersSurface || node.surface === true || node.surface === false) {
    return;
  }

  addDiagnostic(
    result,
    'info',
    'NESTED_SURFACE',
    `${context}: nested section with explicit size renders as a group; set surface: true if it should remain a card.`,
  );
}

function computeTraversal(node, component, parentTraversal) {
  const parentLayoutType = parentTraversal.parentLayoutType || 'stack';
  const surfaceDepth = Number.isInteger(parentTraversal.surfaceDepth) ? parentTraversal.surfaceDepth : 0;
  let rendersSurface = false;

  if (component === 'section' || component === 'table') {
    if (node.surface === true) {
      rendersSurface = true;
    } else if (node.surface === false) {
      rendersSurface = false;
    } else {
      rendersSurface = surfaceDepth === 0 || parentLayoutType === 'grid';
    }
  }

  return {
    rendersSurface,
    childSurfaceDepth: rendersSurface ? surfaceDepth + 1 : surfaceDepth,
  };
}

function lintPrimitiveNode(result, node, context, parentTraversal = {}) {
  if (!isObject(node) || typeof node.component !== 'string' || !PRIMITIVE_COMPONENTS.has(node.component)) {
    return computeTraversal(node, '', parentTraversal);
  }

  const component = node.component;
  const props = isObject(node.props) ? node.props : {};
  const traversal = computeTraversal(node, component, parentTraversal);

  lintUnknownProps(result, component, props, context);
  lintTextProps(result, component, props, context);
  lintFieldLabels(result, component, props, context);
  lintNestedSurface(result, node, component, traversal, context);

  return traversal;
}

module.exports = {
  lintPrimitiveNode,
};
