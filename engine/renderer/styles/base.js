'use strict';

// Page shell, frame treatment and typography.
// Frames are keyed on [data-wf-frame], which the renderer decides. CSS never
// infers a box from nesting or adjacency.

const baseStyles = [
  '*{box-sizing:border-box}',
  'body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#374151}',

  // --- Tokens ---
  ':root{--wf-ink:#111827;--wf-ink-2:#374151;--wf-ink-3:#6b7280;--wf-ink-4:#9ca3af;'
    + '--wf-line:#d1d5db;--wf-line-2:#e5e7eb;--wf-line-strong:#4b5563;--wf-fill:#f3f4f6;--wf-fill-2:#f9fafb;'
    + '--wf-info:#2f6fd0;--wf-success:#2f8f55;--wf-warning:#c07817;--wf-danger:#c0443c}',
  // The page stays greyscale. These four hues mark one thing: severity, validity
  // and destruction. An element that needs one sets --wf-tone and paints it on a
  // single edge, dot or label — never a fill, a heading or a whole control.
  '.wf-tone-info{--wf-tone:var(--wf-info)}',
  '.wf-tone-success{--wf-tone:var(--wf-success)}',
  '.wf-tone-warning{--wf-tone:var(--wf-warning)}',
  '.wf-tone-danger{--wf-tone:var(--wf-danger)}',

  // --- Mode: page background ---
  '.wf-mode-line{background:#ffffff}',
  '.wf-mode-card{background:var(--wf-fill)}',

  // --- Page shell ---
  '.wf-page{display:flex;flex-direction:column;margin:0 auto;min-width:0}',
  '.wf-mode-card .wf-page{padding:16px;gap:16px}',
  '.wf-body-row{flex:1;display:flex;flex-direction:row;align-items:stretch;min-height:0;min-width:0}',
  '.wf-body-column{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0}',
  '.wf-mode-card .wf-body-row,.wf-mode-card .wf-body-column{gap:16px}',

  // --- Sticky regions ---
  '.wf-root[data-sticky="top"]{position:sticky;top:0;z-index:10;flex-shrink:0}',
  '.wf-root[data-sticky="bottom"]{position:sticky;bottom:0;z-index:10;flex-shrink:0}',

  // --- Roots ---
  '.wf-root{border:none;margin:0;min-width:0}',
  '.wf-root-slot{flex:1 1 auto;min-width:0}',
  '.wf-root-title{display:none}',
  '.wf-root-body{display:block;min-width:0}',
  '.wf-node-children{display:contents}',

  // --- The frame contract ---
  // Only [data-wf-frame="surface"] draws a container box.
  '.wf-node,.wf-root{background:transparent;border:none;min-width:0}',
  '.wf-mode-line [data-wf-frame="surface"]{background:transparent;'
    + 'outline:var(--wf-border-width,1px) var(--wf-border-style,dashed) var(--wf-line-strong);'
    + 'outline-offset:-1px;border-radius:var(--wf-surface-radius,0px)}',
  '.wf-mode-card [data-wf-frame="surface"]{background:#ffffff;'
    + 'border:var(--wf-border-width,1px) var(--wf-border-style,solid) var(--wf-line-2);'
    + 'box-shadow:var(--wf-surface-shadow,0 1px 2px rgba(17,24,39,0.06));'
    + 'border-radius:var(--wf-surface-radius,6px)}',
  '[data-wf-frame="group"],[data-wf-frame="content"],[data-wf-frame="control"]{background:transparent;border:none;box-shadow:none;outline:none}',
  // Edge elements draw one rule, never a box.
  '[data-wf-frame="edge"]{background:transparent;border:none;box-shadow:none;outline:none}',
  // Separators between the children of a divided container.
  '.wf-mode-line [data-wf-divides]>[data-wf-edge="after"]{border-bottom:var(--wf-divider-width,1px) var(--wf-divider-style,dashed) var(--wf-divider-color,#4b5563)}',
  '.wf-mode-card [data-wf-divides]>[data-wf-edge="after"]{border-bottom:var(--wf-divider-width,1px) var(--wf-divider-style,solid) var(--wf-divider-color,#e5e7eb)}',
  '[data-wf-divides="row"]>[data-wf-edge="after"]{border-bottom:none}',
  '.wf-mode-line [data-wf-divides="row"]>[data-wf-edge="after"]{border-right:var(--wf-divider-width,1px) var(--wf-divider-style,dashed) var(--wf-divider-color,#4b5563)}',
  '.wf-mode-card [data-wf-divides="row"]>[data-wf-edge="after"]{border-right:var(--wf-divider-width,1px) var(--wf-divider-style,solid) var(--wf-divider-color,#e5e7eb)}',

  // --- Typography ---
  '.wf-heading h1,.wf-heading h2,.wf-heading h3,.wf-heading h4,.wf-heading h5,.wf-heading h6{margin:0;color:var(--wf-ink)}',
  '.wf-heading h1{font-size:26px;font-weight:650;line-height:1.2}',
  '.wf-heading h2{font-size:21px;font-weight:620;line-height:1.25}',
  '.wf-heading h3{font-size:17px;font-weight:600;line-height:1.3}',
  '.wf-heading h4{font-size:15px;font-weight:600;line-height:1.35}',
  '.wf-heading h5{font-size:13px;font-weight:600;line-height:1.35}',
  '.wf-heading h6{font-size:12px;font-weight:600;line-height:1.35;text-transform:uppercase;letter-spacing:.04em;color:var(--wf-ink-3)}',
  '.wf-paragraph p{margin:0;font-size:14px;line-height:1.6;color:var(--wf-ink-2);max-width:68ch}',
  '.wf-text{font-size:14px;line-height:1.45;color:var(--wf-ink-2)}',
  '.wf-text-meta,.wf-text-caption{font-size:12px;color:var(--wf-ink-3)}',
  '.wf-text-label{font-size:12px;font-weight:600;color:var(--wf-ink-3);text-transform:uppercase;letter-spacing:.04em}',
  '.wf-text-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px}',
  '.wf-inline-link{color:inherit;text-decoration:underline;text-underline-offset:2px}',
  '.wf-interactive{cursor:pointer}',

  // --- Skeletons: the wireframe placeholder vocabulary ---
  '.wf-bar{display:inline-block;height:.85em;min-width:1.5em;border-radius:2px;'
    + 'background:var(--wf-skeleton-bg,var(--wf-line-2));vertical-align:middle}',
  '.wf-mode-line .wf-bar{background:transparent;border:1px dashed var(--wf-line)}',
  '.wf-skeleton{display:flex;align-items:flex-start;gap:10px;min-width:0}',
  '.wf-skeleton-row{display:block;margin-bottom:7px}',
  '.wf-skeleton-row:last-child{margin-bottom:0}',
  '.wf-skeleton-lines{display:block;flex:1 1 auto;min-width:0}',
  '.wf-skeleton-avatar{display:inline-block;width:36px;height:36px;flex:0 0 auto;border-radius:50%;background:var(--wf-line-2)}',
  '.wf-mode-line .wf-skeleton-avatar{background:transparent;border:1px dashed var(--wf-line)}',

  // --- Icons: readable with or without the icon font ---
  '.wf-ico{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}',
  '.wf-icon-glyph{display:inline-flex;align-items:center;justify-content:center;color:var(--wf-ink-2);font-size:16px;width:1em;min-width:1em;line-height:1}',
  '.wf-icon-glyph:not([class*="fa-"]):before,.wf-icon-glyph.fa-solid:not(.fa-classic):before{}',
  // Fallback box drawn only when the icon font left the glyph empty.
  '.wf-icon-glyph:empty:not(.fa-solid):not(.fa-regular):not(.fa-brands):after{content:attr(data-wf-glyph);'
    + 'display:inline-flex;align-items:center;justify-content:center;width:1em;height:1em;'
    + 'border:1px solid var(--wf-line);border-radius:2px;font-size:.7em;font-family:system-ui,sans-serif}',

  // --- Block headers shared by card, section, form ---
  '.wf-block-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}',
  '.wf-block-text{min-width:0}',
  '.wf-block-title,.wf-section-title,.wf-card-title,.wf-form-title{margin:0;color:var(--wf-ink);font-size:14px;font-weight:600;line-height:1.3}',
  '.wf-block-desc{margin-top:2px;color:var(--wf-ink-3);font-size:12px;line-height:1.45}',
  '.wf-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto}',

  // --- The shared action button, used inside composite elements ---
  '.wf-act{display:inline-flex;align-items:center;justify-content:center;gap:6px;'
    + 'min-height:32px;min-width:var(--wf-control-min,80px);padding:6px 14px;'
    + 'font:inherit;font-size:13px;font-weight:500;line-height:1.2;white-space:nowrap;cursor:pointer}',
  '.wf-act-icon{min-width:32px;padding:6px}',
  '.wf-mode-line .wf-act{background:transparent;border:1px solid var(--wf-line-strong);color:var(--wf-ink);border-radius:0}',
  '.wf-mode-line .wf-button-primary.wf-act{border-width:2px}',
  '.wf-mode-card .wf-act{background:var(--wf-line-2);border:1px solid transparent;color:var(--wf-ink-2);border-radius:var(--wf-corner-radius,6px)}',
  '.wf-mode-card .wf-button-primary.wf-act{background:#1f2937;color:#ffffff}',
  '.wf-mode-card .wf-button-danger.wf-act{background:#1f2937;color:#ffffff}',
  '.wf-mode-card .wf-button-ghost.wf-act{background:transparent;color:var(--wf-ink-2)}',
  '.wf-mode-card .wf-button-link.wf-act{background:transparent;color:var(--wf-ink);text-decoration:underline;min-width:0;padding:0}',
].join('\n');

module.exports = { baseStyles };
