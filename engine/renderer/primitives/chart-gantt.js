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

/** A staircase of greeked bars, a pure function of the node id. */
function seededRows(node, lib) {
  const seed = node.id || 'chart';
  return Array.from({ length: SEEDED_ROWS }, (_, i) => {
    const start = i * 12 + Math.round(lib.seeded(seed, i * 2) * 10);
    const length = 14 + Math.round(lib.seeded(seed, i * 2 + 1) * 24);
    return { label: '', tone: null, span: [start, start + length] };
  });
}

/** Smallest start to largest end; a zero-width domain is padded by ±1. */
function domainOf(rows) {
  let low = Infinity;
  let high = -Infinity;
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

/** Tick labels spaced evenly from the start of the domain to its end. */
function tickMarks(ticks) {
  const labels = (Array.isArray(ticks) ? ticks : [])
    .filter((tick) => typeof tick === 'string' || typeof tick === 'number')
    .map(String);
  return labels.map((label, i) => ({
    label,
    at: labels.length > 1 ? i / (labels.length - 1) : 0,
  }));
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
  const rows = Array.isArray(props.data) ? lib.items(props.data).map(ganttRow) : seededRows(node, lib);
  const domain = domainOf(rows);
  const marks = tickMarks(props.ticks);
  const grid = marks.length > 0
    ? `<div class="wf-gantt-grid" aria-hidden="true">${
      marks.map((mark) => `<span class="wf-gantt-gridline" style="left:${percent(mark.at)}"></span>`).join('')
    }</div>`
    : '';
  const body = rows.length > 0
    ? rows.map((row) => rowMarkup(row, domain, ctx, lib)).join('')
    : '<div class="wf-gantt-empty">No data</div>';
  const height = lib.num(props.height, null);
  const heightStyle = height ? ` style="height:${height}px"` : '';
  const axis = marks.length > 0
    ? `<div class="wf-gantt-axis">${marks.map((mark, i) => {
      const edge = i === 0 ? ' wf-gantt-tick-start' : (i === marks.length - 1 ? ' wf-gantt-tick-end' : '');
      return `<span class="wf-gantt-tick${edge}" style="left:${percent(mark.at)}">${lib.escapeHtml(mark.label)}</span>`;
    }).join('')}</div>`
    : '';
  return `<div class="wf-gantt"><div class="wf-gantt-plot"${heightStyle}><div class="wf-gantt-rows">${grid}${body}</div></div>${axis}</div>`;
}

module.exports = { ganttBody };
