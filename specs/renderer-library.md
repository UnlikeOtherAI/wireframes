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

## Task 12: Implement browser-side YAML → HTML render pipeline

### Requirements

The renderer library must replicate the full `wf build` pipeline from [rendering.md](../docs/cli/rendering.md) in the browser:

**API:** The library exports these functions:

```typescript
// Full project render — same output as wf build
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

**Pipeline steps** (from [rendering.md](../docs/cli/rendering.md) § rendering pipeline):

1. Parse all YAML strings using js-yaml
2. Resolve component import graphs from templates, pages, and component documents
3. Resolve template + page (fill slots, inject injectables, expand components)
4. Walk resolved node tree and emit HTML
5. Apply wireframe CSS (borders, layout, spacing) — [rendering-modes.md](../docs/cli/rendering-modes.md)
6. Attach interaction JavaScript (navigation, overlays, state, toggles) — [rendering.md](../docs/cli/rendering.md) § 8
7. Bind state and data values into rendered nodes — [rendering.md](../docs/cli/rendering.md) § 9-10
8. Return complete HTML strings

**Must support all features from rendering.md:**
- All primitives (heading, paragraph, text, image, icon, button, tab_bar, bottom_tab_bar, input, textarea, select, checkbox, radio, toggle, chart, table, section, divider, spacer)
- All layout types (stack, row, grid, absolute, overlay)
- Both rendering modes (line, card) from [rendering-modes.md](../docs/cli/rendering-modes.md)
- Overlay rendering with correct z-indexing
- Interaction runtime (navigation, overlays, state, toggles, submit, action, gesture)
- State binding (appState, pageState) with reactivity
- Data binding with collection iteration
- Selection rendering
- Pane rendering (resizable panels)
- Viewport dimensions per device type

### Patterns

- Share as much code as possible with the engine (same resolver, same renderer)
- The interaction runtime JS is generated as a string and injected into the HTML
- CSS is generated based on the rendering mode (line/card)
- Navigation works differently in browser preview vs static build (SPA vs file navigation)
- For live preview: `renderPage` re-renders a single page efficiently

### Acceptance Criteria

- `renderProject` produces identical HTML to `wf build` for the same YAML input
- `renderPage` renders a single page with correct template resolution
- All primitives render correctly in both line and card modes
- Interactions work in the browser (navigation between pages, overlay open/close, state changes)
- Data binding iterates over dataset items correctly
- Viewport dimensions match the device type declarations
- Performance: renders a 20-page project in < 500ms on a modern browser
