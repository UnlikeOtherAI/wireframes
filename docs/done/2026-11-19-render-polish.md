# Render polish: tiles, text, read-only and navigation kinds

Status: implemented on 19 November 2026 (branch `claude/render-polish`, from `57c953f`). §9 records the Codex review decisions and §10 the implementation decisions. Where they differ from §4, §10 wins, then §9.

## 1. Problem Statement

On the iPad the edits were right, but the pages looked wrong. There are seven rendering defects:

1. A `grid` with no `columns` squeezes its tiles into 1/12-width slivers.
2. Text paints outside its card, tile or stat, or is clipped mid-glyph.
3. Authored line breaks are lost.
4. A read-only control looks editable.
5. A menubar cannot hold a plain link or mark the current page.
6. An inline `menu` draws as bare text.
7. Sidebar, rail and menu look alike; top nav and menubar look alike.

Reproduced on `origin/main` (Chromium headless shell 1243, Minis). The fixtures are `visual-review/*/wf/*.wf` plus synthetic projects. Pages render at their own width: `device: web` is 1280 px (the iPad scales it to fit) and `device: mobile` is 390 px.

| # | Reproduced | Evidence |
|---|---|---|
| 1 | yes | Every unplaced grid gets 12 tracks: 86.7 px at 1280, 34 px at 390. `layout: { type: grid }` on a section does the same (83.8 px). |
| 2 | yes | 120 px tiles: "Supercalifragilistic" ends 30 px past the box and a URL 118 px. Stat "$1,250,000" ends 19 px past it. At 390, every card in `specialist-pricing-5` spills, by up to 66 px. |
| 3 | yes | `\|-`, `\|`, `"\n"` and blank-line `>-` text all render on one line: in section and card descriptions, paragraph, text, list row text and alert text. |
| 4 | yes | Read-only input, select, textarea, tags and date fields get only `#f9fafb` instead of `#fff`. Checkbox, radio, toggle, choice_group, segmented, range, otp, colour and picker look identical to editable. |
| 5 | yes | A menubar leaf with `route` and `current` renders as `<button class="wf-menubar-trigger">Home</button>`: no link, no state. |
| 6 | yes | A top-level `menu` has `data-wf-frame="content"`: three bare lines. |
| 7 | yes | Card mode: the current row's fill (`--wf-fill`) is the page background, so only the bold weight shows. The kinds differ by direction and font size alone. |

## 2. Current Behavior

- **Grid columns.** `layoutToCss` (`engine/renderer/layout.js:85`) emits `repeat(N,1fr)`, with `N = columns`, else the default.
  - Build resolves a missing `manifest.defaultGridColumns` to 12 (`engine/build/index.js:237`, `:302`, `engine/screenshots/index.js:279`), and `engine/screenshots/renderer.js:225` defaults to 12, so the renderer never sees "unset".
  - Only `props.minItemWidth` gives auto-fit (`engine/renderer/node-shell.js:123`).
  - `wf init` writes `defaultGridColumns: 12` into every new manifest (`engine/init/index.js:22`); the iPad app's manifests omit it.
- **Text.** No container sets `overflow-wrap`.
  - The stat label is `nowrap` plus ellipsis, and the value is a flex row whose bare text cannot shrink (`styles/content.js:57`, `:60`).
  - The list title is a flex box with `text-overflow:ellipsis`, which flex boxes ignore, so it clips mid-glyph (`styles/data.js:41`).
- **Line breaks.** `renderBoundText` (`render-utils.js:161`) escapes the text and keeps its `\n`, but every text class uses `white-space:normal`. `lib.str` trims; `textProp` (`render-lib.js:29`) does not.
- **Read-only.** States reach the markup (`data-wf-readonly`, `readonly`, `aria-readonly`), but only `styles/controls.js:101` styles native fields: a near-white fill in card mode, a dashed edge in line mode. Drawn controls get nothing.
- **Menubar.** `renderMenubar` (`primitives/navigation-menus.js:108`) makes every top-level item a `<button>`. It ignores its `route`, and its `current` and `selected`. Top nav (`navigation-nav.js` `topEntry`) already turns a childless item into a link through `itemLink`/`itemsOn`, with `aria-current="page"`.
- **Menu.** The registry gives `menu` frame `N` ("the overlay owns the frame", `primitive-registry/navigation.js:84`). A dropdown's panel is drawn by the overlay (`.wf-menubar-panel`, `styles/navigation.js`).
- **Nav kinds.** `nav` and `menubar` are `N` (never framed), so their chrome comes only from a template region (e.g. role `sidebar`). In a slot they are bare. `.wf-nav-on` fills with `--wf-fill`, the card-mode page colour (`styles/navigation.js:78`).

## 3. Desired Behavior

1. A grid with no positive `columns`, no `minItemWidth` and no child placed with `gridItem` lays out as tiles that fill the row and wrap. This holds when `manifest.defaultGridColumns` is unset. Spans, offsets, explicit columns and an explicit manifest default keep the 12-column (or N-column) system.
2. No text in a card, tile, stat or list row paints outside its box. Long words wrap inside it. Numbers wrap between digits rather than spill or be overpainted. Single-line rows truncate with a visible ellipsis.
3. An authored newline in prose (headings, paragraph, text, titles, descriptions, alert and empty-state text, list row text) is a line break. Folded `>-` text is unchanged.
4. Every control with `readonly` looks read-only in one consistent way, distinct from disabled: a lock beside the label, a dashed field edge, and no editing affordances. The value stays at full contrast.
5. A top-level menubar item without a submenu is a link in the bar when its route is known. `current` (or route inference, as in `nav`) draws it like top nav's current item, with `aria-current="page"`.
6. A `menu` placed in content draws as the dropdown surface.
7. Each kind is recognisable at the top level of content, in both modes. Inside a framed region or card nothing changes.

## 4. Design

### 4.1 Tiles (item 1)
- **Unset default.** `resolveDefaultGridColumns(manifest)` returns a positive integer or `null`. It is one function, in `engine/renderer/layout.js`, used by the three build/screenshot call sites, and `screenshots/renderer.js` drops its `= 12`. `DEFAULT_GRID_COLUMNS` stays 12 as the span system's width.
- **Auto-fit rule.** `layoutToCss(layout, size, { defaultGridColumns, density, children, tileMin })` decides in one place, so `buildShell`, regions and the tab-body paths agree:
  - If `layout.columns` is a positive integer, use `repeat(columns,1fr)`.
  - Else, if `defaultGridColumns` is set, use `repeat(default,1fr)`.
  - Else, if any child has a `gridItem` with `span`, `offset`, `row` or `column`, use `repeat(12,1fr)`.
  - Else, use `repeat(auto-fit,minmax(min(<tileMin>px,100%),1fr))`.
  - `min(…,100%)` stops a single track overflowing a container narrower than the minimum.
  - Authored `minItemWidth` still wins, as today.
- **Token.** A new sizing token `grid.minItemWidth`: web 220, tablet 200, mobile 150. These match `styles/adaptive.js`, which already reflows grids at 150 and 200. At 1280 that fits five tiles per row; at 390, two.
- **Scope.** Both the `grid` primitive and `layout: { type: grid }`. No layout grid without columns or placed children has ever drawn anything but slivers (case 5 in the grid fixture, 83.8 px tracks). Two rules for one CSS grid would be a patch.
- **Scaffold.** `wf init` stops writing `defaultGridColumns`, so new CLI projects get tiles. The gallery fixture's `defaultGridColumns: 12` is removed so the gallery can show tiles; every gallery grid sets `columns`, so nothing else moves. `wf info` prints `auto` when the value is unset.
- **Visible changes.** No existing content changes: all 46 grids in the gallery, examples, `admin_wireframes`, `web_wireframes`, `wireframe_studio` and `cli/test/fixtures` set `columns` (a census of every parsed YAML node in those trees, including `layout: { type: grid }`). Only the new gallery fixture (§5) shows it.
- **Schema and docs.**
  - The token goes in `sizing-tokens.js`, then `schema.json` `SizingTokens` (`node scripts/sync-schema-primitives.js`).
  - Grid registry `sizing: ['grid.gap', 'grid.minItemWidth']`.
  - Hand-written docs: `schema.md` (manifest default and the grid row), `schema-systems.md` (layout grid), `schema-canonical.yaml` (token list, manifest comment).
  - `rendering.md` §"Layout type → CSS" is rewritten in place. The file is at 1,001 lines, so it must not grow: the detail moves to a new `rendering-data.md` §Grid columns.
  - Regenerated: the agent guide and the catalogue.

### 4.2 Text stays in its box (item 2)
- **Global wrap.** `body{overflow-wrap:break-word}` (`styles/base.js`). It breaks a word only where it would otherwise overflow, and it does not change min-content sizing, so tables, rows and intrinsic widths keep their sizes.
- **Flex items need more.** A flex item's automatic minimum keeps its longest word, so break-word alone cannot shrink it:
  - **Stat.** The value text gets its own span `.wf-stat-number`, with `min-width:0` and `overflow-wrap:anywhere`. `.wf-stat-value` wraps, so a delta drops to the next line. The label wraps (`white-space:normal; overflow-wrap:anywhere`) instead of truncating to "SA…".
  - **List rows** stay single-line summaries by design. The title text gets its own span with `overflow:hidden;text-overflow:ellipsis`, so a real ellipsis shows instead of a mid-glyph clip. `.wf-list-text` already ellipsizes.
- **Visible changes.** These show only where text overflowed or truncated before. Expected candidates are stat labels in `content` (`stats_row`) and in `line_structure`; each changed PNG is checked and named in the report. The in-repo projects are pixel-diffed page by page before and after.
- **Schema.** None. **Docs:** `rendering-presentation.md` gains a short "Text" section covering items 2 and 3.

### 4.3 Line breaks (item 3)
- **CSS.** `white-space:pre-line` (newlines break, spaces still collapse) on the prose classes: `.wf-heading h1–h6`, `.wf-paragraph p`, `.wf-text`, `.wf-block-title` and its title aliases, `.wf-block-desc`, `.wf-alert-title`, `.wf-alert-text`, `.wf-empty-title` and `.wf-empty-text`.
  - List `text` gets `white-space-collapse:preserve-breaks` with `text-wrap-mode:nowrap`, so each authored line keeps its own ellipsis. Older engines ignore the longhands and keep today's single line.
  - CSS rather than `<br>`, so text set at runtime through `data-bind` breaks too.
- **Trim.** Prose from `textProp` is trimmed at both ends, as `lib.str` already does, so a `|` block's final newline adds no empty line. Trimming the ends changes no rendering today, because leading and trailing white space already collapses.
- **YAML check.** `>-` and `>` fold single newlines to spaces, so existing text is unaffected. A blank line inside a folded block becomes one `\n` and now breaks, which is what such a paragraph means.
- **Visible changes.** No existing content contains a newline inside any string after YAML parsing (a census of the same trees as §4.1, plus `specs/`), so no existing page changes.
- **Schema.** None. **Docs:** `schema.md` text props ("a newline is a line break") and `rendering-presentation.md`.

### 4.4 Read-only (item 4)
- **The iPad case.** `editor-6` sets `select` `plan_picker` `readonly: true`. The user sees the same chevron and an almost invisible tint.
- **One state class.** Every control spreading `FIELD_PROPS` adds `wf-field-readonly` to its node, next to where it adds `wf-field-invalid` today. This goes through one helper `fieldClasses(state)` in `controls-field.js`, and is added only when `readonly` is set and `disabled` is not ("disabled wins").
- **One look.**
  - **Lock.** `fieldLabel` and the inline label of checkbox, radio and toggle append `<span class="wf-field-lock" aria-hidden="true">` holding `lib.icon('lock')`, so the accessible name is unchanged.
  - **Field edge.** Native fields, the tags and colour boxes, otp boxes, the stepper, picker wheel, editor body, upload zone and segment track get a dashed edge, with full-ink text:
    - card mode: `--wf-line`, with a `--wf-fill-2` fill;
    - line mode: `--wf-line-strong`, dashed.
  - **Marks.** Checkbox, radio, toggle and choice marks get a dashed outline. Checked marks fill with `--wf-ink-3` instead of `--wf-ink`; labels stay ink.
  - **Affordances removed.** The select chevron (`appearance:none`), the textarea resize handle, the stepper −/+ (hidden), the range thumb (drawn flat) and the date/colour picker indicators.
- **Unchanged.** Runtime guards, ARIA and submission. Disabled keeps its faded look and gets no lock.
- **Visible changes.** `forms` (`field_states_card`) and `line_forms` (`line_states`) hold read-only controls. They change only if those controls are inside the 1280×900 baseline crop; I expect them below it.
- **Schema.** None. **Docs:** `rendering-controls.md` (the "Field contract per widget" read-only column and paragraph), `rendering-states.md` Rules, and `schema-systems.md` §15.5.

### 4.5 Menubar leaves and current (item 5)
- **What exists.** The canonical item model already has `route`, `current` and `selected`. `itemLink`, `itemsOn` and `STATE_OWNERS.link` do what is needed. No new keys.
- **Changes in `renderMenubar`.**
  - **Leaf items.** A top-level item with no nested `items` and a known `route` renders as `<a class="wf-menubar-trigger" href data-wf-route-target>`, through `itemLink`. A leaf without a known route stays a `<button>`, as today, so the gallery's route-less `Help` titles keep their markup. An element `interaction` keeps the items inert, as in nav.
  - **Current.** The current item is decided by `itemsOn` with nav's rule: the item's own `selected`/`current` first, otherwise an enabled item whose `route` is the page being rendered.
  - **State.** A current item, leaf or trigger, gets `aria-current="page" data-wf-current`. Triggers keep `aria-expanded`, as `topEntry` does.
- **Look.** `[data-wf-current]` on a trigger is drawn like `.wf-nav-on`: fill, ink and weight 600 in card mode, the dashed outline in line mode. `open` still only opens a panel.
- **Model guidance.** The registry summary and example show a leaf (`{ label: Home, route: home }`) and `current`, so `wf llm` teaches leaves instead of "Home > Home" and `current` instead of `open`. Panel rows still never link.
- **Visible changes.** None. Gallery menubars (`menubar_demo`, `appnav_menubar`, `lnav_menubar`) have no top-level routes or `current`; their route-less `Help` leaf stays a button.
- **Schema and docs.** Only the registry summary and example change (then `sync-schema-primitives`, agent guide and catalogue). `rendering-navigation.md` changes in its `menubar` section, the Links list and the State attributes table.

### 4.6 Inline menu surface (item 6)
- **Registry.** `menu` frame `N` → `C`, like `command`: framed on its own, unframed inside a card, modal or dropdown (frame rules 4 and 9). `menu` joins `SELF_PADDED`.
- **Look.** `.wf-menu[data-wf-frame="surface"]` takes the dropdown panel look:
  - 5 px inset, radius 8 and the `0 10px 30px` shadow;
  - `width:max-content; max-width:100%`, with the current `min-width:180px`;
  - in line mode, the panel's solid `--wf-line-strong` edge with no shadow.
- **Visible changes.** `navigation_elements` `states_menu` sits in a grid-layout card, so rule 8 makes it a tile surface, as `command` already is. It is deliberate, and probably below the crop. `menu_demo` (in a card), overlay menus in `android` and `interactive-workspace`: unchanged.
- **Schema and docs.**
  - The `menu` summary is reworded.
  - `schema.md` Box column: never → rules decide.
  - `schema-canonical.yaml` `menu: C`.
  - `rendering-navigation.md`.
  - Regenerated: the agent guide and the catalogue.

### 4.7 Navigation kinds (item 7)
- **New frame class `B`** (bar): `edge` at surface depth 0, otherwise `content`. It is decided in `frame-rules.js` rule 3, beside `S`, `E` and `N`. `nav` and `menubar` become `B`.
  - It is not `C`: a surface draws a full box and adds depth, so every kind would have to undo it.
  - It is not `E`: an edge inside a sidebar region or card would double the region's own frame.
  - `wf why` gains its rule text.
- **Drawing.** CSS keys on `[data-wf-frame="edge"]` per kind. A nav with no `variant` has no edge rule, so it looks as it does today.

| Kind at top level | Card mode | Line mode |
|---|---|---|
| `nav variant: sidebar` | white panel, `sidebar.width` wide (inline `--wf-nav-w`, applied only by the edge rule), right rule `--wf-line-2`, 8 px inset | right rule `--wf-line-strong` |
| `nav variant: rail` | white strip, `sidebar.collapsedWidth`, right rule. Items without `icon` draw a placeholder icon box (any depth), so the current item's filled box shows | right rule; dashed placeholder |
| `nav variant: top` | white bar across the width, `min-height: header.height`, bottom rule | bottom rule |
| `menubar` | compact strip across the width, 36 px, rules above and below, tight 13 px medium titles | rules above and below |
| `menu` | floating dropdown card (§4.6) | solid panel edge |
| `tab_bar` | unchanged: rule plus active underline | unchanged |

- **Current item.** On these white panels and bars, `.wf-nav-on` and the menubar's current fill become visible again.
- **Visible changes.** None. The census found every existing `nav` and `menubar` inside a framed container. No fixture or in-repo project uses `variant: rail`, so the placeholder box changes nothing either.
- **Schema and docs.**
  - The registry frame letter goes into the `frameClass` comment.
  - `schema.md` Box column ("edge at top level").
  - `schema-canonical.yaml` frame list and legend.
  - `rendering-modes.md` must not grow (1,035 lines), so the frame rules note goes in `rendering-navigation.md` §Kinds.
  - Regenerated: the catalogue and the agent guide.

## 5. Implementation Order

One focused commit per step, each with tests that fail first, the docs and the regenerated artefacts its change feeds. Push after each commit.

1. Tiles: `resolveDefaultGridColumns`, the auto-fit rule, the token, `wf init`, `wf info`. Tests: `layout-css.test.js` cases (unset → auto-fit, placed → 12, explicit → N); a build test on a manifest without the default; the init test.
2. Text containment: CSS plus the stat and list spans. A browser test runs the spill checker (text rect past the content box) on a fixture at 1280 and 390.
3. Line breaks: CSS plus the trim. A browser test counts line boxes per prose element; a `>-` case stays one line.
4. Read-only: the helper, the lock and the CSS. Markup tests per control; a browser test reads the computed dashed edge, the lock, the hidden chevron and the full-ink value, and checks disabled is distinct.
5. Menubar: the renderer, CSS and registry text. Markup tests: leaf `<a href>`, `aria-current="page"`, inferred current, trigger `current`, an inert element.
6. Inline menu: the registry and CSS. A frame decision test: top level → surface, in a card, overlay or modal → content or group.
7. Nav kinds: frame `B`, CSS and the rail placeholder. Frame-rule tests plus a browser test of the computed edges at the top level and none inside a sidebar region.
8. Gallery: drop the manifest default and add the pages `polish` (card) and `line_polish` (line) to `PAGE_IDS`:
   - auto-fit tiles (cards and stats);
   - a fixed narrow tile row with long words;
   - multi-line prose;
   - read-only next to disabled;
   - a menubar with leaves and current;
   - an inline menu;
   - sidebar, rail, top nav and menubar at the top level.

   Regenerate the Windows baselines on Maxis and the macOS ones on the Mac, then capture before/after evidence.

## 6. Edge Cases

- **Grid shapes.** A single unplaced child fills the row (intended). Eight children wrap five and three at 1280. A grid nested in a tile gets one track through `min(…,100%)`.
- **Mixed placement.** If any child is placed, the whole grid uses 12 columns. `gridItem` inside a repeat cell counts, because children are expanded before render.
- **`form`.** `form` with `columns` is explicit. `form` with `layout: { type: grid }` and no columns gets tiles.
- **Explicit defaults.** A manifest default of 12 (or any value) keeps today's grids exactly. That covers every existing CLI project and the in-repo projects.
- **Adaptive.** The `adaptive` option's `!important` reflow still wins on smaller devices.
- **Long text.** A URL or a word wider than a 120 px tile breaks inside it. Buttons, badges and tabs keep `nowrap` and may still overflow a box narrower than themselves (§7).
- **Trailing newline.** A `|` block's final newline is trimmed, while `"a\n\nb"` keeps its blank line. Newlines in labels of controls, menus, tabs and table cells still collapse (§7).
- **Read-only state combinations.** Read-only with disabled looks only disabled. Read-only with error keeps the invalid edge colour, dashed. A read-only control without a label gets the edge but no lock.
- **Menubar.** A disabled leaf never links and is never inferred current. An unknown route keeps the `<button>`. `current` on several items is allowed: they are exactly the marked ones (`resolveSelection`).
- **Nav placement.** A sidebar nav in a top-level `row` beside content gets its panel. Inside a role-`sidebar` or `header` region it gets none. A rail given `size.width` keeps it. Skin `shellBackground` still paints inline over the white panel.

## 7. Non-Goals

- Reflowing explicit `columns` on phones; the `adaptive` option owns that.
- Migrating existing manifests' explicit `defaultGridColumns: 12`.
- A new look for a nav with no `variant`.
- Linking menubar panel rows, keyboard behaviour or menu/listbox roles.
- Wrapping control, button, badge, tab or table-cell labels.
- Container queries or font scaling to fit numbers.

## 8. Open Questions

1. **The scaffold default.** Should `wf init`'s historical `defaultGridColumns: 12` count as explicit? This design keeps it explicit, as the brief says, but stops writing it for new projects. The alternative is to treat 12 as unset, which also fixes existing CLI projects.
2. **The read-only cue.** Is a lock glyph right, or a "Read-only" caption? The glyph needs no copy or translation, and it falls back to the lettered box without the icon font.
3. **Tile width.** Is 220/200/150 px the right minimum? It is the same as `adaptive`'s reflow, and leaves five tiles across at 1280.
4. **The new frame class.** Is `B` worth adding, or should top-level nav chrome come from `C` plus per-kind overrides of the surface box?
5. **Menubar inference.** Should menubar leaves infer current from the route, as `nav` does? This design says yes, for consistency and because a menubar in a template cannot know its page.

The review settled all five: (1) keep an explicit 12 and stop writing it; (2) lock plus dashed edge, if they pass contrast and render in WebKit; (3) start from 220/200/150 and check the content box after gaps; (4) `B` only at depth zero, and a nav with no `variant` is unchanged; (5) infer from the route, with the resolver's precedence.

## 9. Review Findings

Codex reviewed `2e90056`. Decisions, by finding:

| # | Finding | Decision | What changes |
|---|---|---|---|
| 1 | Adaptive `!important` floors override the clamp and cover only `.wf-grid` and `.wf-form` | adopt | Tracks for every grid host come from one function in normal and adaptive mode alike. `styles/adaptive.js` drops its grid track rules. |
| 2 | Hosts, validation and output paths decide columns separately | adopt, narrowed | One column decision, shared by every render host. Validation unchanged. Parity test: bundle against build. |
| 3 | `1fr` tracks can grow around long content | adopt | Every emitted track is `minmax(0,1fr)`. |
| 4 | A lock alone does not make a control read-only | adopt, narrowed | The existing state owners and guards are reused, not rebuilt. Added: tests, contrast floors and WebKit checks. |
| 5 | Menu `min-width` beats a smaller `max-width`; rule 8 frames a menu in a card's grid | adopt | `min-width:min(180px,100%)`, defined overflow, and new frame class `T`. |
| 6 | Menubar fallback, current and expanded need distinct contracts | adopt | Fallback through `itemLink`, as in nav. Current gets an underline, unlike expanded. Selection uses resolver precedence. |
| 7 | Nav chrome can bypass mobile reflow | adopt, narrowed | Chrome follows authored placement. Adaptive phone reflows standalone sidebars and rails. Placeholders are decorative. |
| 8 | List newline longhands lack a WebKit fallback | adopt | List summaries stay single-line, outside the prose rule. Everything is checked in WebKit. |
| 9 | Docs and checks list incomplete | adopt | Added: `brief.md`, `schema-systems.md`, the determinism test and per-project page checks. |

### 9.1 Grid columns
- **One function.** `gridTemplateColumns` in `layout.js` decides the tracks. It is the only place a host gets `grid-template-columns`, and its inputs are the layout, `minItemWidth`, the rendered children, the explicit manifest default, the viewport and the sizing tokens.
- **Precedence:**
  1. Any child placed with `gridItem` (span, offset, row or column) gives `repeat(columns ?? default ?? 12, minmax(0,1fr))`. This holds in adaptive mode too: placement is never reflowed.
  2. Else `minItemWidth` gives `repeat(auto-fit,minmax(min(<min>px,100%),1fr))`, as today but clamped.
  3. Else, in adaptive mode, the same auto-fit at the shown device's `grid.minItemWidth`: tablet 200, mobile 150. These are today's adaptive floors, now clamped and applied to every grid host.
  4. Else explicit `columns`, then an explicit manifest default, as `minmax(0,1fr)` tracks.
  5. Else auto-fit at the page device's `grid.minItemWidth`.
- **Hosts.** These hosts call it with their own rendered children:
  - `node-shell.buildShell`, for every element. That covers `grid`, `form` with `columns`, and a `section` or `card` with a grid layout. The shell's CSS also lays out the split-body children wrapper.
  - The region body (`renderRoot`) and the page body (`renderPageShell`) in `screenshots/renderer.js`. The region body never received the manifest default before.
  - The tab-body paths in `node-primitives.js` are not a host: the file is imported nowhere.
  - Repeat rows and component uses are expanded before render, so the decision sees the real children.
- **Validation needs no change.** Auto tiles apply only when no child uses `gridItem`, so `INVALID_GRID_SPAN` cannot fire on them. A placed grid with no columns and no explicit default resolves to 12 in both the doctor and the renderer.
- **Adaptive is a deliberate change.** Grid-layout sections, cards and forms now reflow too. Before, only `.wf-grid` and `.wf-form` did, and placed spans were reflowed into overflow.

### 9.2 Read-only semantics
- **Owners stay as they are** (rendering-controls.md "Field contract per widget"):
  - native `readonly` for text inputs, textareas and the tags text box;
  - `aria-readonly` plus `data-wf-readonly` on `select`;
  - `aria-readonly` on checkbox and switch marks;
  - `data-wf-readonly` on a single radio, and `aria-readonly` on a radio group;
  - data attributes on segmented, range, otp, stepper, picker, colour and the editor.
- **Guards stay as they are.** The runtime in `interactions-controls.js` already blocks pointer and keyboard changes; tests now pin it.
- **Contrast.**
  - The dashed edge is `--wf-ink-3` in card mode: 4.8:1 on white, 4.4:1 on the page colour. In line mode it is `--wf-line-strong`, 7.5:1.
  - The lock is `--wf-ink-3`.
  - Both pass 3:1, and tests measure the computed colours in both modes.
- **The lock is kept.** It falls back to a caption only if WebKit cannot draw the glyph.

### 9.3 Menus and the menubar
- **Frame class `T`.** A surface at surface depth 0 and content inside any frame, decided at rule 3. It is used by `menu`. `C` would let rule 8 frame `states_menu` inside its card's grid; `T` keeps every embedded menu as it is today. The top-level inline menu gets the dropdown surface.
- **Menu overflow.** Labels truncate with an ellipsis; shortcuts and chevrons never shrink.
- **Menubar leaf markup** follows `itemLink`, as for `nav`:
  - a known route gives `<a class="wf-menubar-trigger" href>`, which is focusable and navigates on Enter;
  - an unknown route, a disabled leaf, or an element with its own `interaction` gives `<span class="wf-menubar-trigger">`, which is not focusable, like a nav row;
  - triggers with submenus stay `<button aria-expanded>`.
  - The gallery's route-less `Help` therefore becomes a `<span>`.
- **Current against expanded.**
  - Current is ink, weight 600 and a 2 px underline, with `aria-current="page" data-wf-current`.
  - Expanded keeps its fill in card mode, or its dashed outline in line mode.
  - A current, expanded trigger shows both.
- **Which items are current.** `itemsOn` with nav's rule:
  - explicit `selected` or `current` first, and every marked item is on;
  - an item marked `false` is never inferred;
  - otherwise, an enabled leaf whose route is the rendered page.

### 9.4 Navigation kinds
- **Where `B` applies.** Only to `menubar` and to `nav` with variant `sidebar`, `rail` or `top`. The registry lists those variants; a nav with no variant keeps frame `N`.
- **Placement.** Chrome follows where the author put the element. Moving a sidebar into a side region is the app's job.
- **Adaptive phone.** A standalone sidebar or rail reflows like a region sidebar: full width, a horizontal row that scrolls inside itself, and a bottom rule instead of the right rule. It never overflows the page.
- **Placeholders.** Rail placeholder boxes are `aria-hidden`; the link keeps its label as its accessible name.
- **Skins.** Their inline `background-color` still wins over the white panel, and the selected row keeps the skin's accent and text pair.

### 9.5 Text, lists and checks
- **List rows.** They stay single-line summaries with a real ellipsis, and are outside the prose newline rule. The `preserve-breaks` longhands are dropped.
- **Docs.** `brief.md` says `wf init` no longer writes `defaultGridColumns`. `schema-systems.md` covers frame classes `B` and `T`.
- **New checks:**
  - two renders of one input give identical HTML;
  - every page of the gallery, examples and the three in-repo projects is rendered before and after in both modes, and each pixel change is explained;
  - targeted assertions cover the states below the baseline crop.
- **WebKit.** Every fixed case is checked in Playwright WebKit as well as Chromium.

## 10. Implementation Decisions

- **Text is scoped to framed boxes.** `overflow-wrap: break-word` applies to a surface's own title and description, and to `heading`, `paragraph` and `text` placed straight in a surface, not to `body`. On `body`, `wireframe_studio`'s miniature 58 px stat previews broke "1,234" mid-number, where the text had only run into invisible padding. Stat label and number keep their own wrap.
- **List titles change by CSS only.** `.wf-list-title` becomes a block, so its ellipsis draws without new markup, and the legacy list markup tests stay exact. A list badge sits 1–2 px lower; that is the only `data.png` change.
- **The sidebar slot was added after the review.** On the iPad build, a `role: sidebar` slot region (stack, padding 0, beside `main`) rendered four bare words:
  - such a slot now draws the sidebar panel itself (frame-rules rule 5, `edge`);
  - its edge faces the content (`data-wf-edge-side` end, start, bottom or top);
  - it takes a `card.padding` inset when no padding above 0 is authored;
  - its descendants render with `insideChrome`, so `B` and `T` draw nothing inside it, and persistent sidebar regions stay surfaces;
  - adaptive phone mode rules the panel below instead of beside.
- **`B` is variant-aware through the registry.** `frameVariants: [sidebar, rail, top]` on `nav`, read by `frameClass(name, variant)`. The sidebar panel width comes from a page variable (`--wf-sidebar-w`), not inline style, so nav markup is unchanged. The legacy navigation test still compares exact markup inside a frame, and at the top level it allows only the frame decision to differ.
- **Menubar `selected` counts like `current`** for top-level titles (nav's rule). Panel rows still keep `selected` and `current` apart.
- **Keyboard checks are engine-aware.** Safari's WebKit moves focus between links with Option-Tab, so the menubar keyboard test presses Alt+Tab there.
- **Not changed.** A page designed for a phone with a side-by-side template keeps the region's 280 px sidebar width. That is pre-existing region sizing; the `adaptive` option reflows it.

### 10.1 Follow-up: empty stdlib values

The iPad's `std.site_footer` had a blank tagline, empty link lists and `social: []`. It drew as a 112 px logo box with the brand wrapped inside it, plus a skeleton bar, three empty 160 px columns and a rule.

- **A new node key, `when`, leaves empty parts out.** A node keeps its place only when its value has content. A blank string, `[]`, `null`, `undefined` or `false` removes it. `engine/resolver/when.js` evaluates the key once on the resolved tree, after props, slots and repeat rows, and strips it from the nodes it keeps. The key is in all four schema files.
- **`std.site_footer`:**
  - the tagline, each link column and the copyright carry `when`;
  - the root is a `section`, so at the top of a page the footer is one full-width panel, and inside a framed footer region it is plain;
  - the logo is 160×40, so a brand fits on one line.

  A fixed-size logo box stays as it was, because `company-logos.test.js` pins the missing-slot box.
- **`std.site_header` and `std.hero` had the same stubs.** In the header, the menu and both actions carry `when`, and the menu is `surface: false`, because the header is already the bar. In the hero, the badge, title, intro and both calls to action carry `when`. A bare `use:` still draws every part.

### 10.2 Implementation review

Codex reviewed the implementation and found eight problems. All are adopted. Each test failed before its fix, except where noted.

1. **A sidebar fits its slot.** A standalone sidebar is `min(--wf-sidebar-w, 100%)` wide and can shrink, so a 120 px stack or a narrow grid track does not overflow. An authored `size.width` is inline and still wins. Tested in both modes.
2. **A narrow menu row gives way in order:**
   - the label shortens to a letter and its ellipsis (`min-width: min(2em, 100%)`; a zero-width label would show nothing);
   - then the shortcut truncates with an ellipsis and finally hides;
   - icons and chevrons keep their size.

   The test checks every descendant against the row, using a long shortcut in a 120 px stack, on the web and an adaptive phone, in both modes. Key chips in command and menubar panels are unchanged, because those panels size to their content.
3. **The read-only lock is an inline SVG** in `currentColor`. Before this, the bundle's default mount dropped the icon stylesheet and the lock drew nothing. `renderer/test/fontless-lock.test.mjs` mounts the bundle without icons in both modes.
4. **Export parity extracts reliably.** Windows and macOS extract with bsdtar: System32 `tar.exe` on Windows, because a POSIX shell's GNU `tar` cannot read a ZIP. Linux uses `unzip`. A failed extraction fails the test, which checks that the archive holds every project file and that the page renders before comparing. The old fallback exited 0 with an empty folder.
5. **Read-only controls are named.** A labelled select, textarea or tags input points at its visible label with `aria-labelledby`. An `id` would change its submit key. The guard test tries every listed control by tap, click, Escape, focus, Space, ArrowDown and typing.
6. **An adaptive phone sidebar faces the content.** A sidebar slot authored after `main` stacks below it and draws its rule on top. One authored before `main` keeps the bottom rule. Both orders are tested.
7. **The grid tests prove their names.** The repeat test's cell root is placed, so only expanded rows carry a placement, and a decision that saw no rows fails it. The determinism test asserts that both renders succeed. These are test fixes; each new test was checked against an engine change that brings back the gap it closes.
8. **The schema prose says what comes before the manifest default.** `schema.md`, `schema-systems.md` and `rendering-data.md` now say that an authored `minItemWidth` and adaptive reflow come before `manifest.defaultGridColumns`, as the canonical YAML already did. This is a documentation fix, so there is no test.
