# Render polish evidence, 19 November 2026

Before and after pairs for the seven defects seen on the iPad. The design is in
[docs/done/2026-11-19-render-polish.md](../../done/2026-11-19-render-polish.md).

- **Before:** `origin/main` at `57c953f`, rendered with that revision's own engine.
- **After:** `claude/render-polish` at `2450c88`. The engine was last changed in `6fcb3e2`.
- **Host:** Minis (Windows 11), Playwright Chromium headless shell build 1243, full-page screenshots.
- **Widths:** each page renders at its own width. `device: web` is 1280 px, which the iPad scales to fit; `device: mobile` is 390 px.
- **Mode:** card mode, the iPad's default. Every pair uses the same fixture at the same width and mode.

| Pair | Fixture | What changed |
|---|---|---|
| `01-grid-tiles-pricing` | iPad `specialist-pricing-5`, web | A grid without `columns` had twelve 86 px tracks and cards spilling text. Now its tiles fill the row. |
| `02-stat-tiles-phone` | iPad `specialist-stat-1`, mobile | The 34 px phone tracks clipped labels to nothing and numbers mid-glyph. Now there are two tiles per row, with full labels. |
| `03-line-breaks-hours` | iPad `cafe-3` (Opening hours, a `\|-` block), web | Two lines of hours ran together on one line. Now they break where the author wrote them. |
| `04-readonly-plan` | iPad `editor-6` (read-only plan select), web | A faint tint and a live chevron. Now there is a lock, a dashed edge and no chevron. |
| `05-navigation-kinds` | sidebar, rail, plain nav, menu, top nav, menubar (leaves, `current`) and tab bar, stacked, web | Before, five of them were bare lists or rows of words. Now each has its own chrome, the inline menu is a dropdown panel, and the menubar's current title is underlined. |
| `06-sidebar-slot-panel` | the latest iPad layout: a `row` template with a `role: sidebar` slot (stack, padding 0) beside `main`, holding `nav variant: sidebar`, web | Four bare words at the top left. Now a sidebar panel with an edge, an inset and a visible current row; the cards beside it are tiles. |

The iPad fixtures are the app's own page YAML from the visual review, unpacked
with `wf unpack`. The other two are minimal projects built for this check.

## Also checked, not pictured

- **Every fixed case in both engines and both modes.** Chromium on Minis, and Playwright WebKit 26.0 (build 2248) on the Mac mini, in card and line mode, at 1280 and 390 px. In WebKit:
  - the lock draws from the bundled icon font;
  - list titles end in a drawn ellipsis;
  - authored line breaks show;
  - no page overflows horizontally.
- **Adaptive renders.** Phone and tablet renders (`adaptive: true`) of the sidebar slot and the navigation kinds.
  - On a phone, the panel and the standalone sidebar and rail become ruled rows across the top.
  - Grids reflow at the shown device's minimum, and a placed grid keeps 12 columns.
- **Existing content.** All 92 pages of the gallery, `examples/`, `admin_wireframes`, `web_wireframes`, `wireframe_studio` and the showcase fixture were rendered before and after, in both modes. Pixels changed only where the design says:
  - list rows with a badge;
  - stat-label antialiasing;
  - the gallery's read-only form fields.
