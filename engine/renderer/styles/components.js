'use strict';

// Mode CSS strings live here; per-node wireframeStyle overrides live in ../wireframe-styles.js.

const componentStyles = [
    // --- Tables ---
    '.wf-table{padding:0;margin:0;overflow:hidden}',
    '.wf-table-grid{display:grid;align-items:center;min-width:0}',
    '.wf-table-header{font-size:12px;font-weight:600;border-bottom:1px solid var(--wf-divider-color,#d1d5db)}',
    '.wf-table-body{display:block}',
    '.wf-table-row{min-width:0}',
    '.wf-table-body>.wf-table-row+.wf-table-row{border-top:1px solid var(--wf-divider-color,#e5e7eb)}',
    '.wf-table-cell{padding:10px 12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.wf-table-header-cell{color:#374151}',
    '.wf-table-body>.wf-table-row:nth-child(odd){background:#ffffff}',
    '.wf-table-body>.wf-table-row:nth-child(even){background:#f8fafc}',
    '.wf-mode-line .wf-table-header{background:#f9fafb}',
    '.wf-mode-line .wf-table-body>.wf-table-row:nth-child(even){background:#f9fafb}',
    '.wf-mode-card .wf-table-header{background:#f3f4f6}',
    '.wf-table-row-empty .wf-table-cell{grid-column:1 / -1;color:#6b7280}',

    // --- Inputs: mode-specific styling ---
    '.wf-field-label{display:block;margin:0 0 4px;color:#4b5563;font-size:12px;font-weight:500;line-height:1.3}',
    '.wf-input input,.wf-textarea textarea,.wf-select select{width:100%;font-family:inherit;color:#111827}',
    '.wf-input input,.wf-select select{min-height:36px}',
    '.wf-textarea textarea{min-height:72px;resize:vertical}',
    '.wf-input input::placeholder,.wf-textarea textarea::placeholder{color:#9ca3af}',
    '.wf-mode-line .wf-input input,.wf-mode-line .wf-textarea textarea,.wf-mode-line .wf-select select{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;background:transparent;border-radius:0;padding:6px 10px}',
    '.wf-mode-card .wf-input input,.wf-mode-card .wf-textarea textarea,.wf-mode-card .wf-select select{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #d1d5db;background:#ffffff;padding:6px 10px;border-radius:var(--wf-surface-radius,4px)}',
    '.wf-checkbox label,.wf-radio label,.wf-toggle label{display:inline-flex;align-items:center;gap:8px;color:#374151;font-size:14px;line-height:1.4}',
    '.wf-checkbox input,.wf-radio input{width:16px;height:16px;accent-color:#6b7280}',

    // --- Sections ---
    '.wf-section-title{margin:0 0 8px;color:#1f2937;font-size:13px;font-weight:600;line-height:1.3}',
    '.wf-section-body{min-height:10px}',
    '.wf-group{box-shadow:none;outline:none}',

    // --- Other primitives ---
    '.wf-divider{border:none;border-top:1px solid #9ca3af;margin:8px 0}',
    '.wf-mode-line .wf-divider{border-top-color:#4b5563}',
    '.wf-mode-card .wf-divider{border-top-color:#e5e7eb}',
    '.wf-spacer{min-height:12px;background:transparent;border:none}',
    '.wf-skeleton{display:inline-block;height:0.9em;border-radius:3px;background:var(--wf-skeleton-bg,#e5e7eb);vertical-align:middle}',
    '.wf-mode-line .wf-skeleton{background:#d1d5db}',
    '.wf-img,.wf-image img{width:100%;max-width:100%;max-height:100%;display:block;border:1px solid #e5e7eb;border-radius:var(--wf-surface-radius,4px)}',
    '.wf-mode-line .wf-image img{border-color:#4b5563;border-radius:0}',
    '.wf-image-placeholder{width:100%;padding:16px;border:1px solid #d1d5db;background:linear-gradient(to top right,transparent calc(50% - 1px),#d1d5db,transparent calc(50% + 1px)),linear-gradient(to top left,transparent calc(50% - 1px),#d1d5db,transparent calc(50% + 1px)),#f9fafb;text-align:center;color:#9ca3af;min-height:120px;display:flex;align-items:center;justify-content:center}',
    '.wf-mode-line .wf-image-placeholder{border-color:#4b5563;border-radius:0}',
    '.wf-chart{border:none;background:transparent;padding:4px 0;min-height:120px}',
    '.wf-chart-svg{width:100%;min-height:120px;max-height:160px;display:block}',
    '.wf-chart-title{font-size:12px;color:#6b7280;margin-bottom:4px}',
    '.wf-toggle-track{display:inline-block;width:36px;height:20px;border:1px solid #9ca3af;border-radius:10px;position:relative;vertical-align:middle;background:#d1d5db}',
    '.wf-mode-line .wf-toggle-track{background:transparent;border-color:#4b5563}',
    '.wf-toggle-thumb{position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#ffffff;box-shadow:0 1px 2px rgba(0,0,0,0.2)}',

    // --- Panes ---
    '.wf-pane-left,.wf-pane-center,.wf-pane-right{display:block}',
    '.wf-pane-right{margin-left:auto}',
    '.wf-pane-center{flex:1 1 auto;min-width:0}',
    '.wf-pane[data-wf-pane-collapsed="true"]{overflow:hidden}',

    // --- Screenshot shell ---
    '#wf-screenshot-shell{position:relative;}',
    '#wf-frame-image{display:block;max-width:none;max-height:none;}',
    '#wf-wireframe-shell{overflow:hidden}',

    // --- Separators between siblings (layout.separators: between) ---
    '.wf-divide-x>*+*,.wf-divide-x>.wf-node-children>*+*{border-left:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-divide-y>*+*,.wf-divide-y>.wf-node-children>*+*{border-top:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-mode-line .wf-divide-x>*+*,.wf-mode-line .wf-divide-y>*+*,.wf-mode-line .wf-divide-x>.wf-node-children>*+*,.wf-mode-line .wf-divide-y>.wf-node-children>*+*{--wf-divider-color:#9ca3af}',
    '.wf-mode-card .wf-divide-x>*+*,.wf-mode-card .wf-divide-y>*+*,.wf-mode-card .wf-divide-x>.wf-node-children>*+*,.wf-mode-card .wf-divide-y>.wf-node-children>*+*{--wf-divider-color:#e5e7eb}',

    // Suppress surface borders on direct children of separator containers:
    // the divider line IS the visual separation — individual child borders would double it.
    // These rules must appear after the mode-specific surface rules (same specificity, source order wins).
    '.wf-divide-x>.wf-surface,.wf-divide-y>.wf-surface,.wf-divide-x>.wf-node-children>.wf-surface,.wf-divide-y>.wf-node-children>.wf-surface{outline:none;border:none;box-shadow:none}',
    '.wf-divide-x>.wf-node.wf-surface,.wf-divide-y>.wf-node.wf-surface,.wf-divide-x>.wf-node-children>.wf-node.wf-surface,.wf-divide-y>.wf-node-children>.wf-node.wf-surface{border:none;box-shadow:none}',
    '.wf-divide-x>.wf-surface+.wf-surface,.wf-divide-x>.wf-node.wf-surface+.wf-node.wf-surface,.wf-divide-x>.wf-node-children>.wf-surface+.wf-surface,.wf-divide-x>.wf-node-children>.wf-node.wf-surface+.wf-node.wf-surface{border-left:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',
    '.wf-divide-y>.wf-surface+.wf-surface,.wf-divide-y>.wf-node.wf-surface+.wf-node.wf-surface,.wf-divide-y>.wf-node-children>.wf-surface+.wf-surface,.wf-divide-y>.wf-node-children>.wf-node.wf-surface+.wf-node.wf-surface{border-top:1px var(--wf-divider-style,solid) var(--wf-divider-color,#9ca3af)}',

    // --- Interactions / state ---
    '.wf-visible{display:flex !important;}',
    '.wf-overlay-modal.wf-visible,.wf-overlay-alert.wf-visible{align-items:center;justify-content:center}',
    '.wf-overlay-content{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;pointer-events:auto;max-height:100%;overflow:auto}',
    '.wf-selected{outline:2px solid #2563eb;outline-offset:1px;}',
    '.wf-gesture-pulse{position:relative;}',
    '.wf-gesture-pulse:after{content:"";position:absolute;inset:0;border:2px solid rgba(0,102,204,0.7);animation:wfPulse 250ms ease-out forwards;pointer-events:none;}',
    '@keyframes wfPulse{from{transform:scale(1);opacity:0.8;}to{transform:scale(1.05);opacity:0;}}',
    '.wf-runtime-toast{position:fixed;right:16px;top:16px;padding:8px 10px;border:1px solid #333;background:#fff;color:#000;z-index:600;font-family:Arial,sans-serif;font-size:12px;max-width:420px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,0.15);}',
].join('\n');

module.exports = {
  componentStyles,
};
