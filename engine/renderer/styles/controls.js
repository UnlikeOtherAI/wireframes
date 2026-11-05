'use strict';

const controlStyles = [
  // --- Buttons ---
  '.wf-button{width:fit-content;max-width:100%}',
  '.wf-button button,.wf-button .wf-button-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;'
    + 'min-height:var(--wf-control-h,36px);min-width:88px;padding:7px 16px;font:inherit;font-size:13px;font-weight:500;'
    + 'line-height:1.2;white-space:nowrap;cursor:pointer;text-decoration:none}',
  '.wf-button-sm button,.wf-button-sm .wf-button-link{min-height:32px;min-width:64px;padding:5px 12px;font-size:12px}',
  '.wf-button-lg button,.wf-button-lg .wf-button-link{min-height:44px;min-width:104px;padding:10px 20px;font-size:14px}',
  '.wf-button.wf-button-icon button,.wf-button.wf-button-icon .wf-button-link{min-width:var(--wf-control-h,36px);padding:0 8px}',
  '.wf-button.wf-button-fab button,.wf-button.wf-button-fab .wf-button-link{width:52px;height:52px;min-width:52px;border-radius:50%;padding:0}',
  '.wf-button-disabled{opacity:.5}',
  '.wf-mode-line .wf-button button,.wf-mode-line .wf-button .wf-button-link{background:transparent;border:1px solid var(--wf-line-strong);color:var(--wf-ink);border-radius:0}',
  '.wf-mode-line .wf-button-primary button,.wf-mode-line .wf-button-primary .wf-button-link{border-width:2px}',
  '.wf-mode-line .wf-button-link button,.wf-mode-line .wf-button-link .wf-button-link{border:none;text-decoration:underline;min-width:0;padding:0}',
  '.wf-mode-card .wf-button button,.wf-mode-card .wf-button .wf-button-link{background:var(--wf-line-2);border:1px solid transparent;color:var(--wf-ink-2);border-radius:var(--wf-corner-radius,6px)}',
  '.wf-mode-card .wf-button-primary button,.wf-mode-card .wf-button-primary .wf-button-link{background:#1f2937;color:#ffffff}',
  // Destructive: the hue is the whole signal, so a wireframe reader never
  // mistakes Delete for Cancel. Outline, never a filled red button.
  '.wf-button-danger{--wf-tone:var(--wf-danger)}',
  '.wf-mode-card .wf-button-danger button,.wf-mode-card .wf-button-danger .wf-button-link{background:#ffffff;color:var(--wf-tone);border-color:var(--wf-tone);border-width:1px}',
  '.wf-mode-line .wf-button-danger button,.wf-mode-line .wf-button-danger .wf-button-link{color:var(--wf-tone);border-color:var(--wf-tone)}',
  '.wf-mode-card .wf-button-ghost button,.wf-mode-card .wf-button-ghost .wf-button-link{background:transparent;color:var(--wf-ink-2)}',
  '.wf-mode-card .wf-button-link button,.wf-mode-card .wf-button-link .wf-button-link{background:transparent;color:var(--wf-ink);text-decoration:underline;min-width:0;padding:0}',

  '.wf-button button .wf-icon-glyph,.wf-button .wf-button-link .wf-icon-glyph{color:inherit}',

  // --- Segmented control ---
  '.wf-segmented{display:inline-flex;align-items:stretch;width:fit-content;border-radius:var(--wf-corner-radius,6px);overflow:hidden}',
  '.wf-mode-line .wf-segmented{border:1px solid var(--wf-line-strong);border-radius:0}',
  '.wf-mode-card .wf-segmented{border:1px solid var(--wf-line);background:var(--wf-fill-2)}',
  '.wf-segment{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:6px 14px;font:inherit;font-size:13px;'
    + 'background:transparent;border:none;cursor:pointer;color:var(--wf-choice-ink,var(--wf-ink-3));white-space:nowrap}',
  '.wf-segment+.wf-segment{border-left:1px solid var(--wf-line)}',
  '.wf-mode-line .wf-segment+.wf-segment{border-left-color:var(--wf-line-strong)}',
  '.wf-segment-on{background:#ffffff;color:var(--wf-choice-accent,var(--wf-ink));font-weight:600}',
  '.wf-mode-line .wf-segment-on{background:var(--wf-fill)}',
  '.wf-segmented-lg .wf-segment{min-height:40px}',

  // --- Fields ---
  '.wf-field{width:100%;min-width:0}',
  '.wf-field-label{display:block;margin:0 0 5px;color:var(--wf-ink-2);font-size:12px;font-weight:500;line-height:1.3}',
  '.wf-req{color:var(--wf-ink-3);margin-left:2px}',
  '.wf-field-help{display:block;margin-top:4px;font-size:11px;color:var(--wf-ink-3);line-height:1.4}',
  '.wf-field-error{display:block;margin-top:4px;font-size:11px;color:var(--wf-danger);font-weight:500;line-height:1.4}',
  '.wf-field-error:before{content:"! ";font-weight:700}',
  '.wf-field-count{display:block;margin-top:4px;font-size:11px;color:var(--wf-ink-4);text-align:right}',
  '.wf-control{display:flex;align-items:center;gap:0;width:100%;min-width:0;overflow:hidden}',
  '.wf-control input,.wf-control select,.wf-textarea textarea{flex:1 1 auto;width:100%;min-width:0;font:inherit;font-size:13px;'
    + 'color:var(--wf-ink);background:transparent;border:none;outline:none;padding:0 12px;min-height:var(--wf-control-h,36px)}',
  '.wf-textarea textarea{padding:10px 12px;min-height:72px;resize:vertical;line-height:1.5;display:block}',
  '.wf-control input::placeholder,.wf-textarea textarea::placeholder{color:var(--wf-ink-4)}',
  '.wf-affix{display:inline-flex;align-items:center;justify-content:center;padding:0 10px;color:var(--wf-ink-4);font-size:12px;flex:0 0 auto}',
  '.wf-affix-start+input,.wf-affix-start+select{padding-left:0}',
  '.wf-mode-line .wf-control,.wf-mode-line .wf-textarea textarea{border:1px solid var(--wf-line-strong);background:transparent;border-radius:0}',
  '.wf-mode-card .wf-control,.wf-mode-card .wf-textarea textarea{border:1px solid var(--wf-line);background:#ffffff;border-radius:var(--wf-corner-radius,6px)}',
  // Invalid: a red edge plus the heavier border, so the state survives greyscale.
  '.wf-field-invalid{--wf-tone:var(--wf-danger)}',
  '.wf-field-invalid .wf-control,.wf-field-invalid textarea{border-color:var(--wf-tone);border-width:2px}',
  '.wf-select-searchable .wf-control select{padding-left:0}',

  '.wf-control-center{position:relative}',
  '.wf-control-center input{padding-inline-start:36px}',
  '.wf-affix-center{position:absolute;inset:0;gap:6px;pointer-events:none;justify-content:center}',
  '.wf-input-placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 44px)}',
  '.wf-control-center:not(:focus-within):has(input:placeholder-shown) input::placeholder{color:transparent}',
  '.wf-control-center:focus-within .wf-affix-center,.wf-control-center:not(:has(input:placeholder-shown)) .wf-affix-center{inset-inline-start:0;inset-inline-end:auto}',
  '.wf-control-center:focus-within .wf-input-placeholder,.wf-control-center:not(:has(input:placeholder-shown)) .wf-input-placeholder{display:none}',

  // --- Special inputs ---
  '.wf-otp{display:flex;gap:8px}',
  '.wf-otp-box{width:38px;height:44px;border:1px solid var(--wf-line);border-radius:var(--wf-corner-radius,6px);background:#ffffff}',
  '.wf-mode-line .wf-otp-box{border-color:var(--wf-line-strong);border-radius:0;background:transparent}',
  '.wf-range{position:relative;display:block;padding:14px 0 6px}',
  '.wf-range-track{display:block;height:4px;border-radius:2px;background:var(--wf-line-2)}',
  '.wf-range-fill{display:block;height:100%;border-radius:2px;background:var(--wf-ink-3)}',
  '.wf-range-thumb{position:absolute;top:9px;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#ffffff;border:1px solid var(--wf-ink-3)}',
  '.wf-color{display:flex;align-items:center;gap:0;border:1px solid var(--wf-line);border-radius:var(--wf-corner-radius,6px);overflow:hidden;background:#ffffff}',
  '.wf-mode-line .wf-color{border-color:var(--wf-line-strong);border-radius:0;background:transparent}',
  '.wf-color input[type=color]{width:36px;height:34px;flex:0 0 36px;padding:3px;cursor:pointer}',
  '.wf-color input{border:none;outline:none;font:inherit;font-size:13px;padding:0 10px;min-height:34px;background:transparent;width:100%}',

  '@media(pointer:coarse){.wf-segmented .wf-segment,.wf-color input{min-height:44px}.wf-segment{min-width:44px}.wf-color input[type=color]{width:44px;height:44px;flex-basis:44px}}',

  // --- Choices ---
  '.wf-choice{display:inline-flex;align-items:flex-start;gap:9px;cursor:pointer;min-height:22px}',
  '.wf-choice-text{display:inline-flex;flex-direction:column;gap:1px;min-width:0}',
  '.wf-choice-label{font-size:13px;color:var(--wf-ink-2);line-height:1.4}',
  '.wf-choice-desc{font-size:11px;color:var(--wf-ink-3);line-height:1.4}',
  '.wf-choice-disabled{opacity:.5}',
  '.wf-choice-list{display:flex;flex-direction:column;gap:9px}',
  '.wf-choice-inline{flex-direction:row;flex-wrap:wrap;gap:16px}',
  '.wf-check-mark{display:inline-block;width:16px;height:16px;flex:0 0 auto;margin-top:2px;'
    + 'border:1px solid var(--wf-ink-3);border-radius:3px;background:#ffffff;position:relative}',
  '.wf-radio-mark{display:inline-block;width:16px;height:16px;flex:0 0 auto;margin-top:2px;'
    + 'border:1px solid var(--wf-ink-3);border-radius:50%;background:#ffffff;position:relative}',
  '.wf-choice-on .wf-check-mark,.wf-check-on{background:var(--wf-ink);border-color:var(--wf-ink)}',
  '.wf-choice-on .wf-check-mark:after,.wf-check-on:after{content:"";position:absolute;left:5px;top:1px;width:4px;height:9px;'
    + 'border:solid #ffffff;border-width:0 2px 2px 0;transform:rotate(45deg)}',
  '.wf-choice-on .wf-radio-mark:after{content:"";position:absolute;left:3px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--wf-ink)}',
  '.wf-toggle-track{display:inline-block;width:36px;height:20px;flex:0 0 auto;margin-top:1px;position:relative;'
    + 'border:1px solid var(--wf-ink-3);border-radius:10px;background:var(--wf-line-2)}',
  '.wf-mode-line .wf-toggle-track{background:transparent;border-color:var(--wf-line-strong)}',
  '.wf-toggle-thumb{position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#ffffff;border:1px solid var(--wf-line)}',
  '.wf-toggle-on{background:var(--wf-ink);border-color:var(--wf-ink)}',
  '.wf-toggle-on .wf-toggle-thumb{left:auto;right:2px;border-color:var(--wf-ink)}',

  // --- Tags input ---
  '.wf-tags{flex-wrap:wrap;gap:6px;padding:6px 8px;min-height:var(--wf-control-h,36px)}',
  '.wf-tags input{min-height:22px;padding:0 2px;flex:1 1 80px}',
  '.wf-tag{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;font-size:12px;color:var(--wf-ink-2);'
    + 'background:var(--wf-fill);border:1px solid var(--wf-line);border-radius:10px}',
  '.wf-mode-line .wf-tag{background:transparent;border-color:var(--wf-line-strong);border-radius:0}',
  '.wf-tag-x{color:var(--wf-ink-4)}',

  // --- Upload ---
  '.wf-upload{display:flex;flex-direction:column;align-items:center;gap:6px;padding:24px;text-align:center}',
  '.wf-mode-line .wf-upload[data-wf-frame="surface"]{outline-style:dashed}',
  '.wf-mode-card .wf-upload[data-wf-frame="surface"]{border-style:dashed;border-color:var(--wf-line);box-shadow:none;background:var(--wf-fill-2)}',
  '.wf-upload-glyph .wf-icon-glyph{font-size:24px;color:var(--wf-ink-4)}',
  '.wf-upload-label{font-size:13px;font-weight:500;color:var(--wf-ink-2)}',
  '.wf-upload-hint{font-size:11px;color:var(--wf-ink-4)}',
  '.wf-upload-files{display:flex;flex-direction:column;gap:4px;margin-top:8px;width:100%}',
  '.wf-upload-file{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--wf-ink-2)}',
  '.wf-upload-button{display:flex;align-items:center;gap:8px}',

  // --- Numeric stepper ---
  '.wf-numstepper{display:inline-flex;align-items:center;overflow:hidden;border:1px solid var(--wf-line);'
    + 'border-radius:var(--wf-corner-radius,6px);background:#ffffff;width:fit-content}',
  '.wf-mode-line .wf-numstepper{border-color:var(--wf-line-strong);border-radius:0;background:transparent}',
  '.wf-numstepper-btn{min-width:36px;min-height:var(--wf-control-h,36px);font:inherit;font-size:15px;'
    + 'background:var(--wf-fill-2);border:none;color:var(--wf-ink-2);cursor:pointer}',
  '.wf-numstepper-value{min-width:48px;padding:0 10px;text-align:center;font-size:13px;color:var(--wf-ink)}',

  // --- Wheel picker ---
  '.wf-picker{padding:0}',
  '.wf-picker-wheel{position:relative;display:flex;flex-direction:column;align-items:center;'
    + 'padding:6px 0;overflow:hidden;-webkit-mask-image:linear-gradient(transparent,#000 28%,#000 72%,transparent)}',
  '.wf-picker-row{display:block;padding:5px 0;font-size:14px;color:var(--wf-ink-4);line-height:1.5}',
  '.wf-picker-on{color:var(--wf-ink);font-weight:600;font-size:16px}',
  '.wf-picker-window{position:absolute;left:8px;right:8px;top:50%;height:32px;margin-top:-16px;'
    + 'border-top:1px solid var(--wf-line);border-bottom:1px solid var(--wf-line);pointer-events:none}',

  // --- Rich text editor ---
  '.wf-editor-toolbar{display:flex;align-items:center;gap:2px;padding:6px 8px;border-bottom:1px solid var(--wf-line-2)}',
  '.wf-mode-line .wf-editor-toolbar{border-bottom-color:var(--wf-line-strong)}',
  '.wf-editor-tool{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;color:var(--wf-ink-3)}',
  '.wf-editor-body{padding:12px}',
  '@media(any-pointer:coarse){.wf-page .wf-button button,.wf-page .wf-button .wf-button-link{min-height:44px;min-width:44px}}',
].join('\n');

module.exports = { controlStyles };
