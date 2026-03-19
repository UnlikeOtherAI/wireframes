# Admin Chat Integration

## Related Documentation

- [Architecture](../docs/architecture.md) — chat section (reuse from AdGoes.live, scope tracking, streaming, patch-based editing from docgen)
- [AGENTS.md](../AGENTS.md) — admin UI rules (i18n, accessibility), engine rules, layered architecture
- [Schema](../docs/cli/schema.md) — document types the chat edits (pages, templates, components)
- [Schema Systems](../docs/cli/schema-systems.md) — validation rules for edited documents
- [Brief](../docs/cli/brief.md) — CLI structure management (chat replicates these operations)
- [Rendering](../docs/cli/rendering.md) — preview pipeline (preview updates after chat edits)
- [API spec: project-documents](api-project-documents.md) — document CRUD (chat saves via API)
- [API spec: build-assets](api-build-assets.md) — build endpoint for preview refresh

## Source Projects for Reuse

### AdGoes.live Chat (primary reuse target)

Location: `/System/Volumes/Data/.internal/projects/Projects/AdGoes.live/`

Files to study and adapt:
- `src/features/chat/ChatPopup.tsx` — modal chat UI
- `src/features/chat/usePopupChat.ts` — session/WebSocket/state hook
- `src/features/chat/chatApi.ts` — REST client
- `src/features/chat/types.ts` — message types
- `src/features/chat/MarkdownMessage.tsx` — markdown rendering
- `server/routes/chat.ts` — REST endpoints
- `server/services/chatService.ts` — scope tracking, LLM routing, streaming
- `server/lib/llm.ts` — LLM abstraction (Anthropic/Google)
- `server/lib/websocket.ts` — WebSocket streaming

### Docgen Patch Patterns (for YAML editing)

Location: `/System/Volumes/Data/.internal/projects/Projects/docgen/`

Files to study:
- `platform-api/src/api/v1/specs_routes_write.py` — PATCH with content hash + idempotency
- `platform-api/src/api/v1/specs_service.py` — deep-copy + mutate + validate + persist
- `frontend/src/shared/utils/diff.ts` — LCS line-diff algorithm
- `frontend/src/features/workspace/ui/FileDiffPreview.tsx` — visual diff rendering

## Overview

AI chat for wireframe editing. The chat understands what the user is looking at (active page, selected node, workspace mode) and can edit YAML files via LLM-generated patches.

---

## Task 21: Implement chat backend

### Requirements

**REST Endpoints:**

`POST /projects/:id/chat/sessions` — Create chat session.
- Body: `{ scope: ChatSessionScope }`
- Returns `{ sessionId, messages: [] }`

`GET /projects/:id/chat/sessions/:sessionId` — Resume session.
- Returns `{ sessionId, messages: [...] }`

`POST /projects/:id/chat/sessions/:sessionId/messages` — Send message.
- Body: `{ content: string }`
- Returns `{ userMessage, assistantMessage }` (assistant message is the summary)
- Full assistant response streams via WebSocket

**WebSocket Streaming:**
- Channel: `chat.{sessionId}`
- Events: `chat.stream.token`, `chat.stream.done`, `chat.stream.error`
- Token-by-token streaming for responsive UX (from AdGoes.live)

**Chat Session Scope** (adapted from AdGoes.live):

```typescript
interface ChatSessionScope {
  projectId: string
  activePage?: string          // which page is being edited
  selectedNode?: string        // wf:// address of selected node
  workspaceMode?: 'preview' | 'sitemap' | 'tree'
  device?: DeviceType
  renderMode?: 'line' | 'card'
}
```

Every message triggers the pipeline (from [architecture.md](../docs/architecture.md)):
1. Scope normalization (validate active page exists, etc.)
2. Scope application (load relevant documents for context)
3. Scoped data loading (current page YAML, template, components used)
4. LLM tool routing (determine intent: edit structure, navigate, ask about schema, etc.)
5. Handler dispatch (execute the appropriate action)

**LLM Integration:**
- Use Anthropic Claude API (via `@anthropic-ai/sdk`)
- System prompt includes: wireframe schema reference, current project structure, current scope
- Tools available to the LLM:
  - `edit_document` — replace entire YAML content of a document
  - `navigate_to_page` — change active page in workspace
  - `explain_schema` — answer questions about the wireframe schema
  - `list_pages` / `list_components` / `list_templates` — introspection
- The LLM generates new YAML content for `edit_document` (not diffs)

**YAML Edit Pipeline** (adapted from docgen):
1. LLM generates new full YAML content for the changed file
2. Server validates the new YAML (parse + engine validation)
3. If valid: save via document API with content hash for conflict detection
4. Compute line-diff (old vs new) for visual preview
5. Broadcast change to workspace via WebSocket
6. If invalid: return validation errors to LLM for self-correction (retry once)

### Patterns

- Chat service is in the API server, not a separate service
- Session state stored in DB (new table: `chat_sessions`, `chat_messages`)
- LLM context window management: include relevant docs, trim old messages
- Idempotency keys on edit operations (from docgen patterns)
- Rate limiting: max 1 concurrent LLM call per session

### Acceptance Criteria

- Chat sessions can be created and resumed
- Messages are stored and returned in order
- WebSocket streams tokens in real-time
- LLM can edit YAML documents via tools
- Edited documents are validated before saving
- Invalid edits trigger LLM self-correction
- Scope tracking provides relevant context to LLM
- All chat endpoints require project membership

---

## Task 22: Implement chat frontend

### Requirements

**Chat Popup** (adapted from AdGoes.live `ChatPopup.tsx`):
- Floating button in bottom-right corner of the editor
- Opens a chat panel (modal or side panel)
- Message thread with user and assistant messages
- Markdown rendering for assistant messages (from AdGoes.live `MarkdownMessage.tsx`)
- Streaming text display (tokens appear incrementally)
- Connection status indicator (connected / disconnected / reconnecting)
- Input field with send button
- Keyboard shortcut to open/close (Cmd+K or similar)

**Context Awareness:**
- Chat scope syncs with workspace state automatically:
  - Active page changes → scope updates
  - Node selection in tree/preview → scope updates
  - Device/mode changes → scope updates
- Scope changes are sent with each message (not a separate API call)

**YAML Diff Preview** (adapted from docgen `FileDiffPreview.tsx`):
- When the LLM edits a document, show a diff preview before applying
- Side-by-side or inline diff view
- Line additions (green) / deletions (red) / unchanged (grey)
- "Apply" and "Reject" buttons
- Apply: saves the document, refreshes preview
- Reject: discards the edit, sends feedback to LLM

**LCS Line-Diff Algorithm** (from docgen `diff.ts`):
- Compute longest common subsequence between old and new YAML content
- Produce line-by-line diff markers: added, removed, unchanged
- Display in the diff preview component

**Action Buttons:**
- Quick actions above the input field:
  - "Add a page" — pre-fills prompt
  - "Edit this page" — includes current page context
  - "Explain this node" — includes selected node address
  - "Build preview" — triggers build

**Session Persistence:**
- Chat session persists within a project session
- Switching projects clears the chat
- Message history scrollable
- Session can be cleared manually ("New conversation" button)

### Patterns

- WebSocket connection established on chat panel open, closed on panel close
- Reconnection with exponential backoff
- Messages are append-only (no editing)
- Diff computation runs in the browser (not on server)
- Chat panel is a controlled component receiving workspace state as props

### Acceptance Criteria

- Chat popup opens and closes smoothly
- Messages send and assistant responses stream in real-time
- Markdown renders correctly in assistant messages
- Context scope updates automatically as user navigates
- YAML edits show diff preview before applying
- Apply saves the document and refreshes the preview
- Reject discards the edit with feedback
- Session persists within a project, clears on project switch
- Quick action buttons pre-fill appropriate prompts
- All UI strings internationalized
