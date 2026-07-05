# Wireframe Rendering Quality Overhaul

Design document. Goal: the renderer produces **proper wireframes** — clean,
readable, greyscale product mocks — directly from page YAML, with every
primitive component rendering in a way that makes sense visually. Card mode is
the primary target (it is the default and the mode in active use); line mode is
brought along with the same component rules so it stops looking like ASCII art.

Status: **designed, not implemented**. Implementation agent: follow the
Implementation Order (Section 5) and the Schema Discipline checklist
(Section 8).

---

## 1. Problem Statement

Built wireframes do not look like wireframes. Rendering
`admin_wireframes` today produces pages where:

- Almost every heading on every page renders as the literal word **"Heading"**
  and most text/paragraph nodes render **empty**. The YAML content is simply
  not reaching the output.
- Form fields render as bare unlabeled boxes — authored field labels are
  silently discarded.
- Every `section` becomes a white bordered card, including sections used as
  pure layout wrappers (an icon+text row becomes an icon floating inside a
  white bordered box). Pages read as "boxes inside boxes inside boxes" with no
  visual hierarchy.
- The login card renders in the top-left corner of a huge empty page even
  though the template says "center it".
- Section titles (`props.title`) are never displayed at all.
- Headings have no type scale — an `h1` is a giant browser-default 32px, an
  `h4` is body-sized.
- 2 of the 3 wireframe projects in this repo (`admin_wireframes`,
  `web_wireframes`) fail `wf validate` outright because a `data/` directory is
  treated as required, so they cannot even be rebuilt.

The rendering-modes spec ([rendering-modes.md](../cli/rendering-modes.md)) is
good; the implementation diverges from it in several load-bearing places and
the schema is too loose to catch authoring mistakes.

## 2. Current Behavior

All references are to the current implementation.

### 2.1 Text content is lost (props contract mismatch)

- `engine/renderer/node-primitives.js:39` — heading reads `props.text`,
  falls back to the string `'Heading'`.
- `engine/renderer/node-primitives.js:52,62` — paragraph and text read
  `props.text`, fall back to `''`.
- The canonical contract ([schema-canonical.yaml](../cli/schema-canonical.yaml)
  §primitives) says `heading/paragraph/text` take `props.text` while `button`
  takes `props.label`.
- Actual usage in this repo: `admin_wireframes` has **195** heading/
  paragraph/text nodes using `props.label` and **0** using `props.text`;
  `web_wireframes` has 44 (`label`) / 0 (`text`); only `wireframe_studio`
  uses `props.text` (88 nodes).
- `engine/schema/schema.json` `$defs.Node.properties.props` is
  `{"type": "object"}` — completely free-form. Neither `wf validate` nor lint
  flags the mismatch. The result: pages full of "Heading" and blank strings.

### 2.2 Form field labels are dropped

- `engine/renderer/node-primitives.js:150-187` — `input`, `textarea`,
  `select` render only the control and placeholder. `props.label` (38
  occurrences in `admin_wireframes` alone) is ignored. There is no
  label element in the output at all.

### 2.3 Everything is a surface (box soup)

- `engine/renderer/render-attrs.js:75-79` — every `section` gets
  `wf-surface` unless the author writes `surface: false` (no project does).
  Authors use `section` as the only grouping construct, so icon+text rows,
  button rows, and toolbars all become white bordered cards.
- `engine/screenshots/renderer.js:98` — every template region root,
  **including the page slot**, gets `wf-surface`. The spec
  (rendering-modes.md §5.1) explicitly renders `<main class="wf-region">`
  *without* a surface. Result: the entire content area is one giant white
  card, so nested cards are white-on-white and the card-mode grey gutters
  never appear inside the main area.

### 2.4 Template layout is discarded

- `engine/build/index.js:122` and `engine/tree.js:184` — only
  `templateLayout.type` survives (mapped to `wf-body-row`/`wf-body-column`).
  `align`, `justify`, `gap`, `padding` on the template layout are dropped.
  `auth_template` declares `align: center; justify: center`
  (`admin_wireframes/templates.yaml:5-9`) — the login card should be centered
  and is not.

### 2.5 CSS diverges from the rendering spec

All in `buildWireframeStyles()` (`engine/screenshots/renderer.js:110-271` —
note this also lives in an odd home, see §4.8):

- `.wf-section-title{display:none}` (line 218) — section titles never render.
  `renderSectionTitle` (`engine/renderer/render-attrs.js:201-206`) also
  defaults the title to `'Section'` when absent, so it could not simply be
  un-hidden without spraying "Section" everywhere.
- No heading type scale exists. Spec §6.5 defines one (`.wf-heading h1 {...}`);
  the CSS contains no heading rules, so browser defaults apply (h1 = 2em
  bold — dominates every page).
- `.wf-section{padding:4px}` (line 220) — sections have a cramped 4px default
  padding; the spec's density model expects a comfortable default (16px).
- `.wf-heading,.wf-paragraph,...,.wf-text{margin:4px 0}` (line 227) — default
  margins on all content primitives fight the gap-based flex spacing model and
  produce uneven rhythm.
- Buttons: card mode renders every button as the same light-grey block. There
  is no primary/secondary distinction, so mocks have no visible call to
  action.
- Line mode buttons render as `[ Save ]` with literal bracket characters baked
  into the markup (`engine/renderer/node-primitives.js:102-104`).

### 2.6 Unresolved content has no placeholder affordance

- A binding that resolves to nothing renders as an empty string; a heading
  with no text renders as "Heading". Neither reads as "placeholder" — one is
  invisible, the other is misleading fake content.

### 2.7 Projects fail validation for a missing `data/` dir

- `engine/doctor/index.js:200` — a missing `data/` directory is an **error**,
  which makes `wf build` refuse to run. `admin_wireframes` and
  `web_wireframes` have no `data/` directory and use no dataset bindings; the
  committed build output is stale and cannot be regenerated.

## 3. Desired Behavior

A page YAML like `admin_wireframes/pages/dashboard.yaml` renders as a clean
greyscale product mock:

1. **All authored text appears.** Headings show their text at a sensible
   wireframe type scale. Text/paragraph nodes show their content in the
   correct grey.
2. **Form fields look like form fields.** Label above control, consistent
   heights, visible boundaries, placeholder text inside.
3. **Surfaces express hierarchy.** Top-level content blocks are white cards on
   the grey page. Sections nested inside a card render as plain groups —
   no border, no background — unless explicitly promoted. Slot regions are
   transparent; chrome regions (header, nav, footer) are surfaces.
4. **Templates lay out faithfully.** `align`/`justify`/`gap`/`padding` on a
   template layout apply to the page body. Centered auth pages center.
5. **Placeholders read as placeholders.** Missing text renders as a grey
   skeleton bar, never as fake words or invisible nothing.
6. **Every primitive has a deliberate rendering** in both modes, per the
   component table in §4.5.
7. **Authoring mistakes surface at validate/lint time**, not as silently
   wrong output.
8. **All three projects in the repo build** (`data/` optional) and a
   component-gallery fixture makes rendering quality verifiable in
   Playwright.

## 4. Design

### 4.1 Content contract: accept `label` as an alias for `text`

The repo evidence (239 `label` vs 88 `text` usages) shows both spellings are
natural. Fighting authors (and LLM generators) is a losing game; the renderer
becomes liberal and the canonical docs stay strict:

- Text-bearing primitives (`heading`, `paragraph`, `text`) resolve their
  content as `props.text ?? props.label` (first non-empty string wins,
  `text` is authoritative when both are set).
- `schema.json`: keep `text` as the documented canonical prop, add `label`
  as an accepted alias in the per-primitive props definitions (§4.2).
- Lint (new rule `TEXT_PROP_ALIAS`, severity `info`): notes nodes using
  `label` on text primitives so projects can converge on `text` over time.

Fallback text changes (see §4.6): when neither prop is present, render a
skeleton bar — never the strings `'Heading'` / `''`.

### 4.2 Typed per-primitive props in the schema + lint

Replace the free-form `Node.props` with a discriminated contract so mistakes
are caught:

- Add `$defs.PrimitiveProps_<name>` for each primitive with its known props
  (see the table in §4.5 for the full prop list per component).
- Wire them with `allOf`/`if-then` on `component` inside `$defs.Node`.
  Unknown props are a **schema warning, not an error**: use
  lint (new rule `UNKNOWN_PROP`, severity `warning`) rather than
  `additionalProperties: false`, so custom component parameters passed through
  `props` keep working. (Component definitions in `components.yaml` receive
  arbitrary params via `{{props.*}}` — a hard schema error would break them.
  Lint skips `use:` nodes for this rule.)
- New lint rules:
  - `UNKNOWN_PROP` (warning): prop not in the primitive's contract on a
    primitive node.
  - `MISSING_TEXT` (info): text primitive with neither `text` nor `label`.
  - `UNLABELED_FIELD` (info): `input`/`select`/`textarea` without `label`.

### 4.3 Surface hierarchy

Three changes, in increasing order of importance:

**(a) Slot regions are not surfaces.**
`renderRoot` (`engine/screenshots/renderer.js:98`) stops adding `wf-surface`
when `root.kind === 'slot'`. Persistent regions (header/nav/footer) keep it.
This matches the spec's §5.1 example and immediately restores grey gutters
between content cards.

**(b) Nesting-aware section demotion.**
A `section` renders as a **surface card** only when it is a *top-level*
surface in its context; nested sections render as **plain groups**
(transparent, no border/shadow, keep layout/padding/gap). Precise rule,
applied at render time while walking the tree:

```
surfaceDepth = number of ancestor nodes (within the same root) that
               rendered as a surface

section renders as surface  ⇔  node.surface === true
                              OR (node.surface !== false AND surfaceDepth == 0)
```

- Explicit `node.surface: true|false` always wins (schema already has it).
- `props.title` does **not** force a surface; a nested titled section renders
  its title as a group label (§4.5 section row).
- Implementation: pass `surfaceDepth` down through render options
  (`renderNode` → `renderChildren`), increment when a node actually renders
  with `wf-surface`. Overlay content roots reset `surfaceDepth` to 0 (a modal
  card is a surface). Pane panels and `table` count as surfaces for depth
  purposes.
- `tab_bar` / `bottom_tab_bar` keep their surface treatment regardless of
  depth (they are chrome, and flush tab strips need their frame).

This single rule converts the current box soup into: grey page → white cards →
flat grouped content inside cards. Authors who want a card-in-card (e.g. the
dashboard invite tiles inside the invites banner) write `surface: true` on the
inner section — lint rule `NESTED_SURFACE` (info) points at demoted sections
that set an explicit `size.height`, which usually indicates the author
expected a tile.

**(c) `.wf-node` legacy fallback stays for mode-less contexts only.** No
change to behavior, but the new CSS must ensure mode contexts never rely on
it.

### 4.4 Template layout fidelity

- `engine/tree.js` / `engine/build/index.js`: carry the full template
  `layout` object (not just `type`) into the page render as `bodyLayout`.
- `renderPageShell` (`engine/screenshots/renderer.js:273`) applies
  `layoutToCss(bodyLayout)` to the body container element, in addition to the
  `wf-body-row`/`wf-body-column` class. `gap` from the template overrides the
  mode default gap; `align`/`justify`/`padding` map directly.
- The body container must keep `flex:1` so sticky header/footer keep working;
  `layoutToCss` output is appended after the class-based defaults so template
  values win.
- Fixes: `auth_template` centering; any template that declares its own gap.

### 4.5 Component rendering specification (both modes)

The definitive per-primitive contract. "—" means same as card mode. All
colors greyscale (grey-N = Tailwind grey palette already used in the CSS).
This table supersedes §6 of rendering-modes.md where they conflict;
rendering-modes.md must be updated to match (§8).

| Primitive | Props (contract) | Card mode | Line mode |
|---|---|---|---|
| `heading` | `text` (alias `label`), `level` 1-6 | Type scale: h1 24px/650, h2 20px/600, h3 16px/600, h4 14px/600, h5 13px/600, h6 12px/600 uppercase tracking-wide grey-500. Color grey-900. No margins (gap-based spacing). | — |
| `paragraph` | `text` (alias `label`) | 14px/400 grey-600, line-height 1.6, max-width 65ch. | — |
| `text` | `text` (alias `label`), `variant`: `body`\|`meta` (default `body`) | body: 14px grey-700; meta: 12px grey-500. | — |
| `button` | `label`, `icon`, `iconStyle`, `iconSize`, `variant`: `primary`\|`secondary`\|`ghost`\|`danger` (default `secondary`) | Height 32px min, padding 6px 14px, radius token. primary: grey-800 bg / white text; secondary: grey-200 bg / grey-700 text; ghost: transparent, grey-700 text; danger: grey-800 bg + white text + small `triangle-exclamation` glyph (stay greyscale). | Transparent bg, 1px grey-600 border, grey-900 text. **No bracket characters** — remove `[ ]` from markup (`node-primitives.js:102-104`); variants map to border weight: primary = 2px border, others 1px. |
| `input` | `label`, `placeholder`, `inputType` | Field pattern: `<label>` 12px/500 grey-600 above control, 4px gap. Control: 36px height, white bg, 1px grey-300 border, 4px radius, placeholder grey-400. | Label same; control transparent bg, 1px grey-600 border, radius 0. |
| `textarea` | `label`, `placeholder`, `rows` | Same field pattern; min-height from `rows`. | — (line-mode border) |
| `select` | `label`, `placeholder`, `options[]` | Same field pattern; native select styled to 36px, white bg, grey-300 border, chevron via `appearance:auto` (keep native). | — (line-mode border) |
| `checkbox` | `label` | 16px box, `accent-color` grey-600, label 14px grey-700, 8px gap. | — |
| `radio` | `label` | Same as checkbox. | — |
| `toggle` | `label` | Track 36×20, radius 10, grey-300 bg (off) / grey-600 (on via state); thumb white 16px with shadow. Label 14px grey-700. | Track outline-only. |
| `section` | `title` | Surface (per §4.3): white card, grey-200 border, shadow token, radius token, **default padding 16px** when `layout.padding` unset. Group (demoted): transparent, no default padding. Title: when `props.title` present render `wf-section-title` — 13px/600 grey-800 with 8px bottom gap (inside the card, above body); **no default title** when absent (fix `renderSectionTitle` fallback). | Surface = hairline outline, transparent bg. Same title rules. |
| `image` | `src`, `alt`, `width`, `height` | Resolvable src: render `<img>` with grey-200 hairline border, radius token. Placeholder: grey-50 bg, grey-300 border, diagonal cross (existing), centered `image` icon + alt text 12px grey-400; **default min-height 120px** and `width:100%` when no explicit size, so images read as media blocks instead of collapsing. | Same, radius 0. |
| `icon` | `name`, `style`, `size` | FA glyph, grey-700. Sizes map to FA size classes (existing). | grey-600. |
| `divider` | — | 1px grey-200 full-width, `margin: 4px 0`. | 1px grey-400. |
| `spacer` | `size` | Invisible. Numeric size → px on the parent axis. **Percentage size (`"100%"`) or missing size in a flex parent → `flex:1 1 auto`** (true flexible spacer; today `width:100%` misbehaves in rows). | — |
| `table` | `columns[]`, `rows[]` / binding, `surface` | Existing renderer kept: header row grey-100 bg 12px/600, zebra body rows, cell padding 10/12. Surface per §4.3 depth rule (top-level table = card). | Header grey-50; outline frame. |
| `chart` | `chartType`, `title`, `data` | Existing placeholder SVGs kept; title 12px grey-500. Add **default min-height 120px** so charts hold space. | — |
| `tab_bar` | — (children are buttons) | Buttons inside render as tabs: transparent bg, grey-600 text, active (selection/`wf-selected`) gets grey-900 text + 2px bottom border grey-800. Bar itself: white surface, 1px grey-200 bottom border only (not a full card). | Hairline outline bar. |
| `bottom_tab_bar` | — | Existing stacked icon+label layout kept; active state as tab_bar. | — |

Shared CSS cleanup that falls out of the table:

- Delete the blanket `margin:4px 0` on content primitives; spacing comes from
  parent `gap` exclusively (matches the spec's token model).
- Add the heading scale (missing entirely today).
- `.wf-section-title` becomes visible (remove `display:none`).
- Keep density scaling as-is (`layout.js` multiplier).

### 4.6 Placeholder affordances (skeleton bars)

New shared helper in the renderer (`renderSkeleton(widthCh)`):

```html
<span class="wf-skeleton" style="width:12ch"></span>
```

```css
.wf-skeleton{display:inline-block;height:0.9em;border-radius:3px;
  background:var(--wf-skeleton-bg,#e5e7eb);vertical-align:middle}
.wf-mode-line .wf-skeleton{background:#d1d5db}
```

Usage (deterministic — widths derived from component type, never random):

- `heading` with no text: skeleton of 12ch.
- `text` with no text: skeleton of 8ch.
- `paragraph` with no text: two stacked skeletons (100% and 60% width).
- A `{{binding}}` token that resolves to `undefined`/empty: skeleton of 8ch
  in place of the token (`renderBoundText` in `render-utils.js`).
- `button` with no label and no icon: label skeleton of 6ch.

This makes missing data *look intentional* (classic wireframe greeking) and
makes binding failures visible without faking content.

### 4.7 `data/` becomes optional

`engine/doctor/index.js:200`: missing `data/` directory downgrades from error
to nothing (silence) — a project without dataset bindings simply has no data.
Add instead a real error when a `binding.source` references a dataset id that
does not exist (if not already covered by semantic validation). This unblocks
`wf build` for `admin_wireframes` and `web_wireframes`.

### 4.8 CSS architecture cleanup (enabling, not cosmetic)

`buildWireframeStyles()` currently lives in `engine/screenshots/renderer.js`
and is a single string array. With the component spec above it will grow past
the 500-line file limit and it is not a screenshots concern:

- Move to `engine/renderer/styles/` split by concern, each file a module
  exporting a CSS string: `base.js` (reset, page shell, modes, tokens),
  `components.js` (per-primitive rules), `overlays.js` (existing overlay CSS
  stays where it is if already separate). `buildWireframeStyles()` in
  `engine/renderer/styles/index.js` concatenates; `screenshots/renderer.js`,
  `build/index.js`, `serve/index.js` import from the new location.
- Pure move + concatenation; no framework, no build step, engine rules
  (no fs/process/console) unchanged.

### 4.9 Verification: component gallery + Playwright fixtures

Renderer changes require visual fixtures (AGENTS.md). Add:

- `engine/renderer/__fixtures__/gallery/` — a minimal wireframe project
  (manifest, templates, one page per primitive family, both a `card` and a
  `line` page variant) exercising every primitive with: text set, text
  missing (skeleton), labels on fields, nested sections (surface demotion),
  centered auth template, template with row layout, table with rows, charts,
  tab bars with an active tab.
- Playwright spec (`cli/test` or existing e2e home — follow the current test
  layout) that builds the gallery, screenshots each page in both modes, and
  compares against committed baseline PNGs. Threshold-based comparison
  (`maxDiffPixelRatio: 0.01`) to stay robust across font rendering.
- Regenerating baselines is an explicit script (`pnpm gallery:update`).
- Additionally: rebuild `admin_wireframes` (`wf build`) after implementation
  and manually review dashboard, login, project_editor, project_settings —
  these four pages exhibit every defect in §2 and serve as the acceptance
  test.

## 5. Implementation Order

Phases are independently shippable; each ends green (`pnpm test`,
`wf validate` + `wf build` on all three projects once Phase 1 lands).

1. **Unblock builds + content correctness** (highest value, lowest risk)
   - §4.7 `data/` optional.
   - §4.1 `text`/`label` alias in heading/paragraph/text.
   - §4.6 skeleton helper + fallbacks (replaces `'Heading'` default).
   - Rebuild admin_wireframes; verify text appears everywhere.
2. **Form fields**
   - §4.5 field pattern: labels above `input`/`textarea`/`select`;
     control sizing CSS; checkbox/radio/toggle polish.
3. **Surface hierarchy**
   - §4.3(a) slots lose `wf-surface`.
   - §4.3(b) surfaceDepth demotion + `NESTED_SURFACE` lint info.
   - §4.5 section defaults (16px padding, visible title, no 'Section'
     fallback).
4. **Template layout fidelity**
   - §4.4 full template layout → body container.
5. **Component CSS overhaul**
   - §4.8 styles module move (mechanical, first).
   - §4.5 remaining table rows: heading scale, margins removal, buttons +
     variants (schema addition), tab active states, image/chart min-heights,
     spacer flex behavior, line-mode button de-bracketing.
6. **Schema + lint hardening**
   - §4.2 typed props, lint rules (`UNKNOWN_PROP`, `MISSING_TEXT`,
     `UNLABELED_FIELD`, `TEXT_PROP_ALIAS`).
   - Schema discipline sweep (§8).
7. **Verification**
   - §4.9 gallery fixtures + Playwright baselines.
   - Rebuild all projects; commit refreshed
     `admin_wireframes/wireframes/build/`.

Phases 1–4 are each small (< ~10 files); Phase 5 touches CSS broadly and
should land as its own commit series per component family. Do not mix phases
in one commit.

## 6. Edge Cases

- **Both `text` and `label` set** on a text primitive → `text` wins;
  lint info notes the redundancy.
- **Custom components** (`use:`) receive free-form params via `props` →
  `UNKNOWN_PROP` lint skips nodes with `use:`; typed props apply only to
  primitive nodes after component expansion works on the expanded primitives.
- **Section demotion vs explicit styling**: a demoted section with
  `wireframeStyle` border overrides still honors the explicit override
  (author asked for a visible box) — `wireframeNodeStyleOverrides` output is
  applied after demotion strips the surface classes.
- **Section demotion inside overlays**: overlay content root resets
  `surfaceDepth = 0`, so a modal's top section is a card (correct — the modal
  card look comes from its section, not the overlay chrome).
- **Selection/collection rendering** (`renderCollectionNode` clones):
  `surfaceDepth` must flow through the clone path identically.
- **Tables inside cards**: `table` at `surfaceDepth > 0` demotes to
  frameless (existing `surface: false` behavior becomes automatic); explicit
  `surface: true` restores the frame.
- **Skeletons in attributes**: placeholders/aria strings that bind to nothing
  fall back to empty string, not skeleton markup (skeletons are DOM, never
  attribute values).
- **Template layout `justify` with sticky regions**: body container keeps
  `flex:1`; `justify` applies inside it. Sticky top/bottom regions are
  outside the body container and unaffected.
- **Percentage spacer in grid parent**: `flex:1` is meaningless in grid;
  spacer falls back to `min-height:12px` (current behavior) — lint could flag
  later, out of scope.
- **`wireframe_studio` project** already uses `props.text` — alias change is
  backward compatible; its build output must be pixel-identical except where
  §4.5 CSS changes apply globally (expected diff, covered by gallery
  baselines).
- **Determinism**: skeleton widths derive from component type constants;
  no randomness, no timestamps (repo rule).

## 7. Non-Goals

- **No new primitives** (no avatar, badge, breadcrumb, nav_item, list). The
  existing 19 primitives + custom components cover current projects; new
  primitives are a separate proposal.
- **No color/theming system.** Everything stays greyscale; the blue selection
  outline stays the sole accent.
- **No responsive/breakpoint rendering changes.**
- **No admin editor (React) UI work** — this is engine/CLI rendering only.
- **No YAML migrations of existing projects.** The alias makes existing
  documents render correctly as-is. (A follow-up codemod converging on
  `text` is optional and out of scope.)
- **No interactions/runtime changes** beyond CSS class hooks already
  described (active tab uses the existing selection mechanism).
- **No redesign of line mode's philosophy** — it stays a blueprint; it just
  inherits the component contract (borders instead of brackets).

## 8. Schema Discipline Checklist (for the implementing agent)

Schema-touching changes here: text alias, `text.variant`, `button.variant`,
typed per-primitive props. Update **all** of:

1. `engine/schema/schema.json` — typed `PrimitiveProps_*`, `variant` enums,
   alias notes in descriptions.
2. `docs/cli/schema.md` — §4 node model: props contract summary table.
3. `docs/cli/schema-systems.md` — validation section: new lint rules.
4. `docs/cli/schema-canonical.yaml` — §primitives comments (props lists per
   primitive, aliases, variants).
5. `docs/cli/brief.md` — lint rule list if it enumerates rules.
6. `docs/cli/rendering.md` + `docs/cli/rendering-modes.md` — §6 component
   rules replaced by/aligned with §4.5 table; §3.1 line-mode button
   de-bracketing; §5.1 already matches slot-not-surface (implementation catches
   up to spec).

Wireframe/brief sync rule: rebuilding `admin_wireframes/wireframes/build/`
output is part of the change (build output for that project is committed).

---

## Appendix A — Evidence

Screenshots taken from the committed `admin_wireframes/wireframes/build/web/`
pages (2026-07-05, card mode):

- **dashboard**: every card title renders "Heading"; role rows render as
  empty white boxes with a lone icon; "All Projects" section title absent;
  toolbar heading "My Projects" renders "Heading".
- **login**: card pinned top-left of an empty white surface (template
  centering dropped); "Wireframes" h1 renders "Heading" at 32px browser
  default; tagline/prompt/terms paragraphs invisible.
- **project_settings**: form fields render unlabeled (labels exist in YAML);
  three unlabeled "Select" dropdowns in a row are indistinguishable;
  "Danger Zone" section is an empty white box with a Delete button.
- **project_editor**: left file list renders as identical grey blocks; page
  list panel shows three empty white rectangles (sections whose heading/text
  children resolve empty).

Prop usage counts (repo-wide, 2026-07-05): heading/paragraph/text with
`props.label` — admin_wireframes 195, web_wireframes 44, wireframe_studio 0;
with `props.text` — wireframe_studio 88, others 0. Labeled form fields
ignored by renderer: 38 in admin_wireframes.

## Appendix B — Review

Adversarial review performed by a second agent (internal; cross-provider
review per AGENTS.md still recommended before implementation if available).
Findings and dispositions are appended below by the reviewing pass.
