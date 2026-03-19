# Admin Editor & Workspace

## Related Documentation

- [Architecture](../docs/architecture.md) — project editor screen, workspace component, client-side rendering library
- [AGENTS.md](../AGENTS.md) — admin UI rules (i18n, accessibility), engine rules, code quality
- [Rendering](../docs/cli/rendering.md) — rendering pipeline, output structure, viewport dimensions, page shell
- [Rendering Modes](../docs/cli/rendering-modes.md) — line vs card mode, CSS architecture, component rendering
- [Schema](../docs/cli/schema.md) — all document types, core node model, addressing model
- [Schema Systems](../docs/cli/schema-systems.md) — layout, state, interactions, overlays, panes, primitives
- [Canonical YAML](../docs/cli/schema-canonical.yaml) — full YAML schema reference
- [Brief](../docs/cli/brief.md) — CLI commands (editor replicates structure management)
- [Renderer Library spec](renderer-library.md) — client-side rendering library API
- [API spec: project-documents](api-project-documents.md) — document CRUD endpoints
- [API spec: build-assets](api-build-assets.md) — build and asset endpoints

## Overview

The core editor experience: a YAML editing pane, a live wireframe preview, and a workspace component that ties them together. The workspace must be embeddable and externally controllable.

---

## Task 18: Implement YAML editor with syntax highlighting and validation

### Requirements

**YAML Editor Pane:**
- Code editor component for YAML editing
- Use CodeMirror 6 (lightweight, extensible, good YAML support) or Monaco
- YAML syntax highlighting
- Line numbers
- Bracket/indent matching
- Search and replace

**Document Management:**
- Sidebar tree showing all project documents:
  - `manifest.yaml`
  - `sitemap.yaml`
  - `templates.yaml`
  - `components.yaml`
  - `pages/` folder with page files
  - `data/` folder with dataset files
- Click document → load content into editor
- Unsaved changes indicator (dot on tab/tree item)
- Save: calls `PUT /projects/:id/documents/:type` with content
- Optimistic concurrency: sends `If-Match` with stored content hash
- Conflict detection: if server returns 409, show merge dialog

**Inline Validation:**
- On every edit (debounced 500ms): parse YAML locally
- Show parse errors as red squiggly underlines
- After save: server runs full engine validation
- Display validation errors/warnings in a problems panel below the editor
- Click error → jump to line in editor

**Auto-save:**
- Debounced auto-save (3s after last edit)
- Save indicator: "Saving...", "Saved", "Unsaved changes"
- Can be disabled in preferences

### Patterns

- Editor is a controlled React component
- Document content is local state until saved (not in Zustand)
- Content hash tracking for conflict detection
- Validation results stored per-document

### Acceptance Criteria

- Editor renders YAML with syntax highlighting
- All project documents are navigable in the sidebar tree
- Editing triggers local YAML parse validation
- Save persists to API with concurrency check
- Conflict on save shows appropriate error
- Validation errors display in problems panel with clickable locations
- Auto-save works with debouncing

---

## Task 19: Implement live preview using client-side renderer library

### Requirements

**Preview Pane:**
- Split-pane layout: editor on left, preview on right
- Preview renders the wireframe HTML output in an iframe
- Uses the client-side renderer library from [renderer-library.md](renderer-library.md):

```typescript
import { renderPage } from '@wireframes/renderer'

// Collect all project YAML files
const yamlFiles = buildYamlFilesMap(projectDocuments)

// Render the active page
const html = renderPage(yamlFiles, activePageId, { mode: 'card' })

// Write to iframe
iframeRef.contentDocument.write(html)
```

**Live Update:**
- On every YAML edit (debounced 300ms): re-render the preview
- Only re-render the active page (not the whole project)
- If YAML is malformed: show error overlay in preview pane instead of broken HTML
- If validation errors: show warning banner but still render (best-effort)

**Device Preview:**
- Device selector: Web (1280px), Tablet Portrait (820px), Tablet Landscape (1180px), Mobile Portrait (390px), Mobile Landscape (844px)
- Preview iframe resizes to match selected device viewport
- Device frame chrome around the iframe (decorative only)
- Viewport dimensions from [rendering.md](../docs/cli/rendering.md) § 3

**Page Navigation:**
- Page selector dropdown showing all pages in the project
- Changing page re-renders the preview
- Clicking navigation links in the preview also changes the active page
- Breadcrumb showing: template → page → current route

**Rendering Mode Toggle:**
- Toggle between Line and Card mode
- Overrides the page's `renderMode` setting for preview purposes
- Persisted in user preferences

### Patterns

- Iframe sandbox for preview isolation
- Preview renders client-side only — no API call for rendering
- Debounced re-render on edit for performance
- Error boundaries around the renderer (catch render failures gracefully)

### Acceptance Criteria

- Preview shows the rendered wireframe for the active page
- Editing YAML updates the preview in real-time (< 500ms delay)
- Device selector changes viewport dimensions correctly
- Page navigation works (both selector and in-preview clicks)
- Mode toggle switches between line and card rendering
- Malformed YAML shows error overlay instead of broken preview
- Preview is isolated in iframe (no CSS/JS leakage)

---

## Task 20: Build embeddable workspace component

### Requirements

**Workspace Component** (from [architecture.md](../docs/architecture.md) § Workspace Component):

The editor workspace (preview pane, navigation, tree, device controls) must be a self-contained, embeddable component. It will be reused in other projects and controlled externally — including from other systems, websites, or AI chat sessions via tool calls.

**Component API:**

```typescript
interface WorkspaceProps {
  // Data source
  yamlFiles: Record<string, string>  // all YAML files
  assets?: Record<string, string>     // asset URL map

  // State control (controlled component)
  activePage: string                   // current page ID
  onPageChange: (pageId: string) => void
  device: DeviceType                   // web | mobile_portrait | etc.
  onDeviceChange: (device: DeviceType) => void
  renderMode: 'line' | 'card'
  onRenderModeChange: (mode: 'line' | 'card') => void

  // Optional features
  showNavigation?: boolean             // page nav sidebar
  showDeviceControls?: boolean         // device selector bar
  showTree?: boolean                   // node tree panel
  interactive?: boolean                // enable interactions in preview

  // Callbacks
  onNodeSelect?: (address: string) => void  // node clicked in preview
  onNavigate?: (routeId: string) => void    // navigation interaction in preview
}

function Workspace(props: WorkspaceProps): JSX.Element
```

**Sub-components:**

1. **Preview Renderer** — iframe-based wireframe rendering (reuses task 19 logic)
2. **Page Navigation** — sidebar list of all pages, grouped by platform
3. **Device Controls** — toolbar with device selector, mode toggle, zoom controls
4. **Node Tree** — hierarchical tree of the resolved node tree for the active page
   - Shows node ID, component type, layout type
   - Click node → highlight in preview (scroll into view, add selection outline)
   - Collapse/expand nodes
5. **Sitemap View** — visual sitemap showing all routes and their connections
   - Nodes = pages, edges = navigation interactions between pages
   - Click page → navigate to it

**External Control Interface:**

For embedding in other systems, the workspace exposes imperative methods:

```typescript
interface WorkspaceRef {
  navigateTo(pageId: string): void
  setDevice(device: DeviceType): void
  setMode(mode: 'line' | 'card'): void
  highlightNode(address: string): void
  getRenderedHtml(): string
  refresh(): void
}
```

### Patterns

- Pure component — no direct API calls (data provided via props)
- All state is controlled (parent manages active page, device, mode)
- Embeddable: no global styles, no side effects, no routing assumptions
- Uses `forwardRef` + `useImperativeHandle` for the ref API
- Each sub-component is independently usable

### Acceptance Criteria

- Workspace renders preview + navigation + controls as a single component
- Active page, device, and mode are controlled via props
- Changing props updates the workspace immediately
- Node tree shows resolved hierarchy for active page
- Clicking nodes in tree highlights them in preview
- Workspace ref methods work for external control
- Component can be rendered outside the admin app (standalone)
- No global CSS leakage
