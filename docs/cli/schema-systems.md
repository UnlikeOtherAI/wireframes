# Wireframe Schema — Systems & Validation

Continued from [schema.md](schema.md). Covers layout, state, interactions,
overlays, panes, wireframe style, data binding, primitives, and validation.

---

# 5. Layout System

Allowed layout types:

* stack
* row
* grid
* absolute
* overlay

Layout properties: gap, padding, columns (grid), justify, align,
separatorPolicy, separators, separatorStyle.

Grid:

* columns defined per context
* spans must not exceed columns
* span cannot coexist with explicit width
* without `columns`, a grid whose children use no `gridItem` lays out tiles at
  least `grid.minItemWidth` wide (web 220, tablet 200, mobile 150) that fill the
  row and wrap. This applies to the `grid` element and to `layout: { type: grid }`
  alike. An explicit `manifest.defaultGridColumns` gives such a grid that many
  equal columns, but an authored `minItemWidth` and adaptive reflow take
  priority over it. Any child placed with `gridItem` keeps the column system
  (`columns`, else the manifest default, else 12) in every mode. Precedence:
  [rendering-data.md § Grid columns](rendering-data.md#grid-columns)

Separators:

* `separatorPolicy: auto | gutters | divide | none`
* `separators: none | between`
* `separatorStyle: solid | dashed`
* If `gap > 0`, gutters win and divider policies are ignored
* If `gap == 0` and divider rendering is requested, the parent renders the
  separator and child surface strokes on that shared edge are suppressed

Absolute:

* children positioned via `position` property (top, left, right, bottom in px)
* only valid on children of nodes with `layout.type: absolute`

No arbitrary CSS.

---

# 6. Responsive System

Contexts declared in sitemap.

Responsive values allowed for:

* width
* height
* span
* gap
* padding
* columns
* align
* visibility

No implicit breakpoints in a document. The renderer's opt-in `adaptive` option is a view of a page, described in rendering.md, and is not part of the schema.

---

# 7. State System

Two scopes only:

## appState

Defined in sitemap.
Persists across routes.

## pageState

Defined in page.
Resets on navigation.

State keys:

* Must follow dot-path grammar
* Must exist before being referenced

No component-local hidden state.

---

# 8. Interaction Model

Allowed types:

* navigation
* open_overlay
* close_overlay
* toggle
* set_state
* submit
* action
* gesture

Required fields per type:

* navigation: `targetRoute`
* open_overlay: `targetOverlay`
* close_overlay: `targetOverlay`
* toggle: `scope`, `stateKey`
* set_state: `scope`, `stateKey`, `value`
* submit: `formId` (references a node ID that acts as a form container)
* action: `actionId`
* gesture: `gestureType` (swipe_left, swipe_right, swipe_up, swipe_down, long_press, pinch, double_tap)

All interaction types may include an optional `condition` for conditional execution.

Per-type field requirements are enforced by the code validator, not JSON Schema.
JSON Schema validates structure; the validator checks semantic rules.

No raw JS.
No freeform onClick.

---

# 9. Conditions

All conditional logic must use structured `Condition`.

Allowed condition types:

* `state_equals` — required: `scope` (page|app), `key` (StateKey), `equals` (any value)
* `route_match` — required: `routeId` (Id)
* `compare` — required: `left` (Expression or literal), `op` (eq|ne|gt|gte|lt|lte), `right` (Expression or literal)
* `and` — required: `conditions` (array of Condition)
* `or` — required: `conditions` (array of Condition)
* `not` — required: `condition` (single Condition)

String expressions are not allowed. All conditions are structured objects with `type` + required fields.

---

# 10. Addressing Model

Canonical URI format:

```
wf://<doctype>/<docid>#<path>
```

Examples:

```
wf://page/dashboard#main_content.stats_grid.sales_card
wf://template/app_shell#left_bar.nav.products
wf://component/metric_card#root.value
wf://data/products#items:sku=ABC123
```

No index-based addressing.

A path descends through a node's `children` and through the named slot fills of
a `use:` node, matching by id, so a page fill is addressed on its instance:
`wf://page/billing#main.billing_panel.upgrade`. `wf node` and `wf inspect` use
the same rule; `wf node add --inside` a `use:` node fills its `default` slot.

Annotated renders (`annotateSource: true`) stamp each node with
`data-wf-source="<doctype>:<docid>#<node id>"` (the document that wrote it) and
`data-wf-source-path` (where it is written in that document, relative to the
page document, the template or the component definition, for example
`page.slots[0].content[1].slots.footer[0]` or `root.children[1].children[0]`).

Resolved nodes must track:

* origin (page/template/component)
* sourceRef
* resolvedAddress

---

# 11. Overlay System

Overlay types:

* dropdown
* popover
* menu
* modal
* drawer_left
* drawer_right
* bottom_sheet
* toast
* alert
* tooltip

Each overlay must define:

* `id` — unique within the page (or template)
* `type` — one of the types above
* `content` — node tree for overlay body

Optional:

* `trigger` — ID of the node that opens this overlay
* `placement` — top, bottom, left, right, center
* `dismissOn` — array of dismissal triggers: backdrop, escape, button, timeout, outside
* `wireframeStyle` — per-overlay style override
* `props.title` — title in the overlay header
* `props.actions` — footer actions: `{ label, variant, route, disabled, tone }`, no other keys. They render like every other action row (§15.4).

Rules:

* dropdown/popover/menu/tooltip require trigger + placement (enforced by code validator)
* modal/drawer/bottom_sheet typically use backdrop + escape dismissal
* menu overlays typically use outside + escape dismissal
* overlays inherit page wireframe style unless overridden
* overlays may be defined at page level (`page.overlays`) or template level (`template.overlays`)
* template overlays are available on every page using that template (e.g. nav dropdowns, notification panels)
* overlay IDs must be unique across template + page overlays for a given page
* toast/alert may use timeout dismissal

Z-order fixed:

1. base
2. overlay
3. modal
4. toast

---

# 12. Pane System (Resizable Panels)

Nodes may define:

```
pane:
  side
  defaultSize
  minSize
  maxSize
  resizable
  collapsible
  collapsedSize
  state:
    scope
    sizeKey
    collapsedKey
```

Used for:

* left chat
* right inspector
* any split layout

Rules:

* `resizable` and `collapsible` are always required
* `state` is required only if the pane needs to persist its size/collapsed state
* If `state` is provided, its `scope`, `sizeKey`, and `collapsedKey` are required
* State keys must exist in the referenced scope

---

# 13. Wireframe Style System

Must exist on every page:

```
wireframeStyle:
  border:
    style: solid|dashed   # required
    width: thin|medium
  corner:
    style: sharp|rounded
    radius: number
```

Inheritance:

* corner and border.width may inherit
* border.style does NOT inherit
* page must explicitly define border.style

Per-node and per-overlay overrides use a partial style — no fields are
required. Only the properties being overridden need to be specified;
everything else inherits from the page wireframe style.

Rendering mode interaction:

* In `line` mode, `wireframeStyle` maps to CSS `outline` on surface containers.
  `corner.radius` is divided by 3 to preserve the schematic aesthetic.
* In `card` mode, `wireframeStyle` maps to CSS `border` + `border-radius` on
  surface containers. A `box-shadow` is added automatically.
* `node.surface: false` suppresses framing on nodes that would otherwise render
  as surfaces; `node.surface: true` forces surface treatment on custom wrappers.
* `node.elevation: 0-3` selects the card-mode shadow token for that node and is
  ignored in line mode.
* See [rendering-modes.md](rendering-modes.md) for the full CSS
  mapping per mode.

---

# 14. Data Binding

Bindings allowed:

* {{state.key}}
* {{appState.key}}
* {{route.id}}
* {{event.field}}
* {{props.key}}
* {{item.field}}

No arbitrary expressions.

`{{props.key}}` is resolved during component expansion, before HTML render.
That applies to local components and imported component documents alike, so
prop values can drive labels, nested component props, and `Condition` payloads
used for smart-object style branching.

Collection renderers must define:

* binding.source
* itemVar

### Datasets (Mock Data)

Datasets are defined in optional `data/<datasetId>.yaml` files. A project can
omit the `data/` directory entirely when no page references datasets. Each
dataset contains an array of plain key-value objects (items) identified by a
`primaryKey`.

Items are always passed and stored as **whole objects** — no field-by-field
construction or mutation. To update an item, replace the entire object.

Datasets support any value types: strings, numbers, booleans, arrays,
and nested objects. Common patterns include navigation menus, user lists,
table data, and notification feeds.

The optional `fields` array declares expected field names for validation
and tooling hints, but items may contain additional fields beyond what
is declared.

## 14.1 Repeat

`repeat` renders one cell per keyed item of an inline array. Use it for three
or more similar siblings, such as people, plans or stat tiles.

```yaml
- id: team
  component: grid
  layout: { type: grid, columns: 3 }
  repeat:
    cell: person_card            # an element (name or alias) or a component reference
    items:
      - { id: ada, name: Ada Lovelace, role: Admin }
      - { id: grace, name: Grace Hopper, role: Editor }
```

**Grammar.** `repeat` takes exactly `cell` and `items`. `cell` uses the `use:`
grammar. A registry element name or alias wins; anything else is a component
reference, qualified like `use:`: a local id, `alias.id`, `std.<name>`. Use a
qualified reference to reach a component that shares an element's name.
`items` holds 0–200 maps. Each has an `id` (`Id` pattern, unique in the
repeat) and the cell's props. There is no scalar shorthand and no per-item
`slots`.

**Hosts.** Only a concrete `component:` node whose element lays out its
authored children hosts rows: `section`, `card`, `stack`, `row`, `grid`,
`split`, `form`, `carousel`, `app_bar`, and `tab_bar` or `bottom_tab_bar`
without `tabs`. A host can sit in template region children, page slot and
injection content, overlay content, a component definition, a slot fallback
and a slot fill. A `use:` node, an injectable marker, a slot placeholder, a
template region record, an overlay record and any other element is
`REPEAT_INVALID_HOST`, and its rows never render.

**Rows.** Each item becomes the node an author would write by hand:
`{ id: <host id>__<item id>, component: <cell>, props }` for an element cell,
or `use: <cell>` for a component cell. The props are the item without its
`id`. Rows follow the host's own `children`, in item order. They are expanded
by the host's author, where hand-written siblings would be:
* rows in a component definition after its `{{props}}` substitution and before
  namespacing, so they get the definition's props and become
  `<instance>__<host>__<item>` per instance;
* rows in caller content (a page, a template, a fill) before the callee
  expands. A fill forwarded through another component keeps its rows' page ids
  and gets no callee substitution.

Rows follow the override rules of hand-written children. In a component
without slots, instance `children` replace the root's children and its rows. A
slot fallback the caller fills, or empties with `[]`, never renders, so its
rows are never made. A row in a definition is stamped with the definition's
file and path, also when the repeat is on the root.

A sibling in the same scope may refer to a row by its id (`formId: team__ada`,
an overlay `trigger`), and a form cell's own submit follows its row. Ids are
checked on the rendered page, so a row id that equals an authored id is
`DUPLICATE_NODE_ID`, located at the item.

**Budget.** One page expands to at most 50,000 nodes, its regions and overlays
together, so repeats that share a page share it, as do the hosts of one
definition. A repeat's whole fan-out, nested components and repeats included,
is checked before its first row is made: `REPEAT_BUDGET_EXCEEDED`, at the
outermost repeat. A fallback the caller replaces costs nothing. The build,
`wf validate` and the in-memory `validateProject` apply the same budget.
`assertComponentExpansion` counts the rows too. The page limits in §16 (5,000
nodes, depth 100) still apply to the result.

**Binding.** `repeat` is for fixed inline content; `binding` stays the dataset
mechanism. A repeat under a collection binding, on a node with one, or with a
cell whose root has one, is `REPEAT_WITH_BINDING`, since the binding would
clone the rows. The rule crosses component boundaries:
* a binding on or above an instance clones every repeat its definition
  renders, and each is reported where the definition writes it;
* a binding on a definition's root, or on the root it delegates to with
  `use:`, clones the content an instance gives it, and so does a binding above
  the placeholder a fill lands in;
* a cell whose root delegates to a bound root counts as a bound cell.

Only a repeat that renders is checked, by the override rules above: rows that
instance `children` replace, or that sit in a filled fallback, are not cloned.
The binding that counts is the one that renders. A `binding` written on an
instance, or on a root that delegates with `use:`, replaces the one on the root
below it, so an expression there means no collection. A single-value `{{…}}`
binding is fine. Items are plain props: `{{item.…}}`
inside an item is not interpreted (`REPEAT_ITEM_TOKEN`, info). Below a row, an
`{{item.…}}` token renders as written, unless a collection inside the row
gives it an item.

**Checks.** On the authored YAML: `UNKNOWN_REPEAT_CELL` (with the nearest
name), `REPEAT_INVALID_HOST`, `DUPLICATE_REPEAT_ITEM_ID`, `REPEAT_WITH_BINDING`,
and a component cell counts as a usage and a dependency edge. On the rendered
page: ids, form references and overlay triggers. A row that cannot be
expanded, for example because its cell uses an unknown component, is
`REPEAT_ROW_FAILED` at its item. Lint runs element prop contracts on each row
that renders, with the values it renders with (after a definition's
`{{props}}`), and reports `…props.<key>` at `…repeat.items[i].<key>`, once
per place. A row that never renders, such as one in a replaced fallback, is not
checked. A component cell's items follow the component-input policy. When one
entry of a page cannot be expanded, it is reported where it is written, and the
rest of the page, its rows included, is still checked. A form or trigger id
missing from such a page is not reported, since it may be in what failed.
`items: []` is `EMPTY_REPEAT` (info). Shape and the 200 limit are schema
errors.

**Editing.** A row is addressed by its id under its host
(`wf://page/home#main.team.team__ada`). The address finds the item by its id
wherever it sits, so reordering never retargets it and a stale id fails. See
`wf inspect` and `wf node` in brief.md.

## 14.2 Leaving out empty parts

`when` on a node keeps it only when its value has content. A component writes
a prop token (`when: "{{props.tagline}}"`), and a caller who passes a blank
string, an empty list, `null` or `false` gets no node, rather than a skeleton
bar or an empty column. The resolver evaluates it once, on the resolved tree
(`engine/resolver/when.js`). By then props, slot fills and fallbacks and repeat
rows are all substituted, so a row's own values decide its parts. The key is
removed from every node it keeps. Validation and rendering see the pruned tree.
A prop the caller leaves out keeps its `propDefaults` value. The std patterns
use it for optional parts ([stdlib.md](stdlib.md#using-a-pattern)).

---

# 15. Elements

The element set, its props and its aliases live in
`engine/schema/primitive-registry/`, and the generated catalogue is in
[schema.md §4.1](schema.md). `wf llm --element <name>` prints one element;
`wf llm --short` prints the whole cheat sheet.

## 15.1 Which elements draw a box

Every node carries the renderer's decision as `data-wf-frame`:

| Frame | Meaning |
|---|---|
| `surface` | a framed container: card, panel, modal, region |
| `group` | a layout wrapper: spacing and alignment only |
| `control` | element-owned chrome: inputs, buttons |
| `content` | bare content: text, icons, images |
| `edge` | one divider edge: tab bars, app bars, rules, and the panels, strips and bars below |

Two frame classes draw chrome only at the top level. Inside a framed
container, or inside a `role: sidebar` slot that draws its own panel, the
container owns that chrome:

- `B`, a bar's own edge: `nav` with `variant: sidebar | rail | top` and
  `menubar`. A sidebar is a panel at `sidebar.width`, a rail a narrow strip
  of icon tiles, a top nav a bar across the width with a bottom rule, and a
  menubar a strip ruled above and below. A `nav` without a variant never
  frames, as before.
- `T`, a box: `menu`, drawn as the dropdown panel.

A template slot with `role: sidebar` draws a sidebar panel: a fill in card
mode, one edge on the side facing the content, and a comfortable inset when
no padding above 0 is authored. A persistent sidebar region stays a surface
([rendering-navigation.md § Navigation kinds](rendering-navigation.md#navigation-kinds)).

One function, `decideFrame(node, ctx)` in `engine/renderer/frame-rules.js`,
settles it, and both the renderer and the linter call it. The ten rules in
precedence order are in [schema.md §4.2](schema.md).

Set `rendering.explain: true` on a page and every node also carries
`data-wf-why="<rule>:<reason>"`. `wf why <nodeId> --page <pageId>` prints the
rule that fired and the one edit that would flip it.

## 15.2 Separators

A container with `separatorPolicy: divide` (or `separators: between`) and no gap
draws the strokes itself: it is marked `data-wf-divides="row|stack"` and each
child except the last carries `data-wf-edge="after"`. Children that would
otherwise frame are demoted to `group`, so a divided row is one block with
rules, not a line of boxes.

## 15.3 Proportions and platforms

A `role` drives size: see [schema.md §4.3](schema.md) for the token table and
the three override levels, and §4.4 for `viewport.platform`.

## 15.4 Items

Collection elements share one item shape. A registry prop marked
`{ type: 'array', items: true }` takes it, and `wf llm` lists that prop as
`name (items)`. The generated schema keeps item arrays open, so YAML that is
valid today stays valid; the model is applied at render time by
`normalizeItems(value, profile)` in `engine/renderer/items.js`.

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
| `type` | `item` (default), `separator`, `heading` or `group` (a label plus nested `items`). |

A string or number entry is `{ label: String(v) }`; choice elements also set
`value`. Booleans, `null`, arrays and other non-objects are dropped, except in
`select`, which keeps rendering boolean options literally. Keys outside the
model pass through untouched, so element data such as a list row's `side` stays
available. A state the author leaves out stays absent: each element applies its
own default.

```yaml
items:
  - Inbox
  - { label: Drafts, value: drafts, icon: file, badge: 3 }
  - { type: separator }
  - { type: heading, label: Labels }
  - { type: group, label: Team, items: [Ada, Grace] }
  - { label: Archive, route: archive, disabled: true }
```

**Legacy keys.** Each element keeps reading the keys it read before the model,
with the same precedence, so older YAML renders exactly as it did. Canonical
keys work everywhere. When an entry has both, the older precedence below wins.

| Profile | Used by | Legacy keys |
|---|---|---|
| `basic` | `breadcrumb`, `stepper`, `page_header.breadcrumb`, actions | `title` fills an absent `label`; an explicit `label` is kept even when blank. |
| `list` | `list`, `carousel` | A nonblank `title` before `label`; `text` before `description`. |
| `accordion` | `accordion` | As `list`, plus `open` → `expanded` (closed unless `true`). |
| `tree` | `tree` | A nonblank `label` before `title`; `children` → `items`; `open` → `expanded` (open unless `false`). |
| `nav` | `nav` | As `basic`; `children` → `items`; a top-level `{group}` or `{heading}` entry is a heading. Legacy `active` is not an alias of `selected`: it stays in nav's own rule (step 3 below), where `active: true` turns a row on next to route inference and `active: false` never turns off the row for the current route. |
| `menu` | `menu`, `action_sheet` | As `basic`; `{divider: true}` is a separator; `danger: true` is `tone: danger`. |
| `tabs` | `tab_bar`, `bottom_tab_bar`, `page_header.tabs` | As `basic`; `active` → `selected`. |
| `choice` | `segmented`, `choice_group`, `picker` | As `basic`; a scalar also sets `value`. |
| `select` | `select` | No legacy keys; scalars, booleans included, set `label` and `value`. |
| `canonical` | `command`, `menubar` | None: these elements are new and read the model keys only. |

These stay element-specific data and do not take the model: table `columns` and
`rows`, chart `data` and `series`, calendar `events`, kanban `columns` and
`cards`, `tags_input.tags`, `upload.files`, `avatar.group`, and app-bar
`actions` (glyphs).

**Selection.** An item's identity is its `value`, else its `label`, compared as
trimmed strings; a blank identity never matches. Precedence, highest first:

1. Items marked `selected: true` are exactly the selection.
2. Otherwise the element `value` (a list when `multiple: true`) selects the
   matching items, skipping any marked `selected: false`. A single-choice
   element selects only the first match, and `wf lint` reports
   `AMBIGUOUS_VALUE` (info).
3. Otherwise the element's own rule applies: nav's legacy `active: true`
   rows plus route inference, stepper `current`, pagination `page`, or the
   picker's first option whose label is the `value` text (with no `value`, the
   first blank option), else its first option. It never selects an item marked
   `selected: false`.
4. Otherwise nothing is selected.

Runtime binding payloads are unchanged: tab and segmented changes still send
labels.

**Routes.** An item `route` renders a link only in elements that already
navigate: `nav`, `breadcrumb`, `tab_bar`, `bottom_tab_bar`, `menu`, `list`,
`command` and actions. A `disabled` item never navigates: it renders without
`href` and with `aria-disabled`. An unknown route id renders as plain text
(an action renders as a plain button). An item route is ignored when the
element itself carries an interaction, so anchors never nest.

**Actions.** Action rows (`page_header.actions`, the `actions` drawn in the
head of `card`, `section` and `form`, `alert.actions` below the alert text,
and overlay footer `actions`) take
`{ label, icon, variant, route, disabled, pressed, tone }`; the overlay schema
allows only `label`, `variant`, `route`, `disabled` and `tone`. A disabled action
is a button with `aria-disabled="true"` and no link; `pressed` (true or false)
makes it a toggle button with `aria-pressed`; `tone` adds the shared
`wf-tone-*` class. Rendering details are in
[rendering-states.md](rendering-states.md).

## 15.5 Fields and states

Form controls share the field props in
`engine/schema/primitive-registry/shared.js` (`FIELD_PROPS`): `label`, `help`,
`error`, `required`, `disabled` and `readonly`.

- `error` replaces `help` and marks the field invalid.
- Help and error get ids and are linked to the focusable control with
  `aria-describedby`.
- `required` adds a marker to the visible label.
- `disabled` keeps the native attribute where one exists, so disabled values
  are not submitted. `readonly` values stay bound and are submitted.
- With both `readonly` and `disabled`, `disabled` wins visually and both are
  written.
- Every read-only control draws the same cue, distinct from disabled: a lock
  after the label and a dashed field edge, with the value at full contrast
  ([rendering-controls.md](rendering-controls.md)).

| Widget | Field label | Help and error | `readonly` |
|---|---|---|---|
| `input`, `textarea` | Above | Below | Native `readonly`. |
| `select`, `picker`, `segmented`, `choice_group` | Above; `segmented` gains it | Below | `data-wf-readonly`, plus `aria-readonly` where the role supports it (`select`, a radio group, each checkbox in a checkbox group); the runtime ignores changes. |
| `checkbox`, `radio`, `toggle` | Inline; `help` is an alias of the inline `description` | Error below the row | `aria-readonly` (a radio, which has none, gets `data-wf-readonly` only); the runtime ignores toggles. |
| `tags_input`, `editor` | Above | Below | Drawn without input affordances. |
| `upload` | `label` stays the action copy; `fieldLabel` goes above | Below | Dropzone drawn without its action. |

**States.** The element that owns a state carries it as a presence-only data
attribute, next to the native or ARIA attribute its role supports:
`data-wf-disabled`, `-readonly`, `-required`, `-invalid`, `-loading`,
`-pressed`, `-checked` (`="mixed"` when indeterminate), `-selected`, `-current`
and `-expanded`. One serializer writes them all; the conventions are in
[rendering-states.md](rendering-states.md).

---

# 16. Validation Requirements

Blocking errors:

* Duplicate IDs
* Missing page wireframeStyle.border.style
* `sticky` declared on a non-top-level template region (only direct children of template root are valid)
* Missing template reference
* Missing slot match
* Missing injectable match (page references injectable ID not in template)
* Missing component reference
* Missing dataset reference
* Missing stateKey
* Invalid grid span
* Overlay missing required fields
* Circular template references
* Component recursion
* Tree depth exceeds maxTreeDepth
* Nodes per page exceeds maxNodesPerPage
* Schema version incompatible with CLI
* Invalid targetRoute reference (route does not exist)
* Invalid targetOverlay reference (overlay does not exist in page or inherited template overlays)
* Invalid actionId reference (action not defined in page)
* Invalid formId reference (node does not exist)
* Component slots (§3.3 of the schema brief):
  * `UNKNOWN_COMPONENT_SLOT`: a fill names a slot the component does not declare,
    or an instance passes `children` and the component has no `default` slot.
    The message lists the valid slot names.
  * `DUPLICATE_COMPONENT_SLOT`: two placeholders in one component share a name.
  * `DUPLICATE_DEFAULT_SLOT_FILL`: an instance gives both `children` and `slots.default`.
  * `SLOT_OUTSIDE_COMPONENT`: a placeholder is a component root, or sits in a
    page, a template or an overlay.
  * `SLOTS_WITHOUT_USE`: a node has `slots` but no `use:`.
* Repeat (§14.1):
  * `UNKNOWN_REPEAT_CELL`: the cell is neither an element nor a component the
    document can reach. The message suggests the nearest name.
  * `REPEAT_INVALID_HOST`: `repeat` on a node or record that cannot host rows.
  * `DUPLICATE_REPEAT_ITEM_ID`: two items in one repeat share an `id`.
  * `REPEAT_WITH_BINDING`: a collection binding on, above or in the cell of a
    repeat, including one that reaches it across a component boundary.
  * `REPEAT_BUDGET_EXCEEDED`: the fan-out passes the page's 50,000-node budget.
  * `REPEAT_ROW_FAILED`: a row cannot be expanded, for example because its cell
    uses an unknown component. It is reported at the item.

Warnings:

* Unused components
* Unused datasets
* Hidden interactive element
* Unreachable overlay
* Orphan routes
* Empty slots (slot declared in template but page provides no content)
* ID naming convention violations (uppercase, non-snake_case, reserved keywords)
* Unknown primitive props (`UNKNOWN_PROP`)

Info diagnostics:

* Text primitive with no `text` or `label` (`MISSING_TEXT`)
* Input/select/textarea without `label` (`UNLABELED_FIELD`)
* Text primitive using `label` alias instead of canonical `text` (`TEXT_PROP_ALIAS`)
* Demoted nested section with explicit width or height (`NESTED_SURFACE`)
* A component slot that gets neither content nor a fallback
  (`EMPTY_COMPONENT_SLOT`). An explicit `[]` fill is intentional and reports nothing.
* A document that imports components under the alias `std`, whose components
  win over the built-in std patterns of the same id (`STD_ALIAS_SHADOWED`;
  see [stdlib.md](stdlib.md)).
* A repeat with `items: []` (`EMPTY_REPEAT`), and an item value holding an
  `{{item.…}}` token, which is not interpreted (`REPEAT_ITEM_TOKEN`). Both are lint info.

The slot and authored repeat checks run in `wf validate` and in the in-memory
`validateProject` entry point the browser and API use; `validateProject`
returns its info diagnostics in `info`, and checks each page against the
expansion budget as the build does.

Safety limits:

```
maxTreeDepth: 100
maxNodesPerPage: 5000
```

---

# 17. Export Contract

Project must export as:

ZIP containing:

* manifest.yaml
* sitemap.yaml
* templates.yaml
* components.yaml
* pages/
* data/ (when present)
* assets/
* any additional imported `documentType: components` files under the project root

`.wfrc.yaml` is NOT included in export.

No transformation required.

---

# 18. Non-Goals

Schema does NOT define:

* Production CSS
* React components
* API contracts
* Database models
* Deployment

It defines structure only.

---

# 19. Design Principles

* Explicit > implicit
* Deterministic > flexible
* Schema-first > UI-first
* Addressable > index-based
* Git-friendly > database-driven

---

# 20. What This Schema Enables

With this structure:

* Full app architecture
* Template inheritance
* Reusable components
* Resizable editor UI
* Deterministic overlays
* Data-driven grid views
* Dot pagination
* Global selected state
* Safe for external tool integration
* Exportable package

## Sticky content and icon decoration

Ordinary nodes support sticky: top|bottom|none, using the same containing-scroll semantics as template regions.
A bar must precede content in that same region. A separate short wrapper or an overflow/clipping ancestor can limit its travel.
The engine warns for top bars with no following sibling content and bars inside known independently scrolling containers.
Input icon positions start/end are logical sides. The center treatment preserves the full-width input hit area and moves to start on focus or value.
An icon and authored prefix/suffix on the same side is ICON_AFFIX_CONFLICT.
See schema.md for exact props and corner.style: pill.

## Skin validation and resolution

Named skins are project content and need manifest spec/schema version 1.2. The validator checks their explicit schema, ID grammar, reserved IDs, standard registry role keys and selected-skin existence. Unknown properties and unsupported colour expressions fail validation atomically. Ordinary projects remain 1.1.

The shared appearance resolver applies defaults, page style, primitive/variant role and explicit node border/corner leaves; it paints each node independently so container roles do not leak into child controls. State-owned error/danger/status cues survive generic palettes. See [precedence and painted parts](design-system.md).

## Company logo slots

Company logos are optional on each named skin: `logos` maps only `logo_1`, `logo_2` and `logo_3` to `{name, src}`. Names are nonempty and at most 80 characters. Sources are static PNG data URLs, at most 256 KiB decoded and 1024 pixels per side. An image uses `props: {kind: logo, slot: logo_1, width: 160, height: 64}`. Width and height size the container in points (positive, at most 4096); the logo preserves its aspect ratio inside it. Without a `width` the container is 160 points wide for a skin's logo, and a missing slot's placeholder fits its name on one line, at least 160 points and at most `min(100%, 24rem)`; past that it wraps and grows taller than `height`. Switching skin resolves the same slot from that skin. Missing slots keep a labelled placeholder and, when `width` is set, the same box. Asset bytes belong in the skin, never in node props or model context.

Navigation supports optional nav.props.variant: rail|sidebar (omitted preserves legacy output). Rail uses sidebar.collapsedWidth, keeps labels and routes, and honours size.width. Nav/app_bar roles can paint an explicitly authored background; inherited page background does not fill them.

`app_bar.props.leading` is an icon name, or the id of one of the bar's own children. A named child is drawn before the title in place of a glyph, with its interaction, and the bar's other children stay after its actions. A child's id wins over an icon of the same name. The reference follows the child when ids are rewritten inside a reusable component or a bound list.

### Control selection and editable values
The existing `selection` contract also applies to `segmented` and local
`tab_bar` choices: unique option labels are string values stored at
`scope` / `stateKey`. Link panel visibility using `state_equals`.
Inputs use the existing `stateBindings.value` expression for two-way page/app
state values; `props.value` state expressions register the same binding.
Colour inputs publish only complete six-digit hex values. No new schema fields
are required. See [interactive appearance fields](rendering.md#interactive-appearance-fields).


### Table link cells

A table column with `kind: link` accepts a cell `{text: "Device A", route: device_a}`.
Use it in either keyed rows or positional arrays. The route is an existing sitemap route id;
the renderer uses the route table and emits the normal navigation attributes. A nonempty
string text becomes the accessible link name. Scalar cells keep their existing inert
appearance. Unknown routes, malformed cells and unsafe route-table URLs remain inert
text. This adds no row-click or pagination behavior; table pagination remains illustrative.
Link cells do not accept raw HTML or href values. Relative internal paths and fragments
are supported; schemes, protocol-relative URLs, backslashes and whitespace are rejected.

Nodes may set `scroll: true` beside `size` and `layout`. This opts the whole node into native overflow scrolling with contained overscroll and non-shrinking immediate children. Use `size.height`/`maxHeight` (or width bounds) to constrain it; unbounded content grows normally. Put headings and pagination outside the scroller when they must remain visible; `sticky: top` children stick within it. Label stack/row/grid/split scrollers with `accessibility.label` for a named keyboard-focusable region. False or omitted leaves existing markup unchanged. This does not add a resize handle, virtualization or automatic viewport sizing.

### Explicit page inset
Optional `page.inset` is a finite number from 0 to 4096 CSS pixels (rendered to six decimal places). It controls only outer page padding in every mode/platform; `0` is full bleed. Omit it to preserve card/web 16px and existing line/native defaults. Template/body padding and gap remain independent; each page opts in.
