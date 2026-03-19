# Engine Environment Abstraction

## Related Documentation

- [Architecture](../docs/architecture.md) — engine section (must work from in-memory document maps)
- [AGENTS.md](../AGENTS.md) — engine rules (no process.exit, no console.log, no framework imports)
- [Schema](../docs/cli/schema.md) — document types the engine processes
- [Rendering](../docs/cli/rendering.md) — build pipeline the engine implements
- [Rendering Modes](../docs/cli/rendering-modes.md) — line vs card rendering
- [Brief](../docs/cli/brief.md) — CLI commands that consume the engine

## Problem

The engine currently uses `require('node:fs')` and `require('node:path')` throughout its modules. The architecture requires the engine to "work from in-memory document maps, not filesystem paths." Three upcoming consumers cannot use the engine as-is:

1. **API server** — builds documents from PostgreSQL rows, not filesystem files
2. **Client-side renderer** — runs in the browser with no filesystem access
3. **CLI** — the existing consumer, works with the filesystem

The engine needs to be refactored so its core logic accepts in-memory data structures, with filesystem I/O pushed to the CLI layer.

---

## Task: Refactor engine to separate core logic from filesystem I/O

### Requirements

**Split each engine module into core logic + filesystem adapter:**

The core modules receive pre-loaded data and return results without touching `fs` or `path`:

```
engine/
  schema/
    index.js          → core: validate(documentObject, schemaJson) → ValidationResult
    loader.js         → fs adapter: loadYamlFile(path) → parsed object (CLI only)
  resolver/
    index.js          → core: resolve(documentMap) → ResolvedTree
  renderer/
    index.js          → core: render(resolvedTree, options) → HtmlString
  build/
    index.js          → core: buildProject(documentMap, options) → BuildOutput
    fs-writer.js      → fs adapter: writeBuildOutput(output, dir) (CLI only)
  validate/
    index.js          → core: validate(documentMap) → ValidationResult[]
  addressing/
    index.js          → core: pure already (string manipulation)
  doctor/
    index.js          → partially fs-dependent, keep as CLI-only for now
  screenshots/
    index.js          → Playwright-dependent, keep as server-only
```

**Core module contract:**

```typescript
// What the API and renderer library will import
interface DocumentMap {
  manifest: object        // parsed YAML object
  sitemap: object
  templates: object
  components: object
  pages: Map<string, object>     // pageId → parsed page object
  datasets: Map<string, object>  // datasetId → parsed dataset object
  imports?: Map<string, object>  // path → parsed component document (for imported components)
}

interface BuildOutput {
  pages: Array<{ pageId: string, platform: string, html: string }>
  css: string           // wireframe.css content
  js: string            // interactions.js content
  routeTable: Record<string, string>  // routeId → relative path
  indexHtml: string     // master index page
  platformIndexes: Record<string, string>  // platform → index HTML
}

function buildProject(documentMap: DocumentMap, options?: BuildOptions): BuildOutput
function renderPage(documentMap: DocumentMap, pageId: string, options?: RenderOptions): string
function validateProject(documentMap: DocumentMap): ValidationResult[]
```

**No breaking changes to CLI:**

The CLI continues to work unchanged. It builds the DocumentMap from filesystem files (using the fs adapter modules), then passes it to the core functions. Refactoring is internal — the CLI's public commands don't change.

**Eliminate all `require('node:fs')` and `require('node:path')` from core modules:**

- `fs.readFileSync` → caller provides the data
- `fs.writeFileSync` → caller writes the returned data
- `path.join`, `path.resolve` → simple string concatenation for relative paths within the document map, or a tiny `pathJoin` utility that doesn't require Node.js `path`
- `path.basename`, `path.dirname`, `path.extname` → simple string operations

### What NOT to change

- Don't rewrite the engine from scratch — extract filesystem calls to the boundary
- Don't change the YAML schema or document format
- Don't change CLI behavior
- Don't add new features
- Keep all existing tests passing (update them to use in-memory fixtures instead of filesystem)

### Patterns

- Core modules export pure functions taking in-memory data
- Filesystem adapters are thin wrappers in separate files
- CLI imports both core and adapters; API and renderer import only core
- Test refactored modules with in-memory fixtures (no temp directories)

### Acceptance Criteria

- All engine core modules have zero `require('node:fs')` and zero `require('node:path')` imports
- `buildProject(documentMap)` produces BuildOutput from in-memory data
- `renderPage(documentMap, pageId)` renders a single page from in-memory data
- `validateProject(documentMap)` validates from in-memory data
- All existing CLI tests continue to pass
- New unit tests verify core modules work with in-memory document maps
- `wf build` and `wf serve` produce identical output to before refactoring
