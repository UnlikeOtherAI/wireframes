# Wireframe Rendering & Build Specification

Companion to [schema.md](schema.md) and [schema-systems.md](schema-systems.md).
Covers how YAML specs become click-through HTML wireframes.

See [docs/rendering-modes.md](docs/rendering-modes.md) for the two rendering
mode specification (line vs card): visual tokens, CSS architecture, double-border
prevention, and component-level rendering rules per mode.

---

# 1. Rendering Philosophy

Every YAML node renders as a **bordered wireframe box**. No production styling.
No colors beyond black, white, and gray. No icons. No custom fonts.
The visual output is a clickable skeleton.

The rendering pipeline:

1. Load project YAML (manifest, sitemap, templates, components, pages, data)
2. Resolve template + page (fill slots, inject injectables, expand components)
3. Walk resolved node tree and emit HTML
4. Apply wireframe CSS (borders, layout, spacing)
5. Attach interaction JavaScript (navigation, overlays, state, toggles)
6. Bind state and data values into rendered nodes

---

# 2. CLI Commands

## wf build

Builds a complete click-through HTML wireframe website from YAML specs.

```bash
wf build
wf build --output ./wireframes/build
wf build --platform web
wf build --platform mobile
wf build --clean
```

| Flag | Default | Description |
|------|---------|-------------|
| `--output <dir>` | `./wireframes/build` | Output directory |
| `--platform <value>` | `all` | Build only: `web`, `mobile`, `tablet`, or `all` |
| `--clean` | `false` | Remove existing build directory first |
| `--base-path <path>` | `/` | Base path prefix for URLs (subdirectory hosting) |

### Platform grouping

Pages are grouped by `viewport.device` into platform folders. A page with
`device: mobile` goes into `build/mobile/`, `device: web` into `build/web/`.
If `--platform` is specified, only matching pages are built.

### Pre-conditions

* Project must pass `wf validate` (blocking errors abort build)
* All referenced templates, components, datasets must resolve
* Schema version must be compatible with CLI

### Output structure

```
wireframes/build/
  index.html                    # Master index linking all platforms
  assets/                       # Copied from project assets/
  web/
    index.html                  # Platform index listing all web pages
    dashboard.html              # One HTML file per page
    settings.html
    _shared/
      wireframe.css             # Shared wireframe stylesheet
      interactions.js           # Shared interaction runtime
  mobile/
    index.html                  # Platform index listing all mobile pages
    home_mobile.html
    settings_mobile.html
    _shared/
      wireframe.css
      interactions.js
  tablet/
    index.html
    dashboard_tablet.html
    _shared/
      wireframe.css
      interactions.js
```

### Index pages

**Master index.html:** Hub page linking to each platform subfolder. Lists
platforms with page counts. Rendered as a wireframe itself (bordered frames).

**Platform index.html:** Lists all pages in that platform with links.
Shows route path, page ID, and template used.

### Page HTML files

Self-contained HTML documents rendering the resolved page tree. Each includes:

* Linked wireframe CSS and interaction JS (from `_shared/`)
* Full rendered page content (template + slots + injectables + overlays)
* Route mapping for navigation

Named by page ID: `<pageId>.html`. Route paths are recorded as data
attributes but the file system uses flat IDs, not nested directories.

### Base path

When `--base-path` is set (e.g. `--base-path /demo/`), all generated URLs
are prefixed:

* Navigation links: `<basePath><platform>/<pageId>.html`
* Asset paths: `<basePath>assets/<file>`
* Platform index links: `<basePath><platform>/index.html`
* Route table entries in `WF_ROUTES`: prefixed with base path

Default is `/` (root). This enables hosting wireframes in a subdirectory.

### Asset handling

The `assets/` folder is copied to the build root. Image `src` references
resolve relative to the platform folder (using `../assets/` paths).
When `--base-path` is set, asset paths use the base path prefix instead.

### Rules

* Build output is fully self-contained (no external dependencies, no CDN)
* No production styling — everything renders as wireframe boxes
* Deterministic: same YAML input = identical build output
* No timestamps, no random IDs in output
* `.wfrc.yaml` is NOT included in build

---

## wf serve

Launches a local dev server rendering wireframes in the browser.

```bash
wf serve
wf serve --port 3000
wf serve --platform web
wf serve --open
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port <number>` | `8080` | Dev server port |
| `--platform <value>` | `all` | Serve only a specific platform |
| `--open` | `false` | Open default browser on launch |
| `--no-reload` | `false` | Disable hot reload |

### Behavior

* Renders pages on-the-fly (no pre-build step)
* Watches all YAML and asset files for changes
* On change: re-validates, re-renders affected pages, pushes update to browser
* Validation errors display as an overlay in the browser (red border, error text)
* URL scheme mirrors build: `http://localhost:8080/web/dashboard.html`
* Root URL serves the master index

### Console output

```
wf serve started on http://localhost:8080
  web:    3 pages
  mobile: 2 pages
Watching for changes...

[12:34:56] pages/dashboard.yaml changed — rebuilding dashboard
[12:34:56] ✔ dashboard rebuilt (42ms)
```

### Rules

* Same rendering as `wf build` (identical HTML/CSS output)
* Local-only (binds to localhost)
* No minification or optimization
* Serves assets directly from project `assets/` directory

---

## .wfrc.yaml configuration

```yaml
cli:
  strictValidation: true
  failOnWarnings: false
  export:
    includeAssets: true
    compressLevel: 9
  build:
    outputDir: ./wireframes/build
    clean: false
    basePath: /
  serve:
    port: 8080
    open: false
    hotReload: true
```

This is the same `.wfrc.yaml` documented in [brief.md](brief.md). Build and serve
settings are additional keys under the `cli` root.

---

# 3. Viewport Dimensions and Page Shell

Each page declares a viewport. The rendered HTML behaves like a real website
in a browser tab:

* The page fills the browser tab at the declared width
* The **browser window** is the scroll container — the page scrolls naturally when content exceeds the viewport height
* The viewport height is a **minimum height**, not a constraint — content taller than the minimum simply grows the page
* Sticky template regions use `position: sticky` and remain visible during scroll

| Device | Orientation | Width | Min-Height |
|--------|-------------|-------|------------|
| mobile | portrait | 390px | 844px |
| mobile | landscape | 844px | 390px |
| tablet | portrait | 820px | 1180px |
| tablet | landscape | 1180px | 820px |
| web | — | 1280px | 900px |

Responsive contexts declared in `sitemap.yaml` (with `minWidth`/`maxWidth`)
apply within these viewport dimensions — they control responsive overrides
(visibility, span, gap, align) but do not change the viewport dimensions.

## Page shell layout

The outer page container is a flex column. This is what makes the sidebar
stretch to the full page height and what allows sticky headers/footers to work.

```
<body>
  <div class="wf-page">          ← flex column, min-height = device height, centered at device width
    <header class="wf-region">   ← persistent region, sticky: top → position: sticky; top: 0
      ...
    </header>

    <div class="wf-body-row">    ← flex: 1, display: flex, flex-direction: row, align-items: stretch
      <nav class="wf-region">    ← persistent sidebar — stretches to full row height automatically
        ...
      </nav>
      <main class="wf-region">   ← slot region — flex: 1, fills remaining width
        ...
      </main>
    </div>

    <footer class="wf-region">   ← persistent region, sticky: bottom → position: sticky; bottom: 0
      ...
    </footer>
  </div>
</body>
```

**Why the sidebar fills the full height:**
The body row is `flex: 1` (fills space between header and footer) with
`align-items: stretch` (flex default). All children — sidebar, main content —
stretch to the row's height. The sidebar has only 3 nav items but its
background and border extend to the full row height regardless.

**CSS:**

```css
.wf-page {
  width: var(--wf-viewport-width);    /* 1280px for web */
  min-height: var(--wf-viewport-min-height); /* 900px for web */
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.wf-body-row {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;   /* sidebar fills full row height */
  min-height: 0;          /* required for flex children to shrink correctly */
}

/* Sticky regions */
.wf-region[data-sticky="top"] {
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}
.wf-region[data-sticky="bottom"] {
  position: sticky;
  bottom: 0;
  z-index: 10;
  flex-shrink: 0;
}
```

## Template region sticky declaration

Template regions can declare `sticky: top | bottom` to make them stick during scroll.

```yaml
templates:
  app_shell:
    layout: { type: stack }
    regions:
      - id: header_bar
        kind: persistent
        sticky: top           # ← renders with position: sticky; top: 0
        children: [...]
      - id: body
        kind: slot            # fills flex: 1 of the page column
      - id: bottom_nav
        kind: persistent
        sticky: bottom        # ← renders with position: sticky; bottom: 0
        children: [...]
```

For templates with a sidebar, the slot region is typically a row container:

```yaml
regions:
  - id: header_bar
    kind: persistent
    sticky: top
  - id: body_row
    kind: persistent          # contains a nested slot + sidebar
    layout: { type: row }
    children:
      - id: left_nav
        kind: persistent      # sidebar — stretches to full row height via align-items: stretch
        size: { width: 240 }
        children: [...]
      - id: main_content
        injectable: true      # pages inject into here
```

`sticky` is only valid on top-level template regions (direct children of the
template root). It is not valid on arbitrary page nodes.

---

# 4. Primitive Component Rendering

Each primitive maps to specific HTML elements. All share the base wireframe
style: a bordered rectangle.

## Text primitives

```
heading   → <div class="wf-heading wf-heading-{level}">
              <h{level}>{text}</h{level}>
            </div>

paragraph → <div class="wf-paragraph">
              <p>{text}</p>
            </div>

text      → <span class="wf-text">{text}</span>
```

## Image

```
image     → <div class="wf-image">
              <img src="{src}" alt="{alt}" width="{width}" height="{height}" />
            </div>

            If src does not resolve:
            <div class="wf-image wf-image-placeholder">
              {alt || "Image"}
            </div>
```

Images in `assets/` render the actual `<img>` with wireframe border.
Unresolvable sources render a placeholder box with alt text.

## Interactive primitives

```
button    → <div class="wf-button">
              <button>{label}</button>
            </div>

input     → <div class="wf-input">
              <input type="{inputType}" placeholder="{placeholder}" />
            </div>
            inputType values: text (default), password, email, number, search.

textarea  → <div class="wf-textarea">
              <textarea placeholder="{placeholder}" rows="{rows}"></textarea>
            </div>

select    → <div class="wf-select">
              <select>
                <option value="">{placeholder}</option>
                <option value="{value}">{label}</option>
                ...
              </select>
            </div>

checkbox  → <div class="wf-checkbox">
              <label><input type="checkbox" /> {label}</label>
            </div>

toggle    → <div class="wf-toggle">
              <label>
                <span class="wf-toggle-track">
                  <span class="wf-toggle-thumb"></span>
                </span>
                {label}
              </label>
            </div>
```

## Structural primitives

```
section   → <div class="wf-section">
              <div class="wf-section-title">{title}</div>
              <div class="wf-section-body">{children}</div>
            </div>

divider   → <hr class="wf-divider" />
            CSS: border: none; border-top: 1px solid #333; margin: 8px 0;
            Spans full width of parent container.

spacer    → <div class="wf-spacer" style="height:{size}px"></div>
            In stack layout: uses height.
            In row layout: uses width instead (style="width:{size}px").
            In grid layout: spans one cell with the given height.
```

---

# 5. Layout Rendering

Layouts map to CSS layout mechanisms.

## Layout type → CSS

```
stack     → display: flex; flex-direction: column;
row       → display: flex; flex-direction: row;
grid      → display: grid; grid-template-columns: repeat({columns}, 1fr);
             If columns is omitted, defaults to manifest.defaultGridColumns (default: 12).
absolute  → position: relative; (children get position: absolute)
             Children positioned via node `position` property:
               position.top    → top: {value}px
               position.left   → left: {value}px
               position.right  → right: {value}px
               position.bottom → bottom: {value}px
             If no position is specified, child renders at (0,0).
overlay   → position: relative; (children stack with z-index)
```

## Layout properties → CSS

| YAML | CSS |
|------|-----|
| `gap` | `gap: {value}px` |
| `padding` | `padding: {value}px` |
| `columns` | `grid-template-columns: repeat({value}, 1fr)` |
| `justify` | `justify-content: {value}` |
| `align` | `align-items: {value}` |

## Grid item properties → CSS

| YAML | CSS |
|------|-----|
| `span` | `grid-column: span {value}` |
| `offset` | `grid-column-start: {value + 1}` |
| `row` | `grid-row: {value}` |
| `column` | `grid-column: {value}` |

## Size properties → CSS

| YAML | CSS |
|------|-----|
| `width` (number) | `width: {value}px` |
| `width` (string) | `width: {value}` (responsive value passed through) |
| `height` (number) | `height: {value}px` |
| `height` (string) | `height: {value}` (responsive value passed through) |
| `minWidth` | `min-width: {value}px` |
| `maxWidth` | `max-width: {value}px` |
| `minHeight` | `min-height: {value}px` |
| `maxHeight` | `max-height: {value}px` |

When `width` or `height` is a string (responsive context value), it is
passed through as-is to CSS. When it is a number, it is treated as pixels.

---

# 6. Wireframe Style Rendering

The page `wireframeStyle` determines the default visual treatment for all nodes.

## Border style → CSS

| YAML | CSS |
|------|-----|
| `solid` + `thin` | `border: 1px solid #333` |
| `solid` + `medium` | `border: 2px solid #333` |
| `dashed` + `thin` | `border: 1px dashed #333` |
| `dashed` + `medium` | `border: 2px dashed #333` |

## Corner style → CSS

| YAML | CSS |
|------|-----|
| `sharp` | `border-radius: 0` |
| `rounded` + `radius: 8` | `border-radius: 8px` |

Per-node `wireframeStyle` overrides are applied as inline styles on that
node's HTML element. Only the overridden properties are set; everything
else inherits from the page style.

---

# 7. Overlay Rendering

Overlays render as hidden HTML elements that become visible via interaction.
Each type has specific positioning and z-index.

## Overlay type → CSS positioning

| Type | Position | Z-Index | Backdrop |
|------|----------|---------|----------|
| `modal` | Fixed, centered | 200 | Yes (`rgba(0,0,0,0.3)`) |
| `alert` | Fixed, centered | 400 | Yes (`rgba(0,0,0,0.3)`) |
| `drawer_left` | Fixed, left edge, full height | 200 | Yes (`rgba(0,0,0,0.3)`) |
| `drawer_right` | Fixed, right edge, full height | 200 | Yes (`rgba(0,0,0,0.3)`) |
| `bottom_sheet` | Fixed, bottom edge, full width | 200 | Yes (`rgba(0,0,0,0.3)`) |
| `dropdown` | Absolute, relative to trigger | 100 | No |
| `popover` | Absolute, relative to trigger | 100 | No |
| `tooltip` | Absolute, near trigger | 100 | No |
| `toast` | Fixed, top or bottom of viewport | 400 | No |

## Placement

The `placement` value (top, bottom, left, right, center) controls
positioning for dropdown/popover/tooltip relative to their trigger node.

## Dismiss behavior

`dismissOn` array items map to event listeners:

| Value | Behavior |
|-------|----------|
| `backdrop` | Click on backdrop closes overlay |
| `escape` | Keydown Escape closes overlay |
| `button` | Explicit close button (via close_overlay interaction) |
| `timeout` | Auto-dismiss after 3 seconds (toast/alert) |

## Z-order layers

1. **base** (z-index: 0) — normal page content
2. **overlay** (z-index: 100–199) — dropdowns, popovers, tooltips
3. **modal** (z-index: 200–299) — modals, drawers, bottom sheets
4. **toast** (z-index: 400+) — toasts, alerts

---

# 8. Interaction Runtime

All interactions are implemented in a single `interactions.js` file shared
across all pages in a platform. No external dependencies.

## Interaction type → runtime behavior

```
navigation     → window.location.href = '<pageId>.html'
                 Maps route ID to HTML file via embedded route table.

open_overlay   → Show overlay element (add 'wf-visible' class).
                 Show backdrop if applicable.

close_overlay  → Hide overlay element (remove 'wf-visible' class).
                 Hide backdrop.

toggle         → Read current boolean state value, flip it, update DOM.
                 scope=page: stored in page-level JS object.
                 scope=app: stored in sessionStorage.

set_state      → Set state key to specific value.
                 scope=page: page-level JS object.
                 scope=app: sessionStorage.
                 Triggers DOM update for all bound elements.

submit         → Gather values from all interactive primitives (input, textarea,
                 select, checkbox, toggle) within the form container node
                 (referenced by formId). Collect as key-value pairs where
                 key = node ID, value = current input value/checked state.
                 Display as a toast showing "Form submitted: {key: value, ...}"
                 in JSON format. Toast appears at top-right for 3 seconds.
                 No backend — wireframe-only.

action         → Display toast: "Action: <actionId> triggered".
                 Actions are opaque in wireframe mode.
                 Toast appears at top-right of viewport for 3 seconds.

gesture        → Touch/mouse event handlers on mobile/tablet viewports.
                 Each gesture type maps to specific browser events:
                   swipe_left    → touchmove with negative deltaX
                   swipe_right   → touchmove with positive deltaX
                   swipe_up      → touchmove with negative deltaY
                   swipe_down    → touchmove with positive deltaY
                   long_press    → touchstart held > 500ms
                   pinch         → two-finger touch with distance change
                   double_tap    → two taps within 300ms
                 On recognition, a brief visual indicator (pulse animation)
                 appears on the element. Gestures are ignored on web viewport.
```

## Conditional execution

Interactions with a `condition` are evaluated before execution. The
`interactions.js` runtime includes a condition evaluator that handles
all condition types:

* `state_equals` — reads `scope`/`key` from state store, compares to `equals`
* `route_match` — compares `routeId` to current page's route ID
* `compare` — evaluates `left` and `right` (resolving expressions), applies `op`
* `and` — all sub-conditions must be true
* `or` — at least one sub-condition must be true
* `not` — inverts the inner condition

If the condition evaluates to false, the interaction is skipped silently.

## Condition encoding in HTML

Conditions are serialized as JSON in `data-wf-condition` attributes on
the DOM element. The interaction runtime parses these at event time.

```html
<!-- Visibility condition -->
<div class="wf-node" data-wf-visibility='{"type":"state_equals","scope":"page","key":"show_panel","equals":true}'>
  ...
</div>

<!-- Interaction with condition -->
<div class="wf-button wf-interactive"
     data-wf-interactions='[{"type":"navigation","targetRoute":"settings","condition":{"type":"state_equals","scope":"app","key":"is_admin","equals":true}}]'>
  <button>Admin Settings</button>
</div>
```

Visibility conditions are stored on the node element in `data-wf-visibility`.
Interaction conditions are embedded inside the interaction object in
`data-wf-interactions` (a JSON array of all interactions on that node).

On state change, the runtime:

1. Queries all elements with `data-wf-visibility`
2. Parses each condition JSON
3. Evaluates using the condition evaluator
4. Shows (removes `display: none`) or hides (adds `display: none`) accordingly

## Error handling

If an interaction references an invalid target at runtime:

* Missing `targetRoute` — log console warning, no navigation
* Missing `targetOverlay` — log console warning, no overlay action
* Missing `formId` node — log console warning, skip submit
* Missing `actionId` — log console warning, show error toast

No exceptions are thrown. Errors are non-fatal and logged to console.

## Selection rendering

Nodes with a `selection` property render as selectable elements.
The `selectable` boolean (default: true) controls whether clicking
the node updates the selection state.

```
selection:
  scope: page         # or app
  stateKey: selected_item
```

Rendered as:

```html
<div class="wf-node wf-selectable" data-selection-key="selected_item">
  ...
</div>
```

On click, the node's ID (or primaryKey if data-bound) is written to
the `stateKey` in the specified scope. The currently selected element
gets `class="wf-selected"` (highlighted with a blue border).
Only one item can be selected per `stateKey` at a time.

## Interactive elements

Nodes with `interaction` arrays render with `class="wf-interactive"` and
appropriate event listeners. Navigation interactions render as:

```html
<div class="wf-button wf-interactive" data-nav="dashboard">
  <button>Dashboard</button>
</div>
```

---

# 9. State Binding Runtime

State bindings are resolved at page load and updated reactively when
state changes.

## Initial state

* **appState** defaults loaded from `sitemap.yaml`. Stored in `sessionStorage`
  with key prefix `wf_app_` (e.g., `wf_app_theme` for `appState.theme`).
  Values serialized as JSON strings. Persists across page navigation.
  Resets when browser tab closes.
* **pageState** defaults loaded from page YAML. Stored in a JavaScript object
  (`window.__wfPageState`). Resets on every page navigation (new page load
  creates a fresh object from defaults).

## Binding expressions in rendered HTML

| Expression | Resolves to | Rendered as |
|------------|------------|-------------|
| `{{state.key}}` | pageState value | `<span data-bind="state.key">value</span>` |
| `{{appState.key}}` | appState value | `<span data-bind="appState.key">value</span>` |
| `{{route.id}}` | Current route ID | Static text (set at build/render time) |
| `{{props.key}}` | Component prop | Resolved at build time during component expansion |
| `{{item.field}}` | Dataset item field | Resolved during data iteration (see section 10) |
| `{{event.field}}` | Event data | Resolved at interaction time (see below) |

## Event binding

`{{event.field}}` expressions are resolved at interaction time, not at
render time. They provide access to the triggering event's context:

* `{{event.value}}` — current value of the input/select/textarea that triggered the interaction
* `{{event.checked}}` — boolean checked state for checkbox/toggle
* `{{event.targetId}}` — ID of the node that triggered the interaction

Event bindings are only valid inside `interaction` definitions (e.g. as
the `value` in a `set_state` interaction). They are not valid in props
or static text bindings.

## Reactivity

When `set_state` or `toggle` changes a state value:

1. Update storage (JS object for pageState, sessionStorage for appState)
2. Find all DOM elements with matching `data-bind` attribute
3. Update their text content to the new value
4. Re-evaluate `visibility` conditions — show/hide elements accordingly
5. Re-evaluate `stateBindings` — stateBindings are encoded as
   `data-wf-state-bindings='{"propName":"{{state.key}}"}'` on the element.
   The runtime parses these and updates bound DOM properties:
   - Text props (e.g. `text`, `label`, `placeholder`) → update `textContent` or `value`
   - Boolean props (e.g. `disabled`, `checked`) → update DOM attribute
   - Style props → update inline style
   - Visibility → toggle `display: none`

---

# 10. Data Binding and Collection Rendering

Nodes with `binding.source` iterate over dataset items.

## Example

Given this YAML:

```yaml
- id: product_list
  component: section
  binding:
    source: products_source
    itemVar: product
  children:
    - id: product_name
      component: text
      props:
        text: "{{product.name}}"
```

The renderer:

1. Looks up `products_source` in the page's `dataSources` to find the dataset ID
2. Loads dataset items from the data YAML file
3. Clones the children template once for each item
4. Replaces `{{product.name}}` with the actual field value from each item
5. Generates unique DOM IDs for cloned elements: `product_name_0`, `product_name_1`, etc.
   These are runtime DOM `id` attributes only — they do not affect the YAML
   addressing model (which prohibits index-based addressing).

Each iteration renders as a bordered wireframe box. The iteration count
matches the actual dataset item count (not a placeholder).

## Nested object access

Dataset items may contain nested objects. Field access uses dot notation:

```yaml
props:
  text: "{{product.address.city}}"
```

The renderer traverses the object path: `item.address.city` resolves to
`item["address"]["city"]`. If any segment is missing, renders empty string.

---

# 11. Navigation Between Pages

## Route-to-file mapping

Each route in `sitemap.yaml` maps to a page HTML file:

```
Route: { id: dashboard, path: /dashboard, page: dashboard }
  → web/dashboard.html (within the platform folder)
```

The mapping is embedded as a `const WF_ROUTES = { ... }` object in each
page's HTML. The `wfNavigate(routeId)` function looks up the target file
and performs `window.location.href = target`.

## Cross-platform navigation

If a web page navigates to a route whose page has `device: mobile`, the
link resolves to `../mobile/<pageId>.html`. The build emits a warning:

```
Warning: Cross-platform navigation from web/dashboard to mobile/home_mobile
```

## Back navigation

Browser back button works natively — each page is a separate HTML file
with a unique URL.

---

# 12. Pane Rendering (Resizable Panels)

Nodes with `pane` metadata render as resizable panels.

```
pane.side: left    → Panel anchored to left edge
pane.side: right   → Panel anchored to right edge
pane.side: center  → Panel centered (content area between left/right panes)

If `pane.side` is omitted, defaults to `left`.
```

Rendered with CSS `resize` handle and min/max constraints:

| YAML | CSS |
|------|-----|
| `defaultSize` | `width: {value}px` (or height for horizontal splits) |
| `minSize` | `min-width: {value}px` |
| `maxSize` | `max-width: {value}px` |
| `collapsedSize` | Width when collapsed |

Collapse/expand is handled via interaction runtime (toggle on the pane's
`state.collapsedKey`). Resize uses a CSS resize handle or JS drag handler.

If `pane.state` is defined, size and collapsed state persist via the
state system (appState for cross-page, pageState for per-page).

---

# Schema References

| File | Contents |
|------|----------|
| [schema.md](schema.md) | Document types, core node model |
| [schema-systems.md](schema-systems.md) | Layout, state, interactions, overlays, validation |
| [schema-canonical.yaml](schema-canonical.yaml) | Canonical YAML definition |
| [schema.json](schema.json) | Formal JSON Schema |
| [brief.md](brief.md) | CLI commands and behavior |
