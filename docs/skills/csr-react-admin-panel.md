# CSR React Admin Panel – Architecture & Implementation Skill Spec

---

## 1. Core Architectural Principles

- Client-Side Rendered (CSR) React SPA
- Clear separation of:
  - Server state (remote data, caching, invalidation)
  - Client/session state (auth user, UI prefs)
  - Local UI state (component-level)
- Feature-first structure preferred over layer-first for scalability
- Routing is an architectural boundary (route-level containers)
- Client-side RBAC is UX only — enforcement must be server-side
- Prefer functional components + hooks
- Class components only for error boundaries (if needed)

---

## 2. Recommended Folder Structures

### Small App

```
src/
  api/
  app/
  components/
  layout/
  ui/
  hooks/
  pages/
  routes/
  styles/
  types/
```

Use when: < 10 routes, few entities, single developer.

### Medium App (Recommended Default)

```
src/
  app/
    providers/
    router/
  shared/
    api/
    lib/
    ui/
    types/
  features/
    auth/
    users/
    roles/
  pages/
    dashboard/
    users/
  tests/
```

Use when: 10–40 routes, multiple entities, reusable forms/tables.

### Large App (Feature-Sliced Inspired)

```
src/
  app/
  pages/
  widgets/
  features/
  entities/
  shared/
  processes/
  tests/
    e2e/
```

Use when: Multi-team, 40+ routes, strict dependency control required.

---

## 3. Component Architecture

### Component Layers

1. App Root
2. Providers (Auth, Query, Theme)
3. Layouts
4. Pages (route containers)
5. Widgets
6. Feature Components
7. Shared UI primitives

---

## 4. TypeScript Conventions

### Naming

- Folders: kebab-case or camelCase (be consistent)
- Components: `PascalCase.tsx`
- Types: `PascalCase`
- Feature slices: grouped by domain

### Core Shared Types

```typescript
export type Id = string;

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export type SortDirection = "asc" | "desc";

export interface ApiError {
  status: number;
  code: string;
  message: string;
  requestId?: string;
  details?: unknown;
}
```

---

## 5. State Management Strategy

### 1. Server State (Primary)

Use `@tanstack/react-query`. Responsibilities: fetching, caching, retry logic, background refetch, invalidation.

Never store fetched lists in Redux unless absolutely necessary.

### 2. Client Session State

Small global state only: auth user, roles, theme, feature flags.

Options: Context (simple), Zustand (lightweight), Redux Toolkit (complex), MobX (if team aligned).

### 3. Local UI State

Use `useState` / `useReducer`.

---

## 6. API Integration Pattern

### Layered Structure

```
shared/api/httpClient.ts
features/users/api/usersService.ts
features/users/model/userMapper.ts
```

### Rules

- One central HTTP client
- Normalize all errors into `ApiError`
- Never leak Axios/fetch raw errors to UI
- Optional retry logic via React Query or Axios interceptors

---

## 7. Routing Architecture

Use `react-router-dom`, `createBrowserRouter`, route objects.

Pattern: route-level layout, route-level loader for auth, redirect inside loader, lazy route-based code splitting.

---

## 8. Authentication & RBAC

- Auth provider at app level
- Protected route groups
- Loader-based redirect
- UI-level permission checks
- **Server-level enforcement mandatory**

Never trust frontend role checks.

---

## 9. Forms

Use `react-hook-form` + `zod` for validation.

Pattern: `FormProvider`, typed schemas, infer types from schema, validation at boundary.

Never trust backend data — validate external payloads.

---

## 10. Tables

Use `@tanstack/react-table`.

Features: typed column definitions, pagination, sorting, filtering, optional virtualization.

Virtualize if: > 200 rows visible or heavy cell rendering. Use `@tanstack/react-virtual` or `react-window`.

---

## 11. Performance Strategy

Only optimize when measured.

Tools: `React.memo`, `useMemo`, `useCallback`, virtualization, route-based lazy loading, split heavy widgets.

Avoid premature memoization.

---

## 12. Styling Strategy

Pick one primary system:

- **Option A:** Tailwind + headless components
- **Option B:** MUI + sx
- **Option C:** Chakra UI

Supplement with CSS Modules for localized overrides. Avoid mixing 3+ styling paradigms.

---

## 13. Testing Strategy

- **Unit / Component:** `@testing-library/react` — test user behavior, not implementation
- **Integration:** `msw` for API mocking
- **E2E:** `@playwright/test`
- **Runner:** `vitest` (preferred for Vite)

---

## 14. Accessibility

Target: WCAG 2.2 AA.

Critical areas: dialogs, menus, tables, keyboard navigation, focus management.

Follow WAI-ARIA patterns.

---

## 15. Internationalization

Options: `react-i18next`, `react-intl`.

Handle: dates, currency, plurals, enum labels. Never hardcode formatted strings.

---

## 16. Build Tooling

Avoid: Create React App (deprecated).

Use: **Vite**. Key config: `base` for subpath deployment, `import.meta.env`, manual chunk splitting if needed.

---

## 17. Developer Experience

Recommended: ESLint, Prettier or Biome, Husky + lint-staged, Storybook, code generators (Hygen / Plop).

---

## 18. Scaling Checklist

- [ ] Move to feature-first structure
- [ ] Separate server vs client state
- [ ] Route-level guards
- [ ] Standardize forms/tables
- [ ] Add lazy route splitting
- [ ] Add virtualization for heavy lists
- [ ] Formalize accessibility audits
- [ ] Enforce linting + precommit hooks
- [ ] Server-enforce RBAC
- [ ] Migrate to modern build tooling if legacy

---

## 19. Recommended Core Dependencies

```
react, react-dom, react-router-dom
@tanstack/react-query, @tanstack/react-table, @tanstack/react-virtual
react-hook-form, zod
axios (optional)
zustand or @reduxjs/toolkit (if needed)
react-i18next or react-intl
vitest, @testing-library/react, msw, @playwright/test
eslint, prettier or biome, husky, lint-staged, storybook
```

---

## 20. Architectural Default Recommendation

For most professional admin panels:

- Vite
- React Router (data router)
- TanStack Query
- Feature-first folder structure
- React Hook Form + Zod
- TanStack Table
- Tailwind or MUI
- MSW + Playwright
- Zustand (only if needed)
- Strict server-side RBAC enforcement
