'use strict';

const contentStyles = [
  // --- Badges ---
  '.wf-badge{display:inline-flex;width:fit-content;max-width:100%}',
  '.wf-badge-body{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;font-size:11px;font-weight:500;'
    + 'line-height:1.6;color:var(--wf-ink-2);background:var(--wf-fill);border:1px solid transparent;border-radius:10px;white-space:nowrap}',
  '.wf-mode-line .wf-badge-body{background:transparent;border-color:var(--wf-line-strong);border-radius:0}',
  '.wf-badge-outline .wf-badge-body{background:transparent;border-color:var(--wf-line)}',
  '.wf-badge-pill .wf-badge-body{border-radius:10px}',
  '.wf-badge-dot .wf-badge-body{background:transparent;border-color:transparent;padding:2px 0;font-size:12px;color:var(--wf-ink-2)}',
  '.wf-dot-mark{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--wf-ink-3);flex:0 0 auto}',

  // --- Avatars ---
  '.wf-avatar{display:inline-flex;width:fit-content}',
  '.wf-avatar-chip{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;'
    + 'background:var(--wf-fill);border:1px solid var(--wf-line);color:var(--wf-ink-2);font-weight:600;letter-spacing:.02em}',
  '.wf-mode-line .wf-avatar-chip{background:transparent;border-color:var(--wf-line-strong)}',
  '.wf-avatar-img img{width:100%;height:100%;object-fit:cover;display:block}',
  '.wf-avatar-img{display:inline-block;overflow:hidden;border:1px solid var(--wf-line)}',
  '.wf-avatar-group{display:inline-flex;align-items:center}',
  '.wf-avatar-group .wf-avatar-chip+.wf-avatar-chip{margin-left:-10px}',
  '.wf-avatar-group .wf-avatar-chip{box-shadow:0 0 0 2px #ffffff}',
  '.wf-avatar-more{display:inline-flex;align-items:center;margin-left:6px;font-size:12px;color:var(--wf-ink-3)}',

  // --- Media ---
  '.wf-image{display:block;max-width:100%;min-width:0}',
  '.wf-image img{width:100%;max-width:100%;display:block;border:1px solid var(--wf-line-2);border-radius:var(--wf-surface-radius,6px)}',
  '.wf-mode-line .wf-image img{border-color:var(--wf-line-strong);border-radius:0}',
  '.wf-image-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;'
    + 'width:100%;min-height:120px;padding:16px;text-align:center;color:var(--wf-ink-4);'
    + 'border:1px solid var(--wf-line);border-radius:var(--wf-surface-radius,6px);'
    + 'background:linear-gradient(to top right,transparent calc(50% - .5px),var(--wf-line-2),transparent calc(50% + .5px)),'
    + 'linear-gradient(to top left,transparent calc(50% - .5px),var(--wf-line-2),transparent calc(50% + .5px)),var(--wf-fill-2)}',
  '.wf-mode-line .wf-image-placeholder{border-color:var(--wf-line-strong);border-radius:0;background:'
    + 'linear-gradient(to top right,transparent calc(50% - .5px),var(--wf-line),transparent calc(50% + .5px)),'
    + 'linear-gradient(to top left,transparent calc(50% - .5px),var(--wf-line),transparent calc(50% + .5px))}',
  '.wf-image-placeholder .wf-icon-glyph{font-size:22px;color:var(--wf-ink-4)}',
  '.wf-image-caption{font-size:12px}',

  // --- Rating ---
  '.wf-rating{display:inline-flex;align-items:center;gap:1px;color:var(--wf-ink-3);font-size:14px}',
  '.wf-star-on{color:var(--wf-ink)}',
  '.wf-rating-count{margin-left:6px;font-size:12px;color:var(--wf-ink-3)}',

  // --- Stat tile ---
  '.wf-stat{display:flex;flex-direction:column;gap:6px;justify-content:center;min-width:0}',
  '.wf-stat[data-wf-frame="surface"]{padding:16px}',
  '.wf-stat-head{display:flex;align-items:center;gap:8px;min-width:0}',
  '.wf-stat-label{font-size:12px;font-weight:500;color:var(--wf-ink-3);text-transform:uppercase;letter-spacing:.04em;'
    + 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.wf-stat-head .wf-icon-glyph{color:var(--wf-ink-4)}',
  '.wf-stat-value{display:flex;align-items:baseline;gap:10px;font-size:24px;font-weight:650;color:var(--wf-ink);line-height:1.15}',
  '.wf-stat-delta{font-size:12px;font-weight:500;color:var(--wf-ink-3);white-space:nowrap}',
  '.wf-stat-spark{width:100%;height:22px;display:block;fill:none;stroke:var(--wf-ink-4);stroke-width:1.5}',

  // --- Progress ---
  '.wf-progress{display:flex;flex-direction:column;gap:5px;min-width:0}',
  '.wf-progress-label{font-size:12px;color:var(--wf-ink-3)}',
  '.wf-progress-track{display:block;height:6px;width:100%;border-radius:3px;background:var(--wf-line-2);overflow:hidden}',
  '.wf-mode-line .wf-progress-track{background:transparent;border:1px solid var(--wf-line-strong);border-radius:0}',
  '.wf-progress-fill{display:block;height:100%;background:var(--wf-ink-3)}',
  '.wf-progress-indeterminate{width:35%!important;background:repeating-linear-gradient(45deg,var(--wf-ink-4) 0 6px,transparent 6px 12px)}',
  '.wf-progress-ring{width:40px;height:40px;display:block;fill:none;stroke-width:4}',
  '.wf-ring-track{stroke:var(--wf-line-2)}',
  '.wf-ring-value{stroke:var(--wf-ink-3);transform:rotate(-90deg);transform-origin:center;stroke-linecap:round}',
  '.wf-spinner{display:inline-block;width:16px;height:16px;border-radius:50%;'
    + 'border:2px solid var(--wf-line-2);border-top-color:var(--wf-ink-3);vertical-align:middle}',
  '.wf-spinner-sm{width:12px;height:12px;border-width:2px}',

  // --- Code ---
  '.wf-code[data-wf-frame="surface"]{padding:0;overflow:hidden}',
  '.wf-code pre{margin:0;padding:12px 14px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;'
    + 'font-size:12px;line-height:1.6;color:var(--wf-ink-2);background:var(--wf-fill-2)}',
  '.wf-mode-line .wf-code pre{background:transparent}',
  '.wf-code-lang{display:block;padding:4px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;'
    + 'color:var(--wf-ink-4);border-bottom:1px solid var(--wf-line-2)}',
  '.wf-code-inline code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;'
    + 'padding:1px 5px;background:var(--wf-fill);border:1px solid var(--wf-line-2);border-radius:3px}',

  // --- Divider ---
  '.wf-divider{display:flex;align-items:center;gap:12px;width:100%;margin:4px 0}',
  '.wf-rule{flex:1 1 auto;height:1px;background:var(--wf-line)}',
  '.wf-mode-line .wf-rule{background:transparent;border-top:1px dashed var(--wf-line-strong)}',
  '.wf-divider-label{font-size:11px;color:var(--wf-ink-4);text-transform:uppercase;letter-spacing:.06em;flex:0 0 auto}',
  '.wf-divider-vertical{flex-direction:column;width:auto;align-self:stretch;margin:0 4px}',
  '.wf-divider-vertical .wf-rule{width:1px;height:auto;flex:1 1 auto}',
  '.wf-spacer{flex:0 0 auto}',

  // --- Empty state ---
  '.wf-empty_state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;'
    + 'padding:40px 24px;text-align:center;min-height:180px}',
  '.wf-empty-glyph .wf-icon-glyph{font-size:28px;color:var(--wf-ink-4)}',
  '.wf-empty-title{font-size:15px;font-weight:600;color:var(--wf-ink)}',
  '.wf-empty-text{margin:0;font-size:13px;color:var(--wf-ink-3);max-width:46ch;line-height:1.5}',
  '.wf-empty_state .wf-act{margin-top:4px}',

  // --- Alert ---
  '.wf-alert{display:flex;align-items:flex-start;gap:12px;padding:12px 14px}',
  '.wf-mode-card .wf-alert[data-wf-frame="surface"]{background:var(--wf-fill-2);box-shadow:none;border-left-width:3px;border-left-color:var(--wf-ink-3)}',
  '.wf-mode-line .wf-alert[data-wf-frame="surface"]{outline-style:solid;outline-width:1px}',
  '.wf-alert-error[data-wf-frame="surface"],.wf-alert-warning[data-wf-frame="surface"]{border-left-width:4px;border-left-color:var(--wf-ink)}',
  '.wf-alert-glyph .wf-icon-glyph{font-size:17px;color:var(--wf-ink-2)}',
  '.wf-alert-body{flex:1 1 auto;min-width:0}',
  '.wf-alert-title{font-size:13px;font-weight:600;color:var(--wf-ink);line-height:1.4}',
  '.wf-alert-text{font-size:12px;color:var(--wf-ink-2);line-height:1.5}',
  '.wf-alert-close{background:none;border:none;font-size:16px;color:var(--wf-ink-4);cursor:pointer;line-height:1;padding:0 2px}',
  '.wf-alert-inline{padding:8px 10px}',
].join('\n');

module.exports = { contentStyles };
