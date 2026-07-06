# Wireframe Rendering Quality — Implementation Instructions

Step-by-step instructions for the implementing agent. The **what and why**
live in the design document:
[2026-07-05-wireframe-rendering-quality.md](2026-07-05-wireframe-rendering-quality.md)
(referenced below as "the design"). Read it fully before starting —
especially §4.3 (surface rules), §4.5 (the component table, which is the
definitive rendering contract) and Appendix B (review findings already folded
into the design; do not re-litigate them).

Work through the phases **in order**. Each phase ends with all tests green
and its own commit(s). Do not mix phases in a commit.

Status: **completed and visually accepted on 2026-07-06**. These instructions
were carried through Phase 7 before being moved to `docs/done/`.

---

## Phase 0 — Setup and baseline

1. Install and verify the current state:
   ```bash
   pnpm install
   pnpm test          # must pass before you change anything
   ```
2. Capture "before" screenshots for later comparison. The committed build in
   `admin_wireframes/wireframes/build/web/` is stale but renderable; open
   `dashboard.html`, `login.html`, `project_editor.html`,
   `project_settings.html` in Playwright (Chromium at
   `/opt/pw-browsers/chromium` if running in the remote env) and save
   full-page PNGs somewhere outside the repo. These four pages are the
   acceptance set.
3. Skim these files so the code layout is familiar:
   - `engine/renderer/primitives.js` — `renderNode` dispatch
   - `engine/renderer/node-primitives.js` — per-primitive renderers
   - `engine/renderer/render-attrs.js` — classes, data attrs, section title
   - `engine/renderer/render-utils.js` — `renderBoundText`, binding tokens
   - `engine/screenshots/renderer.js` — `buildWireframeStyles`,
     `renderRoot`, `renderPageShell`
   - `engine/build/index.js`, `engine/tree.js` — page assembly
   - `engine/doctor/index.js`, `engine/lint/index.js` — validation/lint
   - `engine/schema/schema.json`, `engine/schema/validator.js`

---

## Phase 1 — Unblock builds + content correctness

### 1.1 Make `data/` optional (design §4.7)

- `engine/doctor/index.js` (~line 200): delete the `else` branch that adds
  the `MISSING_REQUIRED_FILE` error for a missing `data/` directory. A
  project without `data/` is valid.
- Also remove `data` from any required-paths list that feeds the
  `Required path is missing: data` diagnostic (~line 125 consumes it).
- Dataset references that point at nonexistent dataset ids are already an
  error via `engine/*/reference-checks.js` — verify with a quick test, do
  not add a duplicate check.
- Test: `cd admin_wireframes && node ../cli/bin/wf.js validate` reports no
  `data`-related errors; `wf build` proceeds. Same for `web_wireframes`.
- Update `cli/test/info-doctor.test.js` (or wherever the doctor behavior is
  asserted) accordingly.

### 1.2 `text` / `label` alias on text primitives (design §4.1)

- `engine/renderer/node-primitives.js`:
  - `renderHeading` (~:39), `renderParagraph` (~:52), `renderText` (~:62):
    resolve content as: `props.text` if it is a non-empty string, else
    `props.label` if it is a non-empty string, else `null`.
  - Add one tiny shared helper in this file (e.g. `textProp(props)`), do not
    export it.
- Do NOT change `button` (its `label` stays canonical).

### 1.3 Skeleton placeholders (design §4.6)

- New helper in `engine/renderer/render-utils.js`:
  `renderSkeleton(widthCh)` → `<span class="wf-skeleton" style="width:Nch"></span>`.
- Fallbacks when `textProp()` returns `null`:
  - heading → skeleton 12ch (replaces the `'Heading'` literal — remove it)
  - text → skeleton 8ch
  - paragraph → two skeletons: 100% width and 60% width, stacked
  - button with no label and no icon → skeleton 6ch inside the button
- `renderBoundText` (`render-utils.js:147`): when a `{{props.*}}` or
  `{{item.*}}` token resolves to `undefined`/empty string, emit an 8ch
  skeleton instead of nothing. **Do not touch `{{state.*}}` /
  `{{appState.*}}` handling** — those emit `<span data-bind>` for the
  runtime and must keep doing exactly that (design §4.6 exemption; breaking
  this breaks interactions).
- CSS (goes into the styles work; add now in `buildWireframeStyles`):
  ```css
  .wf-skeleton{display:inline-block;height:0.9em;border-radius:3px;
    background:var(--wf-skeleton-bg,#e5e7eb);vertical-align:middle}
  .wf-mode-line .wf-skeleton{background:#d1d5db}
  ```
- Skeleton widths are constants per component type. No randomness
  (determinism rule).
- Skeletons are DOM only — attribute values (placeholder, aria) that resolve
  empty stay empty strings.

### 1.4 Verify and commit

- `pnpm test` green (update any test asserting the `'Heading'` fallback —
  none were found at design time, but re-check).
- Rebuild admin_wireframes (`wf build`), open dashboard + login: every
  authored string must now appear ("My Projects", "Wireframes",
  "Acme Dashboard", taglines, terms text…).
- Add unit tests: alias resolution (text wins over label), each skeleton
  fallback, state-token exemption in `renderBoundText`.
- Commit (roughly): `fix: make data/ optional`, `feat: accept label alias on
  text primitives`, `feat: skeleton placeholders for missing text`.

---

## Phase 2 — Form fields

Implement the field pattern from the design §4.5 table rows for `input`,
`textarea`, `select` (and polish `checkbox`/`radio`/`toggle`).

1. `engine/renderer/node-primitives.js` — `renderInput`, `renderTextarea`,
   `renderSelect`: when `props.label` is a non-empty string, emit
   ```html
   <label class="wf-field-label">…</label>
   ```
   before the control, inside the wrapper div. Run the label through
   `renderBoundText`. No label prop → no label element (do not skeleton
   labels).
2. CSS in `buildWireframeStyles`:
   - `.wf-field-label` — 12px/500 grey-600, `display:block`, 4px bottom gap.
   - Card mode controls: 36px height (min-height for textarea), white bg,
     1px grey-300 border, 4px radius, placeholder grey-400, full width of
     wrapper.
   - Line mode controls: transparent bg, 1px grey-600 border, radius 0.
   - Checkbox/radio: 16px, `accent-color:#6b7280`, label 14px grey-700,
     8px gap.
   - Toggle: track 36×20 radius 10 grey-300, thumb 16px white with shadow
     (adjust existing `.wf-toggle-track`/`.wf-toggle-thumb`).
3. Tests: unit test label emission for all three controls; extend the
   existing renderer tests rather than new files where they exist
   (`renderer/test/primitives.test.mjs`, `cli/test/rendering-modes.test.js`).
4. Rebuild admin_wireframes; check `project_settings.html`: fields must show
   their labels ("Project Name" etc. — the modal on dashboard too).
5. Commit: `feat: render form field labels and control styling`.

---

## Phase 3 — Surface hierarchy

This is the highest-risk phase. Implement design §4.3 exactly — the rule
was revised after review; do not "simplify" it back.

### 3.1 Slot regions lose `wf-surface` (design §4.3a)

- `engine/screenshots/renderer.js` `renderRoot` (~:98):
  `const surfaceClass = (isOverlay || isSlot) ? '' : ' wf-surface';`

### 3.2 surfaceDepth demotion (design §4.3b)

The full rule (surface ⇔ `surface: true`, or `surface !== false` AND
(`surfaceDepth == 0` OR parent layout is `grid`)):

- Thread `surfaceDepth` (integer, default 0) and `parentLayoutIsGrid`
  (boolean) through render options:
  - `renderRoot`: slot roots pass `surfaceDepth: 0`; persistent/overlay-less
    region roots that render with `wf-surface` pass `surfaceDepth: 1`.
  - `renderChildren` / `renderNodes` (`engine/renderer/primitives.js`):
    forward both flags; set `parentLayoutIsGrid` from the current node's
    `layout.type === 'grid'`.
  - When a node renders as a surface, its children receive
    `surfaceDepth + 1`.
  - Overlay content roots (`renderOverlay`) reset `surfaceDepth` to 0.
  - The collection-clone path (`renderCollectionNode` → re-entrant
    `renderNode` with spread options) forwards automatically — add a test
    to prove it.
- Decision point: `buildNodeClasses` (`engine/renderer/render-attrs.js:61`)
  currently decides `wf-surface` for section/table. It has no options
  access — **pass the computed decision in** (extend the function signature
  with an `isSurface` boolean computed in the caller) rather than importing
  options into it.
- Components that count as surfaces for depth purposes: `section`
  (when it renders as one), `table` (same), pane panels, template region
  roots, overlay roots. `tab_bar`/`bottom_tab_bar` keep `wf-surface`
  unconditionally and do NOT increment depth for their children (their
  children are tabs, not content).
- Demoted sections render with class `wf-section wf-group` (add `wf-group`
  so CSS/tests can target them): transparent, no border/shadow/radius, no
  default padding. Explicit `wireframeStyle` overrides still apply on top
  (author asked for a visible box).
- `table` at depth > 0 demotes to frameless automatically (equivalent of
  today's `surface: false`); explicit `surface: true` restores the frame.

### 3.3 Section defaults and titles (design §4.5 section row)

- Default padding: sections that render as surfaces get `padding: 16px`
  when `layout.padding` is unset. Implement in `renderSection` (inject into
  the body style), not in CSS, so explicit `layout.padding: 0` still wins.
  Remove `.wf-section{padding:4px}` from CSS.
- Titles: render the title div **only when** `props.title` is a non-empty
  string. Two call sites to fix (both currently default to `'Section'`):
  - `renderSection` (`node-primitives.js:220-227`)
  - `renderSectionTitle` (`render-attrs.js:201-206`)
- Remove `.wf-section-title{display:none}`; style it 13px/600 grey-800,
  8px bottom margin.
- One renderer test asserts `wf-section-title` presence
  (`renderer/test/primitives.test.mjs:237`) — it passes a title, so it
  should keep passing; verify.

### 3.4 Targeted YAML edits + lint

- `admin_wireframes/pages/dashboard.yaml`: add `surface: true` to `inv_1`
  and `inv_2` (invite tiles in a row — outside the grid exception).
- New lint rule `NESTED_SURFACE` (info): flags sections that were demoted
  by the depth rule AND set explicit `size.width` **or** `size.height`.
  (Lint framework groundwork happens in Phase 6 — if you want this rule now,
  do the §6.1 groundwork first; otherwise defer the rule, not the YAML edit.)
- Sweep the other pages visually after rebuild; add `surface: true` where a
  tile genuinely lost its card. Keep edits additive and minimal.

### 3.5 Verify and commit

- `pnpm test` green; new unit tests: depth rule (top-level surface, nested
  demoted, grid child kept, explicit true/false, overlay reset, region root
  depth, collection clone path).
- Rebuild; dashboard must show: grey page, white toolbar card, white
  invites card containing two white invite tiles, project grid of six white
  tiles, **no** white boxes around icon+text rows or button rows.
- Commits: `feat: slot regions render frameless`,
  `feat: nesting-aware surface demotion`, `feat: section titles + padding
  defaults`, `chore(admin_wireframes): mark invite tiles as surfaces`.

---

## Phase 4 — Template layout fidelity (design §4.4)

1. `engine/tree.js` (~:184) and `engine/build/index.js` (~:122): keep
   `bodyLayoutType` for compatibility, and additionally return the full
   template `layout` object as `bodyLayout`.
2. Propagate `bodyLayout` through every `renderWireframeMarkup` call site:
   `engine/build/index.js`, `engine/build/fs-writer.js`,
   `engine/serve/snapshot.js`, `engine/screenshots/index.js`.
3. `renderPageShell` (`engine/screenshots/renderer.js:273`): apply
   `layoutToCss(bodyLayout, {}, {density})` as an inline style on the body
   container div, after the class. The container keeps its class
   (`wf-body-row`/`wf-body-column`) and `flex:1`; inline styles win over
   the class defaults, which is intended (template gap overrides mode gap).
   Sticky top/bottom regions stay outside this container — unchanged.
4. Tests: template with `align: center; justify: center` produces those
   properties on the body container; template `gap: 24` overrides the mode
   default.
5. Rebuild; `login.html` card must be centered horizontally and vertically.
6. Commit: `feat: apply full template layout to page body`.

---

## Phase 5 — Component CSS overhaul

### 5.1 Styles module move (design §4.8) — do this first, mechanically

- Create `engine/renderer/styles/` with `base.js`, `components.js`,
  `index.js` (exports `buildWireframeStyles()` = concatenation). Move the
  CSS strings out of `engine/screenshots/renderer.js` unchanged in this
  commit. Each file < 500 lines.
- Repoint all consumers: `engine/screenshots/renderer.js`,
  `engine/build/index.js`, `engine/build/fs-writer.js` (lines ~20/152/190),
  `engine/serve/index.js`.
- Note: `engine/renderer/wireframe-styles.js` (per-node override helpers) is
  a different module and stays put; add a one-line comment in each pointing
  at the other.
- Commit: `refactor: move wireframe CSS into engine/renderer/styles`.

### 5.2 Apply the design §4.5 component table

Work component-family by component-family, one commit each. The table in the
design is the contract; key items:

- **Headings**: add the scale (h1 24/650, h2 20/600, h3 16/600, h4 14/600,
  h5 13/600, h6 12/600 uppercase tracked grey-500), color grey-900.
- **Margins**: delete the blanket
  `.wf-heading,...,.wf-text{margin:4px 0}` rule; spacing comes from `gap`.
  After deleting, eyeball pages whose sections have no gap set — if rhythm
  collapses anywhere, fix the YAML gap, not the CSS.
- **Text**: `text.variant` prop (`body` default | `meta`): body 14px
  grey-700, meta 12px grey-500. Schema addition — see Phase 6 checklist.
- **Paragraph**: 14px/400 grey-600, line-height 1.6, max-width 65ch.
- **Buttons**: `button.variant` prop (`primary|secondary|ghost|danger`,
  default `secondary`) — schema addition. Card mode: primary grey-800/white,
  secondary grey-200/grey-700, ghost transparent, danger grey-800/white +
  `triangle-exclamation` glyph. Min-height 32px, padding 6px 14px.
  Line mode: **remove the bracket interpolation** in `renderButton`
  (`node-primitives.js:102-104` — delete the `mode === 'line'` branch);
  style line buttons as transparent with 1px grey-600 border (primary: 2px).
- **Tab bars**: active tab (via existing `wf-selected` mechanism) gets
  grey-900 text + 2px bottom border; bar is white with bottom border only.
- **Image**: placeholder gets `min-height:120px` and `width:100%` defaults
  when the node has no explicit size; keep the diagonal cross.
- **Chart**: `min-height:120px` on `.wf-chart-svg`'s container.
- **Spacer**: in `renderSpacer` (`node-primitives.js:254-261`): if
  `props.size` is a percentage string (matches `/^\d+(\.\d+)?%$/`) and the
  parent layout is flex (stack/row), emit `flex:1 1 auto` instead of a
  width/height. Numeric and missing sizes keep today's behavior (16px).
- **Divider**: card grey-200 / line grey-400 (exists; verify).

### 5.3 Update the tests that assert old output

- `cli/test/rendering-modes.test.js:348` — bracket label assertion → new
  expectation (plain label, bordered line-mode button).
- Same file ~:234-266 — `buildWireframeStyles` token assertions → update to
  the new tokens.
- `renderer/test/layout-modes.test.mjs` — same sweep.

### 5.4 Verify

- `pnpm test` green. Rebuild all three projects (`admin_wireframes`,
  `web_wireframes`, `wireframe_studio` — the first two build only after
  Phase 1). Review the four acceptance pages against the Phase 0 "before"
  shots. wireframe_studio diffs are expected (design §6) — review, don't
  revert.

---

## Phase 6 — Schema + lint hardening

### 6.1 Lint engine groundwork (design §4.2 "Lint engine extension")

- Extend the lint result shape with `info: []` alongside
  `errors`/`warnings` (touches `engine/lint/index.js` and the CLI
  formatter in `engine/validate/format.js` / `cli-adapter.js`).
- `--strict` promotion (`promoteWarningsToErrors`) applies to warnings only;
  infos are never promoted.
- Add a props-aware node traversal (component + props visitor). New rules
  live in `engine/lint/rules/`, one module per rule (`index.js` is at 309
  lines — do not grow it past 500).

### 6.2 Rules

| Rule | Severity | Trigger |
|---|---|---|
| `UNKNOWN_PROP` | warning | prop not in the primitive's contract; **only** when `node.component` ∈ `PRIMITIVE_COMPONENTS` (custom components are skipped) |
| `MISSING_TEXT` | info | heading/paragraph/text with neither `text` nor `label` |
| `UNLABELED_FIELD` | info | input/select/textarea without `label` |
| `TEXT_PROP_ALIAS` | info | text primitive using `label` instead of `text` |
| `NESTED_SURFACE` | info | section demoted by the depth rule with explicit `size.width` or `size.height` (from Phase 3) |

### 6.3 Typed props in schema.json

- Add `$defs.PrimitiveProps_<name>` per primitive (prop lists = design §4.5
  table, including the new `variant` enums and the `label` alias on text
  primitives). Wire with `allOf` + `if`(component const)/`then` inside
  `$defs.Node`. The custom validator (`engine/schema/validator.js`) supports
  `$ref`/`allOf`/`if`/`then` — verified.
- Do **not** set `additionalProperties: false` on props — unknown props are
  lint warnings, not schema errors (custom component params flow through).

### 6.4 Schema discipline sweep — update ALL of these together

1. `engine/schema/schema.json` — typed props, `variant` enums, alias notes.
2. `docs/cli/schema.md` — props contract summary table in the node model.
3. `docs/cli/schema-systems.md` — validation section: the five lint rules.
4. `docs/cli/schema-canonical.yaml` — primitives comments: props, aliases,
   variants.
5. `docs/cli/brief.md` — lint rule list, if it enumerates rules.
6. `docs/cli/rendering.md` + `docs/cli/rendering-modes.md` — replace/align
   §6 component rules with the design §4.5 table; §3.1/§6.2 line-mode
   button de-bracketing; note that §5.1 (slot without surface) is now
   implemented.
7. `engine/schema/llm-reference.js` / `reference.js` / `doc-printer.js` —
   check whether they surface props docs; update if so.

- Tests: schema validation accepts existing projects unchanged; lint
  produces the expected diagnostics on a fixture with each violation.
- Commits: `feat: lint info severity + rule modules`, `feat: typed
  primitive props in schema`, `docs: sync schema docs with props contract`.

---

## Phase 7 — Verification harness + final acceptance

### 7.1 Component gallery (design §4.9)

- `engine/renderer/__fixtures__/gallery/` — a complete minimal project:
  manifest, sitemap, templates (one centered auth-style, one app shell with
  header/nav/slot), pages covering: every primitive with text set; text
  missing (skeletons); labeled + unlabeled fields; nested sections (surface
  demotion incl. grid tiles and a `surface: true` override); table with
  rows; all five chart types; tab bars with an active tab. Each page exists
  in a `card` and a `line` variant (`renderMode`).
- Playwright spec (follow the existing test layout in `cli/test` /
  `admin/e2e`): build the gallery, screenshot each page in both modes,
  compare to committed baselines with `maxDiffPixelRatio: 0.01`.
- `pnpm gallery:update` script regenerates baselines (add to root
  `package.json`).

### 7.2 Final acceptance

1. `pnpm test` — everything green.
2. `wf validate && wf build` succeed in all three wireframe projects.
3. Rebuild and commit `admin_wireframes/wireframes/build/` (this build
   output is intentionally committed — repo rule).
4. Compare the four acceptance pages against the Phase 0 baselines and
   against design §3 "Desired Behavior" point by point:
   - dashboard: all real strings, card grid intact, no box soup, "All
     Projects" title visible;
   - login: centered card, correct heading scale, all paragraphs visible;
   - project_settings: labeled fields;
   - project_editor: file list readable, no empty white rectangles (or
     skeletons where content is genuinely missing).
5. Move the design doc and this file from `docs/plans/` to `docs/done/`
   in the final commit.

---

## Ground rules (repo-wide, enforced)

- **Determinism**: same input → same output. No `Date.now`, no randomness.
- **Engine purity**: no `process.exit`, `console.log`, fs access in new
  engine code paths that run from document maps.
- **File size**: source files ≤ 500 lines — split before exceeding.
- **Commits**: small, focused, pushed promptly; never mix phases.
- **Tests before commit**: `pnpm test` green at every commit boundary.
- **Schema discipline**: any schema change updates all six doc surfaces
  (see Phase 6.4) in the same change.
- **Wireframe/brief sync**: YAML edits (Phase 3.4) must be checked against
  the relevant briefs/docs.
