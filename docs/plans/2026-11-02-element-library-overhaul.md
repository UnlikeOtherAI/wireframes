# Wireframe Engine Overhaul — Element Library, Frame Rules, Proportions, Agent Authoring, Browser Runtime

Design document. Status: **designed, not implemented**. Supersedes the open items in `docs/plans/2026-07-05-wireframe-rendering-quality.md` (most of which is implemented as the WIP carried in on this branch — the plan below treats that working tree, not the previous `main`, as the baseline).

## 1. Problem Statement

- The engine has 19 primitives (`engine/schema/primitives.js`). Everything else must be hand-built from `section` + children. Agents therefore write 5-10 nodes for what should be one line (a stat tile, a nav item with icon, a breadcrumb), and the output is visually thin.
- `section` is simultaneously "card", "row that aligns things", "stack that spaces things", and "semantic group". The renderer cannot tell these apart, so the box/no-box decision is a positional heuristic (`shouldRenderSurface` at `engine/renderer/primitives.js:77`) that is wrong for toolbars at depth 0 (framed) and for cards in rows (unframed, requires `surface: true` by hand). The decision is not inspectable and is duplicated in lint.
- Stroke/separator resolution lives in CSS adjacency selectors (`engine/renderer/styles/components.js:76-79`), which breaks as soon as siblings are a mix of surfaces and groups (the two failing tests in `cli/test/showcase-layouts.test.js:252-253`).
- Proportions: template region `size` is never rendered (`engine/screenshots/renderer.js:96` passes `{}`), region roots have no `flex-shrink:0` unless sticky (`engine/renderer/styles/base.js:24-28`), and there are no role-based defaults, so sidebars collapse to content width.
- Agent authoring surface is wide and leaky: four separate sources describe primitives (schema `PrimitiveProps_*`, `lint/rules/primitive-props.js` `PROP_CONTRACTS`, `node-primitives.js` renderers, `schema/llm-reference.js` prose); diagnostics have no address or fix; `wf node` requires one process per edit; nothing reports what the renderer *decided*.
- The browser renderer (`renderer/`) exists and works, but cannot validate, cannot resolve component `imports`, navigates via `window.location.href`, and has no single-file container format.

## 2. Current Behavior (file references)

### 2.1 Rendering pipeline
- `engine/build/index.js:resolvePageTree` -> `engine/resolver/index.js:resolveTemplatePage` -> roots (regions + overlays) -> `engine/screenshots/renderer.js:renderWireframeMarkup` -> `renderPageShell` -> `renderRoot` -> `engine/renderer/primitives.js:renderNode` -> `engine/renderer/node-primitives.js:PRIMITIVE_RENDERERS[name]` (plus `table-renderer.js`, `chart-renderer.js`, `overlay-renderer.js`).
- CSS: `engine/renderer/styles/{base,components}.js` concatenated by `styles/index.js`; per-node overrides in `engine/renderer/wireframe-styles.js`.
- Runtime: `engine/renderer/interactions.js` builds a JS string IIFE; `wfNavigate` posts `wf:navigate` to `window.parent` when iframed, else sets `window.location.href`.

### 2.2 Frame decision today
- `shouldRenderSurface(node, primitiveName, options)` (`primitives.js:77-88`): only `section`/`table` are conditional; rule is `surface:true|false` else `surfaceDepth==0 || parentLayoutIsGrid`.
- `countsAsSurfaceForDepth` (`primitives.js:90`): tab bars don't increment depth; panes do.
- `buildNodeClasses` (`render-attrs.js:61`) emits `wf-surface` / `wf-group`; `tab_bar`/`bottom_tab_bar` are unconditionally `wf-surface`.
- `renderRoot` (`screenshots/renderer.js:77-79`): persistent regions are surfaces (`surfaceDepth: 1`), slots are not.
- Lint re-implements the rule in `engine/lint/rules/primitive-props.js:52-57` (`rendersAsSurface`) — a second source of truth.
- `node.role` is a free string; it only emits `wf-role-<x>` class and `data-wf-role` (`render-attrs.js:55,115`), no CSS uses it.

### 2.3 Sizing today
- `layoutToCss(layout, size, opts)` (`engine/renderer/layout.js:64`) maps `size` -> width/height/min/max. It is called with `{}` for region roots (`screenshots/renderer.js:96`) and for section outer wrappers it is called with `c.size` (`node-primitives.js:251`) — nodes are fine, regions are not.
- Panes: `paneMetaToStyle` (`render-utils.js:271`) sets `flex:0 0 auto` + width; this is the only place a fixed-width panel is protected from shrinking.
- Viewports: `engine/build/index.js:resolveViewport` presets (web 1280x900, mobile 390x844, tablet 820x1180/1180x820).
- Density: `DENSITY_FACTORS` in `layout.js:5` multiplies gap/padding by 0.65.
- `rendering-modes.md 2.1` specifies snapping gap/padding to tokens; the implementation does not snap. Decision below: drop the clause, keep raw px.

### 2.4 Schema and discovery
- `engine/schema/schema.json`: `Node` with `if/then` per primitive -> `PrimitiveProps_*`; `Layout`, `Size`, `Pane`, `Overlay`, `Viewport`, `PageRendering`; `TemplatesDocument.regions[]` has `size` and `pane` but no `role`/`surface`; `specVersion` is `const "1.1"` in every document def.
- `engine/schema/validator.js` is a hand-written JSON-Schema subset supporting `$ref/allOf/oneOf/anyOf/if/then` and loads the schema with `require('./schema.json')` (bundle-safe). `schema/reference.js`, `schema/doc-printer.js`, `schema/llm-reference.js` read it with `fs` (not bundle-safe).
- `cli/test/engine-boundary.test.js` asserts a fixed list of "core" modules have no `node:fs`/`node:path`.
- Filesystem-bound engine modules: `lint/index.js`, `doctor/*`, `tree.js`, `screenshots/index.js`, `component-registry/index.js`, `addressing/fs-resolver.js`, `node/index.js`, `serve/*`, `build/fs-writer.js`. Pure: `resolver`, `renderer/*`, `build/index.js`, `routes`, `addressing/index.js`, `validate/index.js:validateProject(documentMap)` (schema-level only; semantic checks live in `doctor/semantic-validator.js`, 705 lines — already over the 500-line cap).

### 2.5 Existing browser package
- `renderer/src/index.ts` exports `renderProject`, `renderPage`, `parseProject`, `buildRuntimeJs*`; `document-map.ts` keys documents by `documentType` only (one `components` doc, no `imports`); `build.mjs` is esbuild ESM-only, `bundle/wireframe-renderer.min.js` 138544 B (39601 B gzip). Consumers: `admin/src/features/editor/usePreviewRenderer.ts:159`, `admin/src/features/workspace/WorkspacePreview.tsx:86`, typed via `admin/src/renderer.d.ts`. API uses the CJS engine directly (`api/src/services/engine.ts`).

### 2.6 Project corpus facts (drives back-compat)
- `admin_wireframes` 15 pages, `web_wireframes` 2, `wireframe_studio` 4. Component usage is dominated by `section` (~300), `button` (~150), `text`, `heading`, `icon`. Zero `use:` references; all three `components.yaml` are empty. Two `surface:` overrides total. No `role:` anywhere. Fixed widths in use: 420/480/560 (modals), 220/280 (panels), 200.
- Overlays in use: 10 `modal`, 1 `drawer_left`, 1 `drawer_right`.
- `docs/design-system.md` is the **admin UI** palette (orange brand); it is not a renderer input and must not leak into the wireframe styles.

## 3. Desired Behavior

1. An agent can express every element in the catalogue (4.1) as one node, usually one line in shorthand, with sensible defaults and no layout hacks.
2. Output is unmistakably a wireframe in both modes: greyscale, placeholder affordances (skeleton bars, hatched media, greeked charts), system font, no brand color; the only accent is the blue selection outline.
3. The frame decision is deterministic, semantic, explainable (`wf why`, `data-wf-frame`), unit-tested as a pure function, and shared by renderer and lint.
4. Regions and roles have built-in proportions that look right on web/tablet/mobile; authors override with `size` or a flat `manifest.sizing` map and nothing else.
5. Everything an agent needs fits in one `wf llm` cheat sheet generated from one registry; every diagnostic says where and how to fix; batch edits are one command; the agent can read back what was built and why it rendered as it did.
6. The same engine code renders in the browser from a single `.wf` file with no server, including interactions, and is embeddable in Nessie through a small typed API.
7. Existing projects keep rendering; behavior changes to `section` are documented with a lint-guided migration and the three repo projects are rebuilt and reviewed.

## 4. Design

### 4.1 Element catalogue and the primitive/composed split

**Rule for the split.** A *primitive* is any element that owns its own box geometry or DOM pattern (a frame, a control, a row/cell structure, an SVG) and could not be assembled from other primitives without layout hacks. A *`std` component* is any screen-level pattern that is purely an arrangement of primitives and that authors will want to open up and edit. Element-level composites (a stat tile as `use: std.stat`) are rejected: they cost an agent more tokens than a primitive, cannot own frame/sizing decisions, and the `use:` path is unexercised by every project in the repo.

Cost of a primitive is bounded: ~10-30 lines of renderer in its family file, ~5-15 lines of family CSS, one registry descriptor (which generates its schema props def, lint contract, and cheat-sheet line). Fifty primitives are cheaper to maintain than the sprawl of ad-hoc section trees they replace.

Frame column legend: **S** = always surface (framed container), **C** = conditional (frame rules decide), **N** = never a container frame (may draw its own control/edge chrome), **E** = edge-only (draws one divider edge, never a box).

#### Family: text & content (`engine/renderer/primitives/text.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `heading` | primitive (existing) | N | `text`, `level 1-6`, `label` alias | unchanged |
| `paragraph` | primitive (existing) | N | `text`, `lines` (skeleton line count when no text) | `lines` new |
| `text` | primitive (existing) | N | `text`, `variant: body\|meta\|label\|caption\|mono` | add `label`,`caption`,`mono` variants |
| `code` | primitive (new) | S (own mono box) | `text`, `language`, `inline: bool` | inline -> `N` |
| `badge` | primitive (new) | N | `text`, `variant: neutral\|outline\|dot\|pill`, `icon` | covers badge/pill/chip/tag/status dot (`variant: dot` = dot + text) |
| `avatar` | primitive (new) | N | `name` (initials), `src`, `size: xs\|sm\|md\|lg\|xl`, `shape`, `group: [names]`, `overflow: n` | `group` renders stacked avatars with +n |
| `icon` | primitive (existing) | N | `name`, `style`, `size` | FA optional: without FA CSS renders a labelled glyph box |
| `image` | primitive (existing, extended) | N (own media frame) | `src`, `alt`, `kind: image\|video\|map\|embed\|logo`, `ratio: 16:9\|4:3\|1:1`, `width`, `height` | kind picks placeholder glyph (play, pin, globe); `ratio` replaces guessed min-height |
| `rating` | primitive (new) | N | `value 0-5`, `max`, `count` | stars as outline glyphs |
| `stat` | primitive (new) | C | `label`, `value`, `delta`, `trend: up\|down\|flat`, `icon`, `sparkline: bool` | KPI tile; conditional so it is a card at top level and flat inside a card |
| `progress` | primitive (new) | N | `value 0-100`, `kind: bar\|circle\|spinner`, `label`, `indeterminate` | replaces separate spinner |
| `skeleton` | primitive (new) | N | `lines`, `avatar: bool`, `width` | explicit loading block |
| `divider` | primitive (existing) | E | `label` (text in the middle), `orientation` | |
| `spacer` | primitive (existing) | N | `size` | unchanged |
| `empty_state` | primitive (new) | C | `icon`, `title`, `text`, `action` (button label), `variant: empty\|error\|404\|offline` | fixed centered pattern; `variant` picks default glyph+copy |

#### Family: controls (`engine/renderer/primitives/controls.js`, `controls-choice.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `button` | existing, extended | N | `label`, `icon`, `variant: primary\|secondary\|ghost\|danger\|link`, `size: sm\|md\|lg`, `iconOnly`, `loading`, `disabled`, `fab` | `fab` = floating circular; `link` variant for inline links |
| `segmented` | new | N (own edge frame) | `options[]`, `value` | segmented control / attached button group |
| `input` | existing, extended | N (own control frame) | `label`, `placeholder`, `inputType: text\|email\|password\|number\|search\|tel\|url\|date\|time\|datetime\|color\|range\|otp`, `prefix`, `suffix`, `help`, `error`, `required`, `disabled`, `value` | `search` leading glyph; `date/time` trailing glyph; `range` slider; `otp` renders `length` boxes; `color` swatch |
| `textarea` | existing, extended | N | + `help`, `error`, `required`, `maxLength` | |
| `select` | existing, extended | N | + `searchable: bool` (combobox/autocomplete), `multiple`, `help`, `error` | |
| `checkbox`, `radio`, `toggle` | existing, extended | N | `label`, `checked`, `description`, `disabled` | |
| `choice_group` | new | N | `kind: checkbox\|radio`, `label`, `options[]`, `inline: bool` | radio/checkbox groups in one node |
| `tags_input` | new | N | `label`, `tags[]`, `placeholder` | chips inside an input frame |
| `upload` | new | S (dropzone box) | `label`, `hint`, `files[]`, `variant: dropzone\|button` | `button` variant -> N |
| `editor` | new | S | `label`, `toolbar: bool`, `rows` | rich-text placeholder with toolbar strip |

#### Family: navigation (`engine/renderer/primitives/navigation.js`, `navigation-bars.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `tab_bar` | existing, extended | E (bottom edge) | `tabs[]` (`{label, icon, route, active}`) **or** children buttons, `variant: underline\|pill\|enclosed` | `tabs[]` makes it one-line; children kept for back-compat |
| `bottom_tab_bar` | existing, extended | E (top edge) | `tabs[]` or children | mobile only; role `tabbar` sizing |
| `breadcrumb` | new | N | `items[]` (`{label, route}`) | |
| `pagination` | new | N | `page`, `pages`, `variant: numbers\|simple\|dots` | `dots` = carousel/onboarding dots |
| `stepper` | new | N | `steps[]`, `current`, `orientation` | wizard progress |
| `nav` | new | N | `items[]` (`{label, icon, route, active, badge, children[]}`), `collapsed: bool`, `groups: bool` | vertical side navigation; collapsed -> icon rail |
| `menu` | new | N | `items[]` (`{label, icon, shortcut, danger, divider: true}`) | content for dropdown/context overlays; the overlay owns the frame |
| `app_bar` | new | E | `title`, `leading` (icon/back), `actions[]`, `subtitle` | mobile top chrome, fixed 56px |
| `page_header` | new | N | `title`, `subtitle`, `breadcrumb[]`, `actions[]`, `tabs[]` | web page title block |

#### Family: data (`engine/renderer/primitives/table.js`, `list.js`, `data-structures.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `table` | existing, extended | C | `columns[]` (+`sortable`, `align`, `kind: text\|badge\|avatar\|actions\|check`), `rows[]`/binding, `selectable`, `state: default\|loading\|empty`, `emptyText`, `dense`, `pagination: bool`, `caption` | `loading` renders skeleton rows; `selectable` adds check column; `actions` kind renders icon buttons |
| `list` | new | C | `items[]` (`{title, text, icon, avatar, meta, badge, actions[], route}`), `kind: plain\|avatar\|action\|file\|chat\|timeline`, `divided: bool`, `selectable` | one node covers simple/avatars/actions/attachment rows/chat threads/timelines |
| `chart` | existing, extended | C | `chartType: bar\|vertical\|horizontal\|line\|area\|pie\|donut\|gauge\|sparkline\|heatmap`, `title`, `legend: bool`, `axes: bool`, `series: n`, `height` | deterministic greeked SVG; `sparkline` is 32px no-axes |
| `calendar` | new | S | `view: month\|week\|day\|picker`, `date`, `events[]` | date picker = `picker` view inside a popover overlay |
| `kanban` | new | N (columns are S) | `columns[]` (`{title, count, cards[]}`) | columns render as surfaces, board is a row |
| `tree` | new | C | `items[]` nested, `expanded` | file/tree views |
| `accordion` | new | C | `items[]` (`{title, text, open}`) | |

#### Family: feedback (`engine/renderer/primitives/feedback.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `alert` | new | S | `text`, `title`, `variant: info\|success\|warning\|error\|neutral`, `icon`, `dismissible`, `inline: bool` | banner / inline alert; greyscale variants differ by left-edge weight and glyph, not color |
| toast / tooltip / popover / modal / sheet / drawer | overlay types (existing) | S | existing + `title`, `actions[]` on overlay def | `size` already supported; add `title`/`actions` sugar so a confirm dialog is 4 lines |

#### Family: containers (`engine/renderer/primitives/containers.js`)

| Element | Kind | Frame | Key props | Notes |
|---|---|---|---|---|
| `section` | existing | **C** | `title`, `description`, `actions[]` | "engine decides"; kept for back-compat; lint nudges to the explicit three below |
| `card` | new | **S** | `title`, `description`, `actions[]`, `media` (image src), `footer: bool` | always framed, even nested |
| `stack` | new | **N** | layout sugar: `gap`, `padding`, `align` | = `section` + `layout.type: stack` + never framed |
| `row` | new | **N** | `gap`, `align`, `justify`, `wrap` | |
| `grid` | new | **N** | `columns`, `gap`, `minItemWidth` (auto-fit) | children become tiles (see rule 7) |
| `split` | new | N (panes are S) | `panes[]` via children with `pane` | wraps the existing pane system in one node |
| `carousel` | new | C | `items[]` or children, `dots`, `arrows` | |
| `form` | new | N | `title`, `submit` (label) | groups fields, auto `formId` target for submit interactions |

#### `std` component library (engine-shipped, `engine/stdlib/*.yaml`, auto-imported under reserved alias `std`)

`std.login`, `std.signup`, `std.forgot_password`, `std.hero`, `std.cta_band`, `std.feature_grid`, `std.pricing_table`, `std.testimonials`, `std.site_footer`, `std.settings_page`, `std.onboarding_step`, `std.not_found`, `std.search_bar`. Each has `propDefaults` and `propHints`. `wf node add std.login --inside <addr> --expand` inlines the expansion into the page so the author can edit it; without `--expand` it stays a `use:` reference. Documented in `docs/cli/stdlib.md` (new) and listed by `wf llm`.

Deliberately **not** primitives: mobile pull-to-refresh (`list.refreshable: true`), sticky footer (region `sticky: bottom`, exists), resizable panels (`split` over existing panes), 404/error/empty screens (`empty_state.variant` + `std.not_found`), search with filters (`std.search_bar`), context menu (overlay `menu` type + `menu` primitive).

### 4.2 Frame rules (box vs no-box)

New module `engine/renderer/frame-rules.js` exporting one function:

```js
decideFrame(node, ctx) -> { frame: 'surface'|'group'|'control'|'content'|'edge', reason: string, rule: number }
// ctx: { element, elementFrameClass, isRegionRoot, regionKind, role, surfaceDepth,
//        parentLayoutType, parentFrame, mode, hasPane, isOverlayRoot }
```

Only `surface` draws a container frame. `control`/`content`/`edge` are element-owned chrome that never changes with nesting.

**Precedence (first match wins; every branch names its reason):**

1. `node.surface === true` -> surface (`explicit:true`); `=== false` -> group (`explicit:false`).
2. `node.wireframeStyle.border` present -> surface (`explicit:style`). An author who drew a border wants a box.
3. Element class from the registry: `S` -> surface (`element:<name>`); `N` -> group/control/content per registry; `E` -> edge. Only `C` elements continue.
4. Overlay content root -> surface (`overlay-root`). Overlay roots reset `surfaceDepth` to 0 for their children.
5. Region roots: `kind: slot` -> group (`region:slot`); `kind: persistent` with role in {header, sidebar, nav, footer, toolbar, tabbar} or no role -> surface (`region:<role|persistent>`); `region.surface` explicit (new region field) handled by rule 1.
6. `hasPane` -> surface (`pane`).
7. Parent is `grid` (primitive `grid` or `layout.type: grid`) -> surface (`grid-tile`). Tiles are tiles.
8. `surfaceDepth > 0` -> group (`nested`). Inside a framed container nothing auto-frames; use `card` to be explicit.
9. At `surfaceDepth == 0` (grey page / slot root):
   - `section` with `layout.type: row` and no `props.title` -> group (`row-group`: rows align, they don't contain);
   - `section` with `role: toolbar` -> group (`role:toolbar`);
   - otherwise -> surface (`top-level`).
   For `table`, `list`, `chart`, `stat`, `tree`, `accordion`, `carousel`, `empty_state` at depth 0 -> surface (`top-level`); inside a surface they are `group` with their own internal strokes — they never double-frame.

Depth accounting: `surfaceDepth` increments only when the decision is `surface`, never for `edge`/`control`. Collection clones inherit ctx. `tab_bar` children get the same depth (bars are edges).

**Mode mapping.** `surface` -> line: hairline outline, transparent; card: white, grey-200 border, shadow token. `group` -> nothing, keeps layout/padding/gap. `edge` -> one divider edge in both modes. `control` -> the control's own frame. CSS keys on `[data-wf-frame="surface"]` and `[data-wf-frame="edge"]`, replacing `.wf-surface`/`.wf-group` (keep the classes for one release for tests/admin CSS; remove in the following release).

**Strokes.** Delete the `.wf-divide-x>.wf-surface+.wf-surface` family of CSS. The renderer marks each child of a `gap:0 && separators` container with `data-wf-edge="after"` except the last, and children that are `surface` under such a parent are rendered as `group` with reason `divided-child` (the parent divider replaces their frame). This is the fix for `showcase-layouts.test.js:252`; the test then asserts on `data-wf-edge` instead of computed border style.

**Explainability.** Always emit `data-wf-frame`. With `rendering.explain: true` (page) or `wf build --explain` / `renderPage(..., {explain:true})`, also emit `data-wf-why="<rule>:<reason>"` and `data-wf-size="<token>=<px>"`. New CLI `wf why <wf://address>` prints: element, frame + rule + reason, surfaceDepth, parent frame, resolved size tokens, and the one-line fix to flip the decision. `wf inspect` gains `frame` and `sizing` keys; `--json` on both.

**Testability.** `decideFrame` is pure; `cli/test/frame-rules.test.js` is a table of (fixture ctx -> expected frame/reason) with one row per rule and per `C` element, plus the three regressions above (toolbar row at depth 0, card-in-row, divided siblings). Lint imports `decideFrame`; `engine/lint/rules/primitive-props.js:rendersAsSurface` is deleted.

**Why this beats the prior rule.** The prior rule asked "where are you?"; this asks "what are you?" first and only falls back to position for the one ambiguous element. Agents are told: `card`/`row`/`stack` are explicit, `section` is "decide for me". Existing YAML keeps working because `section` behavior at depth 0 changes only for untitled rows (toolbars), which is the case the prior design got visibly wrong.

### 4.3 Proportions: roles and sizing tokens

**Role enum** (new `$defs.Role`; free strings still accepted, lint info `UNKNOWN_ROLE`): `header`, `app_bar`, `sidebar`, `nav`, `main`, `aside`, `footer`, `toolbar`, `tabbar`, `form`, `dialog`, `sheet`, `drawer`, `content`. Roles are valid on template regions (new field) and nodes (existing). The template region shorthand `role: sidebar` replaces `size.width: 220` + `pane` for the common case.

**Token table** (`engine/renderer/sizing-tokens.js`, one export `resolveSizing(role, element, viewport, manifestSizing, density)`), values per device class web / tablet / mobile:

| Token | web | tablet | mobile | Applies to |
|---|---|---|---|---|
| `sidebar.width` | 256 | 220 | 280 (as drawer) | role sidebar/nav region; collapsed `64` |
| `aside.width` | 320 | 280 | — | role aside |
| `header.height` | 56 | 56 | 56 (app_bar) | role header / `app_bar` |
| `tabbar.height` | 48 | 48 | 56 | `tab_bar`, `bottom_tab_bar` |
| `footer.minHeight` | 64 | 64 | 56 | role footer |
| `page.gutter` | 24 | 20 | 16 | slot root padding when template sets none |
| `content.maxWidth` | none / `narrow: 720` / `reading: 65ch` | | | slot `width: narrow` |
| `card.padding` | 16 (compact 12) | | | surface padding default |
| `card.gap` / `grid.gap` | 16 | 16 | 12 | default gap for `grid`/`stack` of cards |
| `control.height` | 36 (sm 32, lg 44) | | 44 (touch) | inputs/buttons/select |
| `row.height` | 44 (dense 36) | | 48 | table/list rows |
| `modal.width` | sm 400 / md 560 / lg 800 | | 100%-32 | overlay `size` default |
| `drawer.width` | 360 | 320 | 85% | drawer overlays |
| `sheet.maxHeight` | — | — | 70% | bottom_sheet |
| `avatar` | xs 20 / sm 28 / md 36 / lg 48 / xl 64 | | | |
| `chart.height` | 160 (sparkline 32) | | 140 | |
| `stat.minHeight` | 96 | | 88 | |
| `icon` | xs 12 / sm 14 / md 16 / lg 20 / xl 24 | | | replaces raw FA size classes |

**Override levels — exactly three:**
1. `manifest.sizing: { sidebar.width: 280, header.height: 64 }` — flat map, token name -> px, validated against the token list. Project-wide.
2. `size` on the region/node (existing schema) — wins over tokens; plus `pane.defaultSize` for panes.
3. `rendering.density: compact` — scales spacing tokens only (existing factor), never structural widths.

Rejected: theme documents, per-page sizing, CSS custom property overrides in YAML.

**Fixes that fall out:** `renderRoot` applies `root.size` and token width for roled regions and emits `flex:0 0 auto` for any region with a resolved width (and `min-width` = token min); slot roots keep `flex:1;min-width:0`. `wf why` prints `sidebar.width=256 (token; override with size.width or manifest.sizing.sidebar.width)`.

### 4.4 Rendering modes and wireframe look

Keep `line` and `card`; no third mode. Wireframe-ness comes from greyscale, placeholder affordances and system type, not from mode count; a hand-drawn "sketch" mode would need fonts/filters and break determinism across platforms. Changes:
- Every new element gets both-mode rules in its family CSS file; line = outline/hairline/transparent; card = white surfaces + grey-100 chrome.
- Placeholder vocabulary standardised: skeleton bars for missing text, hatched box + glyph for media, greeked SVG for charts, initials circle for avatars, `#` for missing numbers in `stat`.
- Selection outline stays the only accent. `alert`/`badge` variants are encoded by glyph and stroke weight, never hue.
- `rendering-modes.md 2.1` "snap to tokens" is removed (never implemented; snapping fights author px and determinism of existing output). Section 6 component table is regenerated from the registry.
- `wireframe-rendering-research.md` and `rendering-wireframes-from-yaml-in-two-modes.md` are research, moved under `docs/cli/research/` to stop agents treating them as spec.

### 4.5 Primitive registry (single source for schema, lint, renderer, cheat sheet)

`engine/schema/primitive-registry/<family>.js` each exporting one array of descriptors:

```js
{ name: 'stat', family: 'content', frame: 'C',
  props: { label: {type:'string', primary:true}, value: {type:'string'}, delta: {type:'string'},
           trend: {enum:['up','down','flat']}, icon: {type:'string'}, sparkline: {type:'boolean'} },
  required: [], aliases: { kpi: 'stat', metric: 'stat' }, sizing: ['stat.minHeight'],
  example: '- stat: { label: Revenue, value: $12.4k, delta: +8%, trend: up }',
  summary: 'KPI tile with label, value and optional delta/sparkline.' }
```

`engine/schema/primitives.js` becomes a derived `PRIMITIVE_COMPONENTS` set from the registry (same export name). `schema.json` stays authoritative and hand-maintained per AGENTS.md, but `cli/test/schema-registry-drift.test.js` fails if `PrimitiveProps_<name>` properties/enums differ from the registry or if `PrimitiveComponent.enum` differs. Lint `PROP_CONTRACTS` is derived from the registry. `llm-reference.js` renders the quick reference and alias table from it. Renderer dispatch (`PRIMITIVE_RENDERERS`) is assembled from family files and the registry asserts every name has a renderer.

### 4.6 Agent-first authoring

**4.6.1 Shorthand YAML (normalized, not a DSL).** New `engine/schema/normalize.js` (`normalizeNode(node, ctx)`) runs before validation in loader, resolver entry, node commands and the browser parser. Canonical form stays what it is today; shorthand expands to it:

```yaml
# shorthand                                  # canonical
- button: Save                             -> { id: button_save, component: button, props: { label: Save } }
- heading: { text: Dashboard, level: 2 }   -> { id: heading_dashboard, component: heading, props: {...} }
- row:                                     -> { id: row_1, component: row, children: [...] }
    - input: Email
    - button: { label: Go, variant: primary }
- card: { title: Billing, children: [...] }
- std.login: { title: Welcome back }       -> { id: std_login_1, use: std.login, props: {...} }
```

Rules: a node that is a single-key map whose key is a registry name/alias or `std.*` is shorthand; a scalar value maps to the registry's `primary` prop; a map value is `props` except for reserved node keys (`id`, `layout`, `size`, `role`, `surface`, `children`, `interaction`, `visibility`, `binding`, `gridItem`, `pane`, `wireframeStyle`, `elevation`, `position`, `selection`, `stateBindings`, `accessibility`), which lift to the node. `id` becomes optional everywhere: missing ids are generated deterministically as `<component>_<slug-of-primary-prop or ordinal>` with `_2`, `_3` dedupe within the resolved tree; `wf fmt --ids` materializes them into the file for stable addressing. Addressing, lint and `wf node` operate on canonical ids only. A separate text DSL is rejected: two grammars, no editor tooling, and YAML shorthand already removes ~60% of tokens.

**4.6.2 Diagnostics contract.** Every error/warning/info from validate/doctor/lint becomes `{ severity, code, message, address?, path?, fix?: { description, yaml?|command? } }`. `wf validate --json` is the stable machine shape; text output prints `address` and `fix`. Unknown component -> did-you-mean via alias table + Levenshtein over registry names. Unknown prop -> nearest known prop. Missing required prop -> the exact YAML line to add. Schema errors carry the JSON pointer and the node id chain.

**4.6.3 Lint rules for agent mistakes** (new, in `engine/lint/rules/`): `SECTION_INTENT`, `REDUNDANT_SURFACE`, `DEEP_NESTING` (>6 container levels), `EMPTY_CONTAINER`, `ORPHAN_LAYOUT`, `MISSING_ACTIVE_TAB`, `BUTTON_WITHOUT_INTERACTION` (info, primary buttons only), `UNDERSIZED_REGION`, `UNKNOWN_ROLE`, `LITERAL_ID_IN_SHORTHAND`.

**4.6.4 Commands.**
- `wf apply <ops.json|->` — batch of `{op: add|set|remove|move, address, component?, props?, position?}` applied atomically in memory, validated once, written once; `--dry-run` prints the diff. Idempotent: `set` is an upsert by address, `add --if-missing`.
- `wf node move <address> --below|--inside <address>`, `wf node set` (upsert).
- `wf why <address>`, `wf describe <page> [--json]` (outline with element, frame, size per node), `wf llm [--short|--element <name>|--family <f>]`, `wf schema --element <name>`.
- `wf fmt [--ids] [--canonical]` — normalizes shorthand/ids in place (deterministic, no reordering).
- `wf scaffold <std.pattern> --page <id> --slot <s>`.
- `wf screenshots --page <id> --node <address>` — crop to a node for agent self-review.

**4.6.5 Cheat sheet.** `wf llm --short` must stay under ~2500 tokens: field-name gotchas, the 7 families with one example line each, the frame rule in five bullets, the role/sizing list, interaction/overlay shapes, and the commands above. Full `wf llm` is generated from the registry. Add `docs/cli/agent-guide.md` (<=300 lines), the human-readable twin, which the admin chat system prompt loads.

### 4.7 Browser library and `.wf` format (phase 2)

**Package.** Keep `renderer/` as the browser package. Builds via the existing `build.mjs`: `dist/wireframes.esm.js` (ESM), `dist/wireframes.iife.js` (`window.Wireframes`), both minified with sourcemaps in `--dev`, plus generated `dist/wireframes.d.ts` (replaces the hand-written `admin/src/renderer.d.ts`). Size budget: <=70 KB gzip after the element expansion (today 40 KB incl. js-yaml ~8 KB); hard CI fail at 90 KB. Font Awesome is not bundled; `createWireframe({ icons: 'fontawesome'|'none'|url })`, default `none` renders glyph boxes.

**Single source of truth.** No fork. The bundle imports engine CJS as today. New rule enforced by `cli/test/engine-boundary.test.js` (extend the module list to every file under `engine/renderer`, `engine/resolver`, `engine/build/index.js`, `engine/routes`, `engine/addressing/index.js`, `engine/schema/{validator,normalize,primitive-registry}`, `engine/lint/core`, `engine/doctor/core`) plus a bundle test that runs esbuild with `platform: 'browser'` and fails on any `node:*` import. Required refactors: split `doctor/index.js` and `lint/index.js` into `*/core.js` (document-map in, diagnostics out — also fixes the 705-line `semantic-validator.js`) and `*/fs.js`; `component-registry` gets `buildRegistryFromDocuments(docs)`; `schema/reference.js`, `doc-printer.js`, `llm-reference.js` switch to `require('./schema.json')`.

**Runtime.** Phase A (no runtime refactor): the library renders each page into a sandboxed `<iframe srcdoc>` with inline CSS + runtime; `wfNavigate` already posts `wf:navigate` to the parent when iframed, so the host swaps `srcdoc` on that message and keeps app state in `sessionStorage`. Phase B: refactor `interactions.js` into `createRuntime(root, ctx)` taking a root element and callbacks, so a shadow-DOM host (`mount: 'shadow'`) works without an iframe; the string-IIFE build for static `wf build` wraps the same function. Phase B is the long-term Nessie target; Phase A ships first.

**Public API** (`renderer/src/index.ts`):

```ts
parseWf(source: string | ArrayBuffer): WfProject            // .wf or legacy multi-file map
validateWf(project): Diagnostic[]                           // schema + semantic + lint core
renderPageHtml(project, pageId, opts): string               // pure, as today
createWireframe(container: HTMLElement, project, opts): Instance
// Instance: navigate(routeId), setPage(pageId), setMode('line'|'card'), setDevice(),
//           explain(nodeId): FrameDecision, getState(), setState(scope,key,value),
//           on('navigate'|'state'|'select'|'error', cb), screenshot?(), destroy()
```

**`.wf` container.** Decision: **multi-document YAML** in one file. Documents separated by `---`, first document is the manifest with an added `format: wf/1` line; order is `manifest, sitemap, templates, components*, page*, dataset*, asset*`. `js-yaml.loadAll` is already bundled; files are text, git-diffable, cat-able, and identical in content to the folder layout. Assets: `documentType: asset` with `{ id, path, mime, encoding: base64, data }`; `wf pack` warns above 2 MB total and errors above 10 MB; `src: https://...` references stay external. Component `imports` are resolved at pack time. `wf pack [--out project.wf]` / `wf unpack project.wf [--out dir]` are lossless; `wf build`, `wf serve`, `wf validate` accept a `.wf` path. Zip (`.wfz`) is deferred. Rejected: JSON (verbose, loses comments) and zip-first (binary, needs a zip lib in the browser, not diffable). `.wf` is not owned by any major program and has no IANA MIME registration; fallback is `.wfx` (same content; MIME `application/vnd.wireframes+yaml`); the parser sniffs `format: wf/1` and does not depend on the extension.

### 4.8 Where the current architecture will fight this

- **`node-primitives.js` ctx-object pattern** (`c`, `f` bags of 20 fields) will not scale to 50 elements. Each family file gets `(node, ctx, lib)` where `lib` is `engine/renderer/render-lib.js`. `renderNode` computes `shell = { open, close }` once and family renderers only return inner HTML. This halves renderer code and removes the "forgot `wf-interactive`" class of bug.
- **500-line cap:** `semantic-validator.js` (705) already violates it; `tree.js` is at 500; `llm-reference.js` (359) will exceed when the catalogue lands — registry generation fixes that.
- **`region` vs `node`:** template regions are a parallel node type with their own markup (`<section class="wf-root">`). Role/size/frame logic must run for both; the clean fix is to render region roots through `renderNode` with `kind: 'region'` (as overlays already do). Breaking for `admin` CSS that targets `.wf-root-*` — keep the classes.
- **Lint/doctor are filesystem-first.** The API already validates in memory via `validateProject(documentMap)` but gets *no* semantic checks there. Splitting core/fs is prerequisite for both the browser and for honest API validation.
- **`PrimitiveComponent.enum` is a schema `anyOf` with `Id`**, so unknown components are never schema errors; they are caught only by doctor. Keep (custom components), but the normalizer must produce `use:` for `std.*` and lint must flag `component: <unknown>` with suggestions.
- **Runtime navigation uses `window.location.href`** and the route table maps to file names; in-memory page switching needs the parent-message path (exists) and a `routeTable` that is route-id -> page-id. `buildRouteTableFromTargets` gains a `hrefMode: 'file'|'route'`.
- **`docs/design-system.md`** will be read by sub-agents and its orange palette applied to wireframes unless the docs index says otherwise. Add a banner at its top: "admin UI only".
- **Prior plan errors not to inherit:** (1) positional surface rule; (2) CSS-adjacency stroke resolution; (3) the "no new primitives" non-goal — the corpus shows authors never use composition, so composition-only growth was never going to happen; (4) it never looked at region sizing, which is the user's actual complaint; (5) `tab_bar` as an unconditional surface (it is an edge).

## 5. Implementation Order (tranches with file ownership)

Dependency order: T0 -> T1-T4 (sequential, small) -> T5-T11 (parallel) -> T12-T14 (parallel) -> T15-T17. Each tranche ends green (`pnpm test`, gallery build, Playwright baselines updated via `pnpm gallery:update` only by the owning tranche) and lands its own schema-discipline rows for the fields it introduces. T17 reconciles.

| # | Tranche | Owns (create/modify) | Depends on |
|---|---|---|---|
| T0 | **Stabilise WIP**: commit the carried-in implementation of the 2026-07-05 plan; fix the two `showcase-layouts` failures by switching the assertions to the new `data-wf-edge` contract once T2 lands (temporarily `todo`); move research docs to `docs/cli/research/`; banner on `design-system.md` | `cli/test/showcase-layouts.test.js`, `docs/cli/research/*`, `docs/design-system.md` | — |
| T1 | **Primitive registry** | `engine/schema/primitive-registry/**`, `engine/schema/primitives.js`, `engine/schema/llm-reference.js`, `engine/lint/rules/primitive-props.js` (contracts only), `cli/test/schema-registry-drift.test.js` | T0 |
| T2 | **Frame rules** | `engine/renderer/frame-rules.js`, `engine/renderer/primitives.js`, `engine/renderer/render-attrs.js`, `engine/renderer/styles/base.js`, `engine/screenshots/renderer.js` (renderRoot), `engine/introspection/inspect.js`, `engine/introspection/why.js`, `cli/commands/commands/why.js`, `cli/test/frame-rules.test.js` | T1 |
| T3 | **Sizing tokens + roles** | `engine/renderer/sizing-tokens.js`, `engine/renderer/layout.js`, `engine/screenshots/renderer.js`, `engine/schema/schema.json` (Role, manifest.sizing, region.role/surface), docs | T2 |
| T4 | **Shorthand normalizer + optional ids** | `engine/schema/normalize.js`, `engine/schema/loader.js`, `engine/schema/constants.js`, `engine/schema/schema.json` (specVersion enum, id optional), `cli/commands/commands/fmt.js`, `cli/test/normalize.test.js` | T1 |
| T5 | **Renderer shell refactor** | `engine/renderer/primitives.js`, `engine/renderer/primitives/**` (moves), `engine/renderer/styles/**`; delete `node-primitives.js`/`table-renderer.js`/`chart-renderer.js` after move | T2 |
| T6 | **Family: text & content** | `engine/renderer/primitives/text.js`, `content.js`, `styles/text.js`, `styles/content.js`, registry `text.js`, gallery `pages/*_content.yaml` | T5 |
| T7 | **Family: controls** | `engine/renderer/primitives/controls.js`, `controls-choice.js`, `styles/controls.js`, registry `controls.js`, gallery `*_forms.yaml` | T5 |
| T8 | **Family: navigation** | `engine/renderer/primitives/navigation.js`, `navigation-bars.js`, `styles/navigation.js`, registry `navigation.js`, gallery `*_navigation.yaml` | T5, T3 |
| T9 | **Family: data A** (table, list) | `engine/renderer/primitives/table.js`, `list.js`, `styles/data.js`, registry `data.js` (table/list), gallery `*_data.yaml` | T5 |
| T10 | **Family: data B** (chart, calendar, kanban, tree, accordion) | `engine/renderer/primitives/chart.js`, `data-structures.js`, `styles/charts.js`, `styles/structures.js`, registry `data.js` (remaining), gallery `*_structures.yaml` | T5 |
| T11 | **Family: containers + feedback + overlays** | `engine/renderer/primitives/containers.js`, `feedback.js`, `engine/renderer/overlay-renderer.js`, `styles/containers.js`, `styles/feedback.js`, registry `containers.js`, `feedback.js`, gallery `*_containers.yaml`, `*_overlays.yaml` | T5, T3 |
| T12 | **Diagnostics + lint rules + CLI batch** | `engine/validate/**`, `engine/doctor/**` (shape only), `engine/lint/rules/*.js`, `engine/node/**`, `cli/commands/commands/{apply,describe,scaffold,llm,node}.js`, `docs/cli/agent-guide.md`, `docs/cli/brief.md` | T1, T2, T4 |
| T13 | **std library** | `engine/stdlib/**`, `engine/component-registry/index.js` (alias injection), docs | T6-T11 |
| T14 | **Engine core/fs split** | `engine/doctor/**`, `engine/lint/**`, `engine/component-registry/**`, `engine/schema/{reference,doc-printer}.js`, `cli/test/engine-boundary.test.js`, `api/src/services/engine.ts` | T1 |
| T15 | **Browser library** | `renderer/**`, `engine/routes/index.js` (hrefMode), delete `admin/src/renderer.d.ts`, `admin/src/features/editor/usePreviewRenderer.ts` (import path only) | T14 |
| T16 | **`.wf` format** | `engine/wf-format/**`, `cli/commands/commands/{pack,unpack}.js`, `engine/build/fs-writer.js` (input detection), `renderer/src/parser.ts`, docs | T14 |
| T17 | **Migration + docs reconciliation** | `admin_wireframes/**`, `web_wireframes/**`, `wireframe_studio/**`, `docs/cli/*.md`, gallery baselines; move the 2026-07-05 docs and this one to `docs/done/` | all |

Parallelism: T6-T11 are six agents; T12-T14 three more alongside; T15-T16 two more. Family agents own exactly their primitive file(s), their CSS file, their registry file and their gallery page; they never touch `primitives.js`, `frame-rules.js`, or another family's files. Cross-family needs (e.g. `card.actions[]` rendering buttons) go through `render-lib.js` helpers owned by T5.

## 6. Edge Cases

- **Explicit `surface:` on a `card`/`row`:** rule 1 still wins, lint `REDUNDANT_SURFACE` when it matches the element default, `CONTRADICTORY_SURFACE` info when `row` + `surface: true`.
- **Card inside grid inside card:** grid tile rule (7) fires before nested rule (8) -> tiles stay cards inside a card. Intended.
- **Table inside card:** `group` with its own row strokes; `surface: true` restores a frame; in line mode the table header edge is still drawn.
- **`tab_bar` at depth 0 on a grey page (card mode):** edge-only looks floating; the renderer gives `tab_bar` a `page_header`-like white band only when its parent frame is `group` at depth 0 — reason `edge:banded`, not a CSS special case.
- **Collection clones:** ctx flows through the re-entrant `renderNode` as today; generated ids get `_<index>` suffix after shorthand ids are assigned.
- **Overlay content with a single `card` root:** overlay roots mark their first child `surface` -> `group` with reason `overlay-chrome` unless `surface: true`.
- **Pane with role:** pane sizing (`defaultSize`) wins over role token; role still drives frame and min width.
- **Explicit `size.width` below token min:** author wins; lint `UNDERSIZED_REGION` info.
- **Mobile viewport with role sidebar region:** token says drawer; renderer keeps the region in flow at 280 unless page state hides it — documented as "use a `drawer_left` overlay for mobile nav"; lint `SIDEBAR_ON_MOBILE` info.
- **Shorthand id collisions across slots/injectables:** dedupe runs over the resolved page tree, not per document; `wf fmt --ids` materializes before any `wf node` command touches generated ids.
- **`label` alias** continues on text primitives; `button.label` canonical; registry marks aliases so `UNKNOWN_PROP` never fires for them.
- **Line mode + `alert`/`badge` variants:** differentiated by stroke weight/glyph only; verified in gallery baselines for both modes.
- **Icons without Font Awesome:** `icon`/button icons render a 1em outlined square with the first letter, never an empty gap; FA presence is detected at runtime, not at render.
- **`.wf` larger than 10 MB** -> `wf pack` error listing assets by size; browser `parseWf` rejects >25 MB.
- **Legacy consumers of `.wf-surface`/`.wf-group`** (admin CSS, tests): classes emitted alongside `data-wf-frame` for one release; T17 removes them.
- **Determinism:** generated ids, skeleton widths, greeked chart data, avatar initials, sparkline paths are pure functions of input; no `Math.random`, no dates.
- **specVersion:** documents at `1.1` load unchanged; `1.2` enables optional ids/shorthand; `manifest.schemaVersion > 1.2` still aborts.

## 7. Non-Goals

- No hi-fi theming, colors, brand fonts, or a theme document type.
- No third rendering mode (sketch/hand-drawn).
- No responsive breakpoint rendering changes beyond device-class sizing tokens.
- No admin React editor UI work beyond consuming the generated `.d.ts` and the new `createWireframe` host (Nessie integration itself is out of scope here).
- No custom text DSL; shorthand is YAML only.
- No zip container in this plan (`.wfz` deferred).
- No AI/auto-fix in `wf validate`; fixes are suggestions the agent applies.
- No bulk codemod of existing projects' `section` nodes; only lint-guided, reviewed edits in T17.
