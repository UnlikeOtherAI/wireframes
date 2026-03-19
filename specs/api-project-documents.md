# API Project & Document Management

## Related Documentation

- [Architecture](../docs/architecture.md) — core entities, API routes, role-based access table
- [AGENTS.md](../AGENTS.md) — layered architecture, DB conventions, engine rules
- [Schema](../docs/cli/schema.md) — document types (manifest, sitemap, templates, components, page, dataset)
- [Schema Systems](../docs/cli/schema-systems.md) — validation rules
- [JSON Schema](../engine/schema/schema.json) — formal validation schema
- [Brief](../docs/cli/brief.md) — document structure, file philosophy

## Overview

CRUD endpoints for projects, documents, and memberships. Documents store raw YAML validated by the engine. Memberships enforce role-based access.

---

## Task 4: Implement project CRUD with ownership checks

### Requirements

**Endpoints** (from [architecture.md](../docs/architecture.md) § Key API Routes):

`GET /projects` — List user's projects (owned + member via memberships table).
- Returns array of `{ id, name, role, createdAt, updatedAt }`
- `role` comes from the membership record
- Ordered by `updatedAt` descending

`POST /projects` — Create project.
- Body: `{ name }`
- Creates project row + membership with `role: owner` in a transaction
- Returns the created project

`GET /projects/:id` — Get project details.
- Requires membership (any role)
- Returns project + user's role + member count + document count

`DELETE /projects/:id` — Delete project.
- Requires `owner` role
- Cascading delete: removes all documents, memberships, previews, preview access, invites
- Returns 204

### Patterns

- Route → Controller → Service → Repository layering
- All project access checks go through a shared `requireProjectAccess(userId, projectId, minRole?)` service method
- Use Drizzle transactions for multi-table operations
- Ownership check: query memberships table, not projects.ownerId (memberships is the source of truth for access)

### Acceptance Criteria

- Non-members cannot access any project endpoint (403)
- Viewers can GET but not DELETE
- Only owners can DELETE
- Creating a project automatically creates an owner membership
- Deleting a project cascades to all related rows
- List returns only projects the user has membership for

---

## Task 5: Implement document CRUD with YAML validation

### Requirements

**Endpoints:**

`GET /projects/:id/documents` — List project documents.
- Returns array of `{ id, documentType, documentId, contentHash, updatedAt }`
- Does NOT return content (too large for list view)
- Requires membership (any role)

`GET /projects/:id/documents/:documentType/:documentId` — Get single document.
- Returns `{ id, documentType, documentId, content, contentHash, updatedAt }`
- Requires membership (any role)

`PUT /projects/:id/documents/:documentType` — Upsert document.
- Body: `{ documentId, content }` where content is raw YAML string
- Requires `owner` or `editor` role
- Validates YAML by:
  1. Parse YAML (reject malformed)
  2. Check `documentType` and `specVersion` fields match
  3. Run engine JSON Schema validation against [schema.json](../engine/schema/schema.json)
- Computes SHA-256 content hash
- Upserts by (projectId, documentType, documentId) unique constraint
- Optional `If-Match` header for optimistic concurrency (compare against stored contentHash)
- Returns the saved document with new contentHash

`DELETE /projects/:id/documents/:documentType/:documentId` — Delete document.
- Requires `owner` or `editor` role
- Returns 204

### Engine Integration

The API imports the engine's validation module to validate documents on save:

```typescript
import { validateDocument } from '@wireframes/engine'
```

The engine works with in-memory document maps, not filesystem paths. The API builds the document map from Postgres rows, passes it to the engine, and returns validation results.

### Patterns

- YAML is stored as-is in the `content` column — no conversion to JSON
- Content hash enables optimistic concurrency (client sends `If-Match`, server compares)
- Validation errors return 422 with structured error array
- The engine is a workspace dependency — use pnpm workspace linking

### Acceptance Criteria

- Malformed YAML returns 422
- Invalid schema returns 422 with validation errors from engine
- Valid YAML is stored and can be retrieved
- Content hash is computed and returned
- `If-Match` with stale hash returns 409 Conflict
- Viewers cannot upsert or delete documents
- Document types are enforced (reject unknown types)

---

## Task 6: Implement membership endpoints with role-based access

### Requirements

**Endpoints** (from [architecture.md](../docs/architecture.md)):

`GET /projects/:id/members` — List members.
- Returns array of `{ userId, email, displayName, role, joinedAt }`
- Requires membership (any role)

`POST /projects/:id/invite` — Send invite.
- Body: `{ email, role }` where role is `editor` or `viewer`
- Requires `owner` role
- Creates invite row with random token
- If user already exists and is already a member → 409
- Returns invite details (token is included for the owner to share)

`POST /invites/:token/accept` — Accept invite.
- Public endpoint (but requires auth — the accepting user must be logged in)
- Validates token, creates membership, marks invite as accepted
- If accepting user's email doesn't match invite email → 403
- Returns project details

`PATCH /projects/:id/members/:uid` — Change member role.
- Body: `{ role }` where role is `owner`, `editor`, or `viewer`
- Requires `owner` role
- Cannot change own role (prevents accidental self-demotion)
- Cannot set role to `owner` if not transferring ownership (only one owner)

`DELETE /projects/:id/members/:uid` — Remove member.
- Requires `owner` role
- Cannot remove self (owner)
- Cascading: removes membership row
- Returns 204

### Role-Based Access Matrix (from [architecture.md](../docs/architecture.md)):

| Capability | Owner | Editor | Viewer |
|------------|-------|--------|--------|
| View project | Yes | Yes | Yes |
| Edit documents | Yes | Yes | No |
| Build & preview | Yes | Yes | Yes (read-only) |
| Manage members | Yes | No | No |
| Publish preview | Yes | Yes | No |
| Delete project | Yes | No | No |

### Patterns

- Invite tokens are cryptographically random (32 bytes, hex-encoded)
- Email matching for invite acceptance is case-insensitive
- Role checks are centralized in the access service, not duplicated in each controller
- Membership queries always join with users table to return display info

### Acceptance Criteria

- Owners can invite, change roles, remove members
- Editors and viewers cannot manage members (403)
- Invite acceptance creates membership with correct role
- Email mismatch on accept returns 403
- Cannot remove or demote self as owner
- Duplicate invite to existing member returns 409
