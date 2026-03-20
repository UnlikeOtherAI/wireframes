# Admin Editor Polish Plan

## Problem Statement

The admin UI is functionally usable, but the login screen and project editor do not follow the visual language defined in [docs/design-system.md](/System/Volumes/Data/.internal/projects/Projects/wireframes/docs/design-system.md). The current editor layout is mostly raw inline flex boxes and borders, the login screen is unframed and visually under-designed, the editor/preview split is fixed instead of behaving like a polished workspace, and chat only exists as a floating popup rather than as part of the editor layout. That creates two concrete problems:

- The product does not look presentable enough for local review or demos.
- Workspace affordances that should feel native, such as draggable split bars, are missing or not persisted.

## Current Behavior

- The login page in [admin/src/features/LoginPage.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/LoginPage.tsx) is just a heading, paragraph, and buttons without a centered card or design-system styling.
- The project editor in [admin/src/features/ProjectEditorPage.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/ProjectEditorPage.tsx) uses a simple three-column flex layout with hard-coded borders and no resizable panes.
- Chat in [admin/src/features/chat/ChatPopup.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/chat/ChatPopup.tsx) is only available as a floating popup toggled by a button. It does not support a pinned docked state inside the editor shell.
- The editor currently supports document selection and editing, but this plan assumes the “create new file” flow must be promoted as a first-class project-editor action rather than left implicit.
- Existing user preference persistence uses `localStorage` for preview mode and cookies for locale, but there is no persisted split-pane state for the editor workspace.

## Desired Behavior

- The login page should be centered on the page, rendered inside a proper card, and use the warm background, white card surface, border, radius, spacing, and accent colors from the design system.
- The login page should keep both auth buttons, with `Dev login` shown only when enabled, but the overall layout should feel deliberate and demo-ready.
- The project editor should have a polished shell that matches the design system rather than looking like a utility layout.
- The project editor should expose a clear “new file” action so a user can create a new project document directly from the editor.
- The split bars between panes should be draggable, visually obvious, and persisted in cookies so the workspace restores across reloads.
- Chat should support two modes:
  - unpinned: current icon-driven popup access
  - pinned: a full-height right-hand column integrated into the editor shell
- The chat header should include a pin control so the user can move between popup mode and docked-column mode without losing the current conversation.
- The final UI pass should be verified against the design system and exercised so the presentable state is not just assumed.
- Every shipped interaction in this workstream must be validated in Playwright, not just with unit tests or manual spot checks.

## Design

### 1. Introduce a shared admin visual layer

- Add a small set of reusable admin tokens/helpers inside `admin/src/` rather than scattering more inline hex values.
- Mirror the design-system palette in code:
  - page background `#F5F3F0`
  - card background `#FFFFFF`
  - default border `#ECEAE6`
  - primary accent `#F56522`
  - primary hover `#E05A1D`
  - primary tint `#FEF0EB`
- Apply the same radii and spacing across login and editor:
  - page padding `24px`
  - card padding `20px`
  - card radius `16px`
  - button radius `10px`

### 2. Restyle the login page first

- Rework [admin/src/features/LoginPage.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/LoginPage.tsx) into a vertically and horizontally centered layout.
- Add a constrained white auth card on the warm page background.
- Keep the current text hierarchy, but upgrade spacing, button sizing, border treatment, and focus states to align with the design system.
- Keep the primary authenticator action first and render `Dev login` below it as a secondary-but-still-solid action when enabled.
- Ensure any login error message sits inside the card and remains visually integrated, not detached beneath raw content.

### 3. Promote “create new file” into the project editor

- Add an explicit new-file control in the editor shell, most likely near the document tree header where file management already belongs.
- Scope the first version to the existing document model:
  - page
  - dataset
  - supported top-level singleton docs where appropriate
- The flow should be direct and low-friction:
  - choose document type
  - provide id/name
  - create the YAML stub
  - select the new file immediately in the editor
- Reuse existing document loading/saving architecture instead of creating a second document-management path.

### 4. Redesign the project editor shell

- Convert [admin/src/features/ProjectEditorPage.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/ProjectEditorPage.tsx) from a bare flex layout into a composed workspace shell:
  - top command/header bar
  - left navigation/document pane
  - center editing pane
  - right preview/workspace pane
  - optional far-right chat column when pinned
- Visually separate panes with proper surfaces and internal padding rather than a single full-bleed border split.
- Keep the current functional subcomponents, but wrap them in styled containers so we improve look and hierarchy without rewriting every child component in one pass.
- Normalize buttons, tabs, banners, and status indicators to one visual system instead of one-off inline styles.

### 5. Make chat dockable instead of popup-only

- Refactor [admin/src/features/chat/ChatPopup.tsx](/System/Volumes/Data/.internal/projects/Projects/wireframes/admin/src/features/chat/ChatPopup.tsx) into a chat surface that can render in two presentation modes:
  - floating popup
  - docked right column
- Keep the floating chat icon when chat is unpinned.
- Add a pin button in the chat header:
  - when unpinned, tapping the pin docks chat into the editor shell as a full-height right column
  - when pinned, tapping the pin returns chat to popup mode and restores icon-based access
- The pinned chat column should span top to bottom inside the editor workspace and be treated as a first-class pane rather than an overlay.
- The pinned state should persist as a workspace preference so the editor reopens in the same mode.
- The current conversation/session should survive pin and unpin transitions.

### 6. Add draggable split bars with cookie persistence

- Add resize handles between:
  - document tree and editor
  - editor and preview pane
  - preview pane and pinned chat column
- Store split ratios in cookies, not localStorage, to match the stated requirement.
- Use cookie keys that are explicit and scoped, for example:
  - `wf_editor_nav_split`
  - `wf_editor_preview_split`
  - `wf_editor_chat_split`
  - `wf_editor_chat_pinned`
- Behaviour:
  - load cookie values on mount
  - clamp values to safe min/max widths
  - update live during drag
  - persist on drag end
- Use a small workspace preference utility rather than embedding cookie parsing logic directly into the page component.

### 7. Testing and presentation pass

- Add or update tests for:
  - login card rendering and centered auth layout expectations where practical
  - `Dev login` visibility and button ordering
  - new-file control visibility and basic create flow
  - chat pin/unpin behavior
  - chat session continuity across pin state changes
  - split-handle rendering
  - cookie read/write for pane sizes
- Add Playwright coverage for the full user-facing flow, including:
  - login screen layout and centered auth card
  - `Dev login` flow
  - project editor shell layout
  - new-file creation flow
  - dragging and persisting split bars
  - chat opened as popup
  - chat pinned into the right column
  - sending a chat message
  - receiving a chat response
  - seeing a proposed document change in chat
  - applying or rejecting that change
  - verifying the editor and preview update correctly after the change
- Run the admin test suite and Playwright verification for the main views and interactions:
  - login
  - dashboard
  - project editor
  - preview pane states
  - pinned chat state
  - unpinned popup state
  - end-to-end chat usage
- Treat “presentable” as a deliverable:
  - no raw placeholder-looking spacing
  - no misaligned controls
  - no visually broken empty states
  - no splitters that reset unexpectedly
  - no interaction is considered done until its Playwright path passes

## Execution Checklist

Rule: a task stays `[ ]` until implementation is complete and its affected user path passes Playwright. Only then may it be changed to `[x]`.

- [ ] Add admin design tokens/helpers so the restyle has a stable base.
- [ ] Verify the shared visual layer in Playwright on the affected screens before marking it complete.
- [ ] Restyle the login page into a centered card that follows the documented palette and spacing.
- [ ] Verify the login layout, button hierarchy, and enabled/disabled dev-login variants in Playwright before marking it complete.
- [ ] Refactor the project editor shell into explicit pane containers without changing behavior yet.
- [ ] Verify the editor shell layout and baseline usability in Playwright before marking it complete.
- [ ] Refactor chat into a surface that supports both popup and pinned-column presentation.
- [ ] Verify popup chat, pinning, unpinning, and preserved conversation state in Playwright before marking it complete.
- [ ] Add draggable split bars and cookie-backed persistence, including the pinned chat column.
- [ ] Verify drag behavior, restored layout, and cookie-backed persistence in Playwright before marking it complete.
- [ ] Add the “new file” flow to the project editor and wire it into the existing document-management path.
- [ ] Verify end-to-end file creation in Playwright before marking it complete.
- [ ] Tighten remaining editor visual details: tabs, toolbar, warning banners, empty states.
- [ ] Verify the polished editor states in Playwright before marking them complete.
- [ ] Run unit tests plus Playwright verification across all affected flows and clean up any presentational regressions.
- [ ] Verify chat-driven document changes end to end in Playwright, including sending a message, seeing a proposed change, applying or rejecting it, and confirming the editor and preview update correctly, before marking the overall work complete.

## Edge Cases

- Invalid or missing split cookies should fall back to sane defaults.
- Very narrow screens should collapse or clamp pane widths instead of allowing unusable layouts.
- Creating a file with an existing id should fail clearly and not overwrite content silently.
- The login card must still work when `Dev login` is disabled, when it is enabled, and when the dev login request fails.
- The preview pane warning state must remain readable after the redesign.
- Pinning chat must not hide the editor or preview into unusable widths.
- Unpinning chat must preserve the active conversation and pending diff state.
- If the pinned chat cookie is set but the viewport is too narrow, the editor should fall back safely rather than rendering a broken layout.
- Drag handles must remain keyboard-discernible and not reduce hit targets below accessibility minimums.
- Chat-related Playwright flows will need deterministic fixtures or mocks so message streaming and document-change application are testable without flaky external dependencies.

## Non-Goals

- Rebuilding the entire admin app into a new component library in one pass.
- Introducing Tailwind as part of this specific UI-polish change.
- Reworking unrelated screens before the login page and project editor are aligned.
- Changing the project/document data model just to support the initial new-file action.
