'use strict';

const { resolvePrimitiveName } = require('../schema/primitive-registry');

// Elements whose renderer lays out the node's authored children (it returns
// `useChildren: true`). Other elements only append children after their own
// markup, or drop them. `cli/test/repeat-hosts.test.js` checks this against
// the renderers, so the two cannot drift apart.
const CHILD_LAYOUT_ELEMENTS = new Set(['section', 'card', 'stack', 'row', 'grid', 'split', 'form', 'carousel', 'app_bar']);
// These lay out children only when they have no tabs of their own.
const TABS_OR_CHILDREN = new Set(['tab_bar', 'bottom_tab_bar']);

/** Whether the element a node names renders that node's authored children. */
function rendersAuthoredChildren(node) {
  const element = resolvePrimitiveName(node?.component);
  if (!element) return false;
  if (CHILD_LAYOUT_ELEMENTS.has(element)) return true;
  if (TABS_OR_CHILDREN.has(element)) {
    const tabs = node.props?.tabs;
    return !Array.isArray(tabs) || tabs.length === 0;
  }
  return false;
}

module.exports = { rendersAuthoredChildren };
