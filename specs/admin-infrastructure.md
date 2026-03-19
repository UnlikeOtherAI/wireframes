# Admin Infrastructure & Auth

## Related Documentation

- [Architecture](../docs/architecture.md) — admin UI section, auth flow, i18n requirements, screens list
- [AGENTS.md](../AGENTS.md) — admin UI rules (i18n, accessibility, localization), code quality rules, file size limits
- [Rendering](../docs/cli/rendering.md) — rendering pipeline (admin uses the renderer library for preview)
- [API spec: infrastructure](api-infrastructure.md) — auth endpoints the admin calls
- [API spec: project-documents](api-project-documents.md) — project/document endpoints
- [API spec: preview-sharing](api-preview-sharing.md) — preview endpoints

## Overview

Scaffold the React single-page application with routing, state management, SSO authentication, and internationalization. This is the foundation for all admin screens.

## Monorepo Location

```
admin/
  src/
    main.tsx            App entry
    App.tsx             Root component + router setup
    api/                API client layer
      client.ts         Fetch wrapper with JWT handling
      projects.ts       Project API methods
      documents.ts      Document API methods
      members.ts        Membership API methods
      auth.ts           Auth API methods
    features/           Feature modules
    components/         Shared UI components
    hooks/              Shared React hooks
    i18n/
      index.ts          i18n setup (react-i18next)
      locales/
        en.json         English translations
    stores/             Zustand stores
      authStore.ts      Auth state (JWT, user)
      projectStore.ts   Active project state
    router/
      index.tsx         Route definitions
      guards.tsx        Auth guard components
    types/              Shared TypeScript types
  public/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

Package name: `@wireframes/admin`. Framework: React + Vite. Language: TypeScript.

---

## Task 13: Scaffold React + Vite with React Router, Zustand, i18n foundation

### Requirements

- Initialize `admin/` as a Vite + React + TypeScript project
- Add to pnpm workspace
- Install and configure:
  - `react-router-dom` v6 — client-side routing
  - `zustand` — state management
  - `react-i18next` + `i18next` — internationalization
- Set up route structure (from [architecture.md](../docs/architecture.md) § Screens):

```
/login              → Login screen
/                   → Dashboard (project list)
/projects/:id       → Project editor
/projects/:id/settings → Project settings
/projects/:id/members  → Member management
/projects/:id/preview  → Preview settings
/account            → Account settings
```

- Create `i18n/` setup with English locale file
- Every UI string uses translation keys — no hardcoded strings (per [AGENTS.md](../AGENTS.md) § Internationalization)
- Create Zustand auth store: `{ user, token, isAuthenticated, login, logout }`
- Create API client with JWT handling:
  - Reads token from auth store
  - Attaches `Authorization: Bearer <token>` to all requests
  - Handles 401 responses (redirects to login)
  - Base URL from `VITE_API_URL` env var
- Create placeholder page components (just titles) for all routes
- Configure Vite proxy for API during development

### i18n Requirements (from [AGENTS.md](../AGENTS.md)):

- All user-facing strings go through the translation layer
- No hardcoded strings in components — labels, tooltips, placeholders, errors, status text
- Language preference stored per-user in API + cookie
- Admin reads locale from cookie on load, syncs with API after login
- English is the only shipping language, but architecture supports adding more without code changes

### Accessibility Baseline (from [AGENTS.md](../AGENTS.md)):

- 44x44px minimum hit targets, 8px between touch targets
- Colour contrast: normal text >= 4.5:1, large text >= 3:1
- Every control has a label/accessible name
- Logical focus order

### Patterns

- One route per screen (no nested routing complexity in v1)
- Auth guard wraps all routes except `/login`
- Zustand stores are thin — no business logic, just state + actions
- API client is a plain fetch wrapper, not a heavy SDK

### Acceptance Criteria

- `pnpm --filter @wireframes/admin dev` starts the Vite dev server
- All routes render their placeholder components
- i18n setup loads English translations and renders translated strings
- Auth store persists token across page reloads (localStorage)
- Unauthenticated users are redirected to `/login`
- API client attaches JWT and handles 401

---

## Task 14: Implement SSO login flow, JWT management, protected route guards

### Requirements

**Login screen:**
- Single "Sign in" button that redirects to `authenticator.unlikeother.ai`
- SSO redirect URL includes callback URL back to the admin (`/auth/callback`)
- After SSO, user is redirected to `/auth/callback?token=<sso_token>`

**Auth callback:**
- Extract SSO token from URL
- Call `POST /auth/sso` with the token
- Receive JWT from API
- Store JWT in auth store (Zustand + localStorage)
- Store user info (email, displayName, locale) in auth store
- Redirect to dashboard (`/`)
- On failure: show error message, redirect to login after 3s

**Protected routes:**
- Auth guard component checks `isAuthenticated` from auth store
- If not authenticated: redirect to `/login` with return URL in query param
- After successful login: redirect back to original URL

**JWT lifecycle:**
- On app load: check localStorage for existing JWT
- Validate JWT is not expired (decode and check `exp` claim)
- If expired: clear store, redirect to login
- API client intercepts 401 responses and triggers logout

**Locale sync:**
- On login: read user's `locale` from API response
- Set `i18next` language to match
- Store locale in cookie for pre-login hydration
- On locale change: call `PATCH /users/me/locale` and update cookie

### Patterns

- SSO redirect is a full page navigation (not an API call)
- JWT is stored in localStorage (not cookies — API expects Bearer token)
- Auth guard is a React component wrapping `<Outlet />` in router
- Token refresh is not implemented — user re-authenticates via SSO on expiry

### Acceptance Criteria

- Clicking "Sign in" redirects to SSO provider
- SSO callback stores JWT and redirects to dashboard
- Protected routes redirect unauthenticated users to login
- Expired JWT triggers logout and redirect to login
- Locale syncs between API, i18next, and cookie
- Return URL is preserved through the login flow
