# Admin Dashboard & Account Screens

## Related Documentation

- [Architecture](../docs/architecture.md) — screen descriptions, role-based access table, core entities
- [AGENTS.md](../AGENTS.md) — admin UI rules (i18n, accessibility, localization), file size limits
- [API spec: project-documents](api-project-documents.md) — project and document endpoints
- [API spec: preview-sharing](api-preview-sharing.md) — preview settings endpoints
- [API spec: infrastructure](api-infrastructure.md) — auth endpoints

## Overview

The main screens outside the editor: dashboard (project list), project settings, member management, preview configuration, and account settings.

---

## Task 15: Implement dashboard screen

### Requirements

**Dashboard** (from [architecture.md](../docs/architecture.md) § Screens):

- Grid of project cards — each card is a square
- Owned projects show edit icon; viewer-only projects show eye icon
- Pending invites appear as cards with accept/decline actions
- "New Project" card (+ icon, dashed border) opens create dialog

**Project cards:**
- Project name
- Role badge (Owner / Editor / Viewer)
- Last updated timestamp
- Click → navigate to project editor (`/projects/:id`)

**Invite cards:**
- "You've been invited to {projectName}" text
- Invited by (name or email)
- Role being offered
- Accept / Decline buttons
- Accept calls `POST /invites/:token/accept`, then navigates to project
- Decline dismisses the card (no API call for v1, or soft-decline)

**Create project dialog:**
- Modal with project name input
- Create button calls `POST /projects`
- On success: navigate to new project editor
- Name is required, max 100 chars

**Data loading:**
- `GET /projects` for project list
- Separate endpoint or included in response: pending invites for the user
- Loading state with skeleton cards
- Empty state: "No projects yet" with create button

### All strings through i18n

Every label, button text, tooltip, placeholder, and status message uses translation keys.

### Patterns

- Cards use CSS Grid for responsive layout
- Skeleton loading state while data fetches
- Optimistic update after creating a project (add card immediately)
- Error states: network error banner, retry button

### Acceptance Criteria

- Dashboard shows all user's projects as cards
- Cards display name, role badge, last updated
- Owned projects have edit icon, viewer projects have eye icon
- Pending invites display as distinct cards with accept/decline
- Create project dialog works end-to-end
- Loading and empty states are implemented
- All strings are internationalized

---

## Task 16: Implement project settings screen

### Requirements

**Project Settings** (from [architecture.md](../docs/architecture.md) § Screens):

Route: `/projects/:id/settings`

**Sections:**

1. **General** — rename project
   - Name input (pre-filled with current name)
   - Save button calls `PATCH /projects/:id` (or equivalent)

2. **Members** — member management
   - List of members with role badges (Owner / Editor / Viewer)
   - Owner can change member roles (dropdown)
   - Owner can remove members (confirm dialog)
   - Invite by email: input + role selector + invite button
   - Calls membership endpoints from [api-project-documents.md](api-project-documents.md)

3. **Preview Settings** — preview configuration
   - Toggle between access modes: Public / Password / SSO
   - Password mode: password input field
   - SSO mode: email list (add/remove emails)
   - Copy share link button
   - Publish button (triggers build + publish)
   - Last published timestamp
   - Calls preview endpoints from [api-preview-sharing.md](api-preview-sharing.md)

4. **Danger Zone** — destructive actions
   - Delete project button (owner only)
   - Confirmation dialog: type project name to confirm
   - Calls `DELETE /projects/:id`
   - On success: redirect to dashboard

### Role-Based Visibility (from [architecture.md](../docs/architecture.md)):

- Only owners see member management and danger zone
- Editors see general settings and preview settings
- Viewers see read-only view of settings

### Patterns

- Tab-based or section-based layout within the settings page
- Confirmation dialogs for destructive actions (per [AGENTS.md](../AGENTS.md))
- Form validation with inline error messages
- Loading states for async operations

### Acceptance Criteria

- Settings page loads for all roles
- Owners can manage members, change roles, remove members
- Owners can delete project (with confirmation)
- Preview settings change access mode correctly
- Invite flow works end-to-end
- Non-owners see appropriate restrictions
- All strings internationalized

---

## Task 17: Implement account screen

### Requirements

**Account** (from [architecture.md](../docs/architecture.md) § Screens):

Route: `/account`

**Sections:**

1. **Profile**
   - Display name (editable input)
   - Email (read-only, from SSO)
   - Save button for display name changes

2. **Language**
   - Language selector dropdown
   - Options: English (more added later)
   - On change: calls `PATCH /users/me/locale`, updates i18next language, updates cookie
   - Changes take effect immediately (no page reload)

3. **Sessions** (informational for v1)
   - Current session info (logged in since, device/browser)
   - "Sign out everywhere" button (future — v1 just shows info)

4. **Danger Zone**
   - Delete account button
   - Confirmation dialog: type email to confirm
   - Calls delete account endpoint
   - On success: clear auth store, redirect to login

### Patterns

- Simple form layout
- Immediate locale change (no save button for language)
- Confirmation for destructive actions

### Acceptance Criteria

- Profile section shows and allows editing display name
- Language selector changes locale immediately
- Locale preference persists (cookie + API)
- Delete account flow works with confirmation
- All strings internationalized
