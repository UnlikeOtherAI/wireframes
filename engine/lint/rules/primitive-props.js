'use strict';

const { PRIMITIVE_COMPONENTS } = require('../../schema/primitives');
const { getPrimitive, resolvePrimitiveName, knownProps } = require('../../schema/primitive-registry');
const { decideFrame } = require('../../renderer/frame-rules');
const { ROLES } = require('../../renderer/sizing-tokens');

const TEXT_PRIMITIVES = new Set(['heading', 'paragraph', 'text']);
const FIELD_PRIMITIVES = new Set(['input', 'select', 'textarea', 'picker']);
const LAYOUT_ONLY = new Set(['row', 'stack', 'grid', 'split']);
const MAX_CONTAINER_DEPTH = 6;

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

/** Closest known prop name, so an agent gets a fix rather than a rejection. */
function nearest(candidate, pool) {
  let best = null;
  let bestScore = Infinity;
  for (const option of pool) {
    const distance = levenshtein(candidate, option);
    if (distance < bestScore) {
      bestScore = distance;
      best = option;
    }
  }
  return bestScore <= Math.max(2, Math.floor(candidate.length / 3)) ? best : null;
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    for (let j = 1; j < cols; j += 1) {
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = current;
  }
  return prev[cols - 1];
}

function validateKnownProps(result, component, props, context) {
  const contract = knownProps(component);
  if (!contract || !isObject(props)) return;

  for (const propName of Object.keys(props)) {
    if (contract.has(propName)) continue;
    const suggestion = nearest(propName, [...contract]);
    addDiagnostic(
      result,
      'warnings',
      'UNKNOWN_PROP',
      `${context}: ${component} has no prop "${propName}".${suggestion ? ` Did you mean "${suggestion}"?` : ` Known props: ${[...contract].join(', ')}.`}`,
    );
  }
}

function validateEnumProps(result, component, props, context) {
  const entry = getPrimitive(component);
  if (!entry || !isObject(props)) return;
  for (const [name, spec] of Object.entries(entry.props || {})) {
    if (!Array.isArray(spec.enum)) continue;
    const value = props[name];
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (spec.enum.includes(value)) continue;
    const suggestion = nearest(value, spec.enum);
    addDiagnostic(
      result,
      'warnings',
      'UNKNOWN_PROP_VALUE',
      `${context}: ${component}.${name} is "${value}".${suggestion ? ` Did you mean "${suggestion}"?` : ''} Allowed: ${spec.enum.join(', ')}.`,
    );
  }
}

function validateTextProps(result, component, props, context) {
  if (!TEXT_PRIMITIVES.has(component)) return;
  const hasText = hasNonEmptyString(props?.text);
  const hasLabel = hasNonEmptyString(props?.label);
  // `lines` says the skeleton is deliberate, so do not nag about it.
  if (!hasText && !hasLabel && props?.lines == null) {
    addDiagnostic(result, 'info', 'MISSING_TEXT', `${context}: ${component} has no text, so it renders a skeleton bar. Add props.text, or props.lines to say the placeholder is intended.`);
  }
  if (hasLabel && !hasText) {
    addDiagnostic(result, 'info', 'TEXT_PROP_ALIAS', `${context}: ${component} uses the label alias; prefer text.`);
  }
}

function validateFieldLabel(result, component, props, context) {
  if (!FIELD_PRIMITIVES.has(component)) return;
  if (!hasNonEmptyString(props?.label)) {
    addDiagnostic(result, 'info', 'UNLABELED_FIELD', `${context}: ${component} has no label.`);
  }
}

/** Nudge `section` towards the explicit container that says what was meant. */
function validateSectionIntent(result, node, component, decision, context) {
  if (component !== 'section') return;
  const layout = isObject(node.layout) ? node.layout : {};
  const hasTitle = hasNonEmptyString(node.props?.title);

  if (!hasTitle && layout.type === 'row') {
    addDiagnostic(result, 'info', 'SECTION_INTENT', `${context}: an untitled row section renders as a group. Use "row" to say so explicitly.`);
  } else if (!hasTitle && (layout.type === 'stack' || layout.type == null) && decision.frame === 'group') {
    addDiagnostic(result, 'info', 'SECTION_INTENT', `${context}: this section renders as a group. Use "stack" for layout, or "card" for a box.`);
  } else if (decision.frame === 'group' && hasTitle && decision.reason === 'nested') {
    addDiagnostic(result, 'info', 'SECTION_INTENT', `${context}: a titled section inside a frame stays unframed. Use "card" if you wanted a box.`);
  }
}

function validateRedundantSurface(result, node, decision, context) {
  if (typeof node.surface !== 'boolean') return;
  const without = decideFrame({ ...node, surface: undefined }, decision.ctx);
  if (!without) return;
  const wanted = node.surface ? 'surface' : 'group';
  if (without.frame === wanted) {
    addDiagnostic(result, 'info', 'REDUNDANT_SURFACE', `${context}: surface: ${node.surface} matches what the rules already decide. It can be removed.`);
  }
}

function validateLayoutOnLeaf(result, node, component, context) {
  if (!isObject(node.layout)) return;
  const children = childNodes(node);
  if (children.length > 0) return;
  if (LAYOUT_ONLY.has(component) || component === 'section' || component === 'card') return;
  addDiagnostic(result, 'info', 'ORPHAN_LAYOUT', `${context}: layout on a node with no children has no effect.`);
}

function validateEmptyContainer(result, node, component, context) {
  if (!LAYOUT_ONLY.has(component) && component !== 'section' && component !== 'card') return;
  if (childNodes(node).length > 0) return;
  addDiagnostic(result, 'info', 'EMPTY_CONTAINER', `${context}: ${component} has no children.`);
}

function validateRole(result, node, context) {
  const role = typeof node.role === 'string' ? node.role.trim() : '';
  if (role === '' || ROLES.includes(role)) return;
  const suggestion = nearest(role, ROLES);
  addDiagnostic(result, 'info', 'UNKNOWN_ROLE', `${context}: role "${role}" is not a known role, so it drives no proportions.${suggestion ? ` Did you mean "${suggestion}"?` : ` Known roles: ${ROLES.join(', ')}.`}`);
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

  const raw = typeof node.component === 'string' ? node.component : '';
  const component = resolvePrimitiveName(raw) || raw;
  const props = isObject(node.props) ? node.props : {};
  const isPrimitive = PRIMITIVE_COMPONENTS.has(component);

  const layout = isObject(node.layout) ? node.layout : {};
  const ctx = {
    element: component,
    surfaceDepth: Number.isInteger(options.surfaceDepth) && options.surfaceDepth > 0 ? options.surfaceDepth : 0,
    parentIsGrid: options.parentLayoutIsGrid === true,
    parentDivides: options.parentDivides === true,
    hasPane: isObject(node.pane),
    role: typeof node.role === 'string' ? node.role.trim() : undefined,
  };
  // The renderer and lint must never disagree about the frame, so both call
  // decideFrame rather than keeping their own copy of the rule.
  const decision = { ...decideFrame(node, ctx), ctx };

  validateRole(result, node, context);

  if (isPrimitive) {
    validateKnownProps(result, component, props, context);
    validateEnumProps(result, component, props, context);
    validateTextProps(result, component, props, context);
    validateFieldLabel(result, component, props, context);
    validateSectionIntent(result, node, component, decision, context);
    validateRedundantSurface(result, node, decision, context);
    validateLayoutOnLeaf(result, node, component, context);
    validateEmptyContainer(result, node, component, context);
  }

  const containerDepth = (Number.isInteger(options.containerDepth) ? options.containerDepth : 0)
    + (childNodes(node).length > 0 ? 1 : 0);
  if (containerDepth === MAX_CONTAINER_DEPTH + 1) {
    addDiagnostic(result, 'warnings', 'DEEP_NESTING', `${context}: more than ${MAX_CONTAINER_DEPTH} levels of containers. Flatten it, or move part of the tree into a component.`);
  }

  const nextOptions = {
    surfaceDepth: ctx.surfaceDepth + (decision.frame === 'surface' ? 1 : 0),
    parentLayoutIsGrid: layout.type === 'grid' || component === 'grid',
    parentDivides: layout.separatorPolicy === 'divide' || layout.separators === 'between',
    containerDepth,
  };

  for (const child of childNodes(node)) {
    const childId = typeof child?.id === 'string' ? child.id : 'node';
    validatePrimitiveProps(result, child, `${context} > ${childId}`, nextOptions);
  }
}

module.exports = {
  validatePrimitiveProps,
};
