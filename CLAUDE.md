# Wireframes — Project Guide

## What This Is

A wireframe design platform: CLI tool, web landing page, and online admin panel.
The core engine renders YAML specs into clickable wireframe HTML.

See [docs/architecture.md](docs/architecture.md) for full system architecture.
See [docs/cli/](docs/cli/) for CLI-specific documentation.

---

## Monorepo Structure

```
/engine           Shared engine (schema, resolver, renderer, validation)
/cli              CLI tool — thin command layer over engine
/api              Bun + PostgreSQL API (Drizzle ORM)
/admin            React CSR app — online wireframe editor
/web              SSR landing page
/docs             All documentation
  /cli            CLI-specific docs (brief, schema, rendering)
```

### /engine

Core wireframe engine. Zero CLI/API deps. Consumed by CLI, API, and admin.

- **schema** — YAML loader, validation, JSON Schema
- **resolver** — template inheritance, slot filling, component expansion
- **renderer** — YAML-to-HTML rendering pipeline
- **addressing** — `wf://` URI parsing, tree walking

### /cli

Thin shell over engine. Commands parse args, call engine, format output.

### /api

Bun HTTP server + PostgreSQL. Manages projects, users, previews, sharing.

### /admin

React SPA. Online wireframe editor with real-time preview.

### /web

SSR landing page. Marketing, docs, pricing.

---

## Rules

- **No source file bigger than 500 lines.** YAML/JSON/Markdown exempt.
- **Follow existing architecture.** Don't invent new patterns.
- **Engine has zero CLI/API deps.** No process.exit, no console.log, no framework imports.
- **Schema-first.** The schema contract in docs/cli/schema.md and engine/schema/schema.json is authoritative.
- **Schema changes must be reflected everywhere.** schema.md, schema-systems.md, schema-canonical.yaml, schema.json, brief.md, rendering.md.
- **Wireframes and briefs stay in sync.** Any UI change must update wireframes; any wireframe change must be checked against the brief.
- **Verify with Playwright.** Renderer changes require visual layout fixtures verified in Playwright.
- **Deterministic.** Same input = same output.
- **Save agent review output to temp files.** Use `/tmp/`, don't stream into context.

---

## Task Management

`steroids llm` — run for current task management instructions.

---

## File References

| File | Purpose |
|------|---------|
| [docs/architecture.md](docs/architecture.md) | System architecture (CLI, API, admin, web) |
| [docs/cli/brief.md](docs/cli/brief.md) | CLI commands, behavior, philosophy |
| [docs/cli/schema.md](docs/cli/schema.md) | Schema contract: document types + core node model |
| [docs/cli/schema-systems.md](docs/cli/schema-systems.md) | Layout, state, interactions, overlays, validation |
| [docs/cli/schema-canonical.yaml](docs/cli/schema-canonical.yaml) | Full canonical YAML definition |
| [engine/schema/schema.json](engine/schema/schema.json) | Formal JSON Schema for validation |
| [docs/cli/rendering.md](docs/cli/rendering.md) | Build, serve, and renderer specification |
