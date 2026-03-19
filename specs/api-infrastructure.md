# API Infrastructure & Auth

## Related Documentation

- [Architecture](../docs/architecture.md) — system overview, API section, auth flow, core entities
- [AGENTS.md](../AGENTS.md) — layered architecture rules, database conventions, code quality rules
- [Schema](../docs/cli/schema.md) — document types the API stores (pages, templates, components, datasets, sitemap, manifest)
- [Schema Systems](../docs/cli/schema-systems.md) — validation rules the API enforces on save

## Overview

Bootstrap the API server: Bun runtime, PostgreSQL via Drizzle ORM, layered architecture, SSO auth. This is the foundation everything else builds on.

## Monorepo Location

```
api/
  src/
    routes/        HTTP route handlers
    controllers/   Request orchestration
    services/      Business logic
    repositories/  Database access only
    middleware/     Auth, error handling, request context
    db/
      schema.ts    Drizzle schema definitions
      migrations/  Drizzle-kit migrations
      index.ts     Connection pool
  package.json
  tsconfig.json
  drizzle.config.ts
```

Package name: `@wireframes/api`. Runtime: Bun. Language: TypeScript.

---

## Task 1: Scaffold Bun + Drizzle project with PostgreSQL connection and health endpoint

### Requirements

- Initialize `api/` as a Bun project with TypeScript
- Add Drizzle ORM + `drizzle-kit` + `pg` as dependencies
- Create Drizzle config pointing to PostgreSQL (connection string from `DATABASE_URL` env var)
- Implement a minimal HTTP server (Bun native `Bun.serve()`)
- Create layered directory structure: `routes/`, `controllers/`, `services/`, `repositories/`, `middleware/`, `db/`
- Add `GET /health` endpoint returning `{ status: "ok", timestamp }` — verifies DB connection
- Add error-handling middleware (catches thrown errors, returns structured JSON errors)
- Add request-logging middleware (method, path, status, duration)
- Add CORS middleware (configurable origins via `CORS_ORIGINS` env var)
- Add to pnpm workspace in root `pnpm-workspace.yaml`

### Patterns

- Follow layered architecture: routes call controllers, controllers call services, services call repositories
- No `process.exit` in library code — only in the top-level server entry
- All config from environment variables, no hardcoded values
- Drizzle is the single source of truth for DB schema

### Acceptance Criteria

- `pnpm --filter @wireframes/api dev` starts the server
- `GET /health` returns 200 with JSON body
- PostgreSQL connection pool is established and verified on startup
- Drizzle-kit can generate migrations from schema
- All middleware is functional (CORS, error handling, logging)

---

## Task 2: Create database schema and initial migration

### Requirements

Create Drizzle schema for all core entities from [architecture.md](../docs/architecture.md):

**Users table:**
- `id` (UUID, PK, default random)
- `email` (text, unique, not null)
- `displayName` (text)
- `locale` (text, default `'en'`)
- `ssoSubject` (text, unique) — SSO provider subject ID
- `createdAt` (timestamp, default now)
- `updatedAt` (timestamp, default now)

**Projects table:**
- `id` (UUID, PK)
- `name` (text, not null)
- `ownerId` (UUID, FK → users.id, not null)
- `createdAt`, `updatedAt`

**Memberships table:**
- `id` (UUID, PK)
- `userId` (UUID, FK → users.id)
- `projectId` (UUID, FK → projects.id)
- `role` (enum: `owner`, `editor`, `viewer`)
- `createdAt`
- Unique constraint on (userId, projectId)

**Documents table:**
- `id` (UUID, PK)
- `projectId` (UUID, FK → projects.id)
- `documentType` (text: `manifest`, `sitemap`, `templates`, `components`, `page`, `dataset`)
- `documentId` (text) — the document's own ID from YAML (e.g. page ID)
- `content` (text) — raw YAML content
- `contentHash` (text) — SHA-256 of content for conflict detection
- `createdAt`, `updatedAt`
- Unique constraint on (projectId, documentType, documentId)

**Previews table:**
- `id` (UUID, PK)
- `projectId` (UUID, FK → projects.id, unique) — one preview per project
- `slug` (text, unique) — URL-safe identifier
- `accessMode` (enum: `public`, `password`, `sso`)
- `passwordHash` (text, nullable) — bcrypt hash for password mode
- `buildUrl` (text) — GCS URL to built output
- `publishedAt` (timestamp)
- `createdAt`, `updatedAt`

**PreviewAccess table:**
- `id` (UUID, PK)
- `previewId` (UUID, FK → previews.id)
- `email` (text, not null) — allowed email for SSO mode
- `createdAt`
- Unique constraint on (previewId, email)

**Invites table:**
- `id` (UUID, PK)
- `projectId` (UUID, FK → projects.id)
- `email` (text, not null)
- `role` (enum: `editor`, `viewer`)
- `token` (text, unique) — invite acceptance token
- `invitedBy` (UUID, FK → users.id)
- `acceptedAt` (timestamp, nullable)
- `createdAt`

### Patterns

- Use Drizzle's `pgTable`, `pgEnum` for schema definitions
- All timestamps use `timestamp('...', { withTimezone: true })`
- Use cascading deletes where appropriate (documents → project, memberships → user/project)
- Never edit a generated migration — create new ones for changes

### Acceptance Criteria

- `drizzle-kit generate` produces a migration
- `drizzle-kit migrate` applies cleanly to a fresh database
- All tables, enums, constraints, and indexes exist
- Foreign key relationships are correct

---

## Task 3: Implement SSO auth flow and JWT session middleware

### Requirements

Implement the auth flow described in [architecture.md](../docs/architecture.md) § Auth Flow:

**SSO endpoint (`POST /auth/sso`):**
- Receives SSO callback token from `authenticator.unlikeother.ai`
- Validates token against SSO provider (HTTP call to SSO's verify endpoint)
- Creates user if not exists (upsert by `ssoSubject`)
- Returns a signed JWT session token containing `{ userId, email }`
- JWT signed with `JWT_SECRET` env var, 7-day expiry

**Auth middleware:**
- Reads `Authorization: Bearer <jwt>` header
- Validates JWT signature and expiry
- Attaches `req.user = { userId, email }` to request context
- Returns 401 for missing/invalid/expired tokens
- Some routes are public (health, preview viewing) — middleware skips them

**Session management:**
- No refresh tokens for v1 — client re-authenticates via SSO when JWT expires
- JWT is stateless — no server-side session store

### Patterns

- Auth middleware is a Bun middleware function applied to protected routes
- Use a route-level decorator or explicit public route list for unprotected endpoints
- SSO token validation is a service-layer concern (not in middleware)
- Password hashing for preview access uses bcrypt (separate from JWT)

### Acceptance Criteria

- `POST /auth/sso` with valid SSO token returns JWT
- `POST /auth/sso` with invalid token returns 401
- Protected routes return 401 without valid JWT
- Protected routes return 200 with valid JWT and `req.user` populated
- New users are created on first SSO login
- Existing users are found by `ssoSubject` on subsequent logins
