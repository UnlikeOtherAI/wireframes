'use strict';

const { PRIMITIVES } = require('../schema/primitive-registry');

// These are painted-part capabilities, not a second component catalogue.
const ACCENT = new Set(['button', 'input', 'textarea', 'select', 'tags_input', 'checkbox', 'radio',
  'toggle', 'choice_group', 'segmented', 'tab_bar', 'bottom_tab_bar', 'nav', 'menu', 'pagination',
  'stepper', 'progress', 'rating', 'picker']);
const FILL = new Set(['button', 'input', 'textarea', 'select', 'tags_input', 'checkbox', 'radio',
  'toggle', 'choice_group', 'segmented', 'badge', 'avatar', 'image', 'progress', 'skeleton']);
const BORDER = new Set([...FILL, 'divider', 'tab_bar', 'bottom_tab_bar', 'breadcrumb', 'pagination', 'stepper']);

/** Metadata comes from the same registry that validates and renders each primitive. */
function catalogueModel() {
  return PRIMITIVES.map((entry) => ({
    component: entry.name,
    family: entry.family,
    summary: entry.summary,
    aliases: Object.keys(entry.aliases || {}),
    variants: [...(entry.props?.variant?.enum || [])],
    defaultVariant: entry.defaultVariant || null,
    colors: [
      ...(entry.name === 'spacer' || entry.name === 'skeleton' ? [] : ['text']),
      ...(entry.frame === 'S' || entry.frame === 'C' || FILL.has(entry.name) ? ['background'] : []),
      ...(entry.frame !== 'N' || BORDER.has(entry.name) ? ['border'] : []),
      ...(ACCENT.has(entry.name) ? ['accent'] : []),
    ],
  }));
}

module.exports = { catalogueModel };
