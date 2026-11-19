# Data, containers, feedback and overlays

How the data, container, feedback and overlay elements render the shared item
model, their states and actions, and the `gantt` chart. The item model and the
state serializer are in [schema-systems.md §15.4–15.5](schema-systems.md) and
[rendering-states.md](rendering-states.md). The renderers are
`engine/renderer/primitives/{table,data-structures,containers,chart,chart-gantt}.js`
and `engine/renderer/overlay-renderer.js`.

YAML written before the item model renders the same markup it always did. It
may gain the state and ARIA attributes listed below, and nothing else.

## Items

Four elements read their entries through `normalizeItems` with a legacy
profile, so the legacy keys and the canonical keys both work:

| Element | Profile | Text | Default expansion |
|---|---|---|---|
| `list.items` | `list` | A nonblank `title`, else `label`; `text`, else `description` | — |
| `carousel.items` | `list` | As `list` | — |
| `tree.items` | `tree` | A nonblank `label`, else `title`; nested `items` (or `children`) | Open unless `expanded: false` (or `open: false`) |
| `accordion.items` | `accordion` | As `list` | Closed unless `expanded: true` (or `open: true`) |

A string or number entry is a row with that label. A blank label draws a
skeleton bar, as before. Every list entry is drawn as a row: `type` entries
(`separator`, `heading`, `group`) have no special markup in these elements.

These props stay element-specific data and do not take the model: table
`columns` and `rows`, chart `data` and `series`, calendar `events`, kanban
`columns` and `cards`, and `avatar.group`.

### List

| Item key | Markup |
|---|---|
| `selected: true` | A checked control at the start of the row, and `data-wf-selected` on the row. |
| `selected: false` | An unchecked control. Any `selected` key draws the control, as before; leave it out for no control. |
| `disabled: true` | `aria-disabled="true"` and `data-wf-disabled` on the row, drawn at half opacity. |
| `route` | The row becomes `<a class="wf-list-row" href="…" data-wf-route-target="…">`. |

```html
<div class="wf-list-row" data-wf-selected><span class="wf-list-lead"><span class="wf-check-mark wf-check-on"></span></span>…</div>
<a class="wf-list-row" href="/charts.html" data-wf-route-target="charts">…</a>
```

`list.selectable` is still not read by the renderer: a row draws its control
only when the item has a `selected` key.

Routes follow the item-model rules:

- A route to a known route id makes the row a link.
- A `disabled` row never links. It stays a `<div>` with `aria-disabled`.
- An unknown route id leaves the row as plain markup.
- A list that carries an `interaction` is already a link target, so its rows
  never link.
- A row with action buttons (`kind: action`, or an `actions` array) links its
  body (`<a class="wf-list-body">`) instead, so no button sits inside a link.

### Tree

A row with nested items opens and closes, so it is a disclosure button:
`role="button"`, `aria-expanded="true|false"`, and `data-wf-expanded` while
open. A leaf carries no expanded state. `selected: true` adds
`data-wf-selected` to any row and draws it bold on a fill (an inset rule in
line mode). There is no ARIA for selection, because a display-only row has no
role that supports `aria-selected`.

```html
<div class="wf-tree-row" style="padding-left:0px" role="button" aria-expanded="true" data-wf-selected data-wf-expanded>…</div>
```

The element-level `tree.expanded` prop is still not read.

### Accordion

Each head is the trigger: `role="button"` with `aria-expanded`, and
`data-wf-expanded` while open. An open item also draws its body.

```html
<div class="wf-accordion-item wf-accordion-open"><div class="wf-accordion-head" role="button" aria-expanded="true" data-wf-expanded>…</div><div class="wf-accordion-body">…</div></div>
```

No keyboard behaviour ships with tree rows or accordion heads.

### Carousel

Slides read the `list` profile, so `{ label: Slide }` works as well as
`{ title: Slide }` and plain strings.

## Grid columns

Every grid host — the `grid` element, `form` with `columns`, any node or
template region with `layout: { type: grid }`, and the page body — takes its
`grid-template-columns` from one function, `gridTemplateColumns` in
`engine/renderer/layout.js`. It sees the host's rendered children, after
`repeat` and component expansion. In order:

1. A child placed with `gridItem` (`span`, `offset`, `row` or `column`):
   `repeat(N, minmax(0,1fr))`, where N is `columns`, else
   `manifest.defaultGridColumns`, else 12. Adaptive mode never reflows a
   placed grid.
2. `minItemWidth` (on `grid`): `repeat(auto-fit, minmax(min(<min>px,100%), 1fr))`.
3. Adaptive mode (the renderer's `adaptive` option, on a smaller device than
   the page was designed for): the same auto-fit at the shown device's
   `grid.minItemWidth`. This covers every host, not only `.wf-grid`.
4. `columns`, then an explicit `manifest.defaultGridColumns`: `repeat(N, minmax(0,1fr))`.
5. Otherwise tiles at the page device's `grid.minItemWidth` (web 220, tablet
   200, mobile 150; `manifest.sizing` overrides it) that fill the row and wrap.

`minmax(0,1fr)` stops a long word or URL from widening its track, and
`min(…,100%)` stops a tile minimum overflowing a container narrower than it.
`INVALID_GRID_SPAN` is unaffected: auto tiles apply only when no child uses
`gridItem`. `wf init` no longer writes `defaultGridColumns`. Projects that set
it keep their equal columns wherever `minItemWidth` and adaptive reflow (steps
2 and 3) do not apply.

## Repeat rows

`repeat` (schema-systems.md §14.1) adds no markup of its own. The resolver
(`engine/resolver/repeat-rows.js`) turns each item into the child node an
author would have written, after the host's own `children`, so the renderer
draws rows exactly as it draws hand-written siblings: the same ids, classes,
frames, grid cells and separators, byte for byte. A grid of `stat` rows
therefore lays out like a grid of hand-written `stat` children.

Only an element that lays out its authored children hosts rows (the list is in
`engine/renderer/child-hosts.js`, checked against each renderer's
`useChildren`). Rows on any other element are never made, in either rendering
mode. With source annotation, a row carries
`data-wf-source="<document>#<host>__<item>"` and
`data-wf-source-path="…repeat.items[<index>]"`; a component cell's internals
point at the cell's definition, as for any instance.

Item values are plain props, so below a row an `{{item.…}}` token renders as
written instead of as a skeleton bar or an empty attribute. A collection
`binding` inside the row still gives its own tokens their dataset item.

## Table loading state

`state: loading` marks the table body, which is the region that is loading:

```html
<div class="wf-table-body" aria-busy="true" data-wf-loading>…skeleton rows…</div>
```

## Actions

`card.actions`, `alert.actions` and overlay `props.actions` render through
`lib.actionButtons`. Action keys and states are in
[rendering-states.md](rendering-states.md#actions).

| Host | Where the actions go |
|---|---|
| `card` | In the head block, after the title and description. |
| `alert` | Below the text, inside `.wf-alert-body`. An alert without `actions` is unchanged. |
| Overlay | In the footer: `<footer class="wf-overlay-foot">`, with the buttons directly inside. |

`empty_state` keeps its single `action` string.

The overlay `actions` schema takes `label`, `variant`, `route`, `disabled` and
`tone`, and rejects any other key. A routed overlay action is a link; a
disabled one is a button with `aria-disabled="true"` and no link:

```html
<footer class="wf-overlay-foot"><button class="wf-act wf-button-secondary">Not now</button><a class="wf-act wf-button-secondary" href="/data.html" data-wf-route-target="data">Compare plans</a><button class="wf-act wf-button-primary" aria-disabled="true" data-wf-disabled>Upgrade</button></footer>
```

## Gantt chart

`chart` with `chartType: gantt` draws labelled bars on one shared axis. It
has its own data branch (`primitives/chart-gantt.js`), so the other chart
shapes and their `data` handling are unchanged.

```yaml
- chart:
    chartType: gantt
    title: Release plan
    ticks: [W1, W2, W3, W4]
    data:
      - { label: Design, start: 0, end: 1.6 }
      - { label: Build, start: 1.2, end: 4, tone: info }
      - { label: Launch, start: 3.8, end: 4, tone: success }
```

- **Data.** `data` is `[{ label, start, end, tone? }]`. `start` and `end` must
  be finite numbers; a row without them keeps its label and draws no bar.
  `tone` is `info`, `success`, `warning` or `danger`.
- **Ticks.** `ticks` names the axis's bands, on the same scale as the bars:
  tick `i` names the band from `i` to `i + 1`. So with `ticks: [Q1, Q2, Q3,
  Q4]`, `start: 0, end: 1` fills exactly the Q1 band, and `start: 1.5` is the
  middle of Q2. Each label is centred in its band and ends in an ellipsis if
  it is wider. A dashed gridline marks each band's edge, from 0 to the tick
  count.
- **Domain.** With ticks it runs from 0 to the tick count, widened to the
  smallest `start` or the largest `end` if a bar lies outside the ticks.
  Without ticks it runs from the smallest `start` to the largest `end`. A row
  with `start` after `end` is swapped. A zero-width domain is padded by 1 on
  each side.
- **Rows.** Rows are 28 px high, and the chart grows by one row per entry.
  `height` fixes the plot height instead, and the rows then scroll. The label
  column is `min(140px, 35%)` wide, and long labels end in an ellipsis.
- **No data.** Without `data`, the chart draws five seeded bars with greeked
  labels, a pure function of the node id, as the other chart shapes do. With
  `ticks`, the seeded bars span the ticks' bands.
  `data: []`, or a list with no usable entries, draws the empty state: "No
  data" in the plot, with the axis still drawn when `ticks` is set.
- **Modes.** Card mode fills the bars, using the tone colour when there is
  one. Line mode draws outlines, 2 px in the tone colour when there is one.

```html
<div class="wf-gantt"><div class="wf-gantt-plot"><div class="wf-gantt-rows">
  <div class="wf-gantt-grid" aria-hidden="true"><span class="wf-gantt-gridline" style="left:0.00%"></span>…</div>
  <div class="wf-gantt-row"><span class="wf-gantt-label">Build</span><span class="wf-gantt-track"><span class="wf-gantt-bar wf-tone-info" style="left:30.00%;width:70.00%"></span></span></div>
</div></div><div class="wf-gantt-axis"><span class="wf-gantt-tick" style="left:0.00%;width:25.00%">W1</span>…</div></div>
```

`title` and `legend` work as on every other chart.
