'use strict';

// Overlay chrome, runtime visibility and the native platform skins.
// The runtime toggles .wf-visible; everything else here is static.

const overlayStyles = [
  // --- Runtime visibility ---
  '.wf-visible{display:flex !important}',
  '.wf-overlay-modal.wf-visible,.wf-overlay-alert.wf-visible{align-items:center;justify-content:center}',
  '.wf-overlay-bottom_sheet.wf-visible{align-items:flex-end;justify-content:center}',
  '.wf-overlay-toast.wf-visible{justify-content:center}',

  // --- Overlay chrome ---
  '.wf-overlay-content{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;'
    + 'pointer-events:auto;max-height:100%;overflow:auto;background:#ffffff}',
  '.wf-mode-card .wf-overlay-content[data-wf-frame="surface"]{box-shadow:0 12px 32px rgba(17,24,39,.18);border-radius:var(--wf-surface-radius,10px)}',
  '.wf-mode-line .wf-overlay-content[data-wf-frame="surface"]{outline-style:solid;outline-width:1px;box-shadow:0 8px 24px rgba(17,24,39,.12)}',
  '.wf-overlay-content>.wf-node-children{display:flex;flex-direction:column;gap:12px;padding:18px;min-width:0}',
  '.wf-overlay-head{display:flex;align-items:center;justify-content:space-between;gap:12px;'
    + 'padding:14px 18px;border-bottom:1px solid var(--wf-line-2);flex:0 0 auto}',
  '.wf-overlay-title{font-size:15px;font-weight:600;color:var(--wf-ink)}',
  '.wf-overlay-close{background:none;border:none;font-size:18px;line-height:1;color:var(--wf-ink-4);cursor:pointer;padding:0 2px}',
  '.wf-overlay-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;'
    + 'border-top:1px solid var(--wf-line-2);flex:0 0 auto}',
  '.wf-mode-line .wf-overlay-head,.wf-mode-line .wf-overlay-foot{border-color:var(--wf-line-strong)}',

  // Anchored overlays are menus, not panels: tighter padding, no card padding.
  '.wf-overlay-menu .wf-overlay-content>.wf-node-children,'
    + '.wf-overlay-dropdown .wf-overlay-content>.wf-node-children{padding:6px;gap:0}',
  '.wf-overlay-popover .wf-overlay-content>.wf-node-children{padding:14px;gap:10px}',
  '.wf-overlay-tooltip .wf-overlay-content{max-width:280px;background:var(--wf-ink);border:none;outline:none}',
  '.wf-overlay-tooltip .wf-overlay-content>.wf-node-children{padding:7px 10px;gap:4px}',
  '.wf-overlay-tooltip .wf-text,.wf-overlay-tooltip .wf-paragraph p{color:#ffffff;font-size:12px}',
  '.wf-overlay-toast .wf-overlay-content{max-width:420px}',
  '.wf-overlay-bottom_sheet .wf-overlay-content{width:100%;border-radius:16px 16px 0 0}',
  '.wf-overlay-bottom_sheet .wf-overlay-content:before{content:"";display:block;width:36px;height:4px;'
    + 'margin:8px auto 0;border-radius:2px;background:var(--wf-line);flex:0 0 auto}',

  // --- Runtime state ---
  '.wf-selected{outline:2px solid #2563eb;outline-offset:1px}',
  '.wf-gesture-pulse{position:relative}',
  '.wf-gesture-pulse:after{content:"";position:absolute;inset:0;border:2px solid rgba(37,99,235,.7);'
    + 'animation:wfPulse 250ms ease-out forwards;pointer-events:none}',
  '@keyframes wfPulse{from{transform:scale(1);opacity:.8}to{transform:scale(1.05);opacity:0}}',
  '.wf-runtime-toast{position:fixed;right:16px;top:16px;padding:8px 10px;border:1px solid var(--wf-ink);'
    + 'background:#fff;color:var(--wf-ink);z-index:600;font-family:system-ui,sans-serif;font-size:12px;'
    + 'max-width:420px;word-break:break-word;box-shadow:0 2px 10px rgba(0,0,0,.15)}',

  // --- Native chrome: status bar and home indicator ---
  '.wf-status-bar{display:none;align-items:center;justify-content:space-between;flex:0 0 auto;'
    + 'padding:0 18px;min-height:var(--wf-statusbar-h,28px);font-size:12px;font-weight:600;color:var(--wf-ink)}',
  '.wf-platform-ios .wf-status-bar,.wf-platform-android .wf-status-bar{display:flex}',
  '.wf-status-right{display:inline-flex;align-items:center;gap:5px}',
  '.wf-status-glyph{display:inline-block;width:12px;height:9px;background:var(--wf-ink-2);'
    + 'clip-path:polygon(0 100%,25% 60%,25% 100%,50% 35%,50% 100%,75% 15%,75% 100%,100% 0,100% 100%)}',
  '.wf-status-battery{display:inline-block;width:20px;height:10px;border:1px solid var(--wf-ink-2);border-radius:2px;position:relative}',
  '.wf-status-battery:after{content:"";position:absolute;left:1px;top:1px;bottom:1px;width:12px;background:var(--wf-ink-2)}',
  '.wf-home-indicator{display:none;flex:0 0 auto;padding:7px 0 9px}',
  '.wf-platform-ios .wf-home-indicator{display:flex;justify-content:center}',
  '.wf-home-indicator span{display:block;width:134px;height:5px;border-radius:3px;background:var(--wf-ink-3)}',

  // --- Native chrome: platform differences that are real ---
  '.wf-platform-ios .wf-page,.wf-platform-android .wf-page{padding:0;gap:0}',
  '.wf-platform-ios .wf-body-row,.wf-platform-ios .wf-body-column,'
    + '.wf-platform-android .wf-body-row,.wf-platform-android .wf-body-column{gap:0}',
  // iOS centres the title and uses a chevron back; Android left-aligns it.
  '.wf-platform-ios .wf-appbar-title{text-align:center;align-items:center}',
  '.wf-platform-android .wf-appbar-title{text-align:left;align-items:flex-start;font-size:20px;font-weight:500}',
  '.wf-platform-ios .wf-app_bar{min-height:var(--wf-header-h,44px)}',
  '.wf-platform-android .wf-app_bar{min-height:var(--wf-header-h,56px);padding:0 16px}',
  // iOS pill controls, Android rectangular with a larger touch target.
  '.wf-platform-ios .wf-button button,.wf-platform-ios .wf-button .wf-button-link{border-radius:10px}',
  '.wf-platform-ios .wf-control,.wf-platform-ios .wf-textarea textarea{border-radius:10px}',
  '.wf-platform-ios .wf-segmented{border-radius:9px;background:var(--wf-fill)}',
  '.wf-platform-ios .wf-toggle-track{width:51px;height:31px;border-radius:16px;border-color:var(--wf-line)}',
  '.wf-platform-ios .wf-toggle-thumb{width:27px;height:27px;top:1px;left:1px;box-shadow:0 1px 3px rgba(0,0,0,.2)}',
  '.wf-platform-ios .wf-toggle-on .wf-toggle-thumb{right:1px;left:auto}',
  '.wf-platform-android .wf-button button,.wf-platform-android .wf-button .wf-button-link{border-radius:20px;text-transform:none}',
  '.wf-platform-android .wf-button-fab button,.wf-platform-ios .wf-button-fab button{border-radius:50%}',
  '.wf-platform-android .wf-button-fab button{width:56px;height:56px;min-width:56px}',
  '.wf-platform-android .wf-control,.wf-platform-android .wf-textarea textarea{border-radius:4px 4px 0 0;'
    + 'border-width:0 0 1px 0;background:var(--wf-fill-2)}',
  '.wf-platform-android .wf-btab{gap:3px;position:relative}',
  '.wf-platform-android .wf-btab-on .wf-btab-glyph{background:var(--wf-line-2);border-radius:16px;padding:3px 18px}',
  '.wf-platform-android .wf-bottom_tab_bar{padding:6px 0}',
  // Grouped inset list: the iOS Settings pattern.
  '.wf-list-settings{border-radius:10px;overflow:hidden;background:#ffffff}',
  '.wf-list-settings .wf-list-row{padding:11px 16px}',
  '.wf-list-settings .wf-list-row:after{content:"\\203a";margin-left:6px;color:var(--wf-ink-4);font-size:17px}',
  '.wf-list-settings .wf-list-row.wf-list-no-chevron:after{content:""}',
  '.wf-platform-android .wf-list-settings{border-radius:0}',
].join('\n');

module.exports = { overlayStyles };
