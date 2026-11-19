'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { PRIMITIVE_RENDERERS } = require('@wireframes/engine/renderer/primitives/index');
const { renderNode } = require('@wireframes/engine/renderer/primitives');
const { getPrimitive } = require('@wireframes/engine/schema/primitive-registry');

function gantt(props, id = 'plan') {
  return PRIMITIVE_RENDERERS.chart({ id, component: 'chart', props: { chartType: 'gantt', ...props } }, { bindingContext: {} }, lib);
}

function bars(markup) {
  return [...markup.matchAll(/<span class="wf-gantt-bar([^"]*)" style="left:([\d.-]+)%;width:([\d.-]+)%"><\/span>/g)]
    .map((m) => ({ tone: m[1].trim(), left: Number(m[2]), width: Number(m[3]) }));
}

function rows(markup) {
  return [...markup.matchAll(/<div class="wf-gantt-row">(.*?)<\/div>/g)].map((m) => m[1]);
}

function ticks(markup) {
  return [...markup.matchAll(/<span class="wf-gantt-tick" style="left:([\d.]+)%;width:([\d.]+)%">(.*?)<\/span>/g)]
    .map((m) => ({ left: Number(m[1]), width: Number(m[2]), label: m[3] }));
}

function gridlines(markup) {
  return [...markup.matchAll(/wf-gantt-gridline" style="left:([\d.]+)%/g)].map((m) => Number(m[1]));
}

// The iPad's roadmap, as written: four ticks, one bar per quarter.
const ROADMAP = {
  title: 'Release Timeline',
  ticks: ['Q1', 'Q2', 'Q3', 'Q4'],
  data: [
    { label: 'Feature Alpha', start: 0, end: 1 },
    { label: 'Feature Beta', start: 1, end: 2 },
    { label: 'Feature Release', start: 2, end: 3 },
    { label: 'Feature Final', start: 3, end: 4 },
  ],
};

test('gantt is a chartType with its own ticks prop; series data is untouched', () => {
  const props = getPrimitive('chart').props;
  assert.ok(props.chartType.enum.includes('gantt'));
  assert.deepEqual(props.ticks, { type: 'array' });
  assert.deepEqual(props.data, { type: 'array' });
  assert.equal(gantt({}).className, 'wf-chart-gantt');
});

test('the domain runs from the smallest start to the largest end', () => {
  const markup = gantt({ data: [
    { label: 'Design', start: 10, end: 30 },
    { label: 'Build', start: 20, end: 50 },
    { label: 'Ship', start: 45, end: 60, tone: 'success' },
  ] }).inner;
  assert.deepEqual(bars(markup), [
    { tone: '', left: 0, width: 40 },
    { tone: '', left: 20, width: 60 },
    { tone: 'wf-tone-success', left: 70, width: 30 },
  ]);
  assert.deepEqual(rows(markup).map((row) => row.match(/wf-gantt-label">(.*?)<\/span>/)[1]), ['Design', 'Build', 'Ship']);
});

test('reversed endpoints are swapped', () => {
  assert.deepEqual(bars(gantt({ data: [{ label: 'A', start: 0, end: 10 }, { label: 'B', start: 10, end: 5 }] }).inner), [
    { tone: '', left: 0, width: 100 },
    { tone: '', left: 50, width: 50 },
  ]);
});

test('a zero-width domain is padded by one on each side', () => {
  assert.deepEqual(bars(gantt({ data: [{ label: 'Milestone', start: 7, end: 7 }] }).inner), [{ tone: '', left: 50, width: 0 }]);
  assert.deepEqual(bars(gantt({ data: [{ label: 'A', start: 3, end: 3 }, { label: 'B', start: 3, end: 3 }] }).inner), [
    { tone: '', left: 50, width: 0 },
    { tone: '', left: 50, width: 0 },
  ]);
});

test('only finite numbers place a bar; other rows keep their label', () => {
  const markup = gantt({ data: [
    { label: 'Placed', start: 0, end: 4 },
    { label: 'No end', start: 2 },
    { label: 'Strings', start: '1', end: '3' },
    { label: 'Infinite', start: 0, end: Infinity },
    'Scalar row',
  ] }).inner;
  assert.equal(rows(markup).length, 5);
  assert.deepEqual(bars(markup), [{ tone: '', left: 0, width: 100 }]);
  assert.match(markup, /wf-gantt-label">Scalar row</);
});

test('unknown tones add no class; blank labels draw a skeleton', () => {
  const markup = gantt({ data: [{ start: 0, end: 1, tone: 'pink' }, { label: '  ', start: 0, end: 1, tone: 'warning' }] }).inner;
  assert.deepEqual(bars(markup).map((bar) => bar.tone), ['', 'wf-tone-warning']);
  assert.equal(rows(markup).filter((row) => row.includes(lib.renderSkeleton(8))).length, 2);
});

test('tick i names the band from i to i+1, so each roadmap bar fills one quarter', () => {
  const markup = gantt(ROADMAP).inner;
  assert.deepEqual(bars(markup).map(({ left, width }) => [left, width]), [[0, 25], [25, 25], [50, 25], [75, 25]]);
  assert.deepEqual(ticks(markup), [
    { left: 0, width: 25, label: 'Q1' },
    { left: 25, width: 25, label: 'Q2' },
    { left: 50, width: 25, label: 'Q3' },
    { left: 75, width: 25, label: 'Q4' },
  ]);
  // A gridline at every band edge: the bars start and end on them.
  assert.deepEqual(gridlines(markup), [0, 25, 50, 75, 100]);
});

test('with ticks the domain runs from 0 to the tick count, widened only by bars outside it', () => {
  // A quarter with no work keeps its band.
  const sparse = gantt({ ticks: ['Q1', 'Q2', 'Q3', 'Q4'], data: [{ label: 'A', start: 1, end: 2 }] }).inner;
  assert.deepEqual(bars(sparse).map(({ left, width }) => [left, width]), [[25, 25]]);
  assert.deepEqual(gridlines(sparse), [0, 25, 50, 75, 100]);
  // A bar past the last tick widens the axis; the bands keep their place on the scale.
  const past = gantt({ ticks: ['W1', 'W2'], data: [{ label: 'A', start: -1, end: 3 }] }).inner;
  assert.deepEqual(bars(past).map(({ left, width }) => [left, width]), [[0, 100]]);
  assert.deepEqual(ticks(past).map(({ left, width }) => [left, width]), [[25, 25], [50, 25]]);
  assert.deepEqual(gridlines(past), [25, 50, 75]);
  assert.deepEqual(ticks(gantt({ ticks: ['Only'] }).inner), [{ left: 0, width: 100, label: 'Only' }]);
  // Numbers are labels too; anything else is skipped. Labels are escaped.
  assert.deepEqual(ticks(gantt({ ticks: [0, null, '<b>', { x: 1 }] }).inner).map((tick) => tick.label), ['0', '&lt;b&gt;']);
  assert.doesNotMatch(gantt({}).inner, /wf-gantt-axis|wf-gantt-grid/);
});

test('without ticks the domain still runs from the smallest start to the largest end', () => {
  assert.deepEqual(bars(gantt({ data: [{ label: 'A', start: 10, end: 20 }, { label: 'B', start: 15, end: 30 }] }).inner)
    .map(({ left, width }) => [Number(left.toFixed(2)), Number(width.toFixed(2))]), [[0, 50], [25, 75]]);
});

test('seeded bars with ticks span the bands of the ticks', () => {
  const seeded = gantt({ ticks: ['Q1', 'Q2', 'Q3', 'Q4'] }).inner;
  assert.equal(bars(seeded).length, 5);
  assert.ok(bars(seeded).every((bar) => bar.left >= 0 && bar.left + bar.width <= 100.01));
  assert.ok(Math.max(...bars(seeded).map((bar) => bar.left + bar.width)) > 99, 'the staircase reaches the last band');
  assert.deepEqual(gridlines(seeded), [0, 25, 50, 75, 100]);
});

test('rows are fixed-height: the chart grows with its rows unless height is set', () => {
  const tall = gantt({ data: Array.from({ length: 12 }, (_, i) => ({ label: `Task ${i}`, start: i, end: i + 3 })) }).inner;
  assert.equal(rows(tall).length, 12);
  assert.match(tall, /<div class="wf-gantt-plot"><div class="wf-gantt-rows">/);
  assert.match(gantt({ height: 90, data: [{ label: 'A', start: 0, end: 1 }] }).inner, /<div class="wf-gantt-plot" style="height:90px">/);
});

test('without data it draws deterministic seeded bars; data: [] draws the empty state', () => {
  const seeded = gantt({}).inner;
  assert.equal(bars(seeded).length, 5);
  assert.equal(seeded, gantt({}).inner, 'same input, same output');
  assert.notEqual(seeded, gantt({}, 'another_plan').inner, 'the seed is the node id');
  assert.equal(rows(seeded).every((row) => row.includes(lib.renderSkeleton(8))), true);
  assert.ok(bars(seeded).every((bar) => bar.left >= 0 && bar.left + bar.width <= 100.01));

  for (const empty of [[], [null, true, ['x']]]) {
    const markup = gantt({ data: empty, ticks: ['Q1', 'Q2'] }).inner;
    assert.match(markup, /<div class="wf-gantt-empty">No data<\/div>/);
    assert.equal(rows(markup).length, 0);
    assert.equal(ticks(markup).length, 2);
  }
});

test('gantt rendering is a pure function of its input', () => {
  const props = { title: 'Roadmap', legend: true, ticks: ['W1', 'W2', 'W3'], data: [{ label: 'Spec', start: 1, end: 4, tone: 'info' }, { label: 'Build', start: 3, end: 9 }] };
  const node = { id: 'roadmap', component: 'chart', props: { chartType: 'gantt', ...props } };
  const first = renderNode(node);
  assert.equal(renderNode(JSON.parse(JSON.stringify(node))), first);
  assert.deepEqual(node.props.data[0], { label: 'Spec', start: 1, end: 4, tone: 'info' }, 'input is not mutated');
  assert.match(first, /<div class="wf-chart-title">Roadmap<\/div><div class="wf-gantt">/);
  assert.match(first, /<\/div><div class="wf-chart-legend">/);
  assert.doesNotMatch(first, /<svg/);
});

test('other chart types ignore ticks and keep their SVG output', () => {
  const props = { chartType: 'bar', data: [3, 5, 2] };
  const plain = PRIMITIVE_RENDERERS.chart({ id: 'c', props }, { bindingContext: {} }, lib).inner;
  const withTicks = PRIMITIVE_RENDERERS.chart({ id: 'c', props: { ...props, ticks: ['a', 'b'] } }, { bindingContext: {} }, lib).inner;
  assert.equal(withTicks, plain);
  assert.match(plain, /^<svg class="wf-chart-svg"/);
});

test('huge finite endpoints keep finite coordinates', () => {
  // 1e30 ± 1 is 1e30, so padding cannot widen this domain: the bar sits in the middle, as a small milestone does.
  assert.deepEqual(bars(gantt({ data: [{ label: 'Far', start: 1e30, end: 1e30 }] }).inner), [{ tone: '', left: 50, width: 0 }]);
  // A domain wider than the largest double still places bars proportionally.
  assert.deepEqual(bars(gantt({ data: [
    { label: 'Low', start: -Number.MAX_VALUE, end: 0 },
    { label: 'High', start: 0, end: Number.MAX_VALUE },
  ] }).inner), [{ tone: '', left: 0, width: 50 }, { tone: '', left: 50, width: 50 }]);
  assert.deepEqual(bars(gantt({ data: [{ label: 'Wide', start: -1e308, end: 1e308 }, { label: 'Mid', start: 0, end: 5e307 }] }).inner), [
    { tone: '', left: 0, width: 100 },
    { tone: '', left: 50, width: 25 },
  ]);
  assert.doesNotMatch(gantt({ data: [{ label: 'Far', start: 1e30, end: 1e30 }, { label: 'Wide', start: -1e308, end: 1e308 }] }).inner, /NaN|Infinity/);
});

test('a large data set finds its domain without spreading arguments', () => {
  const data = Array.from({ length: 200000 }, (_, i) => ({ label: 'T', start: i, end: i + 1 }));
  const markup = gantt({ data }).inner;
  const placed = bars(markup);
  assert.equal(placed.length, 200000);
  assert.deepEqual(placed[0], { tone: '', left: 0, width: 0 });
  assert.ok(placed[placed.length - 1].left > 99.9, 'the last bar ends the domain');
});
