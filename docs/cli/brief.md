# Wireframe CLI — Clean Generation Brief

## 1. What This CLI Is

A **project generator and structure manager** for deterministic wireframe specs.

The output is **literal wireframes**. Not styled UI. Not production screens.
Everything renders as skeleton frames you can click through:

* A button is a wireframe box with text inside
* A heading is text at a given level
* An image is a frame showing the picture (e.g. a client logo) or alt text
* A sidebar is a frame with a border
* A dropdown is a frame
* A card is a frame
* A modal is a frame on top of another frame
* A navigation bar is a row of wireframe controls
* An input is a framed placeholder field

Built-in primitives: `heading`, `paragraph`, `text`, `image`, `icon`, `button`,
`tab_bar`, `bottom_tab_bar`, `input`, `textarea`, `select`, `checkbox`, `radio`,
`toggle`, `chart`, `table`, `section`, `divider`, `spacer`.

Surface elements are framed rectangles; content primitives such as headings,
paragraphs, text, charts, dividers, and spacers stay unboxed unless explicitly
promoted. Images can reference a URL or a file in `assets/` (e.g. a client
logo).
If a layout is defined as resizable, it stretches like HTML would — but it is still
a wireframe. No colors, no icons beyond what's in assets, no production styling.
Just frames, text, images, and structure.

This is a clickable skeleton of a web application.

It:

* Creates projects
* Generates pages/templates/components and optional data
* Validates structure
* Exports a complete wireframe package (ZIP)

It does NOT:

* Apply AI patches
* Mutate live websites
* Manage deployments
* Modify Git history
* Produce production-styled UI

---

# 2. Core Purpose

The CLI must:

1. Scaffold a new wireframe project
2. Add/remove pages
3. Add/remove templates
4. Add/remove reusable components
5. Add/import datasets
6. Validate structure
7. Export a ZIP

Everything is file-based.

---

# 3. CLI Commands (Clean & Minimal)

## Project

```bash
wf init <project-name>
wf export
wf validate
wf tree
wf info
wf doctor
wf schema
wf lint
wf screenshots
```

### wf init

Creates:

```
/wireframe
  manifest.yaml
  .wfrc.yaml
  sitemap.yaml
  templates.yaml
  components.yaml
  /pages
  /data        # optional; only needed for datasets
  /assets
```

Also generates:

* manifest with project metadata and schema version
* CLI config with validation defaults
* default public template
* default editor template
* one starter page

`components.yaml` is the starter registry, not a folder convention. Reusable
component documents may be split into any project subfolders and imported by
relative path from `templates.yaml`, page documents, or other component
documents. Organization is user-defined; only explicit imports matter.

### wf tree

Prints the project structure as a visual tree:

* All routes and their associated pages
* Template regions (persistent, slot) with children
* Page slot content
* Overlay IDs
* Component references

Output is indented plain text showing the resolved hierarchy.

### wf info

Prints project metadata from manifest.yaml:

* project name
* schema version
* CLI version used to create
* default grid columns
* default wireframe style

### wf doctor

Checks project health:

* Required files exist
* All YAML valid
* No circular template references
* No orphan routes
* No broken page/component/dataset references
* Schema version compatible with CLI

### wf schema

Prints supported schema reference:

* Supported schema version
* Allowed interaction types: navigation, open_overlay, close_overlay, toggle, set_state, submit, action, gesture
* Allowed gesture types: swipe_left, swipe_right, swipe_up, swipe_down, long_press, pinch, double_tap
* Allowed overlay types
* Allowed layout primitives
* Allowed condition types

### wf lint

Checks naming conventions:

* snake_case consistency
* No uppercase in IDs
* No ambiguous names
* No reserved keywords
* Unknown props on primitive components (`UNKNOWN_PROP`, warning)
* Missing text, unlabeled fields, label-alias usage, and demoted nested
  surfaces (`info`, never strict-fatal)

---

## Pages

```bash
wf page add <id> --path /settings --template public_shell --device web
wf page add <id> --path /settings --template mobile_shell --device mobile --orientation portrait
wf page remove <id>
wf page list
```

Rules:

* Updates sitemap.yaml
* Creates pages/<id>.yaml
* Enforces required wireframeStyle
* `--device` is REQUIRED (mobile | tablet | web)
* `--orientation` is REQUIRED for mobile and tablet (portrait | landscape)
* Each page targets one viewport — create separate pages for different viewports

No hidden magic.

---

## Templates

```bash
wf template add <id>
wf template remove <id>
wf template list
```

Templates define persistent regions, slots, and injectables.

Injectables are named placeholder nodes inside persistent regions.
Pages cannot override persistent regions, but can supply content
for any injectable within them (e.g. page-specific action buttons
in a shared header toolbar).

Template removal:

* Fails if pages use it

---

## Components

```bash
wf component add <id>
wf component remove <id>
wf component list
```

No mutation logic. Just structure.

---

## Nodes

```bash
wf node add <component> --below <address> --id <nodeId>
wf node add <component> --below <address> --id <nodeId> --props '{"label":"Save"}'
wf node update <address> --props '{"label":"Cancel"}'
wf node remove <address>
```

Adds, updates, or removes elements and sections within a page or template tree.

Works with both page and template addresses:

* `wf://page/dashboard#...` — edits the page YAML
* `wf://template/app_shell#...` — edits the template YAML

### wf node add

* `<component>` — a primitive (e.g. `button`, `section`) or a reusable component ID (e.g. `metric_card`)
* `--below <address>` — the `wf://` address of the sibling node to insert after
* `--inside <address>` — the `wf://` address of the parent node to insert as the first child
* `--id <nodeId>` — ID for the new node (must be unique within scope)
* `--props` — optional JSON props for the new node

Use `--below` to insert after a sibling. Use `--inside` to add the first child to an empty container (section, slot, etc.). Exactly one of `--below` or `--inside` is required.

Rules:

* Target address must resolve to an existing node
* Target node's parent must accept children
* New ID must be unique within the resolved tree
* Validates after insertion

### wf node update

* `<address>` — the `wf://` address of the node to update
* `--props` — JSON props to merge into the existing node
* `--component <component>` — change the component type
* `--layout <layoutJson>` — update the layout definition

Rules:

* Target address must resolve to an existing node
* Merges props (does not replace entire props object)
* Cannot change the node ID (use rename for that)
* Validates after update

### wf node remove

* `<address>` — the `wf://` address of the node to remove

Rules:

* Removes the node and all its children
* Updates the YAML file in place
* Validates after removal

This is explicit, deterministic structural editing — not AI patching or live mutation.
The address determines which file gets modified (page YAML or template YAML).

---

## Overlays

```bash
wf overlay add <targetId> <overlayId> --type modal
wf overlay add <targetId> <overlayId> --type drawer_left
wf overlay add <targetId> <overlayId> --type dropdown --template
wf overlay remove <targetId> <overlayId>
wf overlay list <targetId>
```

Manages overlay definitions on pages or templates.

### wf overlay add

* `<targetId>` — the page or template to add the overlay to
* `<overlayId>` — ID for the new overlay (must be unique within the target, and across template + page overlays when resolved)
* `--type` — overlay type (REQUIRED): dropdown, popover, menu, modal, drawer_left, drawer_right, bottom_sheet, toast, alert, tooltip
* `--trigger <nodeId>` — optional trigger node ID
* `--placement <value>` — optional placement (top, bottom, left, right, center)
* `--template` — add the overlay to a template instead of a page

Creates an overlay entry in the target YAML with an empty `content: []` array.
Use `wf node add` with an overlay address to add content inside the overlay.

Template overlays are useful for persistent UI elements like navigation
dropdowns, notification panels, and user menu popovers that appear on
every page using the template.

### wf overlay remove

* Removes the overlay and all its content from the target YAML
* Fails if any node references this overlay via interaction

### wf overlay list

* Lists all overlays defined on a page or template
* For pages, also shows inherited template overlays

---

## State

```bash
wf state list
wf state list --scope app
wf state list --scope page --page <pageId>
```

Read-only introspection of declared state keys.

* `wf state list` — lists all state keys across the project (appState + all pageState)
* `--scope app` — only appState keys (from sitemap.yaml)
* `--scope page --page <pageId>` — only pageState keys for a specific page

No mutation. State values are edited in YAML files directly.

---

## Data

```bash
# Dataset management
wf data add <datasetId> --primaryKey <field>
wf data remove <datasetId>
wf data list
wf data import <datasetId> --from <file>

# Item CRUD — pass whole objects
wf data item add <datasetId> '<json>'
wf data item add <datasetId> --from <file>
wf data item update <datasetId> <primaryKeyValue> '<json>'
wf data item remove <datasetId> <primaryKeyValue>
wf data item get <datasetId> <primaryKeyValue>
wf data item list <datasetId>

# Utilities
wf data validate <datasetId>
wf data stats <datasetId>
wf data keys <datasetId>
```

### wf data add

Creates a new empty dataset file at `data/<datasetId>.yaml`.

* `--primaryKey <field>` — REQUIRED. The field that uniquely identifies each item.
* `--fields <field1,field2,...>` — optional. Declares expected fields for documentation/validation.

### wf data remove

Removes a dataset file. Fails if any page references it via `dataSources`.

### wf data import

Imports items from an external JSON or CSV file into an existing dataset.

* Normalizes into dataset envelope
* Enforces primaryKey presence and uniqueness
* Fails on duplicate primaryKey values
* Merges with existing items (fails on key collision unless `--overwrite`)

### wf data item add

Adds a single item to a dataset. The item is passed as a **whole JSON object**:

```bash
wf data item add users '{"user_id": "u003", "name": "Alice", "role": "viewer"}'
```

Or from a file:

```bash
wf data item add users --from item.json
```

* Fails if primaryKey is missing from the object
* Fails if primaryKey value already exists in the dataset

### wf data item update

Replaces an existing item by primaryKey value. Pass the **whole replacement object**:

```bash
wf data item update users u003 '{"user_id": "u003", "name": "Alice Chen", "role": "admin"}'
```

* The primaryKey field in the object must match `<primaryKeyValue>`
* Fails if the item does not exist

### wf data item remove

Removes an item by primaryKey value.

* Fails if the item's primaryKey value appears in any state default or selection binding

### wf data item get

Prints a single item as YAML.

### wf data item list

Lists all items with their primaryKey values.

### Data utilities

* `validate` — check duplicate primary keys, missing declared fields, null values, type consistency
* `stats` — item count, field summary, dataset byte size
* `keys` — list all primary key values

---

## Validation

```bash
wf validate
wf validate --json
wf validate --strict
```

Outputs clean structured result:

```
✔ No blocking errors
⚠ 2 warnings
```

Or:

```
✖ ERROR wf://page/dashboard#stats_grid
  - span exceeds grid columns (mobile_portrait)
```

Flags:

* `--json` — machine-readable output
* `--strict` — fails on warnings (unused components, unused datasets, empty slots)

No auto-fixing.
No guessing.

---

## Export

```bash
wf export --output build.zip
```

Rules:

* Must validate successfully
* Includes only project folder
* Includes manifest.yaml
* No transformation

Just zipped spec.

---

## Build

```bash
wf build
wf build --output ./wireframes/build
wf build --platform web
wf build --platform mobile
wf build --clean
```

Builds a complete click-through HTML wireframe website from YAML specs.
Each page becomes a self-contained HTML file. The output is a static site
you can open in a browser and click through.

* `--output <dir>` — output directory (default: `./wireframes/build`)
* `--platform <value>` — build only: `web`, `mobile`, `tablet`, or `all` (default: `all`)
* `--clean` — remove existing build directory before building
* `--base-path <path>` — base path prefix for URLs (default: `/`)

Pages are grouped by `viewport.device` into platform folders. Project must
pass `wf validate` before building. See [rendering.md](rendering.md) for the
full rendering specification and output structure.

---

## Serve

```bash
wf serve
wf serve --port 3000
wf serve --platform web
wf serve --open
```

Launches a local dev server rendering wireframes in the browser.
Same rendering pipeline as `wf build`. Watches YAML files and hot-reloads.

* `--port <number>` — dev server port (default: `8080`)
* `--platform <value>` — serve only a specific platform (default: `all`)
* `--open` — open browser on launch
* `--no-reload` — disable hot reload

See [rendering.md](rendering.md) for rendering details.

---

## Screenshots

```bash
wf screenshots
wf screenshots --output ./shots
wf screenshots --page <pageId>
wf screenshots --frame <frameId>
wf screenshots --frame phone_bold --page dashboard
```

Uses Playwright under the hood. Playwright is a bundled dependency —
it installs automatically with the package, no separate setup needed.
Renders every page as a wireframe and captures a screenshot of each.

Generates:

* One PNG per page (named by page ID)
* An `index.html` file linking all screenshots with page IDs and routes
* When `--frame` is used, wireframe is composited inside the device frame image

Flags:

* `--output <dir>` — output directory (default: `./screenshots`)
* `--page <pageId>` — capture a single page instead of all
* `--frame <frameId>` — wrap screenshots in a device frame (see `assets/frames/`)

Available frames defined in `assets/frames/frames.yaml`:

Phone frames (from `source.ai`):

* `phone_bold` — thick black bezel
* `phone_wireframe` — thin outline style
* `phone_realistic` — dark bezel with side buttons

Browser frames (from `source_browser.ai`):

* `browser_small` — small browser window
* `browser_medium` — medium browser window
* `browser_large` — large browser window

Each frame defines a screen region where the wireframe content is composited.

Rules:

* Project must validate successfully before capturing
* Screenshots reflect the literal wireframe output (frames, borders, text labels)
* Index file is self-contained (inline styles, relative image paths)
* Frame images must exist as PNGs in `assets/frames/`

---

## Introspection

```bash
wf where-used <componentId>
wf where-used <datasetId>
wf routes
wf stats
wf why <nodeId> [--page <pageId>] [--json]
```

Read-only. No mutations.

* `where-used` — shows all pages/templates referencing a component or dataset
* `routes` — lists all routes with page and template mappings
* `stats` — total pages, templates, components, unused components, dataset sizes
* `why` — explains how one node rendered: its frame, the rule behind it, the
  resolved sizing tokens, and the single edit that would change it. It reads the
  rendered markup rather than re-deriving the decision, so it cannot disagree
  with the output.

---

## Packaging

```bash
wf pack [--out <file.wf>]
wf unpack <file.wf> [--out <dir>]
```

`.wf` is the whole project in one text file: a multi-document YAML stream with
`format: wf/1` on the manifest. Both directions are lossless. See
[wf-format.md](wf-format.md).

---

## Reference for agents

```bash
wf llm                      # the full generated reference
wf llm --short              # a ~1,100-token cheat sheet
wf llm --element <name>     # one element, with an example
wf llm --family <name>      # containers | text | controls | navigation | data | feedback
```

Generated from `engine/schema/primitive-registry/`, so the reference cannot
drift from the code. The human-readable twin is
[agent-guide.md](agent-guide.md).

```bash
wf catalogue [--out <dir>] [--mode card|line] [--platform web|ios|android]
```

`catalogue` is the same registry rendered: a page showing every element with its
props, its example and the box rule it obeys. The copy committed at
`docs/catalogue/` is generated by this command, and a test fails if the two
drift.

---

## Help

```bash
wf --help                   # every command, grouped
wf help <command>           # one command
wf <command> --help         # the same
wf --version
```

Commands are declared once in `cli/commands/registry.js`, which drives the help
and a test that fails if a command is dispatched but undocumented. Asking for
help never runs the command.

---

## Rename (Optional v1)

```bash
wf rename page <oldId> <newId>
wf rename component <oldId> <newId>
```

Safely updates all references across project files.

Skip for ultra-minimal v1 if desired.

---

# 4. Addressing Model (Still Needed)

CLI must support inspect:

```bash
wf inspect wf://page/dashboard#main_content.stats_grid.sales_card
```

This prints:

* Origin (template/page/component)
* Resolved path
* Node definition
* Children
* Layout summary

This is useful for debugging.

But no mutation via address.

---

# 5. File Philosophy

CLI only:

* Creates YAML
* Deletes YAML
* Lists structure
* Validates structure
* Inspects structure

Nothing else.

## What the CLI manages (structural scaffolding)

* Projects, pages, templates, components, datasets (add/remove/list)
* Node trees within pages and templates (add/update/remove via addresses)
* Overlays on pages and templates (add/remove/list)
* State introspection (list)

## What is edited in YAML directly

* Node property values (interactions, bindings, visibility conditions, accessibility)
* State default values (appState, pageState)
* Detailed overlay content (beyond initial scaffolding)
* Wireframe style overrides on individual nodes
* Data binding expressions
* Layout fine-tuning

The CLI validates everything after editing. Use `wf validate` to catch errors.

All editing happens:

* In editor UI
* In Git
* Or manually

---

# 5.1 Chat Integration

The admin editor includes an AI chat for wireframe editing. The chat implementation is reused from AdGoes.live (`/System/Volumes/Data/.internal/projects/Projects/AdGoes.live/`). Key reuse: session management, context-aware scope tracking, WebSocket streaming, LLM tool routing. The chat also draws ideas from the docgen project (`/System/Volumes/Data/.internal/projects/Projects/docgen/`) which uses LLM-driven patches to update only parts of files — the same pattern applies here for targeted YAML edits via chat.

See [architecture.md](../architecture.md) for full chat architecture details.

---

# 6. Internal Architecture (Simplified)

Internally required:

* YAML loader
* Resolver (template + page + component expansion)
* Validator
* Tree indexer (for addressing)
* Project index cache (resolved node tree, address lookup map, state key registry, route registry)

The index cache is in-memory only — no file needed. Required for performance at scale (100+ pages, 100+ components, large datasets).

But no patch engine.
No diff engine.
No AST mutation pipeline.

---

# 6.1 Version Locking

CLI must enforce schema version compatibility:

* `specVersion` is REQUIRED in every document (the per-document schema version)
* `manifest.schemaVersion` is the project-level schema version
* If `manifest.schemaVersion > cli.supportedVersion` → abort with clear error
* Future: `wf migrate` for schema version upgrades

---

# 6.2 CLI Config (.wfrc.yaml)

Local CLI preferences per project:

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

---

# 7. Non-Goals (Explicitly)

The CLI does NOT:

* Apply AI edits or automatic refactoring
* Generate production code
* Manage runtime state

Keep it simple.

---

# 8. What This Gives You

* Clean separation:

  * CLI = structure manager
  * UI = editing surface
  * External tools = suggestion engine

* Safe baseline

* Low complexity

* Deterministic structure

* No hidden behaviors

---

# 9. What You Avoid

By removing patching:

* Complex conflict handling
* Address mutation bugs
* Unintended structural corruption
* Undo/redo complexity in CLI
* Diff merging issues

Very smart move for v1.

---

# 10. If We Keep It Even Cleaner (Optional)

You could even reduce CLI to:

```bash
wf new
wf add page
wf add template
wf add component
wf add data
wf validate
wf export
```

And nothing more.

## Icon search

wf icons search <query> [--style solid|regular|brands] [--limit 1..20] [--json]

Searches the full installed Font Awesome Free catalogue by canonical name, alias, label and terms.
The default limit is 8; JSON is {query, icons: [{name, label, styles}]}.
Examples: wf icons search "burger menu" returns bars; wf icons search search returns magnifying-glass.
Unknown queries return an empty result; bad options/style/limit return a nonzero exit status.
Use the returned name in icon.name or button/input icon; choose a returned style.
