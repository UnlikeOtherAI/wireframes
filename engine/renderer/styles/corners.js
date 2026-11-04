'use strict';

// Explicit pill corners target this node's painted parts, after mode/platform CSS.
const cornerStyles = [
  '.wf-field.wf-input-plain>.wf-control{border:0;background:transparent;border-radius:0}',
  '.wf-node[data-wf-corner="pill"],.wf-node[data-wf-corner="pill"]>button,'
    + '.wf-node[data-wf-corner="pill"]>.wf-button-link,.wf-node[data-wf-corner="pill"]>.wf-control,'
    + '.wf-node[data-wf-corner="pill"]>textarea,.wf-node[data-wf-corner="pill"]>.wf-image-placeholder,'
    + '.wf-node[data-wf-corner="pill"]>img{border-radius:9999px}',
].join('\n');

module.exports = { cornerStyles };
