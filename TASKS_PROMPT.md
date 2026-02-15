# Task Generation Prompt — Build, Serve & Renderer

Use this prompt to generate steroids tasks for the wireframe CLI build/serve/renderer system. Run this in the wireframes project directory.

---

## Context

The wireframe CLI documentation has been significantly updated since the original 21 tasks were generated (all now marked completed). The following major features were added to the specification **after** those tasks were created and need NEW implementation tasks:

1. **`wf build` command** — Builds click-through HTML wireframe websites from YAML specs
2. **`wf serve` command** — Local dev server with hot reload
3. **Renderer pipeline** — The entire YAML-to-HTML rendering system (rendering.md)
4. **Screenshots update** — The `wf screenshots` task (7f43b4b2) was completed before rendering.md existed. Screenshots depend on the renderer output, so that task needs to be re-opened or a follow-up task created to verify screenshots work with the actual rendered HTML.

## Key Files to Reference

- `rendering.md` — Full renderer specification (viewport, primitives→HTML, layout→CSS, wireframe style, overlays, interactions, state binding, data binding, navigation, panes)
- `brief.md` — CLI command specs for `wf build` and `wf serve` (search for "## Build" and "## Serve")
- `schema-canonical.yaml` — Section 19: BUILD CONTRACT
- `CLAUDE.md` — Architecture (`/shared/renderer` subsystem), rules (Playwright testing per section)

## Existing Section IDs (for dependency references)

```
fb75b57a  Project Bootstrap & Core Infrastructure
4aaa3d40  Schema Loading & Validation Engine
be70f097  Template & Page System
0be833d8  Node & Component System
3f93fac3  Dataset & Mock Data System
9f2602ef  Overlay & Interaction System
19f8ec17  Addressing, Resolution & Tree Operations
6edb4cdd  CLI Utilities & Introspection
85e8d19e  Export & Screenshots
```

## Tasks to Generate

### New Section: "Renderer Core" (depends on all existing sections)

This section covers `/shared/renderer` — the rendering pipeline that turns resolved YAML trees into HTML/CSS/JS.

**Task 1: HTML Emitter — Primitive Components to HTML**
- Implement the node-to-HTML emitter for all 13 primitives (heading, paragraph, text, image, button, input, textarea, select, checkbox, toggle, section, divider, spacer)
- Each primitive maps to specific HTML elements as defined in rendering.md Section 4
- Must handle: props, wireframe CSS classes, `data-wf-*` attributes, node IDs as DOM IDs
- Must handle `position` property for absolute layout children (top/left/right/bottom)
- Source spec: rendering.md sections 4, 6
- Playwright tests: render each primitive in isolation, verify correct HTML structure and CSS classes

**Task 2: Layout CSS Generator**
- Implement layout-to-CSS mapping for all 5 layout types: stack, row, grid, absolute, overlay
- Map layout properties to CSS: gap, padding, columns, justify, align
- Map grid item properties: span, offset, row, column
- Map size properties: width, height, min/max with string passthrough for responsive values
- Grid defaults to `manifest.defaultGridColumns` (12) when columns omitted
- Source spec: rendering.md Section 5
- Playwright tests: render nodes with each layout type, verify CSS output

**Task 3: Wireframe Style System**
- Implement page-level wireframeStyle to CSS conversion (border style/width, corner style/radius)
- Implement per-node WireframeStyleOverride as inline styles
- Implement per-overlay WireframeStyleOverride
- Source spec: rendering.md Section 6
- Playwright tests: render pages with solid/dashed, thin/medium, sharp/rounded combinations

**Task 4: Overlay Renderer**
- Render all 9 overlay types as hidden HTML elements with correct CSS positioning and z-index
- Implement backdrop rendering for modal/alert/drawer/bottom_sheet
- Handle placement for dropdown/popover/tooltip relative to trigger
- Implement dismiss behavior: backdrop click, escape keydown, timeout
- Encode overlay state in DOM (data-wf-overlay-type, wf-visible class)
- Source spec: rendering.md Section 7
- Playwright tests: render each overlay type, verify positioning, z-index, backdrop

**Task 5: Interaction Runtime (interactions.js)**
- Implement all 8 interaction types: navigation, open/close_overlay, toggle, set_state, submit, action, gesture
- Navigation: route table lookup (`WF_ROUTES`), `wfNavigate()` function
- Overlays: toggle `wf-visible` class, manage backdrop
- State: toggle/set_state with scope-appropriate storage
- Submit: gather form values by node ID, show toast (top-right, 3 seconds)
- Action: show toast with actionId
- Gesture: touch event handlers for 7 gesture types (mobile/tablet only, ignored on web)
- Conditional execution: parse `data-wf-interactions` JSON, evaluate conditions before executing
- Error handling: console warnings for missing targets, non-fatal
- Source spec: rendering.md Section 8
- Playwright tests: click through interactions, verify navigation, overlay toggle, state changes

**Task 6: State Binding Runtime**
- Implement appState (sessionStorage with `wf_app_` prefix, JSON serialized)
- Implement pageState (in-memory JS object, `window.__wfPageState`)
- Render `{{state.key}}` and `{{appState.key}}` as `<span data-bind="...">value</span>`
- Implement reactivity: state change → update data-bind elements, re-evaluate visibility (`data-wf-visibility`), re-evaluate stateBindings (`data-wf-state-bindings`)
- stateBindings property types: text→textContent, boolean→attribute, style→inline, visibility→display
- Resolve `{{route.id}}` and `{{props.key}}` at build time
- Implement event bindings: `{{event.value}}`, `{{event.checked}}`, `{{event.targetId}}`
- Source spec: rendering.md Section 9
- Playwright tests: verify state persistence across pages (appState), state reset on nav (pageState), reactive updates

**Task 7: Data Binding & Collection Renderer**
- Implement `binding.source` resolution via page `dataSources` → dataset lookup
- Clone children template per dataset item
- Replace `{{itemVar.field}}` expressions with actual values
- Support nested object dot notation (`{{product.address.city}}`)
- Generate unique DOM IDs for clones: `{nodeId}_{index}` (runtime-only, not YAML addressing)
- Handle missing fields (render empty string)
- Source spec: rendering.md Section 10
- Playwright tests: render collection with sample dataset, verify item count, field values

**Task 8: Selection Renderer**
- Implement `selection` property rendering: `wf-selectable` class, `data-selection-key` attribute
- On click: write node ID (or primaryKey if data-bound) to stateKey in scope
- Apply `wf-selected` class to currently selected element (blue border)
- Single selection per stateKey
- Source spec: rendering.md Section 8 (Selection rendering subsection)
- Playwright tests: click selectable items, verify class toggling, state updates

### New Section: "Build & Serve Commands" (depends on Renderer Core)

**Task 9: `wf build` Command**
- Implement full build pipeline: validate → resolve → render → write files
- Platform grouping: pages into web/mobile/tablet folders by viewport.device
- Generate master index.html (hub linking platforms)
- Generate per-platform index.html (page listings)
- Generate per-page HTML files (self-contained with linked CSS/JS)
- Generate `_shared/wireframe.css` and `_shared/interactions.js` per platform
- Copy assets/ to build root
- Handle `--output`, `--platform`, `--clean`, `--base-path` flags
- Base path: prefix all navigation links, asset paths, route table entries
- Deterministic output (no timestamps, no random values)
- Source spec: rendering.md Section 2, brief.md "Build" section, schema-canonical.yaml Section 19
- Playwright tests: build sample project, verify file structure, open pages in browser, click through navigation

**Task 10: `wf serve` Command**
- Implement local dev server on localhost
- Render pages on-the-fly (same pipeline as build)
- Watch YAML and asset files for changes
- Hot reload: re-validate, re-render affected pages, push update to browser
- Validation errors display as overlay in browser (red border, error text)
- Handle `--port`, `--platform`, `--open`, `--no-reload` flags
- URL scheme mirrors build: `http://localhost:{port}/{platform}/{pageId}.html`
- Source spec: rendering.md Section 2, brief.md "Serve" section
- Playwright tests: start serve, modify YAML, verify hot reload in browser

**Task 11: Pane Renderer**
- Implement pane rendering for resizable panels (left/right/center)
- CSS resize handle or JS drag handler
- Default size, min/max constraints
- Collapse/expand via state toggle
- `pane.side` defaults to `left` when omitted
- State persistence via appState/pageState if `pane.state` defined
- Source spec: rendering.md Section 12
- Playwright tests: render pane layout, verify resize behavior, collapse/expand

### Update Required

**Task 12: Update Screenshots for Renderer Output**
- The existing screenshots task (7f43b4b2 in section 85e8d19e) was completed before the renderer existed
- Screenshots now capture the actual rendered HTML wireframes (not just raw YAML structure)
- Must verify: Playwright captures rendered pages correctly, device frames composite properly
- Must verify: screenshots reflect wireframe styling (borders, layout, overlays in correct positions)
- Either re-open task 7f43b4b2 or create a follow-up task in the Export & Screenshots section

## Section Dependencies

```
All existing sections (completed)
  └── Renderer Core (new)
        └── Build & Serve Commands (new)
              └── Screenshots Update (in existing Export & Screenshots section)
```

## Commands to Run

```bash
# Create new sections
steroids sections add "Renderer Core"
steroids sections add "Build & Serve Commands"

# Add tasks to sections (use the IDs returned from section creation)
# Then set dependencies:
# Renderer Core depends on: 9f2602ef (Overlay & Interaction), 19f8ec17 (Addressing), 3f93fac3 (Dataset)
# Build & Serve depends on: Renderer Core section ID

# For the screenshots update, add a task to the existing section:
steroids tasks add "Update wf screenshots for renderer output" --section 85e8d19e
```

## Important Rules

- Each task must have Playwright tests (see CLAUDE.md rule)
- Save LLM review output to `/tmp/` files (see CLAUDE.md rule)
- Source spec for rendering is `rendering.md` — the canonical rendering document
- Schema changes must be reflected in ALL docs (schema.md, schema-systems.md, schema-canonical.yaml, schema.json, brief.md, rendering.md)
- No file bigger than 500 lines in source code
- CLI is a thin shell; all rendering logic goes in `/shared/renderer/`
