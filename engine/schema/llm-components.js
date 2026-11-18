'use strict';

// The `wf llm` sections on reusable components: slot syntax and fill rules,
// and the built-in std patterns. The pattern lists are generated from the
// definitions in engine/stdlib, so props, hints and slots never drift.

const {
  builtinComponentDefinition,
  builtinComponentIds,
  builtinComponentSummary,
} = require('../stdlib');
const { collectSlotPlaceholders } = require('../component-registry/slot-placeholders');

/** How a component takes content from its instances. */
function componentSlotsSection() {
  return `## Component slots

A reusable component marks where an instance's content goes with a slot
placeholder: { id, slot, children } and nothing else. Its children are the
fallback. Placeholders live inside a component definition, never as its root
and never in a page, template or overlay.

\`\`\`yaml
# components.yaml
components:
  panel:
    propDefaults: { title: Details }
    root:
      id: panel
      component: card
      props: { title: "{{props.title}}" }
      children:
        - { id: body, slot: default }
        - id: footer
          slot: footer
          children:                       # fallback
            - { id: close, component: button, props: { label: Close } }

# a page
- id: billing
  use: panel
  props: { title: Billing }
  children:                               # fills default
    - { id: plan, component: heading, props: { text: Pro plan } }
  slots:
    footer:                               # fills footer
      - { id: upgrade, component: button, props: { label: Upgrade, variant: primary } }
\`\`\`

- Instance children fill default; slots.<name> fills the others. Never give both children and slots.default.
- Leave a fill out to get the fallback. slots.<name>: [] leaves that slot empty on purpose.
- slots is valid only on a use: node, and only with names the component declares.
- Page fills keep their ids. The component's own nodes are renamed <instance>__<id>.
- A component without placeholders keeps the old rule: instance children replace its root's children.
- wf component show <id> prints a component's props, slots and fallbacks.`;
}

function defaultText(value) {
  if (Array.isArray(value)) return `list of ${value.length}`;
  if (value != null && typeof value === 'object') return 'object';
  return JSON.stringify(value);
}

function propLines(definition) {
  const defaults = definition.propDefaults || {};
  const hints = definition.propHints || {};
  return [...new Set([...Object.keys(defaults), ...Object.keys(hints)])].map((name) => {
    const fallback = Object.hasOwn(defaults, name) ? ` = ${defaultText(defaults[name])}` : '';
    return `  - ${name}${fallback}${hints[name] ? `: ${hints[name]}` : ''}`;
  });
}

function slotLine(definition) {
  const seen = new Set();
  const slots = [];
  for (const placeholder of collectSlotPlaceholders(definition)) {
    if (seen.has(placeholder.slot)) continue;
    seen.add(placeholder.slot);
    const fallback = Array.isArray(placeholder.children) && placeholder.children.length > 0
      ? placeholder.children.map((node) => node.id).join(', ')
      : 'empty';
    slots.push(`${placeholder.slot} (fallback: ${fallback})`);
  }
  return `- slots: ${slots.join(', ')}`;
}

/** Every built-in pattern with its props, defaults, hints and slots. */
function stdPatternsSection() {
  const patterns = builtinComponentIds().map((id) => {
    const definition = builtinComponentDefinition(id);
    return [`### ${id}`, '', builtinComponentSummary(id), '', '- props:', ...propLines(definition), slotLine(definition)].join('\n');
  });
  return `## Screen patterns (std)

Whole screens ship built in. Use one with use: std.<name> and no components.yaml
entry; override props and fill slots like any component. The project's own
components win over a built-in with the same id, including ones imported under
a std alias (validate reports STD_ALIAS_SHADOWED). Built-ins are read-only:
wf component copy std.<name> [--as <id>] [--file <path>] copies one into the
project to edit. wf component list --std lists them.

\`\`\`yaml
- id: customers
  use: std.data_page
  props: { title: Customers, pages: 4 }
  slots:
    filters:
      - { id: customer_search, component: input, props: { inputType: search, placeholder: Search customers } }
\`\`\`

${patterns.join('\n\n')}`;
}

/** The compact list for `wf llm --short`. */
function stdPatternsCheatSheet() {
  return `## Screen patterns

Whole screens ship built in. Use one before building it by hand: \`use: std.login\`.
${builtinComponentIds().map((id) => `\`${id}\``).join(', ')}.
\`wf component show std.<name>\` lists its props and slots; \`wf component copy
std.<name>\` makes an editable copy in components.yaml.`;
}

module.exports = { componentSlotsSection, stdPatternsCheatSheet, stdPatternsSection };
