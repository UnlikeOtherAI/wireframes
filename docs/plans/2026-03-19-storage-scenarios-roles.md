# Storage Model, Scenarios System & Role-Based Wireframes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add database storage architecture to docs, implement scenarios system in the engine + schema, and add role-based visibility to all admin wireframe pages so they display correctly for owner/editor/viewer roles.

**Architecture:** Three work streams executed sequentially: (1) Update architecture.md with full storage model, engine memory abstraction, and API document operations. (2) Add scenarios to the schema, engine, and CLI so pages can declare named state presets and build can render all variations. (3) Add `user_role` appState + visibility conditions across all admin pages so owner-only, editor-only, and viewer-only elements are properly gated. Rebuild and verify with Playwright screenshots.

**Tech Stack:** YAML schema, JavaScript engine (CommonJS), Playwright screenshots, js-yaml

---

### Task 1: Update architecture.md with storage model

**Files:**
- Modify: `docs/architecture.md`

**Step 1: Add Storage & Data Model section after Monorepo section**

Add the following section to `docs/architecture.md` after the Monorepo section (after line 217):

```markdown
---

## Storage & Data Model

All project data lives in PostgreSQL. No filesystem-based project storage at the API layer. The engine operates on in-memory document maps, not directories.

### Document Storage

```
documents table:
  id          UUID        primary key
  project_id  UUID        FK → projects
  path        TEXT        relative path: "pages/dashboard.yaml", "templates.yaml"
  content     TEXT        raw YAML string
  updated_at  TIMESTAMP   last modified
  updated_by  UUID        FK → users (nullable)

  UNIQUE(project_id, path)
```

A full project load is one query: `SELECT path, content FROM documents WHERE project_id = $1`. Returns an in-memory document map that the engine consumes directly.

A single file save is one upsert: `INSERT ... ON CONFLICT (project_id, path) DO UPDATE SET content = $1, updated_at = now()`.

### Route Structure (Relational)

The sitemap is a derived document. Route structure lives as relational data for drag-and-drop reordering and structural operations.

```
routes table:
  id          UUID        primary key
  project_id  UUID        FK → projects
  route_id    TEXT        "dashboard", "project_editor"
  path        TEXT        "/dashboard", "/projects/:id/editor"
  parent_id   UUID        nullable — for nested routes
  sort_order  INTEGER     drag-and-drop reordering
  page_path   TEXT        "pages/dashboard.yaml"
  device      TEXT        "web", "mobile", "tablet"

  UNIQUE(project_id, route_id)
```

At build time, `sitemap.yaml` is generated from the routes table into the in-memory document map. The LLM or UI never edits sitemap.yaml directly — they call structured API endpoints.

### Contexts (Viewports)

```
contexts table:
  id          UUID
  project_id  UUID        FK → projects
  name        TEXT        "web", "mobile", "tablet"
  width       INTEGER     1280, 390, 1024
  height      INTEGER     900, 844, 768
```

### Asset Storage

Binary assets (images, built HTML, ZIP exports) go to Google Cloud Storage.

```
assets table:
  id          UUID
  project_id  UUID        FK → projects
  path        TEXT        "assets/logo.png"
  gcs_url     TEXT        gs://wireframes-assets/...
  size_bytes  INTEGER
  mime_type   TEXT
  uploaded_at TIMESTAMP

builds table:
  id          UUID
  project_id  UUID        FK → projects
  gcs_prefix  TEXT        gs://wireframes-builds/{project_id}/{build_id}/
  platform    TEXT        "web", "mobile", "tablet"
  created_at  TIMESTAMP
  created_by  UUID        FK → users
```

### Document Operations via API

Two modes of document updates, both hitting the same documents table:

**Full replace** — LLM or UI sends entire updated YAML. API does a simple upsert.

**Structured operations** — The engine's existing operations (node add/update/remove, overlay add/remove, etc.) are exposed as API endpoints:

```
PATCH /projects/:id/documents/:path
{
  "ops": [
    { "op": "node.update", "target": "#main.stats_card", "props": { "label": "Revenue" } },
    { "op": "node.add", "parent": "#main", "node": { "id": "chart_1", "component": "chart" } }
  ]
}
```

Flow: read current content from DB → parse YAML → apply ops via engine → serialize → upsert row.

### Engine Memory Abstraction

The engine currently reads from the filesystem via `fs.readFileSync`. For API consumption, the engine must accept an in-memory document map instead.

The entry point changes from `loadProject(projectDir)` to `loadProject(documentMap)` where documentMap is:

```js
{
  "manifest.yaml": "raw yaml string...",
  "sitemap.yaml": "raw yaml string...",
  "templates.yaml": "raw yaml string...",
  "pages/dashboard.yaml": "raw yaml string...",
}
```

The CLI builds this map by reading from disk. The API builds it by querying Postgres. The engine does not care where the bytes came from. This makes the API fully stateless — any server instance handles any request with no local filesystem dependency.
```

**Step 2: Update API routes section to include document and route endpoints**

Replace the Key API Routes section with updated routes that include the new document ops and route management:

```
POST   /auth/sso                           SSO callback
GET    /projects                           List user's projects
POST   /projects                           Create project
GET    /projects/:id                       Get project details
DELETE /projects/:id                       Delete project (owner only)

GET    /projects/:id/documents             List project documents
GET    /projects/:id/documents/:path       Get single document
PUT    /projects/:id/documents/:path       Upsert document (full replace)
PATCH  /projects/:id/documents/:path       Apply structured ops
DELETE /projects/:id/documents/:path       Remove document

GET    /projects/:id/routes                List routes (ordered)
POST   /projects/:id/routes                Add route
PATCH  /projects/:id/routes/:rid           Update route (rename, reparent)
DELETE /projects/:id/routes/:rid           Remove route + page
PATCH  /projects/:id/routes/reorder        Bulk reorder (drag-and-drop)

POST   /projects/:id/build                 Build project
POST   /projects/:id/preview               Publish preview
GET    /projects/:id/preview               Get preview settings
PATCH  /projects/:id/preview               Update preview access

GET    /projects/:id/members               List members
POST   /projects/:id/invite                Send invite
PATCH  /projects/:id/members/:uid          Change role
DELETE /projects/:id/members/:uid          Remove member

POST   /invites/:token/accept              Accept invite
GET    /preview/:slug                      View published preview
POST   /preview/:slug/auth                 Authenticate for preview
PATCH  /users/me/locale                    Update locale preference
```

**Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add storage model, document operations, and engine memory abstraction to architecture"
```

---

### Task 2: Add scenarios to the schema specification

**Files:**
- Modify: `docs/cli/schema-systems.md`
- Modify: `docs/cli/schema-canonical.yaml`
- Modify: `docs/cli/schema.json` (engine schema)
- Modify: `engine/schema/schema.json`

**Step 1: Add Scenarios section to schema-systems.md**

Add a new section after Section 14 (Data Binding) in `docs/cli/schema-systems.md`:

```markdown
# 14.1. Scenarios (State Presets)

Scenarios are named state presets that define initial state for previewing
different user contexts (roles, empty/loaded states, error states).

Scenarios are declared at two levels:

## Project-level scenarios (sitemap)

Applied to all pages. Define appState overrides:

```yaml
# in sitemap.yaml
scenarios:
  - id: owner_view
    label: "Owner"
    appState:
      user_role: owner
  - id: editor_view
    label: "Editor"
    appState:
      user_role: editor
  - id: viewer_view
    label: "Viewer"
    appState:
      user_role: viewer
```

## Page-level scenarios

Applied to a single page. Define pageState overrides:

```yaml
# in page YAML
page:
  scenarios:
    - id: empty
      label: "Empty State"
      pageState:
        has_projects: false
    - id: loaded
      label: "With Projects"
      pageState:
        has_projects: true
```

Rules:

* Scenario IDs must be unique within their scope (project or page).
* At build time, `--scenario <id>` overrides initial state. The defaults
  from `appState` / `pageState` are merged with the scenario's overrides.
* The preview workspace exposes a scenario switcher to flip between presets.
* Screenshots can capture all scenarios: `wf screenshots --all-scenarios`.
* Scenario state overrides are shallow-merged on top of defaults.
```

**Step 2: Add Scenario to schema-canonical.yaml**

In `docs/cli/schema-canonical.yaml`, add under the sitemap section:

```yaml
scenarios:
  description: Named state presets for previewing different user contexts
  items:
    requiredFields:
      - id
      - label
    optionalFields:
      - appState    # project-level only
      - pageState   # page-level only
```

**Step 3: Add Scenario schema to engine schema.json**

Add a `Scenario` definition to `engine/schema/schema.json`:

```json
"Scenario": {
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "label"],
  "properties": {
    "id": { "$ref": "#/definitions/Id" },
    "label": { "type": "string" },
    "appState": { "type": "object" },
    "pageState": { "type": "object" }
  }
}
```

Add `scenarios` as optional array to both `Sitemap` and `Page` definitions:

```json
"scenarios": {
  "type": "array",
  "items": { "$ref": "#/definitions/Scenario" }
}
```

**Step 4: Commit**

```bash
git add docs/cli/schema-systems.md docs/cli/schema-canonical.yaml engine/schema/schema.json
git commit -m "feat: add scenarios (state presets) to schema specification"
```

---

### Task 3: Add user_role to sitemap appState and define project-level scenarios

**Files:**
- Modify: `admin_wireframes/sitemap.yaml`

**Step 1: Add user_role and scenarios to sitemap**

Replace the current sitemap content:

```yaml
documentType: sitemap
specVersion: "1.1"
id: sitemap
defaultTemplate: app_template
appState:
  authenticated: false
  user_role: owner
scenarios:
  - id: owner_view
    label: "Owner"
    appState:
      user_role: owner
  - id: editor_view
    label: "Editor"
    appState:
      user_role: editor
  - id: viewer_view
    label: "Viewer"
    appState:
      user_role: viewer
routes:
  - id: login
    path: /login
    page: login
    template: auth_template
  - id: dashboard
    path: /
    page: dashboard
  - id: account
    path: /account
    page: account
  - id: project_editor
    path: /projects/edit
    page: project_editor
  - id: project_settings
    path: /projects/settings
    page: project_settings
  - id: project_members
    path: /projects/members
    page: project_members
  - id: project_preview
    path: /projects/preview
    page: project_preview
```

**Step 2: Commit**

```bash
git add admin_wireframes/sitemap.yaml
git commit -m "feat: add user_role appState and role scenarios to admin sitemap"
```

---

### Task 4: Add role-based visibility to dashboard.yaml

**Files:**
- Modify: `admin_wireframes/pages/dashboard.yaml`

**Step 1: Add page-level scenarios and role visibility**

In `dashboard.yaml`, add scenarios to page and add visibility conditions:

1. Add `scenarios` under page (after pageState):
```yaml
  scenarios:
    - id: empty
      label: "Empty State"
      pageState:
        has_projects: false
    - id: with_invites
      label: "Pending Invites"
      pageState:
        has_projects: true
        inv1_accepted: false
        inv2_accepted: false
```

2. Add visibility to `dash_new_btn` (owner/editor only — viewers can't create projects):
```yaml
                  visibility:
                    condition:
                      type: compare
                      left: "{{appState.user_role}}"
                      op: ne
                      right: viewer
```

3. Add the same visibility to `proj_new` (the "Create New Project" card in the grid):
```yaml
                  visibility:
                    condition:
                      type: compare
                      left: "{{appState.user_role}}"
                      op: ne
                      right: viewer
```

4. Add visibility to `invites_banner` (invites are only shown to the user who was invited — visible for all roles since any user can receive invites, so no role gating needed on the banner itself).

**Step 2: Commit**

```bash
git add admin_wireframes/pages/dashboard.yaml
git commit -m "feat: add role-based visibility and scenarios to dashboard"
```

---

### Task 5: Add role-based visibility to project_editor.yaml

**Files:**
- Modify: `admin_wireframes/pages/project_editor.yaml`

This is the most complex page. Viewers should see a read-only version:
- No chat panel (the AI chat is for editing)
- No undo/redo/build/download toolbar buttons
- No chat input
- Workspace preview is still visible (viewers can preview but not edit)

**Step 1: Add scenarios**

Add scenarios under page (after pageState):
```yaml
  scenarios:
    - id: sitemap_view
      label: "Sitemap Mode"
      pageState:
        workspace_mode: sitemap
```

**Step 2: Add visibility to chat_panel (owner/editor only)**

The entire `chat_panel` (id: `chat_panel`) should be hidden for viewers:
```yaml
                    # --- Chat panel (left) ---
                    - id: chat_panel
                      component: section
                      visibility:
                        condition:
                          type: compare
                          left: "{{appState.user_role}}"
                          op: ne
                          right: viewer
```

**Step 3: Add visibility to editing toolbar buttons (owner/editor only)**

The following toolbar buttons should be hidden for viewers:
- `tb_undo`, `tb_redo`, `tb_divider` (undo/redo separator)
- `tb_download`, `tb_build`

Add to each:
```yaml
                      visibility:
                        condition:
                          type: compare
                          left: "{{appState.user_role}}"
                          op: ne
                          right: viewer
```

**Step 4: Add visibility to sidebar management buttons (owner only)**

The following sidebar nav buttons should only show for owner/editor (viewers can still see Editor nav):
- `sb_nav_settings` — owner only (settings page is owner-only)
- `sb_nav_members` — owner only (members page is owner-only)

```yaml
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 5: Add visibility to add page button (owner/editor only)**

`sb_add_page` should be hidden for viewers:
```yaml
                  visibility:
                    condition:
                      type: compare
                      left: "{{appState.user_role}}"
                      op: ne
                      right: viewer
```

**Step 6: Commit**

```bash
git add admin_wireframes/pages/project_editor.yaml
git commit -m "feat: add role-based visibility to project editor (hide chat/edit for viewers)"
```

---

### Task 6: Add role-based visibility to project_settings.yaml

**Files:**
- Modify: `admin_wireframes/pages/project_settings.yaml`

Settings page is owner-only for destructive operations. Editors can view general settings but not the danger zone.

**Step 1: Add visibility to danger_section (owner only)**

```yaml
                - id: danger_section
                  component: section
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 2: Add visibility to sidebar nav items that are role-restricted**

`ss_nav_members` — owner only:
```yaml
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 3: Commit**

```bash
git add admin_wireframes/pages/project_settings.yaml
git commit -m "feat: add role-based visibility to project settings (owner-only danger zone)"
```

---

### Task 7: Add role-based visibility to project_members.yaml

**Files:**
- Modify: `admin_wireframes/pages/project_members.yaml`

Members page is owner-only for management. Editors/viewers shouldn't see this page at all (sidebar nav is already gated), but if they land here, gate the management sections.

**Step 1: Add visibility to invite_section (owner only)**

```yaml
                - id: invite_section
                  component: section
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 2: Add visibility to transfer_section (owner only)**

```yaml
                - id: transfer_section
                  component: section
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 3: Add visibility to sidebar nav — ms_nav_settings (owner only)**

```yaml
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 4: Commit**

```bash
git add admin_wireframes/pages/project_members.yaml
git commit -m "feat: add role-based visibility to project members (owner-only management)"
```

---

### Task 8: Add role-based visibility to project_preview.yaml

**Files:**
- Modify: `admin_wireframes/pages/project_preview.yaml`

Preview page: viewers can see the preview URL but not publish or manage access.

**Step 1: Add visibility to publish_section (owner/editor only)**

```yaml
                - id: publish_section
                  component: section
                  visibility:
                    condition:
                      type: compare
                      left: "{{appState.user_role}}"
                      op: ne
                      right: viewer
```

**Step 2: Add visibility to access_section (owner/editor only)**

Same condition as publish_section.

**Step 3: Add visibility to download_section (owner/editor only)**

Same condition.

**Step 4: Add visibility to sidebar nav — ps_nav_settings and ps_nav_members (owner only)**

```yaml
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

**Step 5: Commit**

```bash
git add admin_wireframes/pages/project_preview.yaml
git commit -m "feat: add role-based visibility to project preview (viewers see URL only)"
```

---

### Task 9: Add role-based sidebar nav visibility to all project sub-pages consistently

**Files:**
- Modify: all project sub-pages (editor, settings, members, preview)

All four project sub-pages share the same sidebar pattern. Ensure consistent gating:

| Sidebar Item | Owner | Editor | Viewer |
|-------------|-------|--------|--------|
| Editor | Yes | Yes | Yes |
| Settings | Yes | No | No |
| Members | Yes | No | No |
| Preview & Share | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes |

For Settings and Members nav items across all pages, use:
```yaml
                  visibility:
                    condition:
                      type: state_equals
                      scope: app
                      key: user_role
                      equals: owner
```

Verify this is applied to:
- `sb_nav_settings`, `sb_nav_members` in project_editor.yaml
- `ss_nav_members` in project_settings.yaml
- `ms_nav_settings` in project_members.yaml
- `ps_nav_settings`, `ps_nav_members` in project_preview.yaml

**Step 1: Audit and fix any missing visibility conditions**

Read each file, check each sidebar nav button, add missing visibility.

**Step 2: Commit**

```bash
git add admin_wireframes/pages/
git commit -m "fix: ensure consistent role-based sidebar nav visibility across all project pages"
```

---

### Task 10: Validate, build, and verify

**Files:**
- All modified YAML files
- Built output

**Step 1: Run validation**

```bash
cd admin_wireframes && node ../cli/bin/wf.js validate
```

Expected: no errors. The `compare` condition type with `{{appState.user_role}}` expressions should be accepted by the schema.

**Step 2: Run build**

```bash
cd admin_wireframes && node ../cli/bin/wf.js build
```

Expected: builds successfully.

**Step 3: Run tests**

```bash
pnpm test
```

Expected: 162+ tests passing.

**Step 4: Verify built output contains visibility attributes**

Grep the built HTML for `data-wf-visibility` attributes containing `user_role` to confirm the visibility conditions made it through the renderer.

```bash
grep -l "user_role" admin_wireframes/wireframes/build/web/*.html
```

Expected: dashboard.html, project_editor.html, project_settings.html, project_members.html, project_preview.html

**Step 5: Commit build output**

```bash
git add admin_wireframes/wireframes/build/
git commit -m "build: rebuild admin wireframes with role-based visibility"
```

---

### Task 11: Final commit and push

**Step 1: Push all commits**

```bash
git push
```

**Step 2: Verify git log shows clean commit history**

```bash
git log --oneline -10
```
