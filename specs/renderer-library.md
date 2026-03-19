# Client-Side Renderer Library

## Related Documentation

- [Architecture](../docs/architecture.md) — client-side rendering library section (why YAML, what's included, cost model)
- [AGENTS.md](../AGENTS.md) — engine rules (no CLI/API deps), code quality rules
- [Rendering](../docs/cli/rendering.md) — full rendering pipeline, primitive→HTML mapping, layout→CSS, overlay rendering, interaction runtime, state binding, data binding, pane rendering
- [Rendering Modes](../docs/cli/rendering-modes.md) — line vs card mode, CSS tokens, surface rules, component rendering per mode
- [Schema](../docs/cli/schema.md) — document types, core node model
- [Schema Systems](../docs/cli/schema-systems.md) — layout, state, interactions, overlays, panes, data binding, primitives, validation
- [Brief](../docs/cli/brief.md) — wf build/serve behavior (renderer replicates this in-browser)
- [Canonical YAML](../docs/cli/schema-canonical.yaml) — full schema definition
- [JSON Schema](../engine/schema/schema.json) — formal validation schema

## Overview

A standalone JavaScript library that runs entirely in the browser. It downloads YAML project files from the API, parses them client-side, resolves templates/components, and renders the full wireframe HTML. This offloads all rendering from server to client — zero per-render server cost.

## Monorepo Location

```
renderer/
  src/
    index.ts        Library entry point
    parser.ts       YAML parsing (wraps js-yaml)
    resolver.ts     Template + component resolution (from engine)
    renderer.ts     Node tree → HTML (from engine)
    layout.ts       Layout → CSS (from engine)
    interactions.ts Interaction runtime (from engine)
    state.ts        State binding runtime (from engine)
    data.ts         Data binding + collection renderer (from engine)
    styles.ts       Wireframe style system (from engine)
  bundle/
    wireframe-renderer.min.js   Built output (ESM, single file)
  package.json
  tsconfig.json
  rollup.config.js              or esbuild config
```

Package name: `@wireframes/renderer`. Format: ESM. Zero external runtime deps (js-yaml bundled).

---

## Task 11: Bundle engine modules as single ESM file for browser

### Requirements

- Create `renderer/` package in the monorepo
- Configure bundler (esbuild preferred for speed, or Rollup) to produce a single minified ESM file
- Bundle includes:
  - `js-yaml` (~8KB gzipped) — YAML parser
  - Engine resolver module — template + page + component resolution
  - Engine renderer module — node tree → HTML emission
  - Engine layout module — layout → CSS generation
  - Engine style module — wireframe style → CSS
- Bundle excludes:
  - Engine validation module (validation stays server-side)
  - Engine screenshots module (Playwright, server-only)
  - Engine doctor module (CLI-only)
  - Any Node.js/Bun APIs
- Output: `renderer/bundle/wireframe-renderer.min.js`
- Export a single `renderProject(yamlFiles: Record<string, string>): RenderedProject` function
- Target: modern browsers (ES2020+, no IE11)
- Source maps for development builds

### Engine Adaptation

The engine modules are currently CommonJS. The bundler must handle CJS → ESM conversion. If engine modules use Node.js APIs (fs, path), those imports must be stubbed or eliminated:

- `fs` — not needed (renderer receives YAML strings, not file paths)
- `path` — replace with simple string manipulation for relative path resolution
- `process` — not used (engine rules forbid `process.exit`)

If the engine has any Node.js-specific code paths, create browser-compatible shims or refactor the engine to be environment-agnostic.

### Patterns

- Tree-shake unused engine code (validation, doctor, screenshots)
- Bundle size target: < 50KB gzipped (js-yaml ~8KB + engine code)
- No side effects on import — library only activates when called
- Version the bundle (include engine version in output filename or metadata)

### Acceptance Criteria

- `pnpm --filter @wireframes/renderer build` produces the bundle
- Bundle is a single `.js` file importable as ESM
- Bundle contains no Node.js API calls
- Bundle size < 50KB gzipped
- `import { renderProject } from './wireframe-renderer.min.js'` works in browser
- Simple smoke test: parse a YAML project and produce HTML output in a browser

---

## Task 12a: Implement core rendering pipeline (primitives, layout, styles)

### Requirements

Implement the core rendering path — YAML → resolved tree → HTML — in the browser library.

**API:** The library exports these functions:

```typescript
// Full project render
function renderProject(yamlFiles: Record<string, string>, options?: RenderOptions): RenderedProject

// Single page render — for live preview in editor
function renderPage(yamlFiles: Record<string, string>, pageId: string, options?: RenderOptions): string

// Parse and validate YAML (lightweight, no full schema validation)
function parseProject(yamlFiles: Record<string, string>): ParsedProject
```

Where:
- `yamlFiles` is a map of filename → YAML string (e.g. `{ "manifest.yaml": "...", "sitemap.yaml": "...", "pages/dashboard.yaml": "..." }`)
- `RenderOptions`: `{ platform?, basePath?, mode? }`
- `RenderedProject`: `{ pages: Map<string, string>, css: string, js: string, routeTable: Record<string, string> }`

**Note on engine input:** The library receives raw YAML strings, parses them with js-yaml, builds a DocumentMap (see [engine-abstraction.md](engine-abstraction.md)), and passes it to the engine's core functions. The engine core accepts parsed objects, not raw YAML.

**Pipeline steps** (from [rendering.md](../docs/cli/rendering.md)):

1. Parse all YAML strings using js-yaml
2. Build DocumentMap from parsed objects
3. Resolve component import graphs from templates, pages, and component documents
4. Resolve template + page (fill slots, inject injectables, expand components)
5. Walk resolved node tree and emit HTML
6. Apply wireframe CSS (borders, layout, spacing) — [rendering-modes.md](../docs/cli/rendering-modes.md)

**This task covers:**
- All primitives (heading, paragraph, text, image, icon, button, tab_bar, bottom_tab_bar, input, textarea, select, checkbox, radio, toggle, chart, table, section, divider, spacer)
- All layout types (stack, row, grid, absolute, overlay)
- Both rendering modes (line, card) from [rendering-modes.md](../docs/cli/rendering-modes.md)
- Viewport dimensions per device type
- Wireframe style system (borders, corners, surfaces)
- Pane rendering (resizable panels)

### Patterns

- Share as much code as possible with the engine (same resolver, same renderer)
- CSS is generated based on the rendering mode (line/card)
- Font Awesome: link to CDN in generated HTML (self-containment is relaxed for icons — bundling FA would triple the bundle size)

### Acceptance Criteria

- `renderProject` produces functionally equivalent HTML to `wf build` for the same YAML input (semantically identical structure and styling; minor whitespace/attribute-order differences are acceptable)
- `renderPage` renders a single page with correct template resolution
- All primitives render correctly in both line and card modes
- All layout types produce correct CSS
- Viewport dimensions match the device type declarations
- Performance: renders a 20-page project in < 500ms on a modern browser

---

## Task 12b: Implement interaction runtime, state binding, and data binding

### Requirements

Complete the browser rendering pipeline with runtime behaviors.

**This task adds to the library built in 12a:**

**Interaction Runtime** (from [rendering.md](../docs/cli/rendering.md) § 8):
- Navigation: `wfNavigate(routeId)` using embedded route table
- Overlay open/close: add/remove `wf-visible` class, backdrop handling, trigger-anchored positioning
- Toggle: flip boolean state, update DOM
- Set state: update state store, trigger reactive DOM updates
- Submit: gather form values, show toast
- Action: show toast with action ID
- Gesture: touch event handlers for mobile/tablet viewports
- Conditional execution: evaluate conditions before running interactions

**State Binding** (from [rendering.md](../docs/cli/rendering.md) § 9):
- appState in sessionStorage, pageState in JS object
- Binding expressions: `{{state.key}}`, `{{appState.key}}`, `{{route.id}}`, `{{event.field}}`
- Reactive updates: state change → update bound DOM elements → re-evaluate visibility conditions → update stateBindings

**Data Binding** (from [rendering.md](../docs/cli/rendering.md) § 10):
- Collection iteration: clone children per dataset item
- `{{item.field}}` expression resolution including nested dot notation
- Unique DOM IDs for cloned elements

**Selection Rendering:**
- `wf-selectable` click handler writes to state
- `wf-selected` class on active item

**Navigation in browser preview vs static build:**
- In static build: navigation changes `window.location.href`
- In live preview (editor): navigation should fire a callback (`onNavigate`) instead of changing URL, so the editor can handle page switching

### Patterns

- Interaction JS is generated as a string and injected into the HTML `<script>` tag
- The library generates all runtime JS — no external files needed
- For live preview mode, inject a message-passing bridge so the parent frame (editor) can intercept navigation

### Acceptance Criteria

- Interactions work in the browser (navigation, overlay open/close, state changes, submit, action)
- State bindings update reactively when state changes
- Visibility conditions show/hide elements based on state
- Data binding iterates over dataset items correctly
- Selection highlights the active item
- Gestures trigger on mobile/tablet viewports
- Navigation in preview mode fires callback instead of hard navigation
