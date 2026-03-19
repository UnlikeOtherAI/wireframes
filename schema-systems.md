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

No implicit breakpoints.

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
* See [docs/rendering-modes.md](docs/rendering-modes.md) for the full CSS
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

Datasets are defined in `data/<datasetId>.yaml`. Each dataset contains
an array of plain key-value objects (items) identified by a `primaryKey`.

Items are always passed and stored as **whole objects** — no field-by-field
construction or mutation. To update an item, replace the entire object.

Datasets support any value types: strings, numbers, booleans, arrays,
and nested objects. Common patterns include navigation menus, user lists,
table data, and notification feeds.

The optional `fields` array declares expected field names for validation
and tooling hints, but items may contain additional fields beyond what
is declared.

---

# 15. Primitive Components

The schema defines a set of built-in primitive components.
These are the basic building blocks — every wireframe element is one of these
or a reusable component composed from them.

## Text Primitives

```yaml
- id: page_title
  component: heading
  props:
    level: 1            # 1-6
    text: "Dashboard"

- id: intro
  component: paragraph
  props:
    text: "Welcome to the admin panel."

- id: save_label
  component: text
  props:
    text: "Save Changes"
```

* `heading` — title text. Required: `level`, `text`.
* `paragraph` — body text block. Required: `text`.
* `text` — inline text span. Required: `text`.

## Image

```yaml
- id: client_logo
  component: image
  props:
    src: "assets/logo.png"    # relative path or external URL
    alt: "Acme Corp Logo"
    width: 120
    height: 40
```

* `image` — displays an image. Required: `src`. Optional: `alt`, `width`, `height`.
* In wireframe rendering, images display as a frame with the alt text label,
  or the actual image if `src` is resolvable.
* Use `assets/` folder for project-local images (client logos, etc.).

## Icon Primitive

```yaml
- id: settings_icon
  component: icon
  props:
    name: gear               # Font Awesome icon name (without fa- prefix)
    style: solid             # solid (default) | regular | brands
    size: lg                 # xs | sm | lg | xl | 2xl (optional)
```

* `icon` — renders a Font Awesome icon. Required: `name`. Optional: `style` (solid/regular/brands, default solid), `size` (xs/sm/lg/xl/2xl).
* Font Awesome Free 6.x is loaded from CDN automatically.
* Buttons also support an `icon` prop: `props: { label: "Save", icon: "floppy-disk" }`.
* Browse available icons: https://fontawesome.com/search?o=r&m=free

## Interactive Primitives

```yaml
- id: save_btn
  component: button
  props:
    label: "Save"
    icon: floppy-disk        # optional: Font Awesome icon before label

- id: email_field
  component: input
  props:
    placeholder: "Enter email"
    inputType: text         # text|password|email|number|search

- id: bio_field
  component: textarea
  props:
    placeholder: "Enter bio"
    rows: 4

- id: role_select
  component: select
  props:
    placeholder: "Choose role"
    options:
      - { value: admin, label: "Admin" }
      - { value: editor, label: "Editor" }

- id: terms_check
  component: checkbox
  props:
    label: "I agree to terms"

- id: plan_toggle
  component: toggle
  props:
    label: "Enable notifications"
```

* `button` — clickable wireframe box. Required: `label`. Optional: `icon` (Font Awesome name, renders before label).
* `tab_bar` — in-page tab navigation. Child buttons are laid out in a row with gap, NOT stretched.
* `bottom_tab_bar` — iOS-style bottom navigation bar. Child buttons stretch equally to fill width, icon stacks above label. Use with `icon` prop on buttons.
* `input` — text input field. Optional: `placeholder`, `inputType` (text, password, email, number, search; defaults to text).
* `textarea` — multi-line input. Optional: `placeholder`, `rows`.
* `select` — dropdown selector. Optional: `placeholder`, `options`.
* `checkbox` — checkbox with label. Required: `label`.
* `toggle` — on/off switch. Required: `label`.

## Structural Primitives

```yaml
- id: recent_orders
  component: table
  props:
    columns:
      - { key: market, label: "Market" }
      - { key: owner, label: "Owner" }
      - { key: status, label: "Status" }
      - { key: spend, label: "Spend", width: 120 }

- id: main_section
  component: section
  props:
    title: "Settings"
  children: [...]

- id: divider_1
  component: divider

- id: spacer_1
  component: spacer
  props:
    size: 24
```

* `table` — tabular data with a header row and alternating body-row fills. Required: `columns`. Optional: `rows`, `emptyText`. May also use `binding.source` to render dataset-backed rows.
* `section` — named container frame. Optional: `title`. May have children.
* `divider` — horizontal rule. No props required.
* `spacer` — empty space. Optional: `size` (pixels).

All primitives render as wireframes: bordered rectangles with text labels.
No production styling.

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

Warnings:

* Unused components
* Unused datasets
* Hidden interactive element
* Unreachable overlay
* Orphan routes
* Empty slots (slot declared in template but page provides no content)
* ID naming convention violations (uppercase, non-snake_case, reserved keywords)

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
* data/
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
