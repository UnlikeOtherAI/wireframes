# Wireframe CLI — Project Guide

## What This Is

A deterministic CLI that generates and manages wireframe project specs.
Node.js. YAML-based. No runtime, no deployment.

The output is **literal wireframes** — bordered rectangles with text labels.
Every element (button, sidebar, dropdown, card, modal) is a frame. The result
is a clickable skeleton of a web app. Layouts stretch like HTML but render as
wireframes only. No colors, no icons, no production styling.

See [brief.md](brief.md) for the full CLI brief.
See [schema.md](schema.md) for the schema contract (document types + node model).
See [schema-systems.md](schema-systems.md) for systems (layout, state, interactions, validation).
See [schema-canonical.yaml](schema-canonical.yaml) for the canonical YAML definition.
See [schema.json](schema.json) for the formal JSON Schema.

---

## Architecture

```
/cli              CLI commands only (thin layer)
/shared           Shared libraries (used by CLI now, web app later)
  /schema         Schema loading, parsing, validation
  /resolver       Template + page + component expansion
  /addressing     wf:// URI resolution and tree indexing
  /renderer       Rendering utilities (future web app consumption)
/docs             Project briefs and specs
```

### /cli

Contains ONLY command definitions and their wiring. No business logic.
Each command calls into `/shared` for all real work.

Commands: `init`, `info`, `doctor`, `schema`, `lint`, `validate`, `export`, `tree`,
`page add/remove/list`, `template add/remove/list`, `component add/remove/list`,
`node add/update/remove`, `overlay add/remove/list`, `state list`,
`data add/remove/import/list/validate/stats/keys`,
`data item add/update/remove/get/list`,
`inspect`, `where-used`, `routes`, `stats`, `screenshots`,
`rename` (optional v1).

### /shared

All logic that is not CLI-specific lives here. This code will be consumed
by a web version of the app later, so it must have zero CLI dependencies.

- **schema** — YAML loader, document type definitions, manifest handling, version checking
- **resolver** — template inheritance, slot filling, component expansion
- **addressing** — `wf://` URI parsing, tree walking, node lookup
- **renderer** — layout computation, tree rendering (shared with future web app)

### /docs

Briefs and specs live here (brief.md, schema.md, schema.json).
Moved out of root once scaffolding begins.

---

## Rules

- **No source file bigger than 500 lines.** Break it down. YAML, JSON, and Markdown files are exempt when keeping them whole makes sense.
- **Follow existing architecture.** Don't invent new patterns.
- **CLI is a thin shell.** Commands parse args, call shared libs, format output.
- **Shared libs have zero CLI deps.** No process.exit, no console.log, no commander/yargs imports.
- **Schema-first.** The schema contract in schema.md/schema.json is authoritative.
- **YAML only.** All project files are YAML. No JSON config in wireframe projects.
- **Deterministic.** Same input = same output. No randomness, no timestamps in generated files.
- **No over-engineering.** Solve what's needed now. No speculative abstractions.
- **Verify every section with Playwright CLI.** Each section of the CLI that is developed must be run past Playwright to verify that generated outputs are correct. For example, after implementing `wf template add`, run Playwright tests to confirm the generated template YAML is valid and matches the expected structure. No section is considered done until its Playwright tests pass.
- **Schema changes must be reflected everywhere.** Any change to the schema must be updated in ALL of: schema.md, schema-systems.md, schema-canonical.yaml, schema.json (formal JSON Schema), and brief.md (if CLI behavior is affected). Never update one without the others.

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** JavaScript (or TypeScript if project adopts it)
- **CLI framework:** TBD (commander, yargs, or similar)
- **YAML:** js-yaml or similar
- **Validation:** Against schema.json (ajv or similar)
- **Export:** archiver or similar for ZIP
- **Screenshots:** Playwright (bundled as a dependency — ships with the package)
- **Testing:** TBD

---

## Key Concepts

### Document Types

Every YAML file has `documentType`, `specVersion`, `id`.
Types: manifest, sitemap, templates, components, page, dataset.

### Addressing

Canonical URI: `wf://<doctype>/<docid>#<path>`
Path segments are node IDs separated by dots. No index-based addressing.

### State

Two scopes only: `appState` (sitemap, persists) and `pageState` (page, resets on nav).
State keys must exist before being referenced.

### Templates

Templates define persistent regions and slots. Pages inject into slots only.
Pages cannot override persistent regions.

### Validation

Blocking errors halt export. Warnings are informational.
`--strict` mode fails on warnings. `--json` flag for machine-readable output.

### Version Locking

`specVersion` required in every document. `manifest.schemaVersion` is the project-level version.
CLI refuses to operate if `manifest.schemaVersion` exceeds CLI's supported version.

---

## File References

| File | Purpose |
|------|---------|
| [brief.md](brief.md) | CLI commands, behavior, philosophy |
| [schema.md](schema.md) | Schema contract: document types + core node model |
| [schema-systems.md](schema-systems.md) | Schema: layout, state, interactions, overlays, validation, export |
| [schema-canonical.yaml](schema-canonical.yaml) | Full canonical YAML definition of the schema |
| [schema.json](schema.json) | Formal JSON Schema for validation |
