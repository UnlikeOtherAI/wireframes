# API Build & Assets

## Related Documentation

- [Architecture](../docs/architecture.md) — build endpoint, asset handling, GCS storage
- [AGENTS.md](../AGENTS.md) — layered architecture, engine rules (no filesystem deps)
- [Rendering](../docs/cli/rendering.md) — build pipeline, output structure, platform grouping, base path
- [Rendering Modes](../docs/cli/rendering-modes.md) — line vs card mode, CSS architecture
- [Schema](../docs/cli/schema.md) — document types fed into build
- [Schema Systems](../docs/cli/schema-systems.md) — validation rules (pre-build validation)
- [Brief](../docs/cli/brief.md) — wf build command behavior (API mirrors this)

## Overview

The build endpoint lets editors trigger a full wireframe build from stored documents. Assets (images, frames) are uploaded to and served from GCS. The engine processes in-memory documents — no filesystem access.

---

## Task 9: Implement build endpoint

### Requirements

**Endpoint:**

`POST /projects/:id/build` — Build project wireframes.
- Requires membership (any role — viewers can build for preview)
- Steps:
  1. Load all documents for project from DB
  2. Build in-memory document map (same structure the engine expects)
  3. Run engine validation — if blocking errors, return 422
  4. Run engine build — produces rendered HTML for all pages
  5. Return build output as JSON: `{ pages: [{ pageId, platform, html }], css, js }`
- Optional query params:
  - `platform=web|mobile|tablet|all` (default: `all`)
- Returns build output as structured JSON (see [engine-abstraction.md](engine-abstraction.md) for BuildOutput shape):
  `{ pages: [{ pageId, platform, html }], css, js, routeTable, indexHtml, platformIndexes }`

### Engine Integration

The engine's build module works with in-memory document maps:

```typescript
import { loadDocuments, validateProject, buildProject } from '@wireframes/engine'

// Convert DB rows to engine document map
function buildDocumentMap(rows: DocumentRow[]): DocumentMap {
  const map = new Map()
  for (const row of rows) {
    // Engine expects parsed YAML objects, not raw strings
    map.set(`${row.documentType}:${row.documentId}`, parseYaml(row.content))
  }
  return map
}
```

The engine build returns:
- Per-page HTML strings (template + slots + injectables resolved)
- Shared CSS (wireframe.css)
- Shared JS (interactions.js)
- Route table

This is the same pipeline as `wf build` but operating on DB documents instead of filesystem YAML files.

### Patterns

- Build is CPU-bound — consider worker threads if latency becomes an issue
- Build output is returned directly, not stored (preview publishing stores it separately)
- The document map interface must match what the engine expects
- Parse YAML in the API layer (engine receives parsed objects)

### Acceptance Criteria

- Build succeeds when all documents are valid
- Build fails with 422 when validation finds blocking errors
- Platform filter works (building only web pages, for example)
- Output contains correct HTML for each page
- CSS and JS are included in response
- Route table maps route IDs to page file names

---

## Task 10: Implement asset upload and serving via GCS

### Requirements

**Endpoints:**

`POST /projects/:id/assets` — Upload asset.
- Requires `owner` or `editor` role
- Accepts multipart file upload
- Validates file type (images: png, jpg, gif, svg, webp; max 5MB)
- Uploads to GCS: `assets/{projectId}/{filename}`
- Returns `{ url, filename, contentType, size }`

`GET /projects/:id/assets` — List project assets.
- Requires membership (any role)
- Lists all files in `assets/{projectId}/` prefix in GCS
- Returns array of `{ filename, url, contentType, size, uploadedAt }`

`DELETE /projects/:id/assets/:filename` — Delete asset.
- Requires `owner` or `editor` role
- Removes file from GCS
- Returns 204

**Asset resolution in builds:**

When the engine encounters `src: "assets/logo.png"` in an image node, the API resolves this to the GCS URL during build. The build endpoint rewrites asset paths:

```
assets/logo.png → https://storage.googleapis.com/{bucket}/assets/{projectId}/logo.png
```

### GCS Configuration

- Bucket: `GCS_BUCKET` env var
- Service account: `GCS_SERVICE_ACCOUNT_KEY` env var (JSON key file path)
- Asset files are private (same as preview files) — served via API proxy
- Set appropriate `Cache-Control` and `Content-Type` headers

### Patterns

- File names are sanitized (alphanumeric, hyphens, underscores, dots only)
- Duplicate filenames overwrite (no versioning in v1)
- GCS client is initialized once and reused
- Asset listing uses GCS prefix listing, not a database table

### Acceptance Criteria

- Upload accepts valid image files
- Upload rejects oversized or invalid file types
- Uploaded files are accessible via returned URL
- Build output references correct GCS URLs for assets
- List returns all uploaded assets for a project
- Delete removes the file from GCS
- Viewers cannot upload or delete assets
