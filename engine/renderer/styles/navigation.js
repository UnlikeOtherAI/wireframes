'use strict';

const navigationStyles = [
  // --- Tabs ---
  '.wf-tab_bar{display:flex;align-items:stretch;gap:0;min-width:0;overflow:hidden}',
  '.wf-tab_bar[data-wf-frame="edge"]{border-bottom:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-tab_bar[data-wf-frame="edge"]{border-bottom-color:var(--wf-line-strong)}',
  '.wf-tab{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;font-size:13px;font-weight:500;'
    + 'color:var(--wf-ink-3);white-space:nowrap;text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px}',
  'button.wf-tab{font-family:inherit;background:transparent;border:0;border-bottom:2px solid transparent;cursor:pointer}',
  '@media(pointer:coarse){button.wf-tab{min-height:44px;min-width:44px}}',
  '.wf-tab.wf-tab-on{color:var(--wf-ink);border-bottom-color:var(--wf-ink)}',
  '.wf-tab-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;'
    + 'font-size:10px;border-radius:9px;background:var(--wf-line-2);color:var(--wf-ink-2)}',
  '.wf-tabs-pill{border-bottom:none;gap:4px;padding:3px;background:var(--wf-fill);border-radius:var(--wf-corner-radius,8px);width:fit-content}',
  '.wf-tabs-pill .wf-tab{border-bottom:none;margin-bottom:0;border-radius:var(--wf-corner-radius,6px);padding:7px 14px}',
  '.wf-tabs-pill .wf-tab-on{background:#ffffff;box-shadow:0 1px 2px rgba(17,24,39,.08)}',
  '.wf-tabs-enclosed .wf-tab{border:1px solid transparent;border-bottom:none;border-radius:6px 6px 0 0;margin-bottom:-1px}',
  '.wf-tabs-enclosed .wf-tab-on{border-color:var(--wf-line-2);background:#ffffff}',
  '.wf-tab_bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',

  // --- Bottom tab bar ---
  // Bottom chrome: it sinks to the foot of whatever column it sits in, so a
  // short screen leaves the gap above the bar rather than below it.
  ".wf-bottom_tab_bar{display:flex;align-items:stretch;min-width:0;margin-top:auto}",
  '.wf-bottom_tab_bar[data-wf-frame="edge"]{border-top:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-bottom_tab_bar[data-wf-frame="edge"]{border-top-color:var(--wf-line-strong)}',
  '.wf-btab{display:flex;flex:1 1 0;flex-direction:column;align-items:center;justify-content:center;gap:3px;'
    + 'min-height:var(--wf-tabbar-h,56px);padding:6px 4px;font-size:10px;color:var(--wf-ink-4);text-decoration:none}',
  '.wf-btab .wf-icon-glyph{font-size:18px}',
  '.wf-btab-on{color:var(--wf-ink)}',
  '.wf-bottom_tab_bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',
  '.wf-bottom_tab_bar .wf-node-children>*{flex:1 1 0;min-width:0}',

  // --- Breadcrumb ---
  '.wf-breadcrumb{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;min-width:0}',
  '.wf-crumb{color:var(--wf-ink-3);text-decoration:none;white-space:nowrap}',
  '.wf-crumb-current{color:var(--wf-ink);font-weight:500}',
  '.wf-crumb-sep{color:var(--wf-ink-4)}',

  // --- Pagination ---
  '.wf-pagination{display:flex;align-items:center;gap:4px;width:fit-content}',
  '.wf-pagenum,.wf-page-step{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:32px;'
    + 'padding:0 8px;font:inherit;font-size:12px;color:var(--wf-ink-2);background:transparent;cursor:pointer;'
    + 'border:1px solid var(--wf-line-2);border-radius:var(--wf-corner-radius,6px)}',
  '.wf-mode-line .wf-pagenum,.wf-mode-line .wf-page-step{border-color:var(--wf-line-strong);border-radius:0}',
  '.wf-pagenum-on{background:var(--wf-ink);color:#ffffff;border-color:var(--wf-ink);font-weight:600}',
  '.wf-page-gap{display:inline-flex;align-items:center;padding:0 4px;color:var(--wf-ink-4)}',
  '.wf-page-label{font-size:12px;color:var(--wf-ink-3);padding:0 8px}',
  '.wf-pagination-dots{gap:7px}',
  '.wf-dot{width:7px;height:7px;border-radius:50%;background:var(--wf-line)}',
  '.wf-dot-on{background:var(--wf-ink-2);width:20px;border-radius:4px}',

  // --- Stepper ---
  '.wf-stepper{display:flex;align-items:flex-start;min-width:0}',
  '.wf-stepper-row{flex-direction:row}',
  '.wf-stepper-stack{flex-direction:column;gap:4px}',
  '.wf-step{display:flex;align-items:center;gap:9px;flex:1 1 0;min-width:0;position:relative}',
  '.wf-stepper-stack .wf-step{flex:0 0 auto;width:100%;padding-bottom:16px}',
  '.wf-step-marker{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:0 0 auto;'
    + 'border-radius:50%;border:1px solid var(--wf-line);font-size:12px;font-weight:600;color:var(--wf-ink-3);background:#ffffff}',
  '.wf-step-on .wf-step-marker{border-color:var(--wf-ink);border-width:2px;color:var(--wf-ink)}',
  '.wf-step-done .wf-step-marker{background:var(--wf-ink);border-color:var(--wf-ink);color:#ffffff}',
  '.wf-step-label{font-size:12px;color:var(--wf-ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.wf-step-on .wf-step-label,.wf-step-done .wf-step-label{color:var(--wf-ink);font-weight:500}',
  '.wf-step-line{flex:1 1 auto;height:1px;min-width:16px;background:var(--wf-line);margin:0 4px}',
  '.wf-stepper-stack .wf-step-line{position:absolute;left:13px;top:30px;width:1px;height:16px;flex:none;margin:0}',

  // --- Side navigation ---
  '.wf-nav{display:flex;flex-direction:column;gap:2px;min-width:0}',
  '.wf-nav-group{padding:14px 10px 5px;font-size:10px;font-weight:600;text-transform:uppercase;'
    + 'letter-spacing:.07em;color:var(--wf-ink-4)}',
  '.wf-nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;min-height:36px;font-size:13px;'
    + 'color:var(--wf-ink-2);text-decoration:none;border-radius:var(--wf-corner-radius,6px);min-width:0}',
  '.wf-mode-line .wf-nav-item{border-radius:0}',
  '.wf-nav-item .wf-icon-glyph{color:var(--wf-ink-4);width:18px;min-width:18px}',
  '.wf-nav-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-nav-on{background:var(--wf-fill);color:var(--wf-ink);font-weight:600}',
  '.wf-mode-line .wf-nav-on{background:transparent;outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-nav-on .wf-icon-glyph{color:var(--wf-ink)}',
  '.wf-nav-badge{display:inline-flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 6px;'
    + 'font-size:10px;border-radius:10px;background:var(--wf-line-2);color:var(--wf-ink-2);flex:0 0 auto}',
  '.wf-nav-children{display:flex;flex-direction:column;gap:2px}',
  '.wf-nav-child{padding-left:38px;font-size:12.5px}',
  '.wf-nav-collapsed .wf-nav-label,.wf-nav-collapsed .wf-nav-badge,.wf-nav-collapsed .wf-nav-group{display:none}',
  '.wf-nav-collapsed .wf-nav-item{justify-content:center;padding:8px}',

  // --- Menu ---
  '.wf-menu{display:flex;flex-direction:column;gap:1px;min-width:180px}',
  '.wf-menu-item{display:flex;align-items:center;gap:10px;padding:7px 12px;font-size:13px;color:var(--wf-ink-2);'
    + 'text-decoration:none;border-radius:4px;min-width:0}',
  '.wf-menu-label{flex:1 1 auto;min-width:0;white-space:nowrap}',
  '.wf-menu-shortcut{font-size:11px;color:var(--wf-ink-4);flex:0 0 auto}',
  '.wf-menu-danger{color:var(--wf-danger);font-weight:500}',
  '.wf-menu-sep{height:1px;background:var(--wf-line-2);margin:4px 0}',
  '.wf-menu-item .wf-icon-glyph{color:var(--wf-ink-4);width:16px;min-width:16px;font-size:13px}',

  // --- App bar ---
  '.wf-app_bar{display:flex;align-items:center;gap:12px;padding:0 12px;min-height:var(--wf-header-h,56px);min-width:0}',
  '.wf-app_bar[data-wf-frame="edge"]{border-bottom:1px solid var(--wf-line-2)}',
  '.wf-app_bar[data-sticky]{background:var(--wf-fill-2)}',
  '.wf-mode-line .wf-app_bar[data-wf-frame="edge"]{border-bottom-color:var(--wf-line-strong)}',
  '.wf-appbar-leading .wf-icon-glyph{font-size:18px;color:var(--wf-ink-2)}',
  '.wf-appbar-title{display:flex;flex-direction:column;flex:1 1 auto;min-width:0;font-size:15px;font-weight:600;color:var(--wf-ink)}',
  '.wf-appbar-sub{font-size:11px;font-weight:400;color:var(--wf-ink-3)}',
  '.wf-appbar-actions{display:flex;align-items:center;gap:14px;flex:0 0 auto}',
  '.wf-appbar-action .wf-icon-glyph{font-size:17px;color:var(--wf-ink-2)}',

  // --- Action sheet ---
  '.wf-action_sheet{display:flex;flex-direction:column;gap:8px;min-width:0}',
  '.wf-sheet-group{display:flex;flex-direction:column;border-radius:12px;overflow:hidden;background:#ffffff}',
  '.wf-mode-line .wf-sheet-group{background:transparent;border:1px solid var(--wf-line-strong);border-radius:0}',
  '.wf-sheet-title{padding:11px 16px;font-size:12px;color:var(--wf-ink-3);text-align:center;'
    + 'border-bottom:1px solid var(--wf-line-2)}',
  '.wf-sheet-row{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;'
    + 'padding:0 16px;font:inherit;font-size:15px;color:var(--wf-ink);background:transparent;border:none;cursor:pointer}',
  '.wf-sheet-row+.wf-sheet-row{border-top:1px solid var(--wf-line-2)}',
  '.wf-sheet-danger{color:var(--wf-danger);font-weight:600}',
  '.wf-sheet-cancel{border-radius:12px;background:#ffffff;font-weight:600;border-top:none}',
  '.wf-mode-line .wf-sheet-cancel{background:transparent;border:1px solid var(--wf-line-strong);border-radius:0}',

  // Compact primary navigation keeps its label and its whole tile clickable.
  '.wf-nav-rail{gap:2px;align-items:stretch}',
  '.wf-nav-rail .wf-nav-item{flex-direction:column;align-items:center;justify-content:center;min-height:64px;min-width:44px;width:100%;padding:4px 2px;gap:3px}',
  '.wf-nav-rail .wf-ico{display:flex;align-items:center;justify-content:center;flex:0 0 40px;width:40px;height:40px;border-radius:10px}',
  '.wf-nav-rail .wf-icon-glyph{font-size:20px;width:24px;text-align:center}',
  '.wf-nav-rail .wf-nav-label{flex:0 0 auto;width:100%;font-size:11px;line-height:13px;text-align:center}',
  '.wf-nav-rail .wf-nav-on,.wf-mode-line .wf-nav-rail .wf-nav-on{background:transparent;outline:none;border-color:transparent}',
  '.wf-nav-rail .wf-nav-on .wf-ico{background:var(--wf-ink);color:var(--wf-bg)}',
  '.wf-nav-rail.wf-nav-collapsed .wf-nav-label{display:inline;position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',

  '@media(any-pointer:coarse){.wf-nav:not(.wf-nav-rail) .wf-nav-item,.wf-menu-item{min-height:44px}}',

  // --- Page header ---
  '.wf-page_header{display:flex;flex-direction:column;gap:10px;min-width:0}',
  '.wf-ph-main{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;min-width:0}',
  '.wf-ph-text{min-width:0;flex:1 1 240px}',
  '.wf-ph-title{margin:0;font-size:22px;font-weight:650;line-height:1.2;color:var(--wf-ink)}',
  '.wf-ph-sub{margin:4px 0 0;font-size:13px;color:var(--wf-ink-3);line-height:1.5}',
  '.wf-ph-crumbs{margin-bottom:-2px}',
  '.wf-ph-tabs{margin-top:2px}',
].join('\n');

module.exports = { navigationStyles };
