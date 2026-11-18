'use strict';

// `input` `min`, `max` and `step` for number, range and stepper (component
// library design §4.5). These controls are drawn, not interactive: bounds
// place and clamp the value, `step` sets how many decimals it shows, and
// nothing ever snaps to a step.

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
// A range with no value keeps the thumb where it always sat.
const DEFAULT_THUMB = 40;

/** A number from a prop, resolving `{{props.x}}`-style templates first. Blank or non-finite is null. */
function numberOf(raw, ctx, lib) {
  if (raw === undefined) return null;
  if (typeof raw === 'string' && raw.includes('{{')) {
    const text = lib.resolveAttributeValue(raw, ctx.bindingContext || {}, null, '').trim();
    return text === '' ? null : lib.num(text, null);
  }
  return lib.num(raw, null);
}

/** `{ min, max, authored }`, with 0 and 100 filling a missing bound and reversed bounds swapped. */
function readBounds(props, ctx, lib) {
  const low = props.min == null ? null : numberOf(props.min, ctx, lib);
  const high = props.max == null ? null : numberOf(props.max, ctx, lib);
  const min = low == null ? DEFAULT_MIN : low;
  const max = high == null ? DEFAULT_MAX : high;
  return { min: Math.min(min, max), max: Math.max(min, max), authored: low != null || high != null };
}

function clamp(value, bounds) {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

/** Where a value sits along the track, 0 to 100. Equal bounds put it at the start. */
function percent(value, bounds) {
  if (bounds.max === bounds.min) return 0;
  if (bounds.min === 0 && bounds.max === 100) return value;
  return round(((value - bounds.min) / (bounds.max - bounds.min)) * 100);
}

function decimals(value) {
  const text = String(value);
  if (/e-/i.test(text)) return Math.min(20, Number(text.split(/e-/i)[1]) || 0);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** A value shown with at least as many decimals as `step`, never fewer than it has. */
function formatValue(value, step) {
  if (step == null) return String(value);
  return value.toFixed(Math.min(20, Math.max(decimals(step), decimals(value))));
}

/**
 * The thumbs a range draws, as track percentages: one, or two for a
 * `value` of exactly two finite numbers. A value that is missing or
 * unreadable keeps the default thumb.
 */
function rangeThumbs(props, ctx, lib) {
  const bounds = readBounds(props, ctx, lib);
  const raw = props.value;
  if (Array.isArray(raw)) {
    const pair = raw.length === 2 ? raw.map((entry) => numberOf(entry, ctx, lib)) : [];
    if (pair.length !== 2 || pair.some((entry) => entry == null)) return [DEFAULT_THUMB];
    return pair.sort((a, b) => a - b).map((entry) => percent(clamp(entry, bounds), bounds));
  }
  const value = numberOf(raw, ctx, lib);
  return [value == null ? DEFAULT_THUMB : percent(clamp(value, bounds), bounds)];
}

/**
 * The value a number or stepper shows. Bounds apply only when the author set
 * `min` or `max`, so older fields keep any value they had.
 */
function displayNumber(text, props, ctx, lib) {
  const bounds = readBounds(props, ctx, lib);
  const step = props.step == null ? null : numberOf(props.step, ctx, lib);
  const value = text.trim() === '' ? null : lib.num(text, null);
  if (value == null || (!bounds.authored && step == null)) return { text, value, bounds, step };
  const shown = bounds.authored ? clamp(value, bounds) : value;
  return { text: formatValue(shown, step), value: shown, bounds, step };
}

module.exports = {
  readBounds,
  rangeThumbs,
  displayNumber,
  numberOf,
  round,
};
