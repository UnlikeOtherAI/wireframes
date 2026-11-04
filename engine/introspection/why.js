'use strict';

const { resolvePageTargets, renderWireframeMarkup } = require('../screenshots');
const { explainFrame } = require('../renderer/frame-rules');
const { regionSizingTokens } = require('../renderer/sizing-tokens');

// `wf why` answers from the rendered markup rather than re-deriving the
// decision, so the explanation can never disagree with the output.

const FIX = {
  'explicit:true': 'Remove `surface: true` to let the rules decide.',
  'explicit:false': 'Remove `surface: false` to let the rules decide.',
  'explicit:style': 'Remove the border from `wireframeStyle` to let the rules decide.',
  'region:slot': 'Slot regions never frame. Put a `card` inside the slot instead.',
  pane: 'Panes always frame. Remove `pane` or set `surface: false`.',
  'divided-child': 'The parent sets `separatorPolicy: divide`, so it draws the strokes. Give the parent a `gap` instead to get separate frames.',
  'grid-tile': 'Grid children are tiles. Set `surface: false` on this node to opt out.',
  nested: 'Already inside a frame. Use `card` instead of `section` if you want a box here.',
  'nested:self-stroked': 'Already inside a frame; this element draws its own row strokes. Set `surface: true` to add a frame as well.',
  'row-group': 'An untitled row at the top of a page reads as a toolbar. Add `props.title`, or use `card`, to get a frame.',
  'role:toolbar': 'Toolbars never frame. Remove `role: toolbar` or use `card`.',
  'top-level': 'Top-level containers frame by default. Set `surface: false`, or use `row`/`stack`, to opt out.',
  'overlay-root': 'Overlay chrome always frames.',
  'overlay-chrome': 'The overlay already draws the frame, so its content does not. Set `surface: true` to add one anyway.',
};

function fixFor(reason) {
  if (FIX[reason]) return FIX[reason];
  if (reason.startsWith('element:')) {
    const element = reason.slice('element:'.length);
    return `\`${element}\` always renders this way. Set \`surface: true\` or \`surface: false\` to override, or pick a different element.`;
  }
  if (reason.startsWith('region:')) {
    return 'Template regions frame unless their role says otherwise. Set `surface: false` on the region.';
  }
  return 'Set `surface: true` or `surface: false` on the node to override.';
}

function attrsOf(markup, nodeId) {
  const escaped = nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markup.match(new RegExp(`<[a-z]+[^>]*\\sid="${escaped}"[^>]*>`, 'i'));
  if (!match) return null;
  const tag = match[0];
  const read = (name) => {
    const found = tag.match(new RegExp(`${name}="([^"]*)"`));
    return found ? found[1] : null;
  };
  return {
    frame: read('data-wf-frame'),
    why: read('data-wf-why'),
    classes: (read('class') || '').split(/\s+/).filter(Boolean),
    style: read('style') || '',
  };
}

/**
 * Explain how one node rendered: its frame decision, the rule behind it, and
 * the one edit that would flip it.
 */
function explainNode({ projectPath, pageId, nodeId }) {
  if (!nodeId) return { ok: false, error: 'A node id is required.' };

  const targets = resolvePageTargets(projectPath, pageId);
  if (!targets.ok) return targets;
  if (!Array.isArray(targets.targets) || targets.targets.length === 0) {
    return { ok: false, error: pageId ? `No page "${pageId}".` : 'No pages in this project.' };
  }

  for (const target of targets.targets) {
    const markup = renderWireframeMarkup({
      roots: target.roots,
      pageViewport: target.viewport,
      pageRouteId: target.pageRouteId,
      routeTable: target.routeTable,
      appStateDefaults: target.appStateDefaults,
      pageStateDefaults: target.pageStateDefaults,
      pageStyle: target.wireframeStyle,
      skin: target.skin,
      rendering: target.rendering || {},
      defaultGridColumns: target.defaultGridColumns,
      bodyLayoutType: target.bodyLayoutType || 'row',
      bodyLayout: target.bodyLayout,
      projectPath,
      dataSources: target.dataSources,
      sizing: target.sizing,
      explain: true,
    });

    const attrs = attrsOf(markup, nodeId);
    if (!attrs) continue;

    const [rule, ...rest] = String(attrs.why || '').split(':');
    const reason = rest.join(':');
    const element = (attrs.classes.find((c) => c.startsWith('wf-') && c !== 'wf-node' && c !== 'wf-surface' && c !== 'wf-group') || '').slice(3);
    const role = (attrs.classes.find((c) => c.startsWith('wf-role-')) || '').slice('wf-role-'.length);

    return {
      ok: true,
      pageId: target.pageId,
      nodeId,
      element,
      role: role || null,
      frame: attrs.frame,
      rule: Number(rule) || null,
      reason,
      because: explainFrame({ rule: Number(rule), reason }),
      fix: fixFor(reason),
      sizing: regionSizingTokens(role, target.viewport, target.sizing),
      style: attrs.style,
    };
  }

  return { ok: false, error: `No node "${nodeId}" in ${pageId ? `page "${pageId}"` : 'any page'}.` };
}

module.exports = { explainNode };
