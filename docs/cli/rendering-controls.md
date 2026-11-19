# Presentation and interactive controls

See [icons and control decoration](rendering-presentation.md) and [named company skins](design-system.md).

Navigation rails and panel colours: [rendering-navigation.md](rendering-navigation.md). Company logo boxes and skin switching: [rendering-logos.md](rendering-logos.md).

An app_bar with children and no title/leading/actions uses those children as its complete bar content; use real button children for working controls.

### Interactive appearance fields
Segmented controls and local `tab_bar` items are native toggle buttons.
Clicking, tapping, Space or Enter changes the active option and `aria-pressed`.
Their unique labels are selection values. With
`selection: {scope: page, stateKey: preview}`, choices write existing page
state; `scope: app` uses session-backed app state. Existing state wins over
`segmented.props.value` or `tab.active`. Use `visibility.condition` with
`state_equals` to show the matching preview panel. Routed tabs keep navigation;
unresolved routes do not become local choices. Unbound groups keep local
selection for the rendered page only.

An `input` with `inputType: color` renders a native colour picker and a labelled
hex field. It accepts exactly `#RRGGBB`; incomplete text remains editable and
does not update a linked state value. Valid hex preserves its authored case.
The picker, hex field and segments have at least 44px coarse-pointer targets.

For editable preview text, use `props.value: "{{state.launcherText}}"` on the
input and `props.label: "{{state.launcherText}}"` on the preview button.
The equivalent explicit `stateBindings.value` is supported. Exact
`state.key` / `appState.key` value bindings are writable on input changes;
other expressions remain read-only. This is ephemeral prototype state, never
an edit to the source design. Native picker dialog appearance depends on the
browser and operating system.

### Form controls: fields, states and the toolbar

Renderers: `engine/renderer/primitives/controls*.js` (`controls-field.js`
holds the shared label and help helpers, `controls-bounds.js` the input
bounds). Runtime: `engine/renderer/interactions-controls.js`. The props are
in [schema.md](schema.md) and the contract in
[schema-systems.md §15.4–15.5](schema-systems.md); the attribute
conventions are in [rendering-states.md](rendering-states.md).

A control that uses only the props it had before the field contract renders
the markup it always did, plus state and ARIA attributes and the ids they
point at. Two visible changes: a `choice_group` row selected by `value` now
draws its checked mark (it never did), and a stepper shows its `help` (it
was dropped). `cli/test/controls-legacy-visual-browser.test.js` compares the
rest pixel by pixel against the legacy markup and stylesheet.

#### Field contract per widget

Every control except `button` and `toolbar` spreads `FIELD_PROPS`: `label`,
`help`, `error`, `required`, `disabled`, `readonly`.

| Widget | Label | Help and error | Where the state goes | `readonly` |
|---|---|---|---|---|
| `input` (text types, number, colour), `textarea` | `<label>` above | below; the `<input>`/`<textarea>` names it in `aria-describedby` | the native control | native `readonly` |
| `input` range, otp, stepper | above | below | the drawn `.wf-range`, `.wf-otp`, `.wf-numstepper` (data attributes only); stepper buttons take native `disabled` | `data-wf-readonly` |
| `select` | above | below, in `aria-describedby` | the `<select>`, drawn with `appearance: none` at the control height (so WebKit draws it as tall as an input) with its own chevron; `multiple` stays a native list box | `aria-readonly`, `data-wf-readonly`; the runtime puts back any change |
| `segmented` | with any field prop, a label above and a `role="group"` track named by it | below, in the track's `aria-describedby` | the track; each segment keeps `aria-pressed` | `data-wf-readonly` (a group or button has no ARIA read-only) |
| `choice_group` | `<label>` above, naming the list | below | the list: `role="radiogroup"` (radio) or `role="group"` (checkbox); each mark is `role="radio"`/`"checkbox"` with `aria-checked` | radio: `aria-readonly` on the group; checkbox: on each mark |
| `checkbox`, `radio`, `toggle` | inline; `required` marks it | `help` is the inline description (it wins over `description`); an error goes below the row; both are in `aria-describedby` | the mark: `role="checkbox"`, `"radio"` or `"switch"`, named by the label with `aria-labelledby` | `aria-readonly` on checkbox and switch; `data-wf-readonly` on radio |
| `tags_input` | above | below, in the text box's `aria-describedby` | the text box | chips drawn without their remove marks; the text box stays (native `readonly`) but is hidden |
| `editor` | above; with a label, help or an error an inner `.wf-editor-box` holds the toolbar and body and draws the surface, and the frame draws nothing (as for `upload`); without them the frame is the box | below the box | the body (data attributes only) | drawn without the toolbar |
| `picker` | above | below | the wheel (data attributes only) | `data-wf-readonly` |
| `upload` | `label` stays the action copy; `fieldLabel` goes above | below | with any field prop, an inner `.wf-upload-zone` (or `.wf-upload-row` for `variant: button`) carries the state and the dashed box | drawn without its action: the files only, or "No files" |

`error` replaces `help` and adds `wf-field-invalid` to the node, which
paints the invalid edge through `--wf-tone`. Read-only has one look for
every control. The node gets `wf-field-readonly`; the state attributes stay
on the owner listed above, and the runtime guards are unchanged:

- a lock (`.wf-field-lock`, `aria-hidden`) after the label text, so the
  accessible name stays the label;
- a dashed edge on the field box: inputs, `textarea`, `select`, tags, colour,
  the otp boxes, the stepper, the segment track, the upload zone, the
  checkbox, radio and toggle marks, the picker frame, and the editor's box
  (its frame when it has no label or note).
  It is `--wf-ink-3` over a `--wf-fill-2` fill in card mode and
  `--wf-line-strong` in line mode. The edge and the lock reach at least 3:1
  against the page. An invalid read-only field keeps its toned edge, dashed;
- no affordance that suggests a change: no select chevron, no textarea
  resize handle, no stepper buttons, a dashed range thumb and a default
  cursor;
- the value at full contrast.

Disabled native fields

(text types, number, colour, `textarea`) keep the browser's disabled look,
as they always did. A disabled `select` and its chevron dim to 0.7, which is
what Chromium's native select did, now in every engine. A field box shows a
2 px focus ring while its input or select has focus. Drawn controls fade one layer to half
opacity, as disabled buttons and checkboxes always have: range, otp,
stepper, picker, editor, tags, the upload zone, the segment track, a choice
list (or one disabled row in it) and a toolbar item. With both `readonly`
and `disabled`, both are written and disabled wins.

A `submit` interaction collects the fields inside its form in document
order. Native fields keep their keys: `<id>__input` for an input, the node
id for a textarea, select or colour field. Drawn controls submit under their
node id, read from the state they show:

| Control | Submits |
|---|---|
| `checkbox`, `radio`, `toggle` | `true` or `false`; a mixed checkbox `"mixed"` |
| `segmented`, radio `choice_group`, `picker` | the chosen option's `value`, else its label; `""` with nothing chosen |
| checkbox `choice_group` | the list of checked options' values |
| multiple `select` | the list of selected option values |

Read-only values are submitted. A disabled field or control is skipped, as
in HTML. An option's own `disabled` stops it being chosen, and, as in HTML,
an option that is itself disabled is not submitted even when it shows as
selected: a radio group or single select whose choice is disabled submits
`""`, and a list leaves it out. A drawn
option whose `value` differs from its label carries it as `data-wf-value`.

#### Options and selection

`select.options`, `segmented.options`, `choice_group.options` and
`picker.options` take the shared item model (§15.4): `select` through the
`select` profile (boolean options stay literal), the others through
`choice`. Identity is `value`, else `label`.

- `select.value` is the initial selection; with `multiple: true` it is a
  list. Item `selected` wins; `selected: false` beats a matching value. A
  `group` item is an `<optgroup>`, a `separator` an `<hr>`, and a
  `disabled` item a disabled option. The selection is resolved once across
  the options of every group, so a single select marks only the first
  match, and `AMBIGUOUS_VALUE` reads the options the same way
  (`engine/renderer/choice-options.js`). A `{{state.x}}` value binds the
  select like an input value.
- A checkbox `choice_group` is multiple choice: its `value` may be a list,
  and an option's `checked: mixed` draws it indeterminate.
- `picker` centres the selected option. With nothing selected it keeps its
  legacy rule: the first option whose label is the `value` text (with no
  `value`, the first blank option), else the first option. Options marked
  `selected: false` are skipped.
- Segments and choices still send their labels as binding payloads.

#### New props

- `button.pressed` (`true` or `false`) makes a toggle button with
  `aria-pressed` and, when on, `data-wf-pressed` and a sunken fill; it
  works with `iconOnly`. A routed button stays a link and only carries
  `data-wf-pressed`.
- `checkbox.indeterminate` draws the mixed bar and wins over `checked`
  (`aria-checked="mixed"`, `data-wf-checked="mixed"`).
- `input` `min`, `max` and `step` apply to `number`, `range` and `stepper`,
  which are drawn, not interactive:
  - A range defaults to 0–100; reversed bounds are swapped; equal bounds put
    the thumb at the start; the value is clamped. A range with no value keeps
    the thumb at 40%.
  - `value: [low, high]` (exactly two numbers, any order) draws two thumbs
    with the fill between them. Only `inputType: range` takes a list; lint
    reports `UNKNOWN_PROP_VALUE` otherwise, or when the list is not two
    numbers.
  - A number or stepper is bounded only when `min` or `max` is set (the
    other defaults to 0 or 100). It then clamps its value, writes native
    `min`/`max` on a number field, and disables the stepper button at a
    bound.
  - `step` sets how many decimals the number and stepper show (step 0.5
    shows 2.0) and is written on a number field. Nothing snaps.
  - `{{props.x}}` values resolve through the binding helpers. A
    `{{state.x}}` value binds a number field or stepper (see Runtime); on
    a range it resolves to nothing and does not move the thumb.

#### `toolbar`

A row (or, with `orientation: stack`, a column) of tool buttons inside one
outline, `role="toolbar"`. It never draws a frame of its own (frame class
`N`).

- `items` take the item model. An item with an `icon` is an icon button
  named by its `label` (`aria-label`); without an icon, or with
  `labels: true`, the label shows beside it.
- `pressed` (`true`/`false`) makes a toggle button with `aria-pressed`;
  `checked` makes a `role="checkbox"` button with `aria-checked`; both may
  be `mixed` (dashed edge). `disabled` is native.
- `{ type: separator }` draws a divider (`role="separator"`); a `group`
  wraps its items in a named `role="group"`; headings are skipped.
- `size: sm | md | lg` sets 28, 32 or 40 px buttons (44 px on coarse
  pointers).

```yaml
- toolbar:
    items:
      - { label: Bold, icon: bold, pressed: true }
      - { label: Italic, icon: italic, pressed: false }
      - { type: separator }
      - { label: Align left, icon: align-left, checked: true }
      - { label: Delete, icon: trash, disabled: true }
```

#### Runtime

`interactions-controls.js` changes a state's ARIA and data attribute
together:

- Segments: `aria-pressed` and `data-wf-selected` move with the choice; a
  read-only track ignores clicks. The label stays the binding payload, but
  the segment chosen is the choice: of several segments sharing a label,
  the one clicked (or selected by `value`) stays lit. State set elsewhere
  lights the first segment with that label.
- Pressed buttons and toolbar items flip `aria-pressed`/`aria-checked` and
  `data-wf-pressed`/`data-wf-checked`; disabled ones do not.
- Checkbox, toggle and radio marks toggle `aria-checked` and
  `data-wf-checked` (a radio only turns on; a mixed checkbox becomes
  checked). A checkbox with `stateBindings.checked` writes an exact
  `{{state.key}}` binding instead and is redrawn from state; with an
  authored interaction, that interaction owns the state. A bound `checked`
  or `disabled` updates the mark, not the node shell.
- A bound mixed checkbox stays mixed until its `checked` state moves off
  the value it mounted with, or the user activates it (which checks it).
- `choice_group` rows select (radio) or toggle (checkbox).
- A bound value refreshes with the field semantics it rendered with. A
  select keeps the render's precedence: item `selected: true` wins over
  the value, `selected: false` skips a match, and a multiple select
  selects every remaining option in the bound list (one value selects one
  option). A bound select's options carry `data-wf-item-selected` and,
  when their `value` attribute is not their identity, `data-wf-identity`
  for this. A number field and a stepper clamp to their bounds
  and show `step` decimals, exactly as at render time; a stepper carries
  `data-wf-min`, `data-wf-max` and `data-wf-step` for this and disables
  its button at a bound. A bound `disabled` on a stepper goes on the
  `.wf-numstepper` and disables both buttons through any value change.
  What the user types into a number field is left as typed.
- Read-only and disabled marks, groups and segments ignore clicks; a
  read-only select puts back its selection; a read-only colour field puts
  back its picker.

### Table link cells

A table column with `kind: link` accepts a cell `{text: "Device A", route: device_a}`.
Use it in either keyed rows or positional arrays. The route is an existing sitemap route id;
the renderer uses the route table and emits the normal navigation attributes. A nonempty
string text becomes the accessible link name. Scalar cells keep their existing inert
appearance. Unknown routes, malformed cells and unsafe route-table URLs remain inert
text. This adds no row-click or pagination behavior; table pagination remains illustrative.
Link cells do not accept raw HTML or href values. Relative internal paths and fragments
are supported; schemes, protocol-relative URLs, backslashes and whitespace are rejected.

Selected skinned sidebar links and rail icon tiles use the authored accent when present. Without an accent, they retain the authored background and show an inset current-colour selection outline; the engine does not combine authored light text with its default light selection fill. Authored transparent or low-contrast palettes do not gain an automatic contrast guarantee.

Nodes may set `scroll: true` beside `size` and `layout`. This opts the whole node into native overflow scrolling with contained overscroll and non-shrinking immediate children. Use `size.height`/`maxHeight` (or width bounds) to constrain it; unbounded content grows normally. Put headings and pagination outside the scroller when they must remain visible; `sticky: top` children stick within it. Label stack/row/grid/split scrollers with `accessibility.label` for a named keyboard-focusable region. False or omitted leaves existing markup unchanged. This does not add a resize handle, virtualization or automatic viewport sizing.
