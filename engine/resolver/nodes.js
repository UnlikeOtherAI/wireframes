'use strict';

const { resolveTemplatePage } = require('./index');
const isObject = value => value != null && typeof value === 'object' && !Array.isArray(value);

function resolveNodes(nodes, components) {
  const syntheticTemplate = {
    regions: [
      {
        id: '__tree_root__',
        kind: 'slot',
      },
    ],
  };
  const syntheticPage = {
    slots: [
      {
        slotId: '__tree_root__',
        content: Array.isArray(nodes) ? nodes : [],
      },
    ],
  };
  const resolved = resolveTemplatePage({
    template: syntheticTemplate,
    page: syntheticPage,
    components,
  });
  if (!resolved.ok) {
    return resolved;
  }
  const firstRoot = Array.isArray(resolved.roots) && resolved.roots.length > 0
    ? resolved.roots[0]
    : null;
  const resolvedNodes = Array.isArray(firstRoot?.nodes)
    ? firstRoot.nodes
    : Array.isArray(firstRoot?.children)
      ? firstRoot.children
      : [];
  return {
    ok: true,
    nodes: resolvedNodes,
  };
}
function buildOverlayRoots(overlays, components, source) {
  const list = [];
  if (!Array.isArray(overlays)) {
    return { ok: true, roots: list };
  }
  for (const overlay of overlays) {
    if (!isObject(overlay) || typeof overlay.id !== 'string' || overlay.id.trim() === '') {
      continue;
    }
    const resolvedOverlay = resolveNodes(overlay.content, components);
    if (!resolvedOverlay.ok) {
      return { ok: false, error: resolvedOverlay.error, target: overlay.id };
    }
    list.push({
      id: overlay.id,
      kind: 'overlay',
      type: overlay.type,
      trigger: overlay.trigger,
      placement: overlay.placement,
      dismissOn: overlay.dismissOn,
      size: isObject(overlay.size) ? overlay.size : undefined,
      // The overlay's own chrome: its title bar and its footer actions.
      props: isObject(overlay.props) ? overlay.props : undefined,
      source,
      nodes: resolvedOverlay.nodes,
      wireframeStyle: isObject(overlay.wireframeStyle) ? overlay.wireframeStyle : undefined,
    });
  }
  return { ok: true, roots: list };
}

module.exports = { resolveNodes, buildOverlayRoots };
