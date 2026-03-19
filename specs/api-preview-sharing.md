# API Preview & Sharing

## Related Documentation

- [Architecture](../docs/architecture.md) — preview & sharing section, preview access modes, auth flow for previews
- [AGENTS.md](../AGENTS.md) — layered architecture, DB conventions
- [Rendering](../docs/cli/rendering.md) — build output structure, platform grouping
- [Schema](../docs/cli/schema.md) — document types that feed into builds
- [Schema Systems](../docs/cli/schema-systems.md) — validation rules (build requires passing validation)

## Overview

Publishing wireframe projects as shareable preview URLs. Three access modes: public, password-protected, and SSO-restricted. Preview output stored in GCS.

---

## Task 7: Implement preview publishing endpoint

### Requirements

**Endpoints:**

`POST /projects/:id/preview` — Publish preview.
- Requires `owner` or `editor` role
- Steps:
  1. Load all project documents from DB into in-memory document map
  2. Run engine validation — abort with 422 if blocking errors
  3. Run engine build (same pipeline as `wf build`) — produces HTML output
  4. Upload build output to GCS bucket
  5. Create/update preview row with `buildUrl`, `publishedAt`
  6. Generate URL-safe slug if first publish (8-char random alphanumeric)
- Returns `{ slug, url, publishedAt, accessMode }`

`GET /projects/:id/preview` — Get preview settings.
- Requires membership (any role)
- Returns `{ slug, url, accessMode, publishedAt, emailAccessList }` (emails only for owner)

`PATCH /projects/:id/preview` — Update preview access settings.
- Requires `owner` or `editor` role
- Body (partial): `{ accessMode?, password?, emails? }`
- If `accessMode: password`: hash the provided password with bcrypt and store
- If `accessMode: sso`: set email access list (replace existing)
- If `accessMode: public`: clear password and email access
- Returns updated preview settings

### Engine Integration

Build uses the engine's build module with documents loaded from DB:

```typescript
import { buildProject } from '@wireframes/engine'

// Build document map from DB rows
const documentMap = buildDocumentMapFromRows(rows)
const buildOutput = buildProject(documentMap, { platform: 'all' })
```

The engine does not touch the filesystem — it returns HTML strings. The API writes them to GCS.

### Build Output → Static Files

The engine's `buildProject()` returns structured output (see [engine-abstraction.md](engine-abstraction.md)):
- `pages[]` — per-page HTML strings
- `css` — wireframe.css content
- `js` — interactions.js content
- `routeTable` — route ID → relative path mapping
- `indexHtml` — master index page
- `platformIndexes` — per-platform index pages

The preview publisher assembles these into the static directory structure described in [rendering.md](../docs/cli/rendering.md):
1. Write each page HTML as `{platform}/{pageId}.html`
2. Write CSS as `{platform}/_shared/wireframe.css`
3. Write JS as `{platform}/_shared/interactions.js`
4. Write index pages (master + per-platform)
5. Copy asset URLs into the HTML (rewrite `assets/` paths to GCS asset URLs)

### GCS Integration

- Bucket name from `GCS_BUCKET` env var
- Build output uploaded as a directory structure: `previews/{slug}/`
- Uses Google Cloud Storage client library
- **All preview files are private** (no public read) — served via the API proxy or signed URLs
- Asset files (images) are also private — proxied through the preview endpoint
- Set `Cache-Control: private, max-age=3600` for built files
- Set `Content-Type` correctly (HTML, CSS, JS)

### Patterns

- Slugs are immutable once generated (republishing updates content, not slug)
- Build is synchronous in v1 (async/queue in future if builds become slow)
- One preview per project (upsert semantics)
- Password hashing uses bcrypt with 12 rounds

### Acceptance Criteria

- Publishing builds the project and uploads to GCS
- Preview slug is stable across republishes
- Access mode can be changed independently of publishing
- Password mode stores bcrypt hash, never plaintext
- SSO mode stores email allowlist
- Public mode clears both password and email list
- Validation failures during publish return 422 with error details

---

## Task 8: Implement preview access control (viewing)

### Requirements

**Endpoints:**

`GET /preview/:slug` — View published preview.
- Public endpoint (no auth required for public previews)
- Looks up preview by slug
- If `accessMode: public`: proxy the HTML from GCS (GCS objects are private — no direct access)
- If `accessMode: password`: return 401 with `{ requiresAuth: "password" }`
- If `accessMode: sso`: return 401 with `{ requiresAuth: "sso", ssoUrl }`

`POST /preview/:slug/auth` — Authenticate for preview access.
- For password mode: Body `{ password }` → verify against bcrypt hash → return preview session cookie
- For SSO mode: after SSO redirect, verify email is in access list → return preview session cookie
- Preview session cookie is a short-lived JWT (24h) with `{ previewId, accessGranted: true }`

**Preview auth flow** (from [architecture.md](../docs/architecture.md)):
1. Viewer opens preview link
2. If SSO-restricted: redirect to SSO, verify email is in access list
3. If password-protected: prompt for password
4. If public: no auth needed

### Important Distinction

- Preview viewers are completely separate from project editors
- Viewing a preview does NOT grant edit access
- Preview auth is separate from the main API auth (different JWT, different purpose)

### Patterns

- Preview session is a separate JWT from the main session JWT
- Preview JWT stored in a cookie (not Authorization header — previews are viewed in browser)
- GCS objects are private — API always proxies content (no public URLs that bypass access control)
- For v1: proxy through API for simplicity (signed URLs as future optimization)

### Acceptance Criteria

- Public previews are accessible without authentication
- Password previews require correct password before viewing
- SSO previews require authenticated email in access list
- Preview auth cookie is set on successful authentication
- Subsequent requests with valid preview cookie bypass auth
- Expired preview cookies require re-authentication
- Preview viewers cannot access edit endpoints
