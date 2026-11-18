# Component library expansion: shared items and fields, component slots, std patterns, new elements, measurement overlay

Status: implemented on 18 November 2026 (branch `claude/component-library`). §9 records
the review, and §10 records the decisions made during implementation.

Source inspected on 18 November 2026: `UnlikeOtherAI/wireframes` `origin/main` at
`b3dfb81`, plus the docs shipped inside `@ui-sdk/react@0.1.0-beta.10` (Vercel Labs,
Apache-2.0, <https://ui-sdk.dev>). UI SDK is a source of ideas only. Nothing here adds
it as a dependency or copies its code.

This plan finishes the `std` library (tranche T13) of
[2026-11-02-element-library-overhaul.md](../plans/2026-11-02-element-library-overhaul.md) and
leaves that plan's other open tranches (T4, T12, T14, T17) open.

## 1. Problem Statement

The registry has 54 primitives, but five problems limit how freely a wireframe can be
designed:

1. **Every collection element invents its own item shape.** `list` rows use
   `title`/`text`, `nav` marks headers with `group`/`heading` entries, `menu` marks
   separators with `divider: true`, tabs use `active`, `accordion` uses `open`,
   `stepper` uses a `current` index, and choice controls use `options` plus a top-level
   `value` that they compare by label. Authors and agents have to learn each one. UI SDK
   uses one list shape for Select, Menu, Command and Tree: strings or objects, with group
   and separator entries.
2. **Form controls do not share a field contract.** `input`, `textarea` and `select`
   have `label`/`help`/`error`/`required`/`disabled`. Other controls have subsets of
   these, and no control has `readonly`. A form cannot show a consistent invalid,
   disabled or read-only state. UI SDK has one Field (label, description, error) for
   every control and one state vocabulary.
3. **Reusable components cannot take content.** Instance `children` replace the whole
   component body (`engine/resolver/index.js:257-266`), so a component has no named parts
   such as header, body and footer. No authored YAML in the three projects uses `use:`.
4. **There are no shipped screen patterns.** The overhaul's `std` library never landed.
5. **Sizes and spacing cannot be inspected in a rendered wireframe.** The user asked for
   the dimension lines shown in ui-sdk.dev's "blueprint" drawings.

UI SDK also has elements we lack: a command palette, a toolbar, a menubar, a site-level
top navigation menu, a pressed toggle button, an indeterminate checkbox, numeric bounds
on range and number inputs, and a timeline of bars on a shared axis.

## 2. Current Behavior

| Area | Where | Behavior today |
|---|---|---|
| Element registry | `engine/schema/primitive-registry/*.js` | One descriptor per element: `name`, `family`, `frame`, `summary`, `props`, `sizing`, `example`. It feeds the schema, lint, `wf llm`, the catalogue and renderer dispatch (`engine/renderer/primitives/index.js`). |
| Schema | `engine/schema/schema.json`, `scripts/sync-schema-primitives.js` | The primitive section is generated. Array props are open, with untyped entries. Node, overlay and page keys are hand-written. `cli/test/schema-registry-drift.test.js` fails on drift. |
| Items | `render-lib.js:74` `items()` | Turns strings and numbers into `{label}`, copies `title` to `label` when `label` is absent, and drops other scalars. Each renderer then applies local rules: list rows prefer a nonblank `title` and draw `text` (`table.js:121-164`); tree is open unless `false`, accordion only when `true` (`data-structures.js:46-100`); nav reads `group`/`heading` headers (`navigation.js:141`) and menu reads `divider: true` (`:161`). |
| Choice controls | `controls.js:148-273`, `interactions-controls.js` | Segmented and choice group compare `value` to labels. Picker falls back to row zero. `select` has no initial `value` and renders boolean options literally (`render-attrs.js:236-255`). Tab and segmented runtime send labels to bindings. |
| Actions | `render-lib.js:90` `actionButtons`; `overlay-renderer.js:175-200`; app bar (`navigation.js:175-189`) | Card, alert and page-header actions share the helper. Overlay footers have their own strict schema (`schema.json:523-555`) and markup. App-bar actions are glyph-only. |
| Field props | `controls.js:36-282` | Controls share label and help helpers, and `error` replaces `help`. Checkbox and toggle descriptions are inline. The upload label is action copy. |
| State markup | `render-attrs.js`, `node-shell.js:208-233` | `data-wf-*` attributes carry frame, edge, variant, interaction and pane data. The node shell is often a wrapper around the real control. |
| Components | `engine/resolver/index.js:61-139, 220-309`, `engine/component-registry/*` | `use:` clones the root and lets instance keys override it. It then substitutes `{{props.x}}` across the merged tree, namespaces descendant ids and form references, and expands nested `use:`. Recursion is checked by component name. |
| Traversals | `doctor/component-graph.js`, `doctor/reference-checks.js`, `doctor/semantic-validator.js` (716 lines, over the cap), `validate/index.js`, `component/index.js`, `lint/index.js` | Each walks `children` itself. |
| Source mapping | `build/source-stamps.js`, `addressing/{index,fs-resolver}.js`, `admin/src/features/workspace/useWorkspaceData.ts` | Stamps are `page:id#node` tags. Addressing descends through `children`. Admin builds its own simplified tree from YAML and maps clicks by rendered id. |
| Component CLI | `cli/commands/commands/component.js`, `engine/component/index.js` | `add`, `remove` and `list` (sorted ids, one per line). |
| Runtime | `engine/renderer/interactions*.js` | Navigation, overlays (outside-dismiss on `mousedown`, document-level Escape), gestures, panes and controls. It posts `wf:navigate`. File builds link a shared runtime asset, while in-memory renders inline it. |
| Previews | `admin/src/features/ProjectEditorPage.tsx` (552 lines, over the cap), `editor/PreviewToolbar.tsx`, `editor/PreviewPane.tsx`, `workspace/{Workspace,WorkspacePreview}.tsx` | The editor mounts `PreviewToolbar` with `WorkspacePreview`, which zooms the iframe from the parent and bridges `wf:nodeClick`. `PreviewPane` is a separate sandboxed path. |
| Browser library | `renderer/src/mount.ts:34-41` | `setPage`, `navigate`, `setMode`, `setPlatform`, `explain`, `html`, `destroy`. |
| Catalogue and gallery | `engine/catalogue/*`; `scripts/update-gallery-baselines.js` | The catalogue parses registry examples into primitive nodes without resolving components. The gallery script renders a fixed `PAGE_IDS` list. Two baseline sets are tracked: `gallery/win32/` and a non-Windows set in `gallery/`. |
| Docs size | `docs/cli/rendering.md` (997 lines), `rendering-modes.md` (1,035), `schema.md` (684), `schema-systems.md` (528), `brief.md` (884) | Two rendering docs are at or over the 1,000-line cap. |

## 3. Desired Behavior

- Every element that opts in to the item model (§4.1) accepts one item shape and
  renders what it accepts. Existing YAML renders exactly as before, and existing gallery
  baselines do not move.
- Every form control accepts the shared field props and states, with correct native and
  ARIA semantics, and readonly values still bind and submit.
- Reusable components declare named slots, which instances fill.
- `std.*` patterns resolve everywhere a project resolves and can be copied into the
  project to be edited.
- New elements: `command`, `toolbar`, `menubar`, `nav` `variant: top`,
  `button.pressed`, `checkbox.indeterminate`, `select.value`, `input`
  `min`/`max`/`step` with a two-thumb range, and `chart` `chartType: gantt`.
- A measurement mode draws dimension lines and pinned distances inside any rendered page.
  Admin previews switch it from the toolbar, the browser library through
  `setMeasure(on)`, and standalone pages with the `m` key.

## 4. Design

### 4.1 Shared item model

New `engine/renderer/items.js` exports `normalizeItems(value, profile)`. `render-lib`
re-exports it, and `lib.items(value, key)` keeps its exact current behaviour as a thin
wrapper. The function is pure, never mutates its input, and **never invents a default
for a boolean that is absent.**

**Canonical keys:**

| Key | Meaning |
|---|---|
| `label` | Primary text. |
| `description` | Secondary line. |
| `value` | Identity. |
| `icon`, `iconStyle`, `avatar`, `badge`, `meta`, `shortcut`, `route` | Decorations and navigation. |
| `tone` | `neutral`, `info`, `success`, `warning` or `danger`. |
| `selected`, `current`, `checked`, `disabled`, `expanded` | State. `checked` may also be `mixed`. |
| `items` | Nested items. |
| `type` | `item` (default), `separator`, `heading` or `group` (label plus nested items). |

**Legacy profiles.** Each consumer passes a profile naming the legacy keys it honoured
before this change and their precedence. Only consumers that already read a legacy key
read it now:

| Consumer | Profile |
|---|---|
| `list` rows | Nonblank `title` before `label`; `text` → `description`. |
| `nav` | Explicit `label` kept even when blank; `{group}`/`{heading}` → `{type: heading}`. |
| `menu`, `action_sheet` | `{divider: true}` → `{type: separator}`; `danger: true` → `tone: danger`. |
| `tab_bar`, `bottom_tab_bar` | `active` → `selected`. |
| `nav` (decided in T4) | `active` stays part of nav's legacy rule, next to route inference, not an alias of `selected`. `active: true` lights a row in addition to the route match, and `active: false` never hides the current route, exactly as before. Canonical `selected` beats both. |
| `tree`, `accordion` | `open` → `expanded`. Each keeps its own default: tree open unless `false`, accordion closed unless `true`. |

Canonical keys work in every opted-in consumer. Tests cover conflicting keys, blank
labels, nested headings, and absent versus `false` booleans.

**Scalars.** Strings and numbers become `{ label: String(v) }`. Choice consumers also
set `value`. Booleans, `null`, arrays and other non-objects are dropped, as today. The
one exception is `select`, which keeps rendering boolean options literally.

**No schema tightening.** Generated array schemas stay open. The model is documented in
`schema-systems.md` and `wf llm` and enforced at render time, so YAML that is valid today
stays valid.

**Opt-in inventory.** These arrays adopt the model:
- `tab_bar.tabs`, `bottom_tab_bar.tabs`, `breadcrumb.items`, `stepper.steps`,
  `nav.items`, `menu.items`, `action_sheet.items`, `page_header.breadcrumb`,
  `page_header.tabs`
- `select.options`, `segmented.options`, `choice_group.options`, `picker.options`
- `list.items`, `tree.items`, `accordion.items`, `carousel.items`
- Actions through `actionButtons`: `card` (it already renders `actions`; the registry
  prop is added), `alert` (a new `actions` prop), `page_header`, and overlay `actions`.
  `empty_state` keeps its single `action` string.
- The new `command.items`, `menubar.items` and `toolbar.items`

These stay element-specific data: table `columns` and `rows`, chart `data` and `series`,
calendar `events`, kanban `columns` and `cards`, `tags_input.tags`, `upload.files`,
`avatar.group`, and app-bar `actions` (glyphs).

**Selection.** Identity is `value` when present, otherwise `label`, compared as
strings. Precedence, highest first:

1. An explicit item `selected` (`true` or `false`).
2. A match on the element-level `value` (an array when the element is multiple).
3. The element's legacy rule: nav route inference, stepper `current` index, pagination
   `page`, or picker row zero.
4. Nothing selected.

Single-choice elements mark only the first match, and lint reports `AMBIGUOUS_VALUE`
(info). Runtime binding payloads are unchanged: tab and segmented changes still send
labels. `list` `selected: false` keeps drawing an unchecked control when `selectable`.

**Routes.** An item `route` renders a link only in consumers that already navigate:
`nav`, `breadcrumb`, `tab_bar`, `bottom_tab_bar`, `menu`, `list`, `command` and actions.
A `disabled` item never navigates and renders without `href`, with `aria-disabled`. An
unknown route id renders as plain text. Lint checks only interaction `targetRoute` today;
a lint for unknown item routes is a follow-up. An item route is ignored
when the element itself carries an interaction, so anchors never nest.

**Actions.** `lib.actionButtons` reads through the model and supports `disabled`,
`pressed` and `tone`. Overlay footers switch to the same helper, keeping their footer
chrome. The overlay `actions` schema gains `disabled` and `tone`, and still rejects
unknown keys. App-bar glyph actions are untouched.

### 4.2 Shared field contract and state attributes

`engine/schema/primitive-registry/shared.js` exports `FIELD_PROPS` (`label`, `help`,
`error`, `required`, `disabled`, `readonly`), which control descriptors spread. **The
existing label and help helpers in `controls.js` are extended rather than replaced by a
new shell.** Output for YAML that only uses today's props must be byte-identical.

**Rules:**
- `error` replaces `help`, as today.
- Help and error get ids and are linked to the focusable control with
  `aria-describedby`.
- `required` adds a marker to the visible label.

**Per-widget mapping:**

| Widget | Field label | Help/error placement | `readonly` |
|---|---|---|---|
| `input`, `textarea` | Above (existing) | Below (existing) | Native `readonly`. Value kept, bound and submitted. |
| `select`, `picker`, `segmented`, `choice_group` | Above; `segmented` gains it | Below | `aria-readonly` and `data-wf-readonly`. The runtime ignores changes, and the value is still submitted. |
| `checkbox`, `radio`, `toggle` | Inline label (existing); `help` is an alias of the inline `description` | Error below the row | `aria-readonly`; the runtime ignores toggles. |
| `tags_input`, `editor` | Above | Below | Chips or body drawn without input affordances. |
| `upload` | `label` stays the action copy; a new `fieldLabel` goes above | Below | Dropzone drawn without its action. |

`disabled` keeps the native `disabled` attribute where one exists, so disabled values
are not submitted, as in HTML.

**States.** `render-attrs.js` gets one serializer, `stateAttrs(state, { owner })`. Each
renderer chooses the element that owns the state and the ARIA that element's role
supports. Data attributes are presence-only and mirror the state:
`data-wf-disabled`, `-readonly`, `-required`, `-invalid`, `-loading`, `-pressed`,
`-checked` (`="mixed"` for indeterminate), `-selected`, `-current` and `-expanded`.

- Toggleable controls keep explicit false ARIA, for example `aria-pressed="false"`.
- Existing tab buttons keep their button and `aria-pressed` semantics.
- Display-only `menu`, `command` and `menubar` render plain lists with `aria-current`
  and `aria-disabled` only. They get no `menu` or `listbox` roles, because no keyboard
  behaviour ships.
- Runtime code that changes a state (segmented, toggles, toolbar pressed, tabs) updates
  the data attribute and the ARIA together.

### 4.3 Component slots

**Grammar.** A **slot placeholder** is its own schema object, `SlotPlaceholder`, with
`id`, `slot` (`Id` pattern) and optional `children` as fallback content. It allows no
other keys (`additionalProperties: false`). Placeholders may appear only inside a
component definition: in `children` arrays of the root's descendants, in fallback
`children`, and in fill arrays of nested instances. They may not be the component root,
and may not appear in pages, templates, regions or overlays. `slots` (a map from slot
name to an array of nodes) is valid only on a `use:` node.

```yaml
components:
  panel:
    propDefaults: { title: Details }
    root:
      id: panel
      component: card
      props: { title: "{{props.title}}" }
      children:
        - { id: body, slot: default }
        - id: footer
          slot: footer
          children:                              # fallback
            - { id: close, component: button, props: { label: Close } }
```

```yaml
- id: billing_panel
  use: panel
  props: { title: Billing }
  children:                                      # fills `default`
    - { id: plan_name, component: heading, props: { text: Pro plan } }
  slots:
    footer:
      - { id: upgrade, component: button, props: { label: Upgrade, variant: primary } }
```

**Fill rules:**
- Instance `children` fill `default`. Giving both `children` and `slots.default` is an
  error.
- An omitted fill uses the fallback.
- An explicit `[]` means "intentionally empty": no fallback, and no diagnostic.
- Neither content nor fallback reports `EMPTY_COMPONENT_SLOT` (info).
- A component with **no** placeholders keeps today's override path exactly: instance
  `children` replace root children.

**Scope by author.** This is the core of the design:

1. Each definition's own tree is prepared once, in its own scope. That covers its root,
   internal nodes, fallback content and any fills it writes for nested instances. Prep
   means `{{props}}` substitution, import qualification, and namespacing of ids and
   scoped references (form ids) under the instance id, as today.
2. Fill content is prepared in its **caller's** scope before it reaches the callee. Page
   fills keep page ids and get no substitution. Fills written inside component A for its
   nested instance of B belong to A, so they are prepared with A's props and namespaced
   under A's instance.
3. Prepared fill content is spliced into the callee's prepared tree in place of the
   placeholder. It is opaque to the callee: no callee substitution and no re-namespacing.
4. Nested `use:` expansion runs after splicing. A caller-authored instance of the same
   component inside a fill is legal finite nesting, not recursion. Only definition
   cycles (A's own tree reaching A again) are errors.
5. A root that is itself a `use:` is prepared in the defining component's scope, and its
   `slots` fills are that component's content.
6. Id uniqueness is checked on the final resolved page tree.

**Traversal.** A new `engine/component-registry/child-nodes.js` exports
`childNodeLists(node)`. It returns `children` plus every `slots.*` array of a `use:`
node, and every walker in §2 "Traversals" uses it. This covers duplicate ids,
references, interactions, the unused-component graph, removal protection in
`wf component remove`, lint, and the in-memory `validate` entry point that the browser
uses. **`semantic-validator.js` is split first**: its traversal and id checks move to new
files, below the 500-line cap, before any slot change lands in it. Slot rules live in
`engine/doctor/component-slots.js`.

**Diagnostics:**

| Code | Severity | When |
|---|---|---|
| `UNKNOWN_COMPONENT_SLOT` | error | A fill names a slot the component lacks. The message lists valid names. |
| `DUPLICATE_COMPONENT_SLOT` | error | Two placeholders in one component share a name. |
| `DUPLICATE_DEFAULT_SLOT_FILL` | error | An instance gives both `children` and `slots.default`. |
| `SLOT_OUTSIDE_COMPONENT` | error | A placeholder is used as a component root or outside a component. |
| `SLOTS_WITHOUT_USE` | error | A node has `slots` but no `use:`. |
| `EMPTY_COMPONENT_SLOT` | info | A slot gets neither content nor fallback. |

**Editing and selection.**
- Source stamps carry the authoring document and the authored path, including
  `slots.<name>[i]` segments.
- Engine addressing and `wf node` traverse named fills.
- Admin's YAML tree walker (`useWorkspaceData.ts`) descends into `slots.*`, so a
  page-authored fill appears in the tree, highlights on click and edits the page
  document.
- A click on component-internal or component-authored content selects the closest
  page-authored instance. Those nodes are edited in the component document, and
  `wf component copy` covers built-ins.
- Replacing admin's second tree with the engine tree is deferred (§7).

**CLI.**
- `wf component show <id>` prints props with defaults and hints, slots with their
  fallback, and the root outline.
- Plain `wf component list` output is unchanged.

### 4.4 `std` pattern library

- Patterns live in `engine/stdlib/`. They are authored as YAML text inside JS modules
  and parsed with the bundled js-yaml, with no filesystem access. Each pattern is
  self-contained: it uses no other `std` pattern, which a test enforces.
- **Lookup rule:** a single `resolveComponentDefinition(id, registry)` in
  `engine/component-registry/`. A project's own definitions, and its own `std` import
  alias if it declares one, win. Built-in `std.<name>` is the fallback. Every entry
  point uses this rule: the file registry, per-page virtual registries, bare in-memory
  maps, the expansion guard, validation, tree, explain, and the browser bundle (with a
  renderer test on a `.wf` project that has no component file). Built-ins join a
  registry lazily, only when referenced, so unused-component reports and listings are
  unchanged.
- A project alias `std` that shadows the built-ins reports `STD_ALIAS_SHADOWED` (info).
  Nothing is reserved, so existing projects and `.wf` files keep working.
- **First batch (8):**
  - `std.login`, `std.signup`
  - `std.settings_page` (slots for sections)
  - `std.data_page` (page header, a `filters` slot, table and pagination)
  - `std.site_header` (logo, `nav` `variant: top`, actions)
  - `std.site_footer`
  - `std.hero` (a `media` slot with fallback)
  - `std.not_found`

  Together they cover prop defaults, named fills, fallbacks and an empty fill. Further
  patterns are a follow-up.
- **CLI:**
  - `wf component list --std` lists built-ins, one per line.
  - `wf component show std.<name>` describes one.
  - `wf component copy std.<name> [--as <id>] [--file <path>]` writes the definition
    into the project's default components document, or an existing valid components
    document given by `--file`. It creates the default document if missing, refuses id
    collisions, and validates the result. The copy then builds and edits like any local
    component.
- **Read-only built-ins.** Source links and selections inside a built-in point users to
  `wf component copy`.
- **Catalogue:** a "Patterns" section renders each pattern through the **real
  resolver**.
- **`wf llm`:** lists patterns with props and slots, generated from the definitions.

### 4.5 New elements and states

| Family | Change | Contract |
|---|---|---|
| navigation | **`command`**: a command palette | `placeholder` (primary), `query`, `items` (groups and items with `icon`, `description`, `shortcut`, `selected`), `empty` (shown when there are no items), `footer: bool`. Display-only (§4.2). |
| navigation | **`menubar`**: a desktop application menu row | `items` (menus with nested `items`), `open` (value or label of the menu drawn open, with its panel below the trigger). Display-only. |
| navigation | **`nav` `variant: top`**: a horizontal site menu | Items with nested `items` show a chevron, and `open` draws that item's panel of links with icon and description. |
| controls | **`toolbar`** | `items` (icon buttons with `label` as accessible name, `pressed`, `disabled`, plus `separator` entries), `size: sm\|md\|lg`, `orientation: row\|stack`, `labels: bool`. `pressed` toggles at runtime. |
| controls | `button.pressed` | Toggle-button state, including with `iconOnly`. |
| controls | `checkbox.indeterminate` | Overrides `checked`. |
| controls | `select.value` | Initial selection, or an array with `multiple`. Resolved through §4.1 selection. |
| controls | `input` `min`, `max`, `step` | See the rules below this table. |
| controls | Field contract | Per the §4.2 mapping. |
| data | **`chart` `chartType: gantt`** | See the rules below this table. |

**`input` bounds.** These apply to `number`, `range` and `stepper`, which are drawn,
not interactive.
- Defaults: `min` 0, `max` 100.
- Bounds given in reverse order are swapped. When `min == max`, the thumb sits at the
  start.
- `value` is clamped into range. A `range` with no `value` keeps today's 40% thumb.
- `value` may be an array of exactly two finite numbers, sorted, **only** with
  `inputType: range`. That draws two thumbs. Lint `UNKNOWN_PROP_VALUE` covers misuse.
- `step` changes the stepper and number display only. Nothing snaps.
- Templated values resolve through the existing binding helpers.

**Gantt.** It uses its own data branch, so existing series rendering is untouched.
- `data` is `[{ label, start, end, tone? }]` with numbers.
- The domain is the smallest `start` to the largest `end`. A zero-width domain is padded
  by ±1, and reversed endpoints are swapped.
- `ticks` is a list of labels spaced evenly across the domain.
- Rows are fixed-height. The chart grows with the row count unless `height` is set, and
  row labels truncate with an ellipsis at narrow widths.
- With no `data`, it draws deterministic seeded bars. `data: []` draws the empty chart
  state.

Each new element needs a registry entry with a renderable `example`, a renderer, family
CSS, and gallery examples in both modes on that family's **existing** gallery pages.
Frame classes follow `frame-rules.js`. A family file that would pass 500 lines splits
into `<family>-<topic>.js`, and the family adds its own lines to
`primitives/index.js`.

### 4.6 Measurement overlay

**Runtime.** A new module, `engine/renderer/interactions-measure.js`, is part of the
page runtime.
- **Output bytes:** the runtime asset and inline runtime change deterministically, so
  the same input and engine version give the same bytes. No measurement DOM, attribute
  or listener side effect exists until measurement is switched on. Switching it on and
  off never changes the page's HTML serialization or build artefacts.
- **Coordinates:** measurement happens in the iframe's own CSS pixels, and the layer is
  drawn in the same viewport coordinates. The host's zoom of the iframe needs no
  correction.
- **Size convention:** labels show the border-box size, rounded only when formatted.
  Zero-size, hidden or fragmented targets are skipped.
- **The layer:** `data-wf-measure`, `pointer-events: none`, above overlays, and clipped
  to the viewport so it never creates scroll overflow. It redraws on scroll and resize.

**Targets.** Any element carrying a node id from the renderer shell is a target,
independent of source annotation. For an overlay shell, the visible
`.wf-overlay-content` is measured instead.

**What it shows.**
- Hover: outline, a width line above (below when there is no room) and a height line
  beside. Both are hairlines with end ticks and a monospace label chip.
- Click or tap: pins the target. Hovering or tapping another target then shows gaps
  between visible border-box edges on each axis. When the boxes overlap on an axis, the
  inset distances between the matching edges are shown.
- Padding bands and child gaps: shown only for `stack`, `row` and `grid` containers,
  read from computed `padding` and `gap`.

**Input mode.** When on, capture-phase listeners on `window` for `pointerdown`,
`mousedown`, `click`, `keydown` and `touchstart`/`touchend` stop the event before
existing handlers run. A shared `isMeasuring()` gate is checked by the runtime paths
that do not go through those events: pending gesture timers, outside-dismiss and
keyboard activation. The admin `wf:nodeClick` bridge also respects it.
- Escape is handled once: it unpins, or does nothing when nothing is pinned.
- Targets are found by pointer hit-testing (`elementsFromPoint`), so disabled controls
  can be measured.
- Scrolling still works.

**Switching it on and off.**
- **Hosts:** `{ type: 'wf:measure', on: boolean }`. The runtime accepts it only from
  `window.parent`, and only with a boolean.
- **Browser library:** `setMeasure(on: boolean)` on `createWireframe()`.
- **Standalone pages:** the `m` key toggles, only when the page is the top window and
  focus is not in a text field. Embedded pages ignore `m`, so the host stays the single
  source of truth.

**Admin.**
- One desired state lives in the editor's state store, persisted per viewer in
  `localStorage`. It is wired to the mounted toolbar and preview: `PreviewToolbar` and
  `WorkspacePreview` in the project editor, plus the workspace controls.
- The state is replayed on every iframe load, which covers page navigation, mode and
  device changes and re-renders.
- `PreviewPane` gets the same replay through `postMessage`.
- The toggle has a ruler icon, `aria-pressed`, a visible label or tooltip, a hit target
  of at least 44×44 px, and an English string.
- The `Workspace` control interface gains `setMeasure(on)`.
- `ProjectEditorPage.tsx` is split below the cap before it is edited.
- The toolbar wireframes in `admin_wireframes` are updated, checked against the brief,
  and rebuilt.

### 4.7 Docs and generated artefacts

- Each tranche documents what it adds, in sections it owns:
  - Schema docs: `schema.md`, `schema-systems.md`, `schema-canonical.yaml`.
  - The CLI and command help it changes: `brief.md` and the command help text.
  - `wf-format.md` for the browser API, and `architecture.md` for `Workspace`.
- **Size cap.** `rendering.md` (997) and `rendering-modes.md` (1,035) must not grow. New
  rendering content goes into new files linked from them with one line:
  `rendering-states.md` (T1), `rendering-measure.md` (T3), and additions to the existing
  `rendering-controls.md` and `rendering-navigation.md`, plus a new `rendering-data.md`
  (T6). If an edited file would pass its cap, split it first.
- **Generated files** are never hand-edited or hand-merged. Each branch regenerates them
  so its own gates pass. At integration, branches merge **serially**, and after each
  merge I regenerate:
  - `node scripts/sync-schema-primitives.js`
  - `wf catalogue --out docs/catalogue`
  - `wf llm --short > docs/cli/agent-guide.md`

  Only then do the drift gates run. Hand-written node schema changes are kept before
  regenerating.
- **Baselines.** Branches commit win32 baselines from Maxis for their own pages only. At
  integration, both tracked sets are regenerated on matching hosts and every changed
  image is reviewed. README images (`pnpm readme:update`) are regenerated only if the
  README's elements changed. No new gallery pages are added, so `PAGE_IDS` stays as it
  is.

### 4.8 Compatibility

- YAML that is valid today stays valid and renders identically.
- Existing baselines for unchanged elements must not move.
- The browser library, the `.wf` format and the overlay schema change only by addition.
  The separate mobile repository is untouched.

## 5. Implementation Order

| # | Tranche | Owns | Starts after |
|---|---|---|---|
| T0 | Baseline (done, `9640bf8`) | `.gitattributes` | — |
| T1 | Shared contracts | `engine/renderer/items.js` (new), `render-lib.js` (`items` wrapper, re-exports, `actionButtons`), `render-attrs.js` (`stateAttrs`), `primitive-registry/shared.js` (new), `llm-reference.js` (shared Items and Fields sections), `cli/test/items.test.js` and `state-attrs.test.js` (new); docs `schema-systems.md` (Items, Fields and states) and new `rendering-states.md` | T0 |
| T2 | Component slots | `engine/resolver/**`, `engine/component-registry/**` (including `child-nodes.js`), the split of `doctor/semantic-validator.js`, `doctor/{component-slots,component-graph,reference-checks}.js`, `validate/**`, `lint/index.js` (traversal), `component/index.js`, `build/source-stamps.js`, `addressing/**`, `node/**` (fill paths), hand-written node, `SlotPlaceholder` and `slots` definitions in `schema.json`, `cli/commands/commands/component.js` (`show`), `cli/commands/registry.js` (help), `admin/src/features/workspace/useWorkspaceData.ts` and a new admin test file, CLI tests; docs `schema.md`, `schema-systems.md` (validation), `schema-canonical.yaml`, `brief.md` (component commands) | T0 |
| T3 | Measurement overlay | `engine/renderer/interactions-measure.js` (new), hooks in `interactions.js`, `interactions-overlays.js` and `interactions-panes.js` for the gate, `renderer/src/mount.ts` and its types, `ProjectEditorPage.tsx` (split, then wire), `editor/{PreviewToolbar,PreviewPane}.tsx`, `workspace/{Workspace,WorkspacePreview}.tsx`, the editor state store, `i18n/locales/en.json`, new admin test files, `cli/test/measure-browser.test.js` (new), `admin_wireframes/**`; docs new `rendering-measure.md` with a link line in `rendering.md`, `brief.md` (`m` key), `wf-format.md`, `architecture.md` | T0 |
| T4 | Navigation family | `primitives/navigation*.js`, `styles/navigation.js`, `primitive-registry/navigation.js`, its lines in `primitives/index.js`, gallery `navigation_elements`, `mobile` and `android` pages with their win32 baselines, `rendering-navigation.md` | T1 merged |
| T5 | Controls family | `primitives/controls*.js`, `styles/controls.js`, `primitive-registry/controls.js`, `interactions-controls.js`, `render-attrs.js` `renderSelectOptions` (select only), its index lines, gallery `forms`, `line_forms` and `auth` pages with their baselines, `rendering-controls.md` | T1 merged |
| T6 | Data, containers, text, feedback, overlays | `primitives/{data-structures,chart,containers,text,table}.js`, `overlay-renderer.js`, `styles/{data,containers,content,overlays}.js`, `primitive-registry/{data,containers,text,feedback}.js`, the hand-written overlay `actions` schema, index lines, gallery `data`, `charts`, `containers`, `content`, `line_structure`, `line_data` and `overlays_elements` pages with their baselines, new `rendering-data.md` | T1 merged |
| T7 | `std` patterns | `engine/stdlib/**` (new), the lookup rule in `engine/component-registry/**`, `engine/catalogue/**` (Patterns section), `component.js` (`--std`, `copy`), `engine/component/index.js` (copy writer), std list in `llm-reference.js`, `cli/test/engine-boundary.test.js` and a renderer bundle test, CLI and renderer tests; docs new `docs/cli/stdlib.md`, `brief.md`, `schema.md` (std lookup) | T1, T2 and T4 merged |
| T8 | Integration (orchestrator) | Serial merges, regeneration, both baseline sets, docs reconciliation, a T13 note in the overhaul plan, full verification, the independent final review, one PR | all |

**Ownership rules:**
- A family tranche edits no other family's files.
- A tranche that needs a change outside its ownership makes the smallest hook and
  reports it.
- Shared markdown files are edited only in each tranche's own sections. Text conflicts
  are resolved at integration.

## 6. Edge Cases

- **Consumers that already rendered something** keep rendering it. Tests compare
  legacy-only YAML output before and after.
- **`value` matches several items:** in single-choice elements only the first match is
  selected, and lint reports `AMBIGUOUS_VALUE`.
- **Explicit item `selected: false`:** beats a matching element value.
- **Both `help` and `description` on a checkbox:** `help` wins, and lint reports alias
  info.
- **`readonly` with `disabled`:** `disabled` wins visually, and both attributes are
  emitted.
- **`checkbox.indeterminate` with `checked: true`:** indeterminate wins.
- **Slot fills:** omitted means fallback, while `[]` means intentionally empty. Both
  `children` and `slots.default` is an error.
- **Two instances of the same forwarding component on a page:** component-authored
  fills are namespaced per author instance, so their ids differ. Page-authored fill ids
  must be unique in the page, as today.
- **Collection binding inside a page fill:** `{{item.x}}` resolves in the page context.
- **Caller-authored nested instance of the same component:** legal finite nesting.
  Definition cycles are errors.
- **Measurement while an overlay is open:** the overlay is measurable, and clicks pin
  rather than dismiss.
- **Measurement on touch:** tap pins, and tapping the pinned target again unpins.
- **Measurement under reduced motion:** nothing animates, with or without the setting.
- **Determinism:** `normalizeItems`, field rendering, slot resolution, std definitions
  and gantt placeholder bars are pure functions of their input. Measurement exists only
  at runtime.

## 7. Non-Goals

- No dependency on `@ui-sdk/*` or any component framework.
- No keyboard widget behaviour (typeahead, roving focus) in wireframes.
- No colour-picker area, image cropper, mention trigger menu, or trace-waterfall view
  beyond the `gantt` chart.
- No migration of the three wireframe projects to the newer elements. That is the
  overhaul's T17.
- No overhaul T4, T12 or T14.
- No admin UI for browsing patterns, and no replacement of admin's YAML tree with the
  engine tree (both are follow-ups).
- No `std` patterns beyond the first 8.
- No measured screenshot export.
- No changes to the mobile repository.

## 8. Verification

**Each tranche:**
- Focused tests on Minis.
- The full suites on Maxis in its own Maxis worktree: `pnpm test` at the root, renderer
  `pnpm test` and admin `pnpm test`.
- win32 baselines from Maxis for its own pages, reviewed as images.
- `wf validate` and `wf build` clean in the three projects.
- A scratch project that exercises everything it added, viewed in a browser.

**Required acceptance cases:**
- **Legacy items:** every legacy item form renders unchanged.
- **Disabled routed action:** renders without a link.
- **Fields:** help plus error, and readonly plus disabled, both rendering correctly and
  submitting through the runtime.
- **Two-layer slot forwarding** with props tokens, a locally imported component and a
  submit action. Two instances of the forwarding component on one page.
- **Admin selection:** clicking a page fill highlights it in the tree and edits the page
  document.
- **`std` patterns:** one resolves in the CLI and in the browser bundle for a project
  with no component file. `wf component copy` produces a project component that builds.
- **Measurement:**
  - The label equals the node's border-box width under admin zoom.
  - Pinned gaps are correct.
  - No navigation, overlay dismissal or gesture fires while measuring.
  - Disabled controls can be measured.
  - Turning it off removes the layer.
  - Toggling leaves the page's HTML serialization unchanged.
  - The state survives navigation and re-render in admin.

**Integration (T8):**
- Everything above on the merged branch, the exact baseline failure signatures
  re-established, and both baseline sets.
- Hands-on use via `wf serve` and the admin preview.
- An independent review from a different provider before the PR.

## 9. Review Findings

Codex (`gpt-6.2-sol`, high effort) reviewed `e3b2d71` adversarially. The full text is in
the orchestrator's session scratchpad; the decisions are below. Sections 1–8 above already
incorporate every adopted change.

| # | Sev. | Finding | Decision |
|---|---|---|---|
| 1 | blocker | Slot content needs author-scoped substitution and namespacing before nested expansion. | **Adopt**: §4.3 "Scope by author", plus the two-layer forwarding acceptance case. |
| 2 | blocker | Source stamps, addressing and admin cannot map slot content back to its source. | **Adopt in part**: stamps carry document and path, addressing and `wf node` walk fills, the admin YAML walker descends into `slots`, and internals select their instance. **Defer** moving admin onto the engine tree. |
| 3 | major | Rendered ids and edit identity collide for repeated instances. | **Adopt**: component-authored fills are namespaced per author instance; uniqueness is checked on the final tree. Fixing generated-id collisions globally is out of scope. |
| 4 | major | Placeholder grammar, root placeholders and empty or duplicate fills are undefined. | **Adopt**: §4.3 grammar and fill rules, with `SlotPlaceholder` as its own schema object. |
| 5 | major | Validators and traversals walk only `children`. | **Adopt**: shared `childNodeLists`, finite nesting legal, validator split first. |
| 6 | blocker | A typed item schema would reject YAML that is valid today. | **Adopt**: no schema tightening; render-time normalization; `select` booleans kept. |
| 7 | major | Legacy alias precedence and defaults differ per renderer. | **Adopt**: per-consumer legacy profiles; absent booleans never defaulted. |
| 8 | major | Selection, identity and runtime payload rules are ambiguous. | **Adopt**: §4.1 selection precedence; label payloads kept; `select.value` added. |
| 9 | major | The migration inventory misses consumers and data arrays. | **Adopt**: explicit opt-in and stays-data lists. |
| 10 | major | Overlay and app-bar actions bypass the helper; routing rules are unclear. | **Adopt**: overlay footers move to the helper (T6); app-bar unchanged; §4.1 route rules. |
| 11 | major | A universal field shell changes layouts and breaks binding and submission. | **Adopt**: extend existing helpers, per-widget mapping, readonly keeps native elements and values, `aria-describedby`. |
| 12 | major | Generic ARIA can land on the wrong element or go stale. | **Adopt**: serializer only, renderer-chosen owner, display-only roles, runtime keeps attributes in sync. |
| 13 | major | Input bounds and two-thumb ranges have no contract. | **Adopt**: §4.5 bounds rules, arrays only for `range`. |
| 14 | minor | Gantt axis and empty cases are underspecified. | **Adopt**: §4.5 gantt rules. |
| 15 | major | Reserving `std` breaks projects that use it as an alias. | **Adopt**: built-ins as fallback, project alias wins, `STD_ALIAS_SHADOWED` info. |
| 16 | major | `std` must resolve the same way in every entry point, including the browser. | **Adopt**: single lookup rule, lazy inclusion, browser bundle test. |
| 17 | major | Component CLI changes break `list` and leave `copy` unspecified. | **Adopt**: `list` unchanged, `show`/`--std`/`copy` contracts, self-contained patterns. |
| 18 | minor | The catalogue resolver gap, too many patterns, and a late top-nav swap. | **Adopt**: real resolver, first batch of 8, T7 after T4 so `std.site_header` uses `nav top` directly. `std.confirm_dialog` dropped. |
| 19 | blocker | "Byte-identical builds" contradicts shipping the runtime. | **Adopt**: repeatability per version, zero measurement DOM before activation, serialization test. |
| 20 | major | Zoom correction is wrong; measure inside the iframe. | **Adopt**: §4.6 coordinates and size convention. |
| 21 | major | Click interception misses mousedown dismiss, Escape, keys and gestures. | **Adopt**: §4.6 input mode with capture and a shared gate. |
| 22 | major | Targets and distances are undefined for wrappers, overlays and gaps. | **Adopt**: §4.6 targets; padding and gaps only for layout containers. |
| 23 | major | State must follow the mounted preview and survive iframe replacement. | **Adopt**: one store, replay on load, embedded pages ignore `m`, message validation, editor split. |
| 24 | blocker | Exclusive ownership conflicts with drift gates and shared files. | **Adopt**: serial merges with regeneration at integration, sections of shared docs, no new gallery pages, sequential T2 → T7. |
| 25 | major | Docs checklist, file caps, and the non-Windows baselines are missing. | **Adopt**: §4.7 new rendering files, both baseline sets at integration, README check. |
| 26 | major | Shared dispatch, runtime and integration flows lack owners. | **Adopt**: index lines per family, T5 owns `interactions-controls.js`, T6 adds `line_data` and overlays pages, separate admin test files, failure signatures re-checked at T8. |

Nothing was rejected outright. Two items were narrowed to keep this plan bounded: #2
defers moving admin onto the engine tree, and #3 leaves global generated-id collisions
alone. Both are recorded in §7.

## 10. Implementation Decisions

These changed or sharpened the design while it was built. The code and the docs under
`docs/cli/` are authoritative.

- **Nav `active` (T4).** It stays part of nav's legacy rule, next to route inference,
  rather than becoming an alias of `selected`. Mapping it changed existing output. Tab
  bars still map `active` to `selected`.
- **Slot grammar (T2).** The schema accepts a placeholder and `slots` wherever a node may
  appear, and the validator enforces positions. Otherwise schema errors would hide
  `SLOT_OUTSIDE_COMPONENT` and `SLOTS_WITHOUT_USE`.
- **Prop default fix (T2).** A root prop written as a bare `{{props.x}}` token now takes
  `propDefaults`. Previously it printed the raw token. This also fixes components without
  placeholders.
- **Source path attribute (T2).** Source stamps keep `data-wf-source="doc#id"`. The
  authored path goes in a separate `data-wf-source-path`.
- **Nested definitions in validation (integration).** A component's nested definitions
  are checked in their own id scope, so reusing an id that a nested component also uses
  is no longer a false `DUPLICATE_NODE_ID`.
- **`std` alias (T7).** A project alias `std` shadows only the ids it defines. Other
  `std.*` ids still reach the built-ins, and `STD_ALIAS_SHADOWED` says so. Built-ins
  never join a registry, so listings and unused-component reports are unchanged.
- **Read-only ARIA (T5).** Segmented, picker and standalone radio get `data-wf-readonly`
  without `aria-readonly`, because their roles don't support it.
- **Number clamping (T5).** `number` and `stepper` clamp only when `min` or `max` is
  set, so values above 100 in existing projects stay put.
- **Control runtime (T5).** Checkbox, radio and toggle now toggle on click, read-only
  controls ignore changes, and disabled fields are not submitted. A multiple select
  submits a list.
- **`choice_group` fix (T5).** A row selected by `value` now draws its dot. It was
  selected but never drawn.
- **Stepper help (T5).** A stepper shows `help`, and `error` replaces it. Authored
  help used to be dropped silently. With the `choice_group` dot, these are the only
  visible changes for legacy-only YAML; a browser test compares every other legacy
  control pixel by pixel against the legacy markup and stylesheet.
- **Disabled look (T5, review).** Native fields (text types, number, colour,
  `textarea`, `select`) keep the browser's disabled look; the wrapper fade was
  removed. Drawn controls fade one layer to 0.5, as the legacy disabled checkbox and
  button do. That covers range, otp and stepper, which ignored `disabled` before. A
  disabled `choice_group` no longer fades its rows a second time, and toolbar items
  moved from 0.45 to 0.5.
- **Runtime refresh (T5, review).** A bound value refreshes with the semantics it
  rendered with: a multiple select keeps its list, number fields and steppers clamp
  to `min`/`max` and show `step` decimals (a bound stepper refreshes at all now), and
  a bound mixed checkbox stays mixed until its `checked` state changes or the user
  activates it. A bound select keeps explicit option `selected: true`/`false` over a
  matching value, and a stepper's bound `disabled` survives value changes. A browser
  test checks a grid of literal and bound values for parity.
- **Segment identity (T5, review).** Labels stay the binding payload; the runtime keeps
  the chosen segment as the choice, so one of several segments sharing a label stays
  selected through refreshes.
- **Drawn-control submission (T5, review).** Checkbox, radio, toggle, segmented,
  choice group and picker submit under their node id, from the state they show:
  booleans (or `"mixed"`), the chosen option's `value` else its label, or a list for a
  checkbox group. Read-only values go; disabled controls and individually disabled
  options do not, in drawn groups and native selects alike, as in HTML. (A selected,
  individually disabled `segmented` option still submits; that is a follow-up.) On `main` the
  checkbox was a drawn mark and submitted nothing; before 2 November 2026
  (`7e1b19e`) it was a native checkbox that submitted `true`/`false` under the node
  id, which is the key and shape it has again. Native field keys are unchanged.
- **Picker centring (T5, review).** With nothing selected, the wheel keeps its legacy
  rule: the first option whose label is the `value` text, so with no `value` the
  first blank option, else the first option. Options marked `selected: false` are
  skipped.
- **Measurement (T3, review).** Labels show one decimal. Pins happen on `pointerup`,
  because disabled controls get no `click`. A press that drags past 8 px, or is
  cancelled, does not pin. Pane sizes are not saved while measuring, and timed overlay
  dismissals pause and resume with their remaining time.
- **Bundle budget (integration).** The renderer budget rose from 420 KB to 460 KB, with
  the user's approval. The bundle went from 329 KB (90 KB gzip) on `main` to 436 KB.
- **Slot resolution (review).** A filled placeholder becomes a marker while the callee
  expands, and the caller's prepared fill replaces it afterwards, so no callee rewrites
  page content, including through slotless components. A component's authored root id
  maps to the instance id for form references on both paths. Slot checks run for
  definitions imported only by a page or template. Ids and form references are checked
  on resolved page and template overlays.
- **Admin selection (review).** The admin tree lists fills of any instance, including
  imported and built-in ones, plus page overlay content. A click selects the first
  rendered ancestor the tree knows. Preview messages are accepted only from the preview
  window and the page's own origin.
- **`std` scoping (review).** A module's own `std` alias shadows only the ids it
  defines; other `std.*` ids reach the built-ins. Component addresses resolve through
  the project registry, so `inspect`, `wf node` writes and `remove` act on the
  definition's real source file. A component is read-only only when lookup fell back
  to a built-in.
- **`wf component copy` (review).** The target must resolve inside the project. The
  definition's text is inserted into the existing document, so comments and formatting
  survive. The result is validated, then written atomically.
- **Gallery pages (review).** Two pages were added despite §4.7: `app_navigation` (card)
  and `line_navigation` (line). They keep the new navigation elements, toolbar and
  gantt inside the 1280×900 screenshot. Both baseline sets include them; the macOS set
  was regenerated on the Mac.
- **Native form submission (integration).** A `form` renders a real `<form>`, so its
  untyped buttons submitted it natively and reloaded the page. The runtime now blocks
  native submission, and prototypes submit through their submit interactions.
- **Generated artefacts (T0, integration).** `.gitattributes` keeps `schema.json`, the
  catalogue's HTML and CSS, and the agent guide LF. Windows checkouts otherwise failed
  the byte-for-byte drift tests.
- **Canonical YAML (integration).** `schema-canonical.yaml` parses again, and a test
  keeps it loadable.
- **Source lint (sync with `main`).** `main` moved the doctor and lint rules into
  in-memory modules shared by disk and YAML text (`docs/cli/source-lint.md`). The slot
  rules and `STD_ALIAS_SHADOWED` run in `doctor/project-checks.js`, so `lintSources`
  reports them with a range. `child-nodes.js` gives each child list's path, so a fill is
  located as `slots.<name>[i]`. The semantic walk lives in `doctor/node-walker.js` and
  what a node refers to in `doctor/semantic-interactions.js`; `node-rules.js` was folded
  into them.
