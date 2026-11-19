'use strict';

// `chart` with `chartType: gantt`: labelled bars on one shared axis. It has its
// own data branch, so the series shapes in chart.js never see gantt data.
// Rows are HTML rather than SVG so a narrow chart can ellipsize its labels.

const TONES = new Set(['info', 'success', 'warning', 'danger']);
const SEEDED_ROWS = 5;

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A row with `start` and `end` numbers gets a bar; reversed endpoints are swapped. */
function ganttRow(entry) {
  const start = finite(entry.start);
  const end = finite(entry.end);
  const span = start == null || end == null ? null : [Math.min(start, end), Math.max(start, end)];
  return { label: entry.label, tone: entry.tone, span };
}

/**
 * A staircase of greeked bars, a pure function of the node id. With ticks it
 * is drawn across the ticks' bands.
 */
function seededRows(node, lib, bands) {
  const seed = node.id || 'chart';
  const rows = Array.from({ length: SEEDED_ROWS }, (_, i) => {
    const start = i * 12 + Math.round(lib.seeded(seed, i * 2) * 10);
    const length = 14 + Math.round(lib.seeded(seed, i * 2 + 1) * 24);
    return { label: '', tone: null, span: [start, start + length] };
  });
  if (bands === 0) return rows;
  const scale = bands / Math.max(...rows.map((row) => row.span[1]));
  return rows.map((row) => ({ ...row, span: row.span.map((at) => at * scale) }));
}

/**
 * Smallest start to largest end. With ticks the axis also spans every tick's
 * band, from 0 to the tick count. A zero-width domain is padded by ±1.
 */
function domainOf(rows, bands) {
  let low = bands > 0 ? 0 : Infinity;
  let high = bands > 0 ? bands : -Infinity;
  for (const row of rows) {
    if (!row.span) continue;
    if (row.span[0] < low) low = row.span[0];
    if (row.span[1] > high) high = row.span[1];
  }
  if (low > high) return [-1, 1];
  return high === low ? [low - 1, high + 1] : [low, high];
}

/**
 * A bar's left edge and width as fractions of the domain. A domain wider than
 * the largest double is measured in halves, and one that padding could not
 * widen (huge equal endpoints) puts its bars in the middle.
 */
function placeBar([start, end], [low, high]) {
  const width = high - low;
  if (!(width > 0)) return { left: 0.5, width: 0 };
  if (Number.isFinite(width)) return { left: (start - low) / width, width: (end - start) / width };
  const half = high / 2 - low / 2;
  return { left: (start / 2 - low / 2) / half, width: (end / 2 - start / 2) / half };
}

function percent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Tick labels on the bars' scale: tick i names the band from i to i+1, so
 * `start: 0, end: 1` fills the first tick's band exactly.
 */
function tickLabels(ticks) {
  return (Array.isArray(ticks) ? ticks : [])
    .filter((tick) => typeof tick === 'string' || typeof tick === 'number')
    .map(String);
}

function rowMarkup(row, domain, ctx, lib) {
  const label = lib.str(row.label);
  const tone = TONES.has(row.tone) ? ` wf-tone-${row.tone}` : '';
  const place = row.span ? placeBar(row.span, domain) : null;
  const bar = place
    ? `<span class="wf-gantt-bar${tone}" style="left:${percent(place.left)};width:${percent(place.width)}"></span>`
    : '';
  return `<div class="wf-gantt-row"><span class="wf-gantt-label">${
    label ? lib.bound(label, ctx) : lib.renderSkeleton(8)
  }</span><span class="wf-gantt-track">${bar}</span></div>`;
}

/**
 * The gantt body. No `data` draws seeded bars, like the other chart types;
 * `data: []` draws the empty state. The chart grows one fixed-height row at a
 * time unless `height` fixes the plot, which then scrolls.
 */
function ganttBody(node, ctx, lib) {
  const props = node.props || {};
  const labels = tickLabels(props.ticks);
  const rows = Array.isArray(props.data) ? lib.items(props.data).map(ganttRow) : seededRows(node, lib, labels.length);
  const domain = domainOf(rows, labels.length);
  // A gridline at each band's edge, 0 to the tick count.
  const grid = labels.length > 0
    ? `<div class="wf-gantt-grid" aria-hidden="true">${
      Array.from({ length: labels.length + 1 }, (_, i) => (
        `<span class="wf-gantt-gridline" style="left:${percent(placeBar([i, i], domain).left)}"></span>`
      )).join('')
    }</div>`
    : '';
  const body = rows.length > 0
    ? rows.map((row) => rowMarkup(row, domain, ctx, lib)).join('')
    : '<div class="wf-gantt-empty">No data</div>';
  const height = lib.num(props.height, null);
  const heightStyle = height ? ` style="height:${height}px"` : '';
  // Each label is centred in its own band and ends in an ellipsis if it is wider.
  const axis = labels.length > 0
    ? `<div class="wf-gantt-axis">${labels.map((label, i) => {
      const band = placeBar([i, i + 1], domain);
      return `<span class="wf-gantt-tick" style="left:${percent(band.left)};width:${percent(band.width)}">${lib.escapeHtml(label)}</span>`;
    }).join('')}</div>`
    : '';
  return `<div class="wf-gantt"><div class="wf-gantt-plot"${heightStyle}><div class="wf-gantt-rows">${grid}${body}</div></div>${axis}</div>`;
}

module.exports = { ganttBody };
