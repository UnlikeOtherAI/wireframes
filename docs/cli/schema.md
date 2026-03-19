# Wireframe Schema — Full Brief

## 1. Purpose

The schema defines a **deterministic, declarative UI architecture language**.

It must:

* Describe full applications (not just pages)
* Support templates, pages, reusable components
* Support datasets
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
/data/*.yaml
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
  * See [docs/rendering-modes.md](docs/rendering-modes.md) for full specification
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

Links a page to a dataset defined in `/data`. Nodes can bind to the
dataset via `binding.source: {{item.field}}`.

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

The built-in primitive component set is documented in
[schema-systems.md](schema-systems.md) and includes common structural
containers such as `tab_bar` for reusable route-backed navigation patterns
and `table` for striped tabular data.

---

# Schema References

This document covers the core structure (sections 1-4). See companion files for the full specification:

| File | Contents |
|------|----------|
| [schema-systems.md](schema-systems.md) | Layout, state, interactions, overlays, panes, wireframe style, data binding, primitives, validation, export (sections 5-20) |
| [schema-canonical.yaml](schema-canonical.yaml) | Full canonical YAML definition of the schema |
| [schema.json](schema.json) | Formal JSON Schema for validation |
