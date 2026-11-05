# Wireframe Schema — Full Brief

## 1. Purpose

The schema defines a **deterministic, declarative UI architecture language**.

It must:

* Describe full applications (not just pages)
* Support templates, pages, reusable components
* Support optional datasets
* Support overlays
* Support state + interactions
* Be export-safe
* Be machine-readable (usable by external tools and automation)
* Be fully Git-diffable
* Never rely on implicit behavior

It is not a runtime.
It is not a visual format.
It is a structured UI specification.

---

# 2. Project Structure (Schema-Level)

Every project consists of:

```
manifest.yaml
.wfrc.yaml
sitemap.yaml
templates.yaml
components.yaml
/pages/*.yaml
/data/*.yaml        # optional; only needed when pages reference datasets
```

Additional reusable component documents may live anywhere under the project
root. Free filesystem structure is allowed. These extra files must still be
valid `documentType: components` documents and are pulled in explicitly via
top-level `imports` maps on `templates.yaml`, `components.yaml`, or page
documents. Folder names have no semantic meaning.

Each file has:

```
documentType
specVersion
id
```

No file may omit specVersion.

CLI must refuse to operate if `manifest.schemaVersion > cli.supportedVersion`.

---

# 3. Document Types

## 3.1 sitemap.yaml

Defines global app-level structure.

Contains:

* id (the sitemap document ID)
* defaultTemplate — fallback template for pages that don't specify one
* contexts — named responsive breakpoints (each with minWidth/maxWidth)
* appState — global state defaults (persists across routes)
* routes — array of (id → path → page → template) mappings

Must not contain:

* page content
* layout trees

---

## 3.2 templates.yaml

Defines reusable structural shells.

`templates.yaml` may declare top-level `imports` to bring in reusable component
documents from arbitrary relative paths:

```yaml
imports:
  nav: ./shared/navigation.yaml
```

Each template contains:

* id
* layout (stack/row/grid/etc.)
* regions

Regions must declare:

* id
* kind: persistent | slot
* optional `sticky: top | bottom` — makes the region sticky during scroll (only valid on top-level regions)
* optional component/use
* optional pane (resizable/collapsible metadata)
* optional size (width/height for sidebar regions etc.)
* layout

Persistent regions may contain `injectable` nodes:

```yaml
regions:
  - id: header_bar
    kind: persistent
    children:
      - id: logo
        component: image
      - id: page_actions
        injectable: true    # pages can inject content here
      - id: user_menu
        component: avatar_dropdown
```

An injectable is a named placeholder inside a persistent region.
Pages cannot override the persistent region itself, but they can
supply content for any injectable node within it.

Rules:

* Pages fill slot regions via `slots`.
* Pages fill injectable nodes via `injectables`.
* Persistent regions are otherwise read-only at page level.
* Templates may define overlays (e.g. navigation dropdowns, notification panels).
* Imported components are referenced by alias-qualified `use` values
  (for example `use: nav.primary_menu`).
* When template imports and page imports are merged for a rendered page,
  alias-qualified component IDs must remain unique.

---

## 3.3 components.yaml

Defines reusable composite components.

Any file may be a reusable component source as long as it is a valid
`documentType: components` document. The root `components.yaml` remains the
default project registry, but additional component documents can be split into
any folder structure and imported explicitly by relative path.

Example:

```yaml
imports:
  common: ./shared/common_components.yaml

components:
  primary_menu:
    root:
      id: primary_menu
      component: section
      children:
        - id: projects_link
          use: common.menu_link
          props:
            label: "{{props.activeItem}}"
```

Each component:

* id
* root (node tree)
* optional propDefaults
* optional propHints

Rules:

* root must contain a valid node
* all nodes inside must have unique IDs within component scope
* components may not reference pageState directly
* components may reference props and state
* component documents may declare top-level `imports`
* `use` supports alias-qualified component references such as `nav.primary_menu`
* `{{props.key}}` is resolved during component expansion, including nested
  imported components

---

## 3.4 pages/<pageId>.yaml

Defines a single page.

Page documents may declare top-level `imports` for component libraries used only
by that page:

```yaml
imports:
  nav: ../shared/navigation.yaml
```

Must contain:

* page.id
* page.template
* page.viewport (REQUIRED)
* wireframeStyle (REQUIRED)

  * border.style is mandatory
* renderMode (optional) — shorthand alias for `rendering.mode`
* rendering (optional) — render mode configuration:

  * `mode: line | card` — selects rendering mode (default: `line`)
  * `density: comfortable | compact` — spacing density (default: `comfortable`)
  * See [rendering-modes.md](rendering-modes.md) for full specification
* pageState (optional) — page-scoped state, resets on navigation
* dataSources (optional) — dataset bindings for this page
* actions (optional) — named action definitions (e.g. form submissions, API calls). Keyed by action ID, referenced via `actionId` in interactions.
* overlays (optional) — overlay definitions (menus, modals, drawers, tooltips, etc.)
* slots (required) — content for template slot regions
* injectables (optional) — content for template injectable nodes

### dataSources

```yaml
dataSources:
  - id: products_source
    dataset: products
```

Links a page to a dataset defined in optional `/data`. Nodes can bind to the
dataset via `binding.source: {{item.field}}`. A missing `/data` folder is valid
when no page references datasets; a referenced dataset ID must still exist.

### actions

```yaml
actions:
  submit_form:
    description: "Submit the settings form"
  delete_item:
    description: "Delete the selected item"
```

Named action definitions referenced by `interaction.actionId`. The schema
treats actions as opaque objects — their internal structure is application-defined.
The validator checks that any `actionId` referenced in an interaction exists
in the page's `actions` map.

### viewport

Defines the target device and orientation for this page.

```yaml
viewport:
  device: mobile | tablet | web
  orientation: portrait | landscape    # required for mobile and tablet, ignored for web
```

Rules:

* `device` is REQUIRED
* `orientation` is REQUIRED when device is `mobile` or `tablet`
* `orientation` is ignored when device is `web`
* A single page targets one viewport — create separate pages for different viewports
* Viewport determines which device frame is applicable for screenshots

Slots must match template slot IDs.

Injectables must match template injectable node IDs:

```yaml
injectables:
  - injectableId: page_actions
    content:
      - id: save_btn
        component: button
        props: { label: "Save" }
      - id: publish_btn
        component: button
        props: { label: "Publish" }
```

Page cannot override template persistent regions, but can supply
content for injectable nodes within them.

---

## 3.5 manifest.yaml

Defines project-level metadata.

Must contain:

```yaml
manifest:
  projectId: wireframe_builder
  name: Wireframe Builder
  schemaVersion: "1.1"
  createdWithCLI: "wf 0.3.0"
  defaultGridColumns: 12
  defaultWireframeStyle:
    border:
      style: solid
      width: thin
    corner:
      style: rounded
      radius: 8
```

Rules:

* `schemaVersion` is REQUIRED
* `projectId` must match Id format
* `defaultWireframeStyle` provides inheritable defaults for pages
* Used by `wf info` and future `wf migrate`

---

## 3.6 .wfrc.yaml

Optional CLI configuration per project.

```yaml
cli:
  strictValidation: true
  failOnWarnings: false
  export:
    includeAssets: true
    compressLevel: 9
```

Not part of the schema contract. Not included in export.

---

## 3.7 data/<datasetId>.yaml

Defines a dataset of mock data items used to populate wireframe UI.
The `data/` directory is optional for projects without dataset bindings.

Must contain:

```yaml
documentType: dataset
specVersion: "1.1"
id: users

dataset:
  id: users
  primaryKey: user_id
  items:
    - user_id: u001
      name: "Jane Smith"
      email: "jane@example.com"
      role: admin
    - user_id: u002
      name: "Bob Jones"
      email: "bob@example.com"
      role: editor
```

Optional:

```yaml
dataset:
  fields:           # informational — see below
    - user_id
    - name
    - email
    - role
```

### fields (optional)

Declares the expected field names for items. Used for:

* CLI validation (`wf data validate`)
* Autocomplete hints when adding items
* Documentation of the dataset shape

Fields are informational — items may contain additional fields not listed.

### items

Array of objects. Each item is a plain key-value object.
Items are passed and stored as whole objects — no field-by-field construction.

Rules:

* primaryKey field must exist in every item
* No duplicate primaryKey values
* No index-based addressing — items are referenced by primaryKey value
* Items are plain objects (strings, numbers, booleans, arrays, nested objects)

### Common dataset patterns

```yaml
# Navigation menu items
dataset:
  id: nav_items
  primaryKey: nav_id
  items:
    - nav_id: dashboard
      label: "Dashboard"
      icon: dashboard
      route: dashboard
    - nav_id: products
      label: "Products"
      icon: box
      route: products_list

# User list
dataset:
  id: users
  primaryKey: user_id
  items:
    - user_id: u001
      name: "Jane Smith"
      avatar: "assets/avatar_jane.png"
      role: admin

# Table data
dataset:
  id: orders
  primaryKey: order_id
  items:
    - order_id: ord_001
      customer: "Acme Corp"
      total: 1250.00
      status: shipped
```

---

# 4. Core Node Model

Every node in any tree must contain:

```
id
component OR use OR injectable: true
```

A node with `injectable: true` is a placeholder — it has no component
of its own. Pages supply its content via the `injectables` section.

Optional:

* `role` — semantic role (e.g. "main", "aside", "nav")
* `layout` — child layout definition (stack, row, grid, absolute, overlay)
* `size` — explicit dimensions (width, height, minWidth, maxWidth, minHeight, maxHeight)
* `scroll` — boolean; opt into native overflow scrolling, bounded by existing size dimensions, without a resize handle
* `gridItem` — grid positioning (span, offset, row, column)
* `visibility` — conditional visibility via a Condition
* `accessibility` — label, role, description for accessibility annotations
* `binding` — data source binding (source expression, itemVar for collections)
* `interaction` — array of Interaction objects (navigation, overlays, state changes, etc.)
* `selection` — selection state tracking (scope, stateKey)
* `stateBindings` — map of property names to state expressions
* `surface` — explicitly mark a node as framed (`true`) or content-only (`false`)
* `elevation` — card-mode elevation token (`0-3`), ignored in line mode
* `children` — child nodes
* `pane` — resizable/collapsible panel metadata
* `wireframeStyle` — per-node style override
* `injectable` — marks node as an injection point (template persistent regions only)

IDs must be unique within resolved tree.

## 4.1 Elements

The element set lives in `engine/schema/primitive-registry/`, which is the
single source for the names, their props, their aliases and whether they draw a
box. `engine/schema/schema.json` is generated from it by
`node scripts/sync-schema-primitives.js`, and `cli/test/schema-registry-drift.test.js`
fails if the two disagree. The table below is generated the same way.

Unknown primitive props are lint warnings rather than schema errors, so custom
component parameters can keep flowing through `props`.

Box column: **always** draws a frame at any depth; **never** is a layout group
or a control with its own chrome; **edge only** draws one divider edge;
**rules decide** means the frame rules in section 4.2 settle it.

**containers**

| Element | Box | Props |
|---|---|---|
| `section` | rules decide | title, description |
| `card` | always | title, description, media, footer |
| `stack` | never | gap, padding, align |
| `row` | never | gap, padding, align, justify, wrap, nowrap |
| `grid` | never | columns, gap, minItemWidth |
| `split` | never | gap, orientation: row\|stack |
| `form` | never | title, submit, columns |
| `carousel` | rules decide | dots, arrows, items |

**text**

| Element | Box | Props |
|---|---|---|
| `heading` | never | text, label, level |
| `paragraph` | never | text, label, lines |
| `text` | never | text, label, variant: body\|meta\|label\|caption\|mono |
| `code` | always | text, language, inline |
| `badge` | never | text, variant: neutral\|outline\|dot\|pill, tone: neutral\|info\|success\|warning\|danger, icon |
| `avatar` | never | name, src, size: xs\|sm\|md\|lg\|xl, shape: circle\|square, group, overflow |
| `icon` | never | name, style: solid\|regular\|brands, size |
| `image` | never | src, alt, kind: image\|video\|map\|embed\|logo, ratio, width, height |
| `rating` | never | value, max, count |
| `stat` | rules decide | label, value, delta, trend: up\|down\|flat, icon, sparkline |
| `progress` | never | value, kind: bar\|circle\|spinner, label, indeterminate |
| `skeleton` | never | lines, avatar, width |
| `divider` | edge only | label, orientation: horizontal\|vertical |
| `spacer` | never | size |
| `empty_state` | rules decide | title, text, icon, action, variant: empty\|error\|404\|offline |

**controls**

| Element | Box | Props |
|---|---|---|
| `button` | never | label, icon, iconStyle: solid\|regular\|brands, iconSize, variant: primary\|secondary\|ghost\|danger\|link, size: sm\|md\|lg, iconOnly, loading, disabled, fab |
| `segmented` | never | options, value, size: sm\|md\|lg |
| `input` | never | label, placeholder, inputType: text\|password\|email\|number\|search\|tel\|url\|date\|time\|datetime\|color\|range\|otp\|stepper, value, prefix, suffix, help, error, required, disabled, length |
| `textarea` | never | label, placeholder, rows, help, error, required, disabled, maxLength |
| `select` | never | label, placeholder, options, searchable, multiple, help, error, required, disabled |
| `checkbox` | never | label, checked, description, disabled |
| `radio` | never | label, checked, description, disabled |
| `toggle` | never | label, checked, description, disabled |
| `choice_group` | never | label, kind: checkbox\|radio, options, value, inline |
| `tags_input` | never | label, tags, placeholder |
| `upload` | always | label, hint, files, variant: dropzone\|button |
| `picker` | always | label, options, value, columns |
| `editor` | always | label, toolbar, rows |

**navigation**

| Element | Box | Props |
|---|---|---|
| `tab_bar` | edge only | tabs, variant: underline\|pill\|enclosed |
| `bottom_tab_bar` | edge only | tabs |
| `breadcrumb` | never | items, separator |
| `pagination` | never | page, pages, variant: numbers\|simple\|dots |
| `stepper` | never | steps, current, orientation: row\|stack |
| `nav` | never | items, collapsed, groups |
| `menu` | never | items |
| `app_bar` | edge only | title, subtitle, leading, actions |
| `action_sheet` | never | items, title, cancel |
| `page_header` | never | title, subtitle, breadcrumb, actions, tabs |

**data**

| Element | Box | Props |
|---|---|---|
| `table` | rules decide | columns, rows, caption, selectable, state: default\|loading\|empty, emptyText, dense, pagination |
| `list` | rules decide | items, kind: plain\|avatar\|action\|file\|chat\|timeline\|settings, divided, selectable, refreshable |
| `chart` | rules decide | chartType: bar\|vertical\|horizontal\|line\|area\|pie\|donut\|gauge\|sparkline\|heatmap, title, label, data, series, legend, axes, height |
| `calendar` | always | view: month\|week\|day\|picker, date, events |
| `kanban` | never | columns |
| `tree` | rules decide | items, expanded |
| `accordion` | rules decide | items |

**feedback**

| Element | Box | Props |
|---|---|---|
| `alert` | always | text, title, variant: info\|success\|warning\|error\|neutral, icon, dismissible, inline |

### Aliases

A handful of names resolve silently to the element on the right, so an agent
that guesses a common synonym is not punished for it: `chip`, `tag`, `pill` →
`badge`; `media` → `image`; `kpi`, `metric` → `stat`; `spinner`, `loader` →
`progress`; `combobox`, `autocomplete` → `select`; `switch` → `toggle`;
`tabs` → `tab_bar`; `wizard` → `stepper`; `sidenav` → `nav`;
`date_picker` → `calendar`; `board` → `kanban`; `banner`, `callout` → `alert`.

## 4.2 Frame rules — which elements get a box

`engine/renderer/frame-rules.js` exports one pure function, `decideFrame(node, ctx)`,
returning `{ frame, rule, reason }`. The renderer and lint both call it, so they
cannot disagree. Only `surface` draws a container frame, and only `surface`
increases nesting depth.

| Frame | Meaning |
|---|---|
| `surface` | a framed container: card, panel, modal, region |
| `group` | a layout wrapper: spacing and alignment only, never a border |
| `control` | element-owned chrome (inputs, buttons) that nesting never changes |
| `content` | bare content: text, icons, images |
| `edge` | a single divider edge: tab bars, app bars, rules |

Precedence, first match wins:

1. `surface: true` / `surface: false` on the node.
2. A border in the node's `wireframeStyle`.
3. The element's own class from the registry (`always`, `never`, `edge only`).
4. Overlay chrome owns the frame, so overlay content does not double-box.
5. Template regions: a slot never frames, a `role: main` region never frames,
   any other persistent region does.
6. A node with a `pane` is a panel, so it frames.
7. A parent that separates its children draws the strokes, so the children do not.
8. A child of a grid is a tile, so it frames.
9. Inside a frame nothing frames itself again — use `card` to be explicit.
10. At the top of a page a `section` frames, unless it is an untitled row
    (which reads as a toolbar) or carries `role: toolbar`.

Every node carries its decision as `data-wf-frame`. With `rendering.explain: true`
it also carries `data-wf-why="<rule>:<reason>"`, and `wf why <nodeId> --page <pageId>`
prints the rule, the resolved sizing tokens and the one edit that would flip it.

## 4.3 Proportions

A node or template region with a known `role` gets its structural size from
`engine/renderer/sizing-tokens.js` rather than from hand-written pixels. Roles:
`header`, `app_bar`, `sidebar`, `nav`, `main`, `aside`, `footer`, `toolbar`,
`tabbar`, `form`, `dialog`, `sheet`, `drawer`, `content`.

There are exactly three ways to override a proportion:

1. `manifest.sizing` — a flat map of token name to pixels, project wide.
2. `size` on the node or region — local, and it wins over the token.
3. `rendering.density: compact` — scales spacing only, never structural widths.

A `role: sidebar` region is 256px on web, 220 on tablet and 280 on mobile, with
a 200px minimum and `flex: 0 0 auto` so it cannot collapse to its content.

## 4.4 Platforms

`viewport.platform` is `web`, `ios` or `android`, defaulting to `ios` for
`device: mobile` and `tablet`. It changes chrome only — control heights, corner
radii, title alignment, status bar, home indicator — never which elements exist
or what they mean. iOS centres an app bar title and uses a chevron back; Android
left-aligns it and gets a 56px circular FAB.

---

# Schema References

This document covers the core structure (sections 1-4). See companion files for the full specification:

| File | Contents |
|------|----------|
| [schema-systems.md](schema-systems.md) | Layout, state, interactions, overlays, panes, wireframe style, data binding, primitives, validation, export (sections 5-20) |
| [schema-canonical.yaml](schema-canonical.yaml) | Full canonical YAML definition of the schema |
| [schema.json](../../engine/schema/schema.json) | Formal JSON Schema for validation |

## Icons, pills and sticky nodes

Buttons and inputs accept Font Awesome Free names in props.icon and solid/regular/brands in props.iconStyle.
props.iconPosition is start (default), end or center. Center on a button is an icon-only action; its label remains its accessible name.
On an input, center shows the icon/placeholder group centred while empty and unfocused; focus or a value moves the icon to start.
An explicit icon replaces type-inferred decorations. Do not combine it with prefix/suffix on the same side.
wireframeStyle.corner.style accepts sharp, rounded and pill. Pill caps are half the shorter painted dimension and override radius.
Nodes accept sticky: top|bottom|none. Put a top bar before the content in its containing scrolling region.
Image placeholders omit src and use alt as an always-visible, wrapping description over the existing cross.

Input variant: plain removes its inner frame for composition inside a single framed toolbar or composer; default retains the field frame.

Buttons accept props.route as a route-ID shorthand when there are no explicit interactions. Explicit interactions take precedence. App-bar children are normal interactive controls placed on its trailing side; decorative actions remain supported.

## Named skins (manifest 1.2)

An optional manifest.designSystem stores activeSkin and a skins map. Each named skin has name, optional defaults and roles; appearance values contain optional colors, border and corner. Colours are restricted to #RRGGBB (transparent is also allowed for background). They are not fields of ordinary wireframeStyle objects. Standard role keys derive from the primitive registry and existing variant enums; there is no custom role or new node field.

Saving named skins requires manifest specVersion: "1.2" and manifest.schemaVersion: "1.2". Other document types and new ordinary projects remain 1.1. The .wf container stays wf/1. The reserved skin wireframe selects the legacy appearance. See [the complete contract](design-system.md).

## Company logo slots

Company logos are optional on each named skin: `logos` maps only `logo_1`, `logo_2` and `logo_3` to `{name, src}`. Names are nonempty and at most 80 characters. Sources are static PNG data URLs, at most 256 KiB decoded and 1024 pixels per side. An image uses `props: {kind: logo, slot: logo_1, width: 160, height: 64}`. Width and height size the container in points (positive, at most 4096); the logo preserves its aspect ratio inside it. Switching skin resolves the same slot from that skin. Missing slots keep a labelled placeholder and the same box. Asset bytes belong in the skin, never in node props or model context.

Navigation supports optional nav.props.variant: rail|sidebar (omitted preserves legacy output). Rail uses sidebar.collapsedWidth, keeps labels and routes, and honours size.width. Nav/app_bar roles can paint an explicitly authored background; inherited page background does not fill them.


### Table link cells

A table column with `kind: link` accepts a cell `{text: "Device A", route: device_a}`.
Use it in either keyed rows or positional arrays. The route is an existing sitemap route id;
the renderer uses the route table and emits the normal navigation attributes. A nonempty
string text becomes the accessible link name. Scalar cells keep their existing inert
appearance. Unknown routes, malformed cells and unsafe route-table URLs remain inert
text. This adds no row-click or pagination behavior; table pagination remains illustrative.
Link cells do not accept raw HTML or href values. Relative internal paths and fragments
are supported; schemes, protocol-relative URLs, backslashes and whitespace are rejected.
