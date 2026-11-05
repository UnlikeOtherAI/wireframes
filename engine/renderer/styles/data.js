'use strict';

const dataStyles = [
  // --- Table ---
  '@media(pointer:coarse){.wf-table-link{display:inline-flex;align-items:center;min-width:44px;min-height:44px}}',
  '.wf-table{padding:0;overflow:hidden;min-width:0}',
  '.wf-table-caption{padding:12px 14px 0;font-size:13px;font-weight:600;color:var(--wf-ink)}',
  '.wf-table-grid{display:grid;align-items:center;min-width:0}',
  '.wf-table-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;'
    + 'color:var(--wf-ink-3);background:var(--wf-fill-2);border-bottom:1px solid var(--wf-line)}',
  '.wf-mode-line .wf-table-header{background:transparent;border-bottom-color:var(--wf-line-strong)}',
  '.wf-table-body{display:block}',
  '.wf-table-row{min-width:0;min-height:var(--wf-row-h,44px)}',
  '.wf-table-body>.wf-table-row+.wf-table-row{border-top:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-table-body>.wf-table-row+.wf-table-row{border-top-style:dashed;border-top-color:var(--wf-line)}',
  '.wf-table-cell{display:flex;align-items:center;gap:8px;padding:11px 14px;min-width:0;font-size:13px;'
    + 'color:var(--wf-ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-table-header-cell{color:var(--wf-ink-3)}',
  '.wf-table-dense .wf-table-cell{padding:7px 12px}',
  '.wf-table-dense .wf-table-row{min-height:36px}',
  '.wf-table-check{padding-left:12px;padding-right:0}',
  '.wf-align-right{justify-content:flex-end;text-align:right}',
  '.wf-align-center{justify-content:center;text-align:center}',
  '.wf-sort{color:var(--wf-ink-4);font-size:9px}',
  '.wf-table-row-empty{display:block}',
  '.wf-table-row-empty .wf-table-cell{justify-content:center;padding:28px 14px;color:var(--wf-ink-4);font-style:italic}',
  '.wf-cell-avatar{display:inline-flex;align-items:center;gap:8px;min-width:0}',
  '.wf-cell-actions{display:inline-flex;align-items:center;gap:2px}',
  '.wf-table-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;'
    + 'padding:9px 14px;border-top:1px solid var(--wf-line-2)}',
  '.wf-table-pager{display:inline-flex;gap:4px}',

  // --- List ---
  '.wf-list{display:flex;flex-direction:column;min-width:0;padding:0}',
  '.wf-list-row{display:flex;align-items:center;gap:12px;padding:11px 14px;min-height:var(--wf-row-h,44px);min-width:0}',
  '.wf-list-divided .wf-list-row+.wf-list-row{border-top:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-list-divided .wf-list-row+.wf-list-row{border-top-style:dashed;border-top-color:var(--wf-line)}',
  '.wf-list-lead{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',
  '.wf-list-lead .wf-icon-glyph{color:var(--wf-ink-4);font-size:17px}',
  '.wf-list-body{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}',
  '.wf-list-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--wf-ink);'
    + 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-list-text{font-size:12px;color:var(--wf-ink-3);line-height:1.45;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-list-meta{font-size:11px;color:var(--wf-ink-4);flex:0 0 auto;white-space:nowrap}',
  '.wf-list-trail{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto}',
  '.wf-list-refresh{text-align:center;padding:6px;color:var(--wf-ink-4);font-size:14px}',
  '.wf-list-timeline .wf-timeline-rail{position:relative;width:16px;align-self:stretch}',
  '.wf-timeline-dot{position:absolute;left:5px;top:6px;width:7px;height:7px;border-radius:50%;background:var(--wf-ink-3)}',
  '.wf-list-timeline .wf-timeline-rail:before{content:"";position:absolute;left:8px;top:0;bottom:0;width:1px;background:var(--wf-line)}',
  '.wf-list-chat .wf-list-row{align-items:flex-start}',
  '.wf-chat-end{flex-direction:row-reverse;text-align:right}',
  '.wf-chat-end .wf-list-body{align-items:flex-end}',
  '.wf-list-chat .wf-list-body{padding:9px 12px;border-radius:12px;background:var(--wf-fill);max-width:72%;flex:0 1 auto}',
  '.wf-mode-line .wf-list-chat .wf-list-body{background:transparent;border:1px solid var(--wf-line)}',
  '.wf-list-chat .wf-list-text{white-space:normal}',

  // --- Charts ---
  '.wf-chart{min-width:0;display:flex;flex-direction:column;gap:6px}',
  '.wf-chart-title{font-size:12px;font-weight:600;color:var(--wf-ink-3)}',
  '.wf-chart-svg{width:100%;height:var(--wf-chart-h,160px);display:block;overflow:visible}',
  '.wf-chart-bar{fill:var(--wf-line);stroke:var(--wf-ink-4);stroke-width:.5}',
  '.wf-mode-line .wf-chart-bar{fill:none;stroke:var(--wf-line-strong);stroke-width:1}',
  '.wf-chart-line{fill:none;stroke:var(--wf-ink-3);stroke-width:2;vector-effect:non-scaling-stroke}',
  '.wf-chart-area{fill:var(--wf-line-2);stroke:none}',
  '.wf-mode-line .wf-chart-area{fill:none}',
  '.wf-chart-axis{stroke:var(--wf-line);stroke-width:1;vector-effect:non-scaling-stroke}',
  '.wf-chart-slice{fill:var(--wf-line-2);stroke:#ffffff;stroke-width:1.5}',
  '.wf-chart-slice.wf-series-1{fill:var(--wf-line)}',
  '.wf-chart-slice.wf-series-2{fill:var(--wf-ink-4)}',
  '.wf-chart-slice.wf-series-3{fill:var(--wf-fill)}',
  '.wf-mode-line .wf-chart-slice{fill:none;stroke:var(--wf-line-strong)}',
  '.wf-chart-hole{fill:#ffffff}',
  '.wf-mode-line .wf-chart-hole{fill:none;stroke:var(--wf-line-strong)}',
  '.wf-chart-gauge-track{fill:none;stroke:var(--wf-line-2);stroke-width:10}',
  '.wf-chart-gauge-value{fill:none;stroke:var(--wf-ink-3);stroke-width:10;stroke-linecap:round}',
  '.wf-chart-line.wf-series-1{stroke:var(--wf-ink-4);stroke-dasharray:4 3}',
  '.wf-chart-line.wf-series-2{stroke:var(--wf-line);stroke-dasharray:1 3}',
  '.wf-heat{fill:var(--wf-fill)}',
  '.wf-heat-1{fill:var(--wf-line-2)}',
  '.wf-heat-2{fill:var(--wf-line)}',
  '.wf-heat-3{fill:var(--wf-ink-4)}',
  '.wf-heat-4{fill:var(--wf-ink-3)}',
  '.wf-chart-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11px;color:var(--wf-ink-3)}',
  '.wf-legend-key{display:inline-flex;align-items:center;gap:6px}',
  '.wf-legend-swatch{width:10px;height:10px;border-radius:2px;background:var(--wf-line)}',
  '.wf-legend-swatch.wf-series-1{background:var(--wf-ink-4)}',
  '.wf-legend-swatch.wf-series-2{background:var(--wf-line-2)}',
  '.wf-chart-sparkline{height:34px}',
  '.wf-chart-sparkline-wrap .wf-chart-svg{height:34px}',

  // --- Calendar ---
  '.wf-calendar{padding:0;min-width:0}',
  '.wf-cal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;'
    + 'border-bottom:1px solid var(--wf-line-2)}',
  '.wf-cal-title{font-size:13px;font-weight:600;color:var(--wf-ink)}',
  '.wf-cal-row,.wf-cal-grid{display:grid;grid-template-columns:repeat(7,1fr)}',
  '.wf-cal-names{padding:6px 0;border-bottom:1px solid var(--wf-line-2)}',
  '.wf-cal-name{text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;color:var(--wf-ink-4)}',
  '.wf-cal-cell{position:relative;min-height:48px;padding:5px 6px;font-size:11px;color:var(--wf-ink-2);'
    + 'border-top:1px solid var(--wf-line-2);border-left:1px solid var(--wf-line-2)}',
  '.wf-cal-cell:nth-child(7n+1){border-left:none}',
  '.wf-cal-out{color:var(--wf-line)}',
  '.wf-cal-event{position:absolute;left:6px;right:6px;bottom:6px;height:4px;border-radius:2px;background:var(--wf-ink-4)}',
  '.wf-cal-picker .wf-cal-cell{min-height:32px;text-align:center;border:none}',
  '.wf-cal-slots{display:flex;flex-direction:column}',
  '.wf-cal-slot-row{display:grid;grid-template-columns:repeat(var(--wf-cal-cols,7),1fr)}',
  '.wf-cal-slot{position:relative;min-height:34px;border-top:1px solid var(--wf-line-2);border-left:1px solid var(--wf-line-2)}',

  // --- Kanban ---
  '.wf-kanban{display:flex;align-items:stretch;min-width:0;overflow:auto}',
  '.wf-kanban-col{flex:1 1 0;min-width:180px;display:flex;flex-direction:column;gap:8px;padding:12px}',
  '.wf-mode-card .wf-kanban-col{background:var(--wf-fill-2);border:1px solid var(--wf-line-2);border-radius:var(--wf-surface-radius,6px)}',
  '.wf-mode-line .wf-kanban-col{outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-kanban-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;'
    + 'font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--wf-ink-3)}',
  '.wf-kanban-count{font-size:11px;color:var(--wf-ink-4)}',
  '.wf-kanban-cards{display:flex;flex-direction:column;gap:8px}',
  '.wf-kanban-card{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#ffffff;'
    + 'border:1px solid var(--wf-line-2);border-radius:var(--wf-corner-radius,6px)}',
  '.wf-mode-line .wf-kanban-card{background:transparent;border-color:var(--wf-line);border-radius:0}',
  '.wf-kanban-card-title{font-size:12.5px;color:var(--wf-ink)}',
  '.wf-kanban-card-meta{font-size:11px;color:var(--wf-ink-4)}',

  // --- Tree ---
  '.wf-tree{display:flex;flex-direction:column;min-width:0;padding:6px 0}',
  '.wf-tree-row{display:flex;align-items:center;gap:7px;padding:5px 12px;font-size:12.5px;color:var(--wf-ink-2);min-width:0}',
  '.wf-tree-caret{width:12px;flex:0 0 auto;color:var(--wf-ink-4);font-size:10px}',
  '.wf-tree-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-tree-row .wf-icon-glyph{color:var(--wf-ink-4);font-size:13px}',

  // --- Accordion ---
  '.wf-accordion{display:flex;flex-direction:column;min-width:0;padding:0}',
  '.wf-accordion-item+.wf-accordion-item{border-top:1px solid var(--wf-line-2)}',
  '.wf-accordion-head{display:flex;align-items:center;justify-content:space-between;gap:12px;'
    + 'padding:13px 14px;cursor:pointer;min-width:0}',
  '.wf-accordion-title{font-size:13px;font-weight:500;color:var(--wf-ink);min-width:0}',
  '.wf-accordion-caret{color:var(--wf-ink-4);font-size:14px;flex:0 0 auto}',
  '.wf-accordion-body{padding:0 14px 14px;font-size:12.5px;color:var(--wf-ink-3);line-height:1.6}',
].join('\n');

module.exports = { dataStyles };
