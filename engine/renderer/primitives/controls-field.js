'use strict';

// The shared field contract (schema-systems.md §15.5): label, help, error,
// required, disabled and readonly. These are the label and help helpers every
// control already used, extended rather than wrapped in a new shell, so a
// control that uses only its older props renders the markup it always did,
// plus state and ARIA attributes.

function partId(node, part) {
  return `${String(node.id)}__${part}`;
}

/** The field states a control shows. A state is on only when it is `true`; `error` marks it invalid. */
function fieldState(props, lib) {
  return {
    disabled: props?.disabled === true,
    readonly: props?.readonly === true,
    required: props?.required === true,
    invalid: lib.str(props?.error) !== '',
  };
}

// Drawn inline in currentColor, so it shows even where the icon font is not
// loaded, as in the browser bundle's default mount.
const LOCK_GLYPH = '<svg viewBox="0 0 12 14" width="10" height="12" aria-hidden="true" focusable="false">'
  + '<path d="M3.5 6.5v-2a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  + '<rect x="1.5" y="6.5" width="9" height="6.5" rx="1.5" fill="currentColor"/></svg>';

/**
 * The lock after a read-only field's label, the cue every control shares.
 * Decorative: the control's own read-only state is what assistive tech reads.
 * Disabled wins, so a disabled field shows no lock.
 */
function readonlyLock(props) {
  return props?.readonly === true && props.disabled !== true
    ? `<span class="wf-field-lock" aria-hidden="true">${LOCK_GLYPH}</span>`
    : '';
}

/**
 * The visible label above a control; `required` adds the marker. `inputId`
 * associates a native control, `labelId` lets a group name itself with
 * aria-labelledby.
 */
function fieldLabel(props, ctx, lib, inputId, labelId) {
  const label = lib.str(props?.label);
  if (!label) return '';
  const required = `${props.required === true ? '<span class="wf-req">*</span>' : ''}${readonlyLock(props)}`;
  const forAttr = inputId ? ` for="${lib.escapeAttr(inputId)}"` : '';
  const idAttr = labelId ? ` id="${lib.escapeAttr(labelId)}"` : '';
  return `<label class="wf-field-label"${forAttr}${idAttr}>${lib.bound(label, ctx)}${required}</label>`;
}

/**
 * Help below the control, or the error that replaces it. Given the node, the
 * note gets the id the control's aria-describedby points at.
 */
function fieldHelp(props, ctx, lib, node) {
  const error = lib.str(props?.error);
  const help = lib.str(props?.help);
  const kind = error ? 'error' : 'help';
  const text = error || help;
  if (!text) return '';
  const idAttr = node ? ` id="${lib.escapeAttr(partId(node, kind))}"` : '';
  return `<span class="wf-field-${kind}"${idAttr}>${lib.bound(text, ctx)}</span>`;
}

/**
 * ` data-wf-value` with the value a drawn option submits, when it has a
 * `value` that differs from its label; otherwise the label is submitted.
 */
function optionValueAttr(option, lib) {
  const raw = option?.value;
  const value = ['string', 'number', 'boolean'].includes(typeof raw) ? String(raw).trim() : '';
  return value && value !== lib.str(option.label) ? ` data-wf-value="${lib.escapeAttr(value)}"` : '';
}

/** ` aria-describedby` naming `ids` and the help or error shown, or ''. */
function describedBy(props, lib, node, ids = []) {
  const all = [...ids];
  if (lib.str(props?.error)) all.push(partId(node, 'error'));
  else if (lib.str(props?.help)) all.push(partId(node, 'help'));
  return all.length > 0 ? ` aria-describedby="${lib.escapeAttr(all.join(' '))}"` : '';
}

module.exports = {
  partId,
  fieldState,
  fieldLabel,
  readonlyLock,
  fieldHelp,
  describedBy,
  optionValueAttr,
};
