'use strict';

const path = require('node:path');
const { loadProjectComponentRegistry } = require(path.resolve(__dirname, '..', 'component-registry'));
const {
  collectSlotPlaceholders,
  isSlotPlaceholder,
} = require(path.resolve(__dirname, '..', 'component-registry', 'slot-placeholders'));

const PROP_TOKEN = /\{\{\s*props\.([a-zA-Z0-9_]+)/g;
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);

function referencedProps(value, found) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(PROP_TOKEN)) found.add(match[1]);
  } else if (Array.isArray(value)) {
    for (const entry of value) referencedProps(entry, found);
  } else if (isObject(value)) {
    for (const entry of Object.values(value)) referencedProps(entry, found);
  }
  return found;
}

function formatValue(value) {
  return typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value) ?? String(value);
}

function propLines(definition) {
  const defaults = isObject(definition.propDefaults) ? definition.propDefaults : {};
  const hints = isObject(definition.propHints) ? definition.propHints : {};
  const names = [...new Set([...Object.keys(defaults), ...Object.keys(hints), ...referencedProps(definition.root, new Set())])];
  if (names.length === 0) return ['  (none)'];
  const width = Math.max(...names.map((name) => name.length));
  return names.map((name) => {
    const parts = [`default: ${Object.hasOwn(defaults, name) ? formatValue(defaults[name]) : 'none'}`];
    if (Object.hasOwn(hints, name)) {
      parts.push(`hint: ${typeof hints[name] === 'string' ? hints[name] : formatValue(hints[name])}`);
    }
    return `  ${name.padEnd(width)}  ${parts.join('  ')}`;
  });
}

function nodeLabel(node) {
  const id = typeof node.id === 'string' ? node.id : '<unnamed>';
  if (isSlotPlaceholder(node)) return `${id} (slot:${node.slot})`;
  if (typeof node.use === 'string') return `${id} (use:${node.use})`;
  if (typeof node.component === 'string') return `${id} (component:${node.component})`;
  return id;
}

function fallbackSummary(placeholder) {
  if (!Array.isArray(placeholder.children)) return 'none';
  if (placeholder.children.length === 0) return 'empty';
  return placeholder.children.filter(isObject).map(nodeLabel).join(', ');
}

function slotLines(definition) {
  const seen = new Set();
  const slots = [];
  for (const placeholder of collectSlotPlaceholders(definition)) {
    if (seen.has(placeholder.slot)) continue;
    seen.add(placeholder.slot);
    slots.push([String(placeholder.slot), fallbackSummary(placeholder)]);
  }
  if (slots.length === 0) return ['  (none)'];
  const width = Math.max(...slots.map(([name]) => name.length));
  return slots.map(([name, fallback]) => `  ${name.padEnd(width)}  fallback: ${fallback}`);
}

function outlineLines(node, depth, lines) {
  if (!isObject(node)) return lines;
  const indent = '  '.repeat(depth);
  lines.push(`${indent}- ${nodeLabel(node)}`);
  if (Array.isArray(node.children)) {
    for (const child of node.children) outlineLines(child, depth + 1, lines);
  }
  if (node.use != null && isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      lines.push(`${indent}  slots.${name}:${Array.isArray(fill) && fill.length === 0 ? ' []' : ''}`);
      if (Array.isArray(fill)) {
        for (const child of fill) outlineLines(child, depth + 2, lines);
      }
    }
  }
  return lines;
}

/**
 * Describes one reusable component: its props with defaults and hints, its
 * slots with their fallback, and the outline of its root. Returns lines; the
 * CLI prints them.
 */
function describeComponent({ projectPath, componentId }) {
  const id = typeof componentId === 'string' ? componentId.trim() : '';
  if (!id) return { ok: false, error: 'A component id is required.' };

  const loaded = loadProjectComponentRegistry(projectPath);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const definition = loaded.registry.components[id];
  if (!isObject(definition) || !isObject(definition.root)) {
    return { ok: false, error: `Component "${id}" does not exist.` };
  }

  const source = loaded.registry.sources[id];
  const sourceLine = source
    ? `${path.relative(projectPath, source.sourcePath).split(path.sep).join('/')} (${source.localId})`
    : 'components.yaml';
  const lines = [
    `Component: ${id}`,
    `Source: ${sourceLine}`,
    '',
    'Props:',
    ...propLines(definition),
    '',
    'Slots:',
    ...slotLines(definition),
    '',
    'Outline:',
    ...outlineLines(definition.root, 1, []),
  ];
  return { ok: true, lines };
}

module.exports = { describeComponent };
