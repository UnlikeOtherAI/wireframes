'use strict';

// The catalogue renders each element from the one-line `example` in the
// registry, so the picture and the documented snippet can never disagree.
//
// A handful of examples elide their children (`children: [...]`) because a
// container's example is about the container, not its contents. Those get a
// renderable stand-in here — the same shape, with the children filled in.

const yaml = require('js-yaml');
const { primaryProp } = require('../schema/primitive-registry');

const FILLED_CHILDREN = {
  section: '- section: { title: Billing, children: [{ paragraph: "Plan, usage and invoices." }] }',
  card: '- card: { title: Revenue, children: [{ stat: { label: This month, value: $12.4k } }] }',
  stack: '- stack: { gap: 12, children: [{ heading: { text: Stacked, level: 4 } }, { paragraph: One under the other. }] }',
  row: '- row: { gap: 8, justify: space-between, children: [{ text: Side by side }, { button: { label: Action } }] }',
  grid: '- grid: { columns: 3, children: [{ stat: { label: One, value: "128" } }, { stat: { label: Two, value: "64" } }, { stat: { label: Three, value: "9" } }] }',
  split: '- split: { children: [{ card: { title: Left } }, { card: { title: Right } }] }',
  form: '- form: { title: Profile, submit: Save, children: [{ input: { label: Full name } }, { input: { label: Email, inputType: email } }] }',
  accordion: '- accordion: { items: [{ title: Billing, text: Card on file, open: true }, { title: Members }] }',
};

/** One `{ component: props }` entry to a node, recursing into `children`. */
function toNode(entry, id) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const [component, value] = Object.entries(entry)[0] || [];
  if (!component) return null;

  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    const { children, ...props } = value;
    const node = { id, component, props };
    if (Array.isArray(children)) {
      node.children = children
        .map((child, index) => toNode(child, `${id}_${index}`))
        .filter(Boolean);
    }
    return node;
  }

  // A bare scalar is shorthand for the element's primary prop.
  const prop = primaryProp(component);
  return { id, component, props: prop ? { [prop]: value } : {} };
}

/** `- badge: { text: Active }` or `- paragraph: Some text` to a node. */
function parseExample(source, id) {
  const documents = yaml.load(source);
  return toNode(Array.isArray(documents) ? documents[0] : documents, id);
}

/** The YAML the catalogue shows, and the node it renders, for one element. */
function demoFor(entry) {
  const source = FILLED_CHILDREN[entry.name] || entry.example;
  return { source, node: parseExample(source, `demo_${entry.name}`) };
}

module.exports = { demoFor, parseExample };
