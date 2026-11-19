'use strict';

const navigationStyles = [
  // --- Tabs ---
  '.wf-tab_bar{display:flex;align-items:stretch;gap:0;min-width:0;overflow:hidden}',
  '.wf-tab_bar[data-wf-frame="edge"]{border-bottom:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-tab_bar[data-wf-frame="edge"]{border-bottom-color:var(--wf-line-strong)}',
  '.wf-tab{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;font-size:13px;font-weight:500;'
    + 'color:var(--wf-ink-3);white-space:nowrap;text-decoration:none;border-bottom:2px solid transparent;margin-bottom:-1px}',
  'button.wf-tab{font-family:inherit;color:var(--wf-choice-ink,var(--wf-ink-3));background:transparent;border:0;border-bottom:2px solid transparent;cursor:pointer}',
  '@media(pointer:coarse){button.wf-tab{min-height:44px;min-width:44px}}',
  '.wf-tab.wf-tab-on{color:var(--wf-choice-accent,var(--wf-ink));border-bottom-color:var(--wf-choice-accent,var(--wf-ink))}',
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
  '.wf-menu{display:flex;flex-direction:column;gap:1px;min-width:min(180px,100%)}',
  '.wf-menu-item{display:flex;align-items:center;gap:10px;padding:7px 12px;font-size:13px;color:var(--wf-ink-2);'
    + 'text-decoration:none;border-radius:4px;min-width:0}',
  // A row too narrow for its parts keeps the label, which is what people read:
  // the shortcut truncates and then hides (see .wf-menu-shortcut), and only
  // after that does the label end in an ellipsis, never shorter than a letter.
  // The label's limit is the row less the 16 px icon and the 10 px gaps beside
  // it. Icons keep their size.
  '.wf-menu-label{flex:1 1 auto;min-width:min(2em,100%);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.wf-menu-label:has(+.wf-menu-shortcut){flex-shrink:0;max-width:calc(100% - 10px)}',
  '.wf-ico+.wf-menu-label:has(+.wf-menu-shortcut){max-width:calc(100% - 36px)}',
  // On the page (frame T at the top level) a menu is the dropdown panel itself.
  '.wf-menu[data-wf-frame="surface"]{width:max-content;max-width:100%;padding:5px}',
  '.wf-mode-card .wf-menu[data-wf-frame="surface"]{border-radius:8px;box-shadow:0 10px 30px rgba(17,24,39,.12)}',
  '.wf-mode-line .wf-menu[data-wf-frame="surface"]{outline:none;border:1px solid var(--wf-line-strong);border-radius:0}',

  // --- Navigation kinds at the top level (frame B: the element's own edge).
  // Inside a framed region or a sidebar panel the container owns this chrome.
  // A sidebar slot region draws the same panel (frame-rules rule 5). ---
  '.wf-mode-card{--wf-panel-edge:var(--wf-line)}',
  '.wf-mode-line{--wf-panel-edge:var(--wf-line-strong)}',
  '.wf-mode-card .wf-root.wf-role-sidebar[data-wf-frame="edge"],.wf-mode-card .wf-nav-sidebar[data-wf-frame="edge"],'
    + '.wf-mode-card .wf-nav-rail[data-wf-frame="edge"],.wf-mode-card .wf-nav-top[data-wf-frame="edge"],'
    + '.wf-mode-card .wf-menubar[data-wf-frame="edge"]{background:#ffffff}',
  '.wf-root.wf-role-sidebar[data-wf-edge-side="end"],.wf-nav-sidebar[data-wf-frame="edge"],.wf-nav-rail[data-wf-frame="edge"]'
    + '{border-right:1px solid var(--wf-panel-edge)}',
  '.wf-root.wf-role-sidebar[data-wf-edge-side="start"]{border-left:1px solid var(--wf-panel-edge)}',
  '.wf-root.wf-role-sidebar[data-wf-edge-side="bottom"]{border-bottom:1px solid var(--wf-panel-edge)}',
  '.wf-root.wf-role-sidebar[data-wf-edge-side="top"]{border-top:1px solid var(--wf-panel-edge)}',
  // Sidebar: a panel at the sidebar width, never wider than its slot or track.
  // An authored size is an inline width and wins. Rail: a narrow strip of icon tiles.
  '.wf-nav-sidebar[data-wf-frame="edge"]{width:min(var(--wf-sidebar-w,256px),100%);flex:0 1 auto;min-width:0;'
    + 'align-self:stretch;padding:8px}',
  '.wf-nav-rail[data-wf-frame="edge"]{align-self:stretch;padding:8px 0}',
  '.wf-nav-rail .wf-ico-placeholder{border:1px dashed var(--wf-line)}',
  '.wf-mode-line .wf-nav-rail .wf-ico-placeholder{border-color:var(--wf-line-strong)}',
  '.wf-nav-rail .wf-nav-on .wf-ico-placeholder{border-color:transparent}',
  // Top nav: a bar across the width with a bottom rule.
  '.wf-nav-top[data-wf-frame="edge"]{align-self:stretch;min-height:var(--wf-header-h,56px);padding:0 12px;'
    + 'border-bottom:1px solid var(--wf-panel-edge)}',
  // Menubar: a compact strip of menu titles, ruled above and below.
  '.wf-menubar[data-wf-frame="edge"]{align-self:stretch;min-height:36px;padding:0 4px;gap:0;'
    + 'border-top:1px solid var(--wf-panel-edge);border-bottom:1px solid var(--wf-panel-edge)}',
  '.wf-menubar[data-wf-frame="edge"] .wf-menubar-trigger{border-radius:0}',
  // A shortcut cut narrower than two letters would leave a stray mark, so the
  // mask, opaque only while the box is at least 2em wide, hides it whole.
  '.wf-menu-shortcut{font-size:11px;color:var(--wf-ink-4);flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;'
    + 'text-overflow:ellipsis;-webkit-mask-image:linear-gradient(90deg,#000 calc((100% - 2em) * 1000),transparent 0);'
    + 'mask-image:linear-gradient(90deg,#000 calc((100% - 2em) * 1000),transparent 0)}',
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

  // --- Item states (rendering-navigation.md). Legacy markup gains state
  // attributes, so only disabled rows and new classes are styled here. ---
  '.wf-tab[data-wf-disabled],.wf-btab[data-wf-disabled],.wf-nav-item[data-wf-disabled],.wf-nav-link[data-wf-disabled],'
    + '.wf-menu-item[data-wf-disabled],.wf-command-item[data-wf-disabled],.wf-sheet-row[data-wf-disabled],'
    + '.wf-menubar-trigger[data-wf-disabled],.wf-step[data-wf-disabled]{opacity:.45;cursor:default}',
  '.wf-crumb[data-wf-disabled]{opacity:.55}',
  '.wf-nav-sep{height:1px;background:var(--wf-line-2);margin:6px 10px}',
  '.wf-mode-line .wf-nav-sep,.wf-mode-line .wf-menu-sep,.wf-mode-line .wf-command-sep,.wf-mode-line .wf-nav-panel-sep{background:var(--wf-line-strong)}',
  '.wf-nav-chevron{display:inline-flex;flex:0 0 auto;margin-left:auto;color:var(--wf-ink-4)}',
  '.wf-nav-item .wf-nav-chevron .wf-icon-glyph{width:auto;min-width:0;font-size:10px}',
  '.wf-nav-collapsed .wf-nav-chevron,.wf-nav-collapsed .wf-nav-sep{display:none}',
  '.wf-menu-heading{padding:8px 12px 4px;font-size:11px;font-weight:600;color:var(--wf-ink-4)}',
  '.wf-menu-item[data-wf-selected]{background:var(--wf-fill);color:var(--wf-ink)}',
  '.wf-menu-item[data-wf-current]{color:var(--wf-ink);font-weight:600}',
  '.wf-mode-line .wf-menu-item[data-wf-selected]{background:transparent;outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-menu-sub{display:inline-flex;flex:0 0 auto;color:var(--wf-ink-4)}',
  '.wf-menu-sub .wf-icon-glyph{font-size:10px;width:auto;min-width:0}',
  '.wf-sheet-sep{height:8px;background:var(--wf-fill)}',
  '.wf-mode-line .wf-sheet-sep{height:0;background:transparent;border-top:1px dashed var(--wf-line-strong)}',
  '.wf-sheet-heading{padding:10px 16px 4px;font-size:12px;color:var(--wf-ink-3);text-align:center}',

  // --- Key chips: command and menubar shortcuts ---
  '.wf-keys{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto}',
  '.wf-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 5px;'
    + 'font:inherit;font-size:11px;line-height:1;color:var(--wf-ink-3);background:var(--wf-fill-2);'
    + 'border:1px solid var(--wf-line-2);border-bottom-width:2px;border-radius:4px}',
  '.wf-mode-line .wf-kbd{background:transparent;border:1px solid var(--wf-line-strong);border-radius:0}',

  // --- Top navigation: a horizontal site menu whose open item draws its panel ---
  '.wf-nav-top{flex-direction:row;align-items:center;flex-wrap:wrap;gap:4px}',
  '.wf-nav-top .wf-nav-item{flex:0 0 auto}',
  '.wf-nav-top .wf-nav-label{flex:0 0 auto}',
  '.wf-nav-top .wf-nav-sep{width:1px;height:20px;margin:0 6px}',
  '.wf-nav-top .wf-nav-group{padding:0 8px}',
  '.wf-nav-menu{position:relative;display:flex}',
  'button.wf-nav-trigger{font:inherit;font-size:13px;background:transparent;border:0;cursor:pointer;gap:6px}',
  '.wf-nav-trigger .wf-nav-chevron{margin-left:0}',
  '.wf-nav-trigger[data-wf-expanded]{background:var(--wf-fill);color:var(--wf-ink)}',
  '.wf-mode-line .wf-nav-trigger[data-wf-expanded]{background:transparent;outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-nav-panel{position:absolute;top:calc(100% + 6px);left:0;z-index:30;display:flex;flex-direction:column;gap:2px;'
    + 'width:320px;padding:8px;background:#ffffff;border:1px solid var(--wf-line-2);border-radius:10px;'
    + 'box-shadow:0 10px 30px rgba(17,24,39,.12)}',
  '.wf-mode-line .wf-nav-panel{border-color:var(--wf-line-strong);border-radius:0;box-shadow:none}',
  '.wf-nav-link{display:flex;align-items:flex-start;gap:12px;padding:10px;min-width:0;color:var(--wf-ink-2);'
    + 'text-decoration:none;border-radius:var(--wf-corner-radius,8px)}',
  '.wf-mode-line .wf-nav-link{border-radius:0}',
  '.wf-nav-link-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 36px;width:36px;height:36px;'
    + 'border-radius:8px;background:var(--wf-fill);color:var(--wf-ink-2)}',
  '.wf-mode-line .wf-nav-link-icon{background:transparent;border:1px dashed var(--wf-line);border-radius:0}',
  '.wf-nav-link-text{display:flex;flex-direction:column;gap:2px;min-width:0}',
  '.wf-nav-link-label{font-size:13px;font-weight:600;color:var(--wf-ink)}',
  '.wf-nav-link-desc{font-size:12px;line-height:1.4;color:var(--wf-ink-3)}',
  '.wf-nav-panel-heading{padding:8px 10px 2px;font-size:10px;font-weight:600;text-transform:uppercase;'
    + 'letter-spacing:.07em;color:var(--wf-ink-4)}',
  '.wf-nav-panel-sep{height:1px;background:var(--wf-line-2);margin:4px 6px}',

  // --- Menubar: a row of menu triggers; the open one draws its panel ---
  '.wf-menubar{display:flex;align-items:center;flex-wrap:wrap;gap:2px;min-width:0}',
  '.wf-menubar-menu{position:relative;display:flex}',
  '.wf-menubar-trigger{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 10px;font:inherit;'
    + 'font-size:13px;font-weight:500;color:var(--wf-ink-2);background:transparent;border:0;'
    + 'border-radius:var(--wf-corner-radius,6px);cursor:pointer}',
  '.wf-menubar-trigger[data-wf-expanded]{background:var(--wf-fill);color:var(--wf-ink)}',
  // A title without a menu is a page link (or plain text) in the bar.
  'a.wf-menubar-trigger,span.wf-menubar-trigger{text-decoration:none}',
  'span.wf-menubar-trigger{cursor:default}',
  // Current is an underline, so it never reads as the open (expanded) menu.
  '.wf-menubar-trigger[data-wf-current]{color:var(--wf-ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--wf-ink)}',
  '.wf-mode-line .wf-menubar-trigger{border-radius:0}',
  '.wf-mode-line .wf-menubar-trigger[data-wf-expanded]{background:transparent;outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-menubar-panel{position:absolute;top:calc(100% + 4px);left:0;z-index:30;min-width:220px;padding:5px;'
    + 'background:#ffffff;border:1px solid var(--wf-line-2);border-radius:8px;box-shadow:0 10px 30px rgba(17,24,39,.12)}',
  '.wf-mode-line .wf-menubar-panel{border-color:var(--wf-line-strong);border-radius:0;box-shadow:none}',
  '.wf-menubar-panel .wf-menu-item{padding:6px 10px}',

  // --- Command palette: search row, grouped results, optional key-hint footer ---
  '.wf-command{display:flex;flex-direction:column;min-width:0}',
  '.wf-command-search{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 8px 8px;font-size:14px;'
    + 'border-bottom:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-command-search{border-bottom-color:var(--wf-line-strong)}',
  '.wf-command-search .wf-icon-glyph{color:var(--wf-ink-4)}',
  '.wf-command-query{color:var(--wf-ink)}',
  '.wf-command-placeholder{color:var(--wf-ink-4)}',
  '.wf-command-list{display:flex;flex-direction:column;gap:2px;padding-top:6px;min-width:0}',
  '.wf-command-group{display:flex;flex-direction:column;min-width:0}',
  '.wf-command-heading{padding:8px 8px 4px;font-size:11px;font-weight:600;color:var(--wf-ink-4)}',
  '.wf-command-items{display:flex;flex-direction:column;gap:1px;margin:0;padding:0;list-style:none;min-width:0}',
  '.wf-command-item{display:flex;align-items:center;gap:10px;min-height:40px;padding:6px 8px;font-size:13px;'
    + 'color:var(--wf-ink-2);text-decoration:none;border-radius:var(--wf-corner-radius,6px);min-width:0}',
  '.wf-mode-line .wf-command-item{border-radius:0}',
  '.wf-command-item .wf-icon-glyph{width:16px;min-width:16px;color:var(--wf-ink-4)}',
  '.wf-command-item[data-wf-selected]{background:var(--wf-fill);color:var(--wf-ink)}',
  '.wf-mode-line .wf-command-item[data-wf-selected]{background:transparent;outline:1px dashed var(--wf-line-strong);outline-offset:-1px}',
  '.wf-command-item[data-wf-current]{font-weight:600}',
  '.wf-command-text{display:flex;flex-direction:column;flex:1 1 auto;min-width:0}',
  '.wf-command-label,.wf-command-desc{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
  '.wf-command-desc{font-size:11.5px;color:var(--wf-ink-4)}',
  '.wf-command-sep{height:1px;margin:6px 0;background:var(--wf-line-2)}',
  '.wf-command-empty{padding:28px 8px;font-size:13px;text-align:center;color:var(--wf-ink-3)}',
  '.wf-command-footer{display:flex;flex-wrap:wrap;gap:16px;margin-top:6px;padding:10px 8px 0;font-size:11px;'
    + 'color:var(--wf-ink-3);border-top:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-command-footer{border-top-color:var(--wf-line-strong)}',
  '.wf-command-hint{display:inline-flex;align-items:center;gap:6px}',
  '@media(any-pointer:coarse){.wf-command-item,.wf-menubar-trigger{min-height:44px}}',

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
