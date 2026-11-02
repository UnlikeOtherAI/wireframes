'use strict';

// Greeked chart placeholders. Every shape is a pure function of the node id and
// the declared data, so the same YAML always produces the same SVG.

const SHAPES = new Set([
  'bar', 'vertical', 'horizontal', 'line', 'area',
  'pie', 'donut', 'gauge', 'sparkline', 'heatmap',
]);

const W = 320;
const H = 120;

function values(node, lib, count = 7) {
  const declared = Array.isArray(node.props?.data)
    ? node.props.data.map((entry) => lib.num(lib.isObject(entry) ? entry.value : entry, null)).filter((v) => v != null)
    : [];
  if (declared.length > 0) {
    const max = Math.max(...declared, 1);
    return declared.map((value) => value / max);
  }
  const seed = node.id || 'chart';
  return Array.from({ length: count }, (_, i) => 0.25 + lib.seeded(seed, i) * 0.7);
}

function bars(node, lib, horizontal) {
  const series = values(node, lib, horizontal ? 5 : 7);
  const gap = 6;
  if (horizontal) {
    const rowHeight = (H - gap * (series.length - 1)) / series.length;
    return series.map((value, i) => (
      `<rect class="wf-chart-bar" x="0" y="${(rowHeight + gap) * i}" width="${(value * W).toFixed(1)}" height="${rowHeight.toFixed(1)}" />`
    )).join('');
  }
  const barWidth = (W - gap * (series.length - 1)) / series.length;
  return series.map((value, i) => {
    const height = value * H;
    return `<rect class="wf-chart-bar" x="${((barWidth + gap) * i).toFixed(1)}" y="${(H - height).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}" />`;
  }).join('');
}

function points(series) {
  return series.map((value, i) => `${((i / (series.length - 1)) * W).toFixed(1)},${(H - value * H).toFixed(1)}`).join(' ');
}

function lineShape(node, lib, filled, seriesCount) {
  const count = Math.max(1, Math.min(4, seriesCount));
  return Array.from({ length: count }, (_, s) => {
    const series = values({ ...node, id: `${node.id || 'chart'}#${s}` }, lib, 9);
    const path = points(series);
    const area = filled
      ? `<polygon class="wf-chart-area" points="0,${H} ${path} ${W},${H}" />`
      : '';
    return `${area}<polyline class="wf-chart-line wf-series-${s}" points="${path}" />`;
  }).join('');
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const toXY = (angle) => [
    (cx + r * Math.cos((angle - 90) * (Math.PI / 180))).toFixed(2),
    (cy + r * Math.sin((angle - 90) * (Math.PI / 180))).toFixed(2),
  ];
  const [x1, y1] = toXY(startAngle);
  const [x2, y2] = toXY(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function pieShape(node, lib, donut) {
  const series = values(node, lib, 4);
  const total = series.reduce((sum, value) => sum + value, 0) || 1;
  const cx = W / 2;
  const cy = H / 2;
  const r = Math.min(cx, cy) - 4;
  let angle = 0;
  const slices = series.map((value, i) => {
    const sweep = (value / total) * 360;
    const path = arcPath(cx, cy, r, angle, angle + sweep);
    angle += sweep;
    return `<path class="wf-chart-slice wf-series-${i}" d="${path}" />`;
  }).join('');
  const hole = donut ? `<circle class="wf-chart-hole" cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(1)}" />` : '';
  return `${slices}${hole}`;
}

function gaugeShape(node, lib) {
  const value = Math.max(0, Math.min(1, values(node, lib, 1)[0]));
  const cx = W / 2;
  const cy = H - 10;
  const r = Math.min(cx, cy) - 10;
  // A half dial: 0 at the left, 1 at the right, sweeping over the top.
  const point = (fraction) => {
    const rad = Math.PI * (1 - fraction);
    return [(cx + r * Math.cos(rad)).toFixed(2), (cy - r * Math.sin(rad)).toFixed(2)];
  };
  const [sx, sy] = point(0);
  const [ex, ey] = point(1);
  const [vx, vy] = point(value);
  const track = `<path class="wf-chart-gauge-track" d="M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}" />`;
  const filled = value <= 0
    ? ''
    : `<path class="wf-chart-gauge-value" d="M ${sx} ${sy} A ${r} ${r} 0 0 1 ${vx} ${vy}" />`;
  return `${track}${filled}`;
}

function heatmapShape(node, lib) {
  const cols = 12;
  const rows = 5;
  const cell = W / cols;
  const rowHeight = H / rows;
  const seed = node.id || 'chart';
  const cells = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const level = Math.round(lib.seeded(seed, y * cols + x) * 4);
      cells.push(`<rect class="wf-heat wf-heat-${level}" x="${(x * cell).toFixed(1)}" y="${(y * rowHeight).toFixed(1)}" width="${(cell - 2).toFixed(1)}" height="${(rowHeight - 2).toFixed(1)}" />`);
    }
  }
  return cells.join('');
}

function axesShape() {
  return `<line class="wf-chart-axis" x1="0" y1="${H}" x2="${W}" y2="${H}" /><line class="wf-chart-axis" x1="0" y1="0" x2="0" y2="${H}" />`;
}

function renderChart(node, ctx, lib) {
  const props = node.props || {};
  const shape = SHAPES.has(props.chartType) ? props.chartType : 'bar';
  const seriesCount = lib.num(props.series, 1);

  let body;
  if (shape === 'bar' || shape === 'vertical') body = bars(node, lib, false);
  else if (shape === 'horizontal') body = bars(node, lib, true);
  else if (shape === 'line') body = lineShape(node, lib, false, seriesCount);
  else if (shape === 'area') body = lineShape(node, lib, true, seriesCount);
  else if (shape === 'pie') body = pieShape(node, lib, false);
  else if (shape === 'donut') body = pieShape(node, lib, true);
  else if (shape === 'gauge') body = gaugeShape(node, lib);
  else if (shape === 'heatmap') body = heatmapShape(node, lib);
  else body = lineShape(node, lib, false, 1);

  const wantsAxes = props.axes !== false && ['bar', 'vertical', 'horizontal', 'line', 'area'].includes(shape);
  const axes = wantsAxes ? axesShape() : '';

  if (shape === 'sparkline') {
    return {
      inner: `<svg class="wf-chart-svg wf-chart-sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`,
      className: 'wf-chart-sparkline-wrap',
    };
  }

  const title = lib.textProp(props, 'title', 'label');
  const heading = title ? `<div class="wf-chart-title">${lib.bound(title, ctx)}</div>` : '';
  const legend = props.legend === true
    ? `<div class="wf-chart-legend">${Array.from({ length: Math.max(1, Math.min(4, seriesCount)) }, (_, i) => (
      `<span class="wf-legend-key"><span class="wf-legend-swatch wf-series-${i}"></span>${lib.renderSkeleton(5)}</span>`
    )).join('')}</div>`
    : '';
  const height = lib.num(props.height, null);
  const heightStyle = height ? ` style="height:${height}px"` : '';

  return {
    inner: `${heading}<svg class="wf-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"${heightStyle}>${axes}${body}</svg>${legend}`,
    className: `wf-chart-${lib.toSafeClass(shape)}`,
  };
}

module.exports = { chartRenderers: { chart: renderChart } };
