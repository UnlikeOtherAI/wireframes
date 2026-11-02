'use strict';

const containerStyles = [
  // --- Containers ---
  '.wf-section,.wf-card,.wf-stack,.wf-row,.wf-grid,.wf-split,.wf-form{min-width:0}',
  '.wf-card-media{margin:-16px -16px 0;overflow:hidden;border-radius:var(--wf-surface-radius,6px) var(--wf-surface-radius,6px) 0 0}',
  '.wf-card-media img{width:100%;display:block;border:none;border-radius:0}',
  '.wf-row>.wf-node-children{display:flex;flex-direction:inherit;gap:inherit;align-items:inherit;justify-content:inherit;flex-wrap:inherit;flex:1 1 auto;min-width:0}',
  '.wf-form-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}',
  '.wf-split>.wf-node-children{display:flex;flex-direction:inherit;gap:inherit;align-items:stretch;flex:1 1 auto;min-width:0}',

  // --- Carousel ---
  '.wf-carousel{position:relative;padding:0;overflow:hidden}',
  '.wf-carousel-track{display:flex;gap:12px;padding:14px;min-width:0}',
  '.wf-slide{flex:1 1 0;min-width:140px;min-height:120px;display:flex;align-items:center;justify-content:center;'
    + 'padding:14px;font-size:13px;color:var(--wf-ink-3);background:var(--wf-fill-2);border:1px solid var(--wf-line-2);'
    + 'border-radius:var(--wf-corner-radius,6px)}',
  '.wf-mode-line .wf-slide{background:transparent;border-color:var(--wf-line);border-radius:0}',
  '.wf-carousel-arrow{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;'
    + 'display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:15px;cursor:pointer;'
    + 'background:#ffffff;color:var(--wf-ink-2);border:1px solid var(--wf-line);border-radius:50%}',
  '.wf-carousel-prev{left:8px}',
  '.wf-carousel-next{right:8px}',
  '.wf-carousel .wf-pagination-dots{justify-content:center;margin:0 auto 12px}',

  // --- Overlays ---
  '.wf-overlay{min-width:0}',
  '.wf-overlay-body{min-width:0}',

  // --- Overlay chrome ---
  '.wf-overlay-content{display:flex;flex-direction:column;gap:0;max-width:100%;overflow:hidden}',
  '.wf-overlay-content>.wf-node-children{display:flex;flex-direction:column;gap:12px;padding:18px;min-width:0}',
  '.wf-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--wf-line-2)}',
  '.wf-overlay-title{font-size:15px;font-weight:600;color:var(--wf-ink)}',
  '.wf-overlay-close{background:none;border:none;font-size:18px;line-height:1;color:var(--wf-ink-4);cursor:pointer;padding:0 2px}',
  '.wf-overlay-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-overlay-head,.wf-mode-line .wf-overlay-foot{border-color:var(--wf-line-strong)}',
  '.wf-mode-line .wf-overlay-content[data-wf-frame="surface"]{background:#ffffff;outline-style:solid}',
  '.wf-overlay-toast .wf-overlay-content,.wf-overlay-tooltip .wf-overlay-content{max-width:360px}',
  '.wf-overlay-tooltip .wf-overlay-content>.wf-node-children{padding:8px 10px;gap:4px}',

  // --- Panes ---
  '.wf-pane-right{margin-left:auto}',
  '.wf-pane-center{flex:1 1 auto;min-width:0}',
  '.wf-pane[data-wf-pane-collapsed="true"]{overflow:hidden}',

  // --- Density ---
  '.wf-density-compact .wf-table-cell{padding:7px 12px}',
  '.wf-density-compact .wf-list-row{padding:8px 12px;min-height:36px}',
].join('\n');

module.exports = { containerStyles };
