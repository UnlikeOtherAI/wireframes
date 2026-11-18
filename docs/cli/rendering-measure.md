# Measurement overlay

Measurement mode draws dimension lines and distances over any rendered page, in
the spirit of the blueprint drawings on ui-sdk.dev. It is part of the page
runtime (`engine/renderer/interactions-measure.js`), so it works in `wf build`
and `wf serve` output, in admin previews and in pages mounted by the browser
library.

## Switching it on and off

| Where | How |
|---|---|
| Standalone page (`wf serve`, a built file opened directly) | Press `m`. It toggles only when the page is the top window and focus is not in a text field, select or editable element. |
| Embedded page (admin previews, any iframe host) | The host posts `{ type: 'wf:measure', on: true \| false }` to the frame. The page accepts it only from `window.parent` and only when `on` is a boolean. Embedded pages ignore `m`, so the host stays the single source of truth. |
| Browser library | `createWireframe(...).setMeasure(on)`. It stays on across `setPage`, `setMode`, `setPlatform` and in-page navigation. See [wf-format.md](wf-format.md). |
| Admin editor | The **Measure** toggle in the preview toolbar. The choice is kept per viewer and replayed into every preview load. |

Every page load starts with measurement off; hosts replay their state on load.

## What it draws

- **Hover:** the target's outline, a width line above it (below, then inside,
  when there is no room) and a height line beside it. Each line is a hairline
  with end ticks and a monospace label chip.
- **Layout containers:** for `stack`, `row` and `grid` targets only, hatched
  padding bands on each side and gap bands between neighbouring children. Both
  read the container's computed `padding`, `row-gap` and `column-gap`; a gap
  band is drawn where the space between neighbours holds the computed gap.
- **Pinned distances:** a click or tap pins a target (heavier outline). Hovering
  or tapping another target then shows, on each axis, the gap between the two
  boxes' facing edges. When the boxes overlap on an axis, it shows the insets
  between matching edges instead (left to left, right to right). Aligned edges
  draw nothing. When the measured line falls outside the pinned box, a dashed
  guide extends the pinned edge to it.

Bands that are entirely outside the viewport are not drawn. Lines and bands
that are partly outside put their chip in the middle of the visible part.

Labels show the border-box size in the page's own CSS pixels, rounded to one
decimal place only when formatted (`320`, `43.4`). Colours are a magenta ink
(`#c2185b`) with a white halo, white chip text, green hatching for padding and
magenta hatching for gaps, so the marks read on line mode, card mode and skinned
pages. Nothing animates.

## Targets

Any element the renderer shell gives a node id is a target: `.wf-node[id]`,
region roots (`.wf-root[id]`) and overlay shells (`.wf-overlay[id]`). An overlay
is measured by its visible `.wf-overlay-content`; a point on a modal backdrop
measures the page underneath. Targets come from hit-testing
(`document.elementsFromPoint`), not event targets, so disabled controls can be
measured. Hidden, zero-size and fragmented (multi-line inline) boxes are
skipped in favour of the nearest measurable ancestor.

## Coordinates and the layer

Measurement happens in the page's own viewport, so a host that zooms the iframe
(admin's preview zoom) needs no correction: a 320 px node reads `320` at any
zoom.

The layer is one `div[data-wf-measure]` appended to `body`: fixed to the
viewport, `pointer-events: none`, `z-index` above every overlay, `overflow:
hidden` and `contain: strict`, so it never creates scroll overflow. It redraws
on pointer movement, scroll (capture phase, so nested scrollers count) and
resize. While it exists, a style inside it shows a crosshair cursor.

## Input while measuring

Capture-phase listeners on `window` for `pointerdown`, `pointerup`,
`mousedown`, `click`, `keydown`, `touchstart` and `touchend` stop each event
before any page handler runs. `mousedown` and `click` are also
default-prevented, so links do not follow, fields do not focus and selects do
not open. Touch listeners are passive and wheel events are untouched, so
scrolling keeps working.

A pick (pin or release) happens on a `pointerup` that ends within 8 px of its
`pointerdown`, not on `click`: browsers send disabled form controls pointer
events but no click, and a drag or scroll is not a pick.

- **Escape** is handled once: it unpins, or does nothing when nothing is
  pinned. Overlays do not also close.
- **Keys in a focused field** are default-prevented (except Tab), so nothing
  types into a bound field.
- **Mouse:** a click pins; clicking the pin again, or empty space, releases it.
- **Touch:** the first tap pins; tapping another target measures to it; tapping
  the pin again releases it.

A shared `isMeasuring()` gate covers the runtime paths that do not start from
those events: pending long-press and gesture timers, overlay outside-dismiss and
Escape handlers, keyboard activation of `role="button"` nodes, and pane size
persistence. Admin's `wf:nodeClick` selection bridge also ignores clicks while
measuring.

## Output and serialization

The runtime asset and the inline runtime change only with the engine version,
so the same input still gives the same bytes. Until measurement is switched on
it adds no DOM, attributes, styles or input listeners beyond the `message`
listener and, on a top-level page, the `m` key listener. Switching it off
removes the layer and every listener it added, so
`document.documentElement.outerHTML` is the same before and after a session.

## Implementation and tests

| File | Role |
|---|---|
| `engine/renderer/interactions-measure.js` | The runtime fragment: activation, hit-testing, drawing, input mode, `isMeasuring()` |
| `engine/renderer/interactions{,-overlays,-panes}.js` | The gate hooks |
| `renderer/src/mount.ts` | `setMeasure` and its replay on load |
| `admin/src/stores/previewMeasureStore.ts` | The admin viewer's persisted choice |
| `admin/src/features/workspace/postMeasure.ts` | The host message |
| `cli/test/measure-browser.test.js` | Playwright: labels, gaps, blocked input, serialization, `m`, messages |
