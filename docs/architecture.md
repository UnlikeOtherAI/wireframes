# Wireframes — System Architecture

## Overview

Wireframes is a platform for designing, building, and sharing clickable wireframe prototypes. It consists of four components sharing a core engine.

```
┌─────────────────────────────────────────────────────┐
│                    @wireframes/engine                │
│  Schema · Resolver · Renderer · Validation · Build  │
└──────────┬──────────────┬───────────────┬───────────┘
           │              │               │
     ┌─────┴─────┐  ┌────┴─────┐  ┌──────┴──────┐
     │  CLI (wf)  │  │   API    │  │   Admin UI  │
     │  Node.js   │  │   Bun    │  │   React CSR │
     └───────────┘  └────┬─────┘  └──────┬──────┘
                         │               │
                    ┌────┴───────────────┴────┐
                    │       PostgreSQL        │
                    └────────────────────────┘

     ┌───────────┐
     │    Web    │  SSR landing page (standalone)
     └───────────┘
```

---

## Components

### Engine (`/engine`)

Shared library. No CLI/API/framework deps. Pure JavaScript (CommonJS).

| Module | Responsibility |
|--------|---------------|
| schema | YAML loading, JSON Schema validation, document types |
| resolver | Template + page + component resolution pipeline |
| renderer | Node tree to wireframe HTML (primitives, layout, styles) |
| build | Full project build (resolve all pages, render to static HTML) |
| screenshots | Playwright-based screenshot capture |
| addressing | `wf://` URI parsing and node lookup |
| validate | Schema + semantic validation |
| doctor | Project health checks |

Consumed by: CLI, API, Admin (via API).

### CLI (`/cli`)

Node.js CLI tool. Thin command layer over engine.

- **Package:** `@wireframes/cli`
- **Entry:** `bin/wf.js`
- **Commands:** init, build, serve, validate, lint, doctor, schema, llm, page, template, component, node, overlay, data, tree, inspect, routes, stats, screenshots, export
- **Deps:** engine (workspace), js-yaml, playwright

### API (`/api`)

Bun HTTP server. RESTful JSON API.

- **Runtime:** Bun
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM (better Bun compatibility than Prisma, TypeScript-first, SQL-like syntax)
- **Migrations:** drizzle-kit
- **Auth:** SSO via `authenticator.unlikeother.ai`

#### Core Entities

| Entity | Description |
|--------|-------------|
| User | Authenticated via SSO. Has projects, memberships. Stores locale preference. |
| Project | Wireframe project. Contains YAML documents stored as rows. |
| Membership | User-project relationship. Role: `owner`, `editor`, `viewer`. |
| Preview | Published snapshot of a built project. Has access control. |
| PreviewAccess | Per-preview access list. Email-based. |
| Invite | Pending invitation to a project (email + role). |

#### Preview & Sharing

- Any project can be published to a preview URL.
- Preview access modes:
  - **Public** — anyone with the link can view.
  - **Password-protected** — requires a password to view.
  - **SSO-restricted** — only specified email addresses (authenticated via SSO) can view.
- Preview viewers are completely separate from project editors.
- Viewing a preview does NOT grant edit access.
- Authors authenticate via the same SSO but their role (owner/editor/viewer) controls what they can do.

#### Key API Routes

```
POST   /auth/sso                    SSO callback
GET    /projects                    List user's projects (owned + member)
POST   /projects                    Create project
GET    /projects/:id                Get project details
DELETE /projects/:id                Delete project (owner only)

GET    /projects/:id/documents      List project documents
PUT    /projects/:id/documents/:type  Upsert document (page, template, etc.)

POST   /projects/:id/build          Build project (returns rendered HTML)
POST   /projects/:id/preview        Publish preview
GET    /projects/:id/preview        Get preview settings
PATCH  /projects/:id/preview        Update preview access settings

GET    /projects/:id/members        List members
POST   /projects/:id/invite         Send invite (email + role)
PATCH  /projects/:id/members/:uid   Change member role
DELETE /projects/:id/members/:uid   Remove member

POST   /invites/:token/accept       Accept invite
GET    /preview/:slug               View published preview
PATCH  /users/me/locale              Update user locale preference
POST   /preview/:slug/auth          Authenticate for preview access
```

### Admin (`/admin`)

React CSR single-page application. Online wireframe editor.

- **Framework:** React (Vite)
- **Routing:** React Router
- **State:** Zustand or similar
- **Auth:** SSO via `authenticator.unlikeother.ai`

#### Internationalization (i18n)

Every UI string in the admin panel must be translatable. English is the initial (and only shipping) language, but the architecture must support adding languages without code changes.

- All user-facing strings go through a translation layer (e.g. `react-i18next` or similar).
- No hardcoded strings in components — every label, tooltip, placeholder, error message, and status text uses a translation key.
- Language selection is per-user, stored in the platform's user profile (not SSO — SSO does not hold this data). Also persisted in a cookie for unauthenticated/pre-login hydration.
- The API stores the user's `locale` preference (e.g. `en`, `de`, `ja`) on the User entity.
- The admin reads the locale from the cookie on load, then syncs with the API-stored preference after login.

#### Screens

| Screen | Description |
|--------|-------------|
| Login | SSO redirect to authenticator.unlikeother.ai |
| Dashboard | Grid of project cards. Each card is a square. Owned projects show edit icon; viewer-only projects show eye (fa-eye) icon. Pending invites appear as cards with accept/decline actions. |
| Project Editor | Full wireframe editor. YAML editing + live preview pane. Template/page/component management. |
| Project Settings | Rename, delete, manage members, preview settings. |
| Members | List of members with role badges. Invite by email. Change roles. Remove members. |
| Preview Settings | Toggle public/password/SSO. Manage email access list. Copy share link. |

#### Role-Based Access

| Capability | Owner | Editor | Viewer |
|-----------|-------|--------|--------|
| View project | Yes | Yes | Yes |
| Edit pages/templates/components | Yes | Yes | No |
| Build & preview | Yes | Yes | Yes (read-only) |
| Manage members | Yes | No | No |
| Publish preview | Yes | Yes | No |
| Delete project | Yes | No | No |
| Change preview access | Yes | Yes | No |

#### Workspace Component

The editor workspace (preview pane, navigation, tree, device controls) must be a self-contained, embeddable component. It will be reused in other projects and controlled externally — including from other systems, websites, or AI chat sessions via tool calls. Design it as a plug-in rendering tool with a clear interface for what is available and controllable.

### Web (`/web`)

SSR landing/marketing page.

- **Framework:** Astro or Next.js (SSR)
- **Content:** Product description, features, pricing, docs links
- **Standalone** — no API dependency for rendering

---

## Auth Flow

1. User clicks "Sign in" on admin or web.
2. Redirect to `authenticator.unlikeother.ai` (SSO).
3. SSO redirects back with token.
4. API validates token, creates/finds user, returns session JWT.
5. Admin stores JWT, uses for all API calls.

Preview auth (for restricted previews):
1. Viewer opens preview link.
2. If SSO-restricted: redirect to SSO, verify email is in access list.
3. If password-protected: prompt for password.
4. If public: no auth needed.

---

## Tech Stack Summary

| Component | Runtime | Language | Key Deps |
|-----------|---------|----------|----------|
| Engine | Node.js / Bun | JavaScript (CJS) | js-yaml |
| CLI | Node.js | JavaScript | engine, playwright |
| API | Bun | TypeScript | drizzle-orm, pg |
| Admin | Browser | TypeScript/React | react, vite, react-router |
| Web | Node.js | TypeScript | astro or next.js |

---

## Monorepo

pnpm workspaces. Each component is a workspace package.

```
wireframes/
├── package.json              root workspace
├── pnpm-workspace.yaml
├── engine/                   @wireframes/engine
├── cli/                      @wireframes/cli
├── api/                      @wireframes/api
├── admin/                    @wireframes/admin
├── web/                      @wireframes/web
└── docs/
    ├── architecture.md       this file
    └── cli/                  CLI-specific docs
```
