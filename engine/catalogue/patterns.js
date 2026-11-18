'use strict';

// The Patterns section: every built-in std pattern, expanded by the real
// resolver (the same path a page takes, so slots, fallbacks and prop defaults
// apply) and drawn by the renderer. Like the element sections, nothing here is
// hand-maintained: add a pattern to engine/stdlib and it appears.

const {
  builtinComponentDefinition,
  builtinComponentIds,
  builtinComponentSummary,
} = require('../stdlib');
const { collectSlotPlaceholders } = require('../component-registry/slot-placeholders');
const { resolveNodes } = require('../resolver/nodes');
const { renderNode } = require('../renderer/primitives');

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const anchor = (id) => `pattern-${id.replace('.', '-')}`;

function defaultText(value) {
  if (value === undefined) return '—';
  if (Array.isArray(value)) return `list of ${value.length}`;
  if (value != null && typeof value === 'object') return 'object';
  return value === '' ? '""' : String(value);
}

function propsTable(definition) {
  const defaults = definition.propDefaults || {};
  const hints = definition.propHints || {};
  const rows = [...new Set([...Object.keys(defaults), ...Object.keys(hints)])].map((name) => (
    `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(defaultText(defaults[name]))}</td>`
    + `<td>${escapeHtml(hints[name] || '')}</td></tr>`
  ));
  return `<table class="cat-props"><thead><tr><th>Prop</th><th>Default</th><th>What it sets</th></tr></thead>`
    + `<tbody>${rows.join('')}</tbody></table>`;
}

function slotsNote(definition) {
  const seen = new Set();
  const notes = [];
  for (const placeholder of collectSlotPlaceholders(definition)) {
    if (seen.has(placeholder.slot)) continue;
    seen.add(placeholder.slot);
    const fallback = Array.isArray(placeholder.children) && placeholder.children.length > 0
      ? `falls back to ${placeholder.children.map((node) => node.id).join(', ')}`
      : 'empty unless filled';
    notes.push(`<code>${escapeHtml(placeholder.slot)}</code> ${escapeHtml(fallback)}`);
  }
  return `<p class="cat-aliases">Slots: ${notes.join('; ')}. Fill one with <code>slots.&lt;name&gt;</code>`
    + ' (instance <code>children</code> fill <code>default</code>); <code>[]</code> leaves it empty.</p>';
}

function renderPattern(id, options) {
  const name = id.slice(id.indexOf('.') + 1);
  const definition = builtinComponentDefinition(id);
  const resolved = resolveNodes([{ id: name, use: id }], {});
  if (!resolved.ok) throw new Error(resolved.error);
  const demo = resolved.nodes.map((node) => renderNode(node, { ...options, surfaceDepth: 0 })).join('');
  const modeClass = options.mode === 'line' ? '' : ' cat-demo-dark';
  const source = `- id: ${name}\n  use: ${id}\n  # props and slots below override the defaults\n\n`
    + `wf component show ${id}\nwf component copy ${id} --as my_${name}`;

  return `<article class="cat-item" id="${anchor(id)}">
  <div class="cat-head">
    <span class="cat-name">${escapeHtml(id)}</span>
    <span class="cat-frame">pattern</span>
  </div>
  <p class="cat-summary">${escapeHtml(builtinComponentSummary(id))}</p>
  <div class="cat-demo${modeClass} wf wf-mode-${escapeHtml(options.mode)} wf-platform-${escapeHtml(options.platform)}">${demo}</div>
  <div class="cat-split">
    <pre class="cat-code">${escapeHtml(source)}</pre>
    <div>${propsTable(definition)}${slotsNote(definition)}</div>
  </div>
</article>`;
}

/** The sidebar group that links each pattern. */
function patternSidebar() {
  const items = builtinComponentIds()
    .map((id) => `<li><a href="#${anchor(id)}">${escapeHtml(id)}</a></li>`)
    .join('');
  return `<h2>Patterns</h2><ul>${items}</ul>`;
}

/** Every pattern, rendered with its defaults, under one heading. */
function patternSection(options) {
  const items = builtinComponentIds().map((id) => renderPattern(id, options)).join('\n');
  return `<h2 class="cat-family" id="family-patterns">Patterns</h2>\n`
    + '<p class="cat-summary">Built-in screens made of the elements above. Use one with <code>use: std.&lt;name&gt;</code>;'
    + ' they are read-only, so <code>wf component copy</code> one to change its structure.</p>\n'
    + items;
}

module.exports = { patternSection, patternSidebar };
