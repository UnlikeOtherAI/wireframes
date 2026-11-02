'use strict';

// Mode CSS strings live here; per-node wireframeStyle overrides live in ../wireframe-styles.js.

const baseStyles = [
    '*{box-sizing:border-box}',
    'body{margin:0;font-family:system-ui,sans-serif}',

    // --- Mode: page background ---
    '.wf-mode-line{background:#ffffff}',
    '.wf-mode-card{background:#f3f4f6}',

    // --- Page shell ---
    // Flex column, centered at device width, min-height (not fixed height — browser scrolls it)
    '.wf-page{display:flex;flex-direction:column;margin:0 auto}',
    '.wf-mode-card .wf-page{padding:16px;gap:16px}',
    // Body row: fill remaining height, stretch all children (sidebars fill full height)
    '.wf-body-row{flex:1;display:flex;flex-direction:row;align-items:stretch;min-height:0}',
    // Body column: stack template — regions stack vertically
    '.wf-body-column{flex:1;display:flex;flex-direction:column;min-height:0}',
    '.wf-mode-card .wf-body-row,.wf-mode-card .wf-body-column{gap:16px}',

    // --- Sticky regions ---
    '.wf-root[data-sticky="top"]{position:sticky;top:0;z-index:10;flex-shrink:0}',
    '.wf-root[data-sticky="bottom"]{position:sticky;bottom:0;z-index:10;flex-shrink:0}',

    // --- Root wrappers ---
    '.wf-root{border:none;padding:0;margin:0}',
    '.wf-root-slot{flex:1;min-width:0}',
    '.wf-root-title{display:none}',
    '.wf-root-body{display:block}',
    '.wf-node-children{display:contents}',

    // --- Surface: template regions, section components ---
    // Line mode: transparent bg, single outline (outline doesn't affect box model)
    '.wf-mode-line .wf-surface{background:transparent;outline:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;border-radius:var(--wf-surface-radius,0px)}',
    // Card mode: white card with border and subtle shadow
    '.wf-mode-card .wf-surface{background:#ffffff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #e5e7eb;box-shadow:var(--wf-surface-shadow,0 1px 3px rgba(0,0,0,0.08));border-radius:var(--wf-surface-radius,4px)}',

    // --- Structural nodes ---
    // Fallback (no mode class): retain original bordered appearance for any context without a mode
    '.wf-node{background:#fff;border:var(--wf-border-width,1px) var(--wf-border-style,solid) #333;border-radius:var(--wf-surface-radius,0px);padding:6px;margin:4px;min-height:22px}',

    // In both rendering modes, only explicit surfaces (wf-surface) show frames.
    // Generic container nodes are transparent layout wrappers — no border, no background.
    // This prevents frames appearing on labels, wrappers, and other non-frame containers.
    '.wf-mode-line .wf-node:not(.wf-surface){border:none;background:transparent}',
    '.wf-mode-card .wf-node:not(.wf-surface){border:none;background:transparent}',

    // Explicit surface treatment (sections + template regions) — mode-specific borders
    '.wf-mode-line .wf-node.wf-surface{border:none;background:transparent;box-shadow:none;outline:var(--wf-border-width,1px) var(--wf-border-style,solid) #4b5563;border-radius:var(--wf-surface-radius,0px)}',
    '.wf-mode-card .wf-node.wf-surface{border:var(--wf-border-width,1px) var(--wf-border-style,solid) #e5e7eb;background:#ffffff;box-shadow:var(--wf-surface-shadow,0 1px 3px rgba(0,0,0,0.08));border-radius:var(--wf-surface-radius,4px)}',

    // --- Borderless primitives (no box) ---
    '.wf-heading,.wf-paragraph,.wf-text,.wf-image,.wf-icon,.wf-button,.wf-input,.wf-textarea,.wf-select,.wf-checkbox,.wf-radio,.wf-toggle{border:none;background:transparent;padding:2px 0;min-height:0}',
    '.wf-heading h1,.wf-heading h2,.wf-heading h3,.wf-heading h4,.wf-heading h5,.wf-heading h6,.wf-paragraph p{margin:0}',
    '.wf-heading h1{font-size:24px;font-weight:650;line-height:1.2;color:#111827}',
    '.wf-heading h2{font-size:20px;font-weight:600;line-height:1.25;color:#111827}',
    '.wf-heading h3{font-size:16px;font-weight:600;line-height:1.3;color:#111827}',
    '.wf-heading h4{font-size:14px;font-weight:600;line-height:1.35;color:#111827}',
    '.wf-heading h5{font-size:13px;font-weight:600;line-height:1.35;color:#111827}',
    '.wf-heading h6{font-size:12px;font-weight:600;line-height:1.35;text-transform:uppercase;letter-spacing:0;color:#6b7280}',
    '.wf-paragraph p{font-size:14px;font-weight:400;line-height:1.6;color:#4b5563;max-width:65ch}',
    '.wf-text{font-size:14px;line-height:1.4;color:#374151}',
    '.wf-text-meta{font-size:12px;color:#6b7280}',
    '.wf-icon{display:inline-flex;align-items:center;justify-content:center;color:#374151}',
    '.wf-button,.wf-checkbox,.wf-radio,.wf-toggle{width:fit-content}',
    '.wf-input,.wf-textarea,.wf-select{width:100%}',
    '.wf-button i.fa-solid,.wf-button i.fa-regular,.wf-button i.fa-brands{margin-right:4px}',
    '.wf-interactive{cursor:pointer}',
    '.wf-inline-link{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.wf-button-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;color:inherit}',

    // --- Buttons: mode-specific styling ---
    '.wf-button button,.wf-button .wf-button-link{display:inline-flex;align-items:center;justify-content:center;gap:4px;min-height:32px;padding:6px 14px;font-size:13px;font-weight:500;line-height:1.3;cursor:pointer;font-family:inherit}',
    '.wf-mode-line .wf-button button,.wf-mode-line .wf-button .wf-button-link{background:transparent;border:1px solid #4b5563;color:#111827;border-radius:0}',
    '.wf-mode-line .wf-button-primary button,.wf-mode-line .wf-button-primary .wf-button-link{border-width:2px}',
    '.wf-mode-card .wf-button button,.wf-mode-card .wf-button .wf-button-link{background:#e5e7eb;border:1px solid transparent;color:#374151;border-radius:var(--wf-corner-radius,6px)}',
    '.wf-mode-card .wf-button-primary button,.wf-mode-card .wf-button-primary .wf-button-link,.wf-mode-card .wf-button-danger button,.wf-mode-card .wf-button-danger .wf-button-link{background:#1f2937;color:#ffffff}',
    '.wf-mode-card .wf-button-secondary button,.wf-mode-card .wf-button-secondary .wf-button-link{background:#e5e7eb;color:#374151}',
    '.wf-mode-card .wf-button-ghost button,.wf-mode-card .wf-button-ghost .wf-button-link{background:transparent;color:#374151}',
    // Fallback button (no mode)
    '.wf-button button,.wf-button .wf-button-link{cursor:pointer;font-family:inherit}',

    // --- Tab bars (in-page tabs — buttons not stretched) ---
    '.wf-tab-bar{padding:0;margin:0;overflow:hidden}',
    '.wf-tab-bar-body{min-height:0}',
    '.wf-tab-bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',
    '.wf-tab-bar .wf-button,.wf-tab-bar .wf-section,.wf-tab-bar .wf-text{margin:0}',
    '.wf-mode-card .wf-tab-bar .wf-button .wf-button-link,.wf-mode-card .wf-tab-bar .wf-button button{min-width:0;border-radius:0;background:#f3f4f6}',
    '.wf-mode-line .wf-tab-bar .wf-button .wf-button-link,.wf-mode-line .wf-tab-bar .wf-button button{min-width:0}',
    '.wf-tab-bar .wf-selected{outline:none}',
    '.wf-tab-bar .wf-selected button,.wf-tab-bar .wf-selected .wf-button-link{color:#111827;border-bottom:2px solid #1f2937}',

    // --- Bottom tab bar (iOS-style — buttons stretched, icon above text) ---
    '.wf-bottom-tab-bar{padding:0;margin:0;overflow:hidden}',
    '.wf-bottom-tab-bar-body{min-height:0}',
    '.wf-bottom-tab-bar .wf-node-children{display:flex;flex:1 1 auto;min-width:0}',
    '.wf-bottom-tab-bar .wf-node-children>*{flex:1 1 0;min-width:0}',
    '.wf-bottom-tab-bar .wf-button,.wf-bottom-tab-bar .wf-section,.wf-bottom-tab-bar .wf-text{margin:0}',
    '.wf-bottom-tab-bar .wf-button,.wf-bottom-tab-bar .wf-button .wf-button-link,.wf-bottom-tab-bar .wf-button button{width:100%}',
    '.wf-mode-card .wf-bottom-tab-bar .wf-button .wf-button-link,.wf-mode-card .wf-bottom-tab-bar .wf-button button{min-width:0;border-radius:0;background:#f3f4f6}',
    '.wf-mode-line .wf-bottom-tab-bar .wf-button .wf-button-link,.wf-mode-line .wf-bottom-tab-bar .wf-button button{min-width:0}',
    '.wf-bottom-tab-bar .wf-button button,.wf-bottom-tab-bar .wf-button .wf-button-link{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 4px;font-size:11px}',
    '.wf-bottom-tab-bar .wf-button i{margin-right:0;font-size:16px}',
].join('\n');

module.exports = {
  baseStyles,
};
