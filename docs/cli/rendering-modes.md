# Wireframe Rendering Modes Specification

Companion to [rendering.md](rendering.md), [schema.md](schema.md), and
[schema-systems.md](schema-systems.md).

Source research:
[wireframe-rendering-research.md](wireframe-rendering-research.md),
[rendering-wireframes-from-yaml-in-two-modes.md](rendering-wireframes-from-yaml-in-two-modes.md)

Defines the two rendering modes (**line** and **card**), their visual token
systems, double-border prevention rules, CSS architecture, and component-level
rendering behaviour. Also documents schema additions required to support both
modes.

---

## 1. Overview

The renderer supports two output modes. Both use the same schema, the same
resolved node tree, and the same layout engine. **Card mode is the default.**
Mode can be overridden per-page via `page.rendering.mode` or the shorthand
`page.renderMode`.

| Mode   | Character                       | Page background | Surface treatment          | Button style       |
|--------|---------------------------------|-----------------|----------------------------|--------------------|
| `line` | Blueprint / schematic           | `#ffffff`        | Transparent + outline      | Bracketed label    |
| `card` | Greyscale product mock          | `#f3f4f6`        | White + border + shadow    | Filled grey block  |

**Line mode** is a pure structural skeleton. Every surface is a single hairline
outline. No fills. Sharp or minimally-rounded corners. The output reads as a
blueprint or wireframe diagram.

**Card mode** is a greyscale product mock. Page background is light grey.
Surfaces are white cards with subtle shadows and rounded corners. Gaps between
cards reveal the grey background, acting as natural gutters. This mode is
closer to a lo-fi product prototype.

Both modes are strictly greyscale. No brand colours. No icons beyond
placeholder stubs. No custom fonts.

---

## 2. Visual Token System

A shared set of tokens drives both modes. The renderer maps each token to
mode-specific CSS values via CSS custom properties. Authors reference numeric
`layout.gap` / `layout.padding` values from the schema — the token system
is a renderer concern, not a schema concern.

### 2.1 Spacing tokens (4px base grid)

| Token | px  | CSS var            | Typical use                            |
|-------|-----|--------------------|----------------------------------------|
| s0    | 0   | `--wf-s0: 0`       | Flush adjacency                        |
| s1    | 4   | `--wf-s1: 4px`     | Tight padding, icon gaps               |
| s2    | 8   | `--wf-s2: 8px`     | Touch separation in dense areas        |
| s3    | 12  | `--wf-s3: 12px`    | Comfortable inner padding              |
| s4    | 16  | `--wf-s4: 16px`    | Default gap between cards/sections     |
| s6    | 24  | `--wf-s6: 24px`    | Major section spacing                  |
| s8    | 32  | `--wf-s8: 32px`    | Page-level spacing blocks              |

The renderer snaps `layout.gap` and `layout.padding` values to the nearest
token. Authors use raw pixel numbers in YAML; the renderer handles the mapping.

### 2.2 Stroke tokens

| Token    | Width | Use                                          |
|----------|-------|----------------------------------------------|
| hairline | 1px   | Default outlines and dividers                |
| emphasis | 2px   | Selected state, focus rings                  |

**Rule:** Never apply strokes on both adjacent siblings. See Section 4.

**Borders vs outlines:**
- Use `border` for structural geometry that participates in box sizing (card frames, input fields).
- Use `outline` for line mode surface frames and all transient state emphasis (selected, focused, hovered). Outlines do not affect layout or cause reflow.

### 2.3 Radius tokens

| Token | Line mode | Card mode | CSS var              |
|-------|-----------|-----------|----------------------|
| r0    | 0         | 0         | `--wf-radius: 0`     |
| r2    | 2px       | 8px       | `--wf-radius: 8px`   |
| r3    | 4px       | 12px      | `--wf-radius: 12px`  |

In line mode, sharp corners reinforce the schematic/blueprint feel.
In card mode, rounded corners signal touchable surfaces.

The `wireframeStyle.corner` on the page maps to these tokens:

| YAML                         | Line mode | Card mode |
|------------------------------|-----------|-----------|
| `corner.style: sharp`        | r0 (0)    | r0 (0)    |
| `corner.style: rounded, radius: 8` | r2 (2px) | r2 (8px) |
| `corner.style: rounded, radius: 12` | r3 (4px) | r3 (12px) |

In line mode, the radius is divided by 3 to keep the "blueprint" feel.

### 2.4 Typography tokens

| Role  | Size  | Weight | CSS class          |
|-------|-------|--------|--------------------|
| title | 18px  | 600    | `wf-text-title`    |
| body  | 14px  | 400    | `wf-text-body`     |
| meta  | 12px  | 400    | `wf-text-meta`     |

Font: `system-ui, sans-serif`. No custom fonts. No brand typography.

---

## 3. Mode Definitions

### 3.1 Line Mode

**Visual language:** A structural schematic. Every surface has a single hairline
outline. No background fills on content surfaces. The page itself has a white
background. Typography is grey, not black — it should recede behind the structure.

**CSS custom properties:**

```css
.wf-mode-line {
  --wf-page-bg:             #ffffff;
  --wf-surface-bg:          transparent;
  --wf-surface-stroke:      1px solid #4b5563;   /* grey-600 */
  --wf-surface-stroke-type: outline;              /* use outline, not border */
  --wf-surface-shadow:      none;
  --wf-surface-radius:      0;                    /* sharp by default */
  --wf-divider-color:       #9ca3af;              /* grey-400 */
  --wf-divider-width:       1px;
  --wf-text-primary:        #111827;              /* grey-900 */
  --wf-text-secondary:      #6b7280;              /* grey-500 */
  --wf-button-bg:           transparent;
  --wf-button-border:       1px solid #4b5563;
  --wf-button-text:         #111827;
  --wf-input-border:        1px solid #4b5563;
  --wf-input-bg:            transparent;
  --wf-selected-outline:    2px solid #2563eb;    /* blue-600 — selection indicator */
}
```

**Surface rendering in line mode:**

Surfaces (`section`, template regions, form containers, pane panels) render with:

```css
.wf-mode-line .wf-surface {
  outline: var(--wf-surface-stroke);
  background: var(--wf-surface-bg);
  border-radius: var(--wf-surface-radius);
}
```

`outline` is used intentionally — it does not participate in the box model,
which means adjacent outlines never double up.

**Button rendering in line mode:**

```html
<div class="wf-button">[ Save ]</div>
```

Buttons render as label text with bracket delimiters or a hairline border.
No fill. This keeps the schematic aesthetic.

### 3.2 Card Mode

**Visual language:** A greyscale product mock. Page is light grey. Cards are white
surfaces elevated with a subtle shadow. Rounded corners. Gaps between cards
expose the grey background, forming natural gutters. No additional dividers are
needed between sibling cards when they have gap > 0.

**CSS custom properties:**

```css
.wf-mode-card {
  --wf-page-bg:             #f3f4f6;              /* grey-100 */
  --wf-surface-bg:          #ffffff;
  --wf-surface-stroke:      1px solid #e5e7eb;   /* grey-200 — optional, subtle */
  --wf-surface-stroke-type: border;              /* use border for card geometry */
  --wf-surface-shadow:      0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --wf-surface-radius:      8px;                 /* default; overridden by wireframeStyle */
  --wf-divider-color:       #e5e7eb;              /* grey-200 */
  --wf-divider-width:       1px;
  --wf-text-primary:        #111827;              /* grey-900 */
  --wf-text-secondary:      #6b7280;              /* grey-500 */
  --wf-button-bg:           #e5e7eb;              /* grey-200 */
  --wf-button-border:       none;
  --wf-button-text:         #374151;              /* grey-700 */
  --wf-input-border:        1px solid #d1d5db;    /* grey-300 */
  --wf-input-bg:            #ffffff;
  --wf-selected-outline:    2px solid #2563eb;    /* blue-600 */
}
```

**Surface rendering in card mode:**

```css
.wf-mode-card .wf-surface {
  background:    var(--wf-surface-bg);
  border:        var(--wf-surface-stroke);
  border-radius: var(--wf-surface-radius);
  box-shadow:    var(--wf-surface-shadow);
}
```

`border` is used (not `outline`) because the card border is geometric — it
participates in the card's visual frame. The card's `box-shadow` provides the
primary elevation signal; the border is secondary and can be omitted for very
clean layouts.

**Separation via gutters:**

In card mode, when `layout.gap > 0`, the grey page background shows through
the gaps between cards. No inner borders or dividers are needed between
sibling cards with gap. The gutter IS the separator.

---

## 4. Separator and Double-Border Prevention

The "double border" problem occurs when two adjacent surfaces each draw their
own border on the shared edge, producing a 2px stroke instead of 1px.

The renderer resolves this automatically. Authors do not need to manage it.

### 4.1 Three strategies

**Strategy 1: Gutters (preferred)**

When `layout.gap > 0`, visible space separates siblings. No borders required
between them. In card mode, the grey background shows through the gap. In line
mode, the white background shows through.

Use when: gap > 0 (the default recommendation for most layouts).

**Strategy 2: Parent dividers**

When siblings must be flush (`gap: 0`) but still visually separated, draw a
single line at the parent level — between children, not on each child.

CSS implementation:

```css
/* Horizontal siblings (row layout) */
.wf-divide-x > * + * { border-left: 1px solid var(--wf-divider-color); }

/* Vertical siblings (stack layout) */
.wf-divide-y > * + * { border-top: 1px solid var(--wf-divider-color); }
```

This is the CSS equivalent of Tailwind's `divide-x` / `divide-y`. Only one
border is drawn per boundary (on the second element), never two.

Use when: `gap: 0` and `layout.separators: between` (see Section 7.2).

**Strategy 3: Outline for line mode surfaces**

In line mode, all surface frames use `outline` instead of `border`. Because
outlines are painted over the box (outside the layout), two adjacent outlines
do not share a border — each is drawn independently over its own box without
overlapping the sibling's box model. The visual result is two hairlines with
zero gap between them, which is correct for a schematic diagram.

Use when: line mode surface frames.

### 4.2 Decision algorithm

```
for each layout container:
  if gap > 0:
    → Strategy 1: gutters. No dividers needed.
       In card mode, grey background shows through.
       In line mode, white background shows through.

  else if gap == 0 and separators == "between":
    → Strategy 2: parent dividers.
       Apply wf-divide-x (row) or wf-divide-y (stack) to parent.
       Remove any border/outline from child surfaces that would double-up.

  else:
    → No separator. Adjacent surfaces are truly flush.
       (Acceptable for tables, segmented controls, tab bars.)
```

### 4.3 Stroke resolution pass

After the node tree is emitted to DOM, the renderer runs a post-processing
pass:

1. Find all container elements with `data-wf-layout-type` and `data-wf-gap`.
2. For containers with `gap > 0`: confirm layout uses CSS `gap` property — done.
3. For containers with `gap == 0` and `data-wf-separators="between"`:
   - Add `wf-divide-x` or `wf-divide-y` class to the container.
   - Remove surface outline/border from direct children (the parent divider replaces them).
4. Selected nodes get `outline: var(--wf-selected-outline)` via the selection runtime (never `border`, which would cause reflow).

---

## 5. CSS Architecture

### 5.1 Root structure

```html
<body class="wf wf-mode-card">
  <div class="wf-page" data-device="web">
    <!-- sticky header (template persistent region with sticky: top) -->
    <header class="wf-region wf-surface" data-sticky="top">...</header>

    <!-- body row: flex row, align-items: stretch — sidebars fill full height -->
    <div class="wf-body-row">
      <nav class="wf-region wf-surface" data-region-id="left_nav">
        <!-- 3 nav items, but nav stretches to full row height -->
      </nav>
      <main class="wf-region" data-region-id="main_content">
        <!-- page slot content -->
      </main>
    </div>

    <!-- sticky footer (template persistent region with sticky: bottom) -->
    <footer class="wf-region wf-surface" data-sticky="bottom">...</footer>
  </div>
</body>
```

The `wf-mode-card` / `wf-mode-line` class on `body` drives all mode-specific
CSS custom properties. The `wf-page` wrapper is a flex column centered at the
device width with `min-height` = device height. The browser window scrolls it.

**Key rule:** `height` from the viewport table is a **min-height**, not a constraint.
Content longer than 900px (web) simply grows the page and the browser scrolls it.
No inner `overflow: scroll` container. No clipping.

### 5.2 Base CSS

```css
/* wireframe.css — shared across all pages in a platform */

.wf {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
}

/* Mode custom properties — set in Section 3 above */

/* Page shell — fills browser tab, scrolls naturally */
.wf-page {
  width: var(--wf-viewport-width);       /* e.g. 1280px for web */
  min-height: var(--wf-viewport-height); /* e.g. 900px for web — grows with content */
  margin: 0 auto;
  background: var(--wf-page-bg);
  display: flex;
  flex-direction: column;
}
.wf-mode-card .wf-page {
  padding: 16px;
  gap: 16px;
}

/* Body row — sidebars stretch to full row height */
.wf-body-row {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;   /* default, but explicit: sidebar fills full height */
  min-height: 0;          /* required for flex shrink to work correctly */
}
.wf-mode-card .wf-body-row { gap: 16px; }

/* Sticky regions */
.wf-region[data-sticky="top"] {
  position: sticky;
  top: 0;
  z-index: 10;
  flex-shrink: 0;
}
.wf-region[data-sticky="bottom"] {
  position: sticky;
  bottom: 0;
  z-index: 10;
  flex-shrink: 0;
}

/* Surface class — applied to sections, cards, template regions, overlays */
.wf-surface {
  background:    var(--wf-surface-bg);
  border-radius: var(--wf-surface-radius);
}
.wf-mode-card .wf-surface {
  border:     var(--wf-surface-stroke);
  box-shadow: var(--wf-surface-shadow);
}
.wf-mode-line .wf-surface {
  outline: var(--wf-surface-stroke);
}

/* Dividers */
.wf-divide-x > * + * { border-left:  var(--wf-divider-width) solid var(--wf-divider-color); }
.wf-divide-y > * + * { border-top:   var(--wf-divider-width) solid var(--wf-divider-color); }

/* Selection indicator */
.wf-selected { outline: var(--wf-selected-outline) !important; }
```

### 5.3 Layout → CSS mapping

| YAML                     | CSS output                              |
|--------------------------|-----------------------------------------|
| `layout.type: stack`     | `display: flex; flex-direction: column` |
| `layout.type: row`       | `display: flex; flex-direction: row`    |
| `layout.type: grid`      | `display: grid`                         |
| `layout.type: absolute`  | `position: relative`                   |
| `layout.type: overlay`   | `position: relative`                   |
| `layout.gap: N`          | `gap: Npx`                              |
| `layout.padding: N`      | `padding: Npx`                          |
| `layout.columns: N`      | `grid-template-columns: repeat(N, 1fr)` |
| `layout.justify: X`      | `justify-content: X`                    |
| `layout.align: X`        | `align-items: X`                        |
| `layout.separators: between` (row) | `wf-divide-x` class on container |
| `layout.separators: between` (stack) | `wf-divide-y` class on container |

---

## 6. Component Rendering Rules by Mode

### 6.1 Surfaces: section, template regions, pane panels

**What gets `wf-surface`:**

- `table` component
- `tab_bar` component
- `bottom_tab_bar` component
- `section` component
- Template region containers (persistent and slot)
- Pane panels (`node.pane` is defined)
- Overlay containers (modal, drawer, popover, etc.)

**What does NOT get `wf-surface`:**

- `text`, `heading`, `paragraph` — inline content
- `button` — handled separately (see 6.2)
- `spacer`, `divider` — structural only

Line mode:
```html
<div class="wf-section wf-surface" data-wf-id="settings_panel">
  <div class="wf-section-title">Settings</div>
  <div class="wf-section-body">...</div>
</div>
```

Card mode: identical HTML — CSS variables drive the visual difference.

### 6.2 Buttons

**Line mode:** Render as bordered label. No fill.

```html
<div class="wf-button wf-button-line">
  <button>[ Save ]</button>
</div>
```

CSS:
```css
.wf-mode-line .wf-button button {
  background:  transparent;
  border:      1px solid #4b5563;
  color:       #111827;
  padding:     4px 10px;
  font-size:   13px;
  border-radius: 2px;
  cursor:      default;
}
```

**Card mode:** Render as filled grey block.

```html
<div class="wf-button wf-button-card">
  <button>Save</button>
</div>
```

CSS:
```css
.wf-mode-card .wf-button button {
  background:    #e5e7eb;
  border:        none;
  color:         #374151;
  padding:       6px 12px;
  font-size:     13px;
  font-weight:   500;
  border-radius: var(--wf-surface-radius);
  cursor:        default;
  min-height:    32px;
}
```

Minimum hit target for card mode: 32px height, 64px width. Card mode is closer
to a prototype — reasonable target sizes matter.

### 6.3 Inputs, selects, textareas

Form fields always get a visible boundary in both modes. A field without a
boundary is visually ambiguous.

**Line mode:**
```css
.wf-mode-line .wf-input input,
.wf-mode-line .wf-select select,
.wf-mode-line .wf-textarea textarea {
  border:     1px solid #4b5563;
  background: transparent;
  padding:    4px 8px;
}
```

**Card mode:**
```css
.wf-mode-card .wf-input input,
.wf-mode-card .wf-select select,
.wf-mode-card .wf-textarea textarea {
  border:        1px solid #d1d5db;
  background:    #ffffff;
  padding:       6px 10px;
  border-radius: 4px;
}
```

### 6.4 Checkboxes and toggles

Both modes: rendered with a visible control. No style difference between modes —
the intrinsic form control appearance is sufficient at wireframe fidelity.

```css
.wf-checkbox input[type="checkbox"],
.wf-radio input[type="radio"],
.wf-toggle-track {
  accent-color: #6b7280;
}
```

### 6.5 Headings, paragraphs, text spans

No surface box. Text-only. Font size and weight driven by component type.

```css
.wf-heading h1 { font-size: 20px; font-weight: 600; }
.wf-heading h2 { font-size: 18px; font-weight: 600; }
.wf-heading h3 { font-size: 16px; font-weight: 600; }
.wf-heading h4,
.wf-heading h5,
.wf-heading h6 { font-size: 14px; font-weight: 600; }
.wf-paragraph p { font-size: 14px; color: #374151; }
.wf-text       { font-size: 14px; }
```

### 6.6 Images

Both modes: a bordered frame with a placeholder diagonal cross and alt label
when `src` is not resolvable. When `src` resolves to an `assets/` file, the
actual image renders with a hairline border.

```css
.wf-image-placeholder {
  display:         flex;
  align-items:     center;
  justify-content: center;
  background:      #f9fafb;
  border:          1px solid #d1d5db;
  color:           #9ca3af;
  font-size:       12px;
}
```

### 6.7 Dividers and spacers

`divider` → `<hr class="wf-divider">` — 1px top border in `--wf-divider-color`.
Spans full parent width. No mode difference.

`spacer` → `<div class="wf-spacer" style="height: Npx">` — invisible gap.
In row layout: `width: Npx` instead of `height`.

These are explicit structural primitives. They are distinct from the parent
dividers used in double-border prevention (those are CSS-only and not authored).

### 6.8 Tab bars

`tab_bar` → `<div class="wf-tab-bar wf-surface">` with a dedicated body row.
It defaults to a flush horizontal layout with parent dividers and equal-width
children, making it suitable for mobile bottom navigation.

### 6.9 Tables

`table` → `<div class="wf-table">` with a dedicated header row and a body that
alternates row fills between white and a very light grey. Columns come from
`props.columns`; rows come from `props.rows` or `binding.source`.

```html
<div class="wf-table wf-surface">
  <div class="wf-table-header wf-table-grid">...</div>
  <div class="wf-table-body">
    <div class="wf-table-row wf-table-grid">...</div>
  </div>
</div>
```

Use `surface: false` when embedding a table inside an already framed card.

### 6.10 Charts

`chart` is a borderless primitive — no `wf-surface` class, no outline or border
in either mode. Charts render as a grey title label above a placeholder SVG.

```css
.wf-chart {
  border:     none;
  background: transparent;
  padding:    4px 0;
}
.wf-chart-svg {
  width:      100%;
  max-height: 160px;
  display:    block;
}
.wf-chart-title {
  font-size:     12px;
  color:         #666;
  margin-bottom: 4px;
}
```

Five chart types: `line`, `bar` (alias `vertical`), `horizontal`, `gauge`,
`donut`. All render as simple grayscale SVG shapes (strokes in `#9ca3af`,
fills in `#e5e7eb`). No mode difference — charts look the same in both line
and card mode.

### 6.11 Section with title

`section` renders title text above the body in both modes. The title uses the
`meta` type scale (12px, grey-500) as a label over the content area.

```html
<div class="wf-section wf-surface">
  <div class="wf-section-title">Settings</div>  <!-- 12px, grey-500 -->
  <div class="wf-section-body">
    <!-- children -->
  </div>
</div>
```

In line mode, the section title is outside the outline box (above it), so the
outline frames just the content body. In card mode, the title is inside the
card surface.

Actually, to keep rendering simple and consistent: the section title is always
inside the surface container, at the top, styled as `wf-text-meta`.

---

## 7. Schema Additions

The following additions are required to support full two-mode rendering.
They are all additive (no breaking changes to existing 1.1 documents).

### 7.1 `page.rendering` block and `page.renderMode` alias

Add an optional `rendering` object to the `page` definition. Pages may also use
`renderMode: line|card` as a shorthand alias for `rendering.mode`.

**YAML:**
```yaml
page:
  id: dashboard
  template: app_shell
  viewport: { device: web }
  wireframeStyle:
    border: { style: solid, width: thin }
    corner: { style: rounded, radius: 8 }
  renderMode: card
  rendering:
    mode: card           # card | line  (default: line)
    density: comfortable # comfortable | compact  (default: comfortable)
  slots: [...]
```

**Schema definition:**
```json
"PageRendering": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "mode": {
      "type": "string",
      "enum": ["line", "card"],
      "description": "Rendering mode. line = blueprint/schematic. card = greyscale product mock."
    },
    "density": {
      "type": "string",
      "enum": ["comfortable", "compact"],
      "description": "Layout density. comfortable = default spacing. compact = reduced spacing for dense UIs."
    }
  }
}
```

**Default:** If both `rendering.mode` and `renderMode` are omitted, the renderer
defaults to `mode: line`. `rendering` may contain only `density`. If both mode
fields are present, `rendering.mode` is authoritative.

**Density effect on spacing tokens:**

| Token | comfortable | compact |
|-------|-------------|---------|
| s1    | 4px         | 2px     |
| s2    | 8px         | 4px     |
| s3    | 12px        | 8px     |
| s4    | 16px        | 10px    |
| s6    | 24px        | 16px    |

### 7.2 `layout.separatorPolicy` and `layout.separators`

Add optional separator fields to `Layout`.

**YAML:**
```yaml
layout:
  type: row
  gap: 0
  separatorPolicy: auto  # auto | gutters | divide | none
  separators: between      # none | between  (default: none)
  separatorStyle: solid    # solid | dashed  (default: solid)
```

**Schema definition additions to `Layout`:**
```json
"separatorPolicy": {
  "type": "string",
  "enum": ["auto", "gutters", "divide", "none"],
  "description": "Shorthand separator policy. auto/divide render parent dividers only when gap is 0; gutters/no dividers win when gap is greater than 0."
},
"separators": {
  "type": "string",
  "enum": ["none", "between"],
  "description": "Draw dividers between siblings. 'between' draws one line between each pair. Only meaningful when gap is 0."
},
"separatorStyle": {
  "type": "string",
  "enum": ["solid", "dashed"],
  "description": "Line style for parent separators. Defaults to solid."
}
```

**Rendering rule:**
- If `separatorPolicy: gutters`: never render parent dividers.
- If `separatorPolicy: divide` and `gap == 0`: render parent dividers.
- If `separatorPolicy: none`: no gutters, no parent dividers.
- If `gap > 0`: gutters are the separator. `separators` is ignored.
- If `gap == 0` and `separators: between`: parent dividers are rendered
  (`wf-divide-x` for rows, `wf-divide-y` for stacks). Child surface strokes
  on the shared edge are suppressed.
- If `gap == 0` and `separators: none`: truly flush adjacency. No separator.

`separatorPolicy` is the higher-level control; `separators` remains the explicit
between-children switch for authored layouts and backwards compatibility.

### 7.3 `node.surface` and `node.elevation`

Add optional node-level render hints:

```json
"surface": {
  "type": "boolean",
  "description": "Explicitly marks a node as a framed surface or forces it to remain content-only."
},
"elevation": {
  "type": "integer",
  "minimum": 0,
  "maximum": 3,
  "description": "Card-mode elevation token. Ignored in line mode."
}
```

Use cases:

- `surface: false` on a `section` that should act as a pure layout wrapper
- `surface: true` on a custom wrapper or component root that should get card/line framing
- `elevation: 2` or `3` on key card-mode surfaces that need stronger hierarchy

### 7.4 Enumerate `layout.justify` and `layout.align`

Currently free strings — invalid values silently degrade. Enumerate them.

**Replace in `Layout`:**
```json
"justify": {
  "type": "string",
  "enum": ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly", "stretch", "start", "end"]
},
"align": {
  "type": "string",
  "enum": ["flex-start", "flex-end", "center", "stretch", "baseline", "start", "end"]
}
```

These map directly to CSS `justify-content` and `align-items` values.

### 7.5 Add `padding` and `columns` to responsive `allowedOverrides`

Currently `padding` and `columns` cannot be set per responsive context. Both
are frequently responsive layout properties. Authors work around this by using
extra nodes or spacers, adding complexity.

**Update `responsive.allowedOverrides` in `schema-canonical.yaml`:**
```yaml
responsive:
  allowedOverrides:
    - width
    - height
    - span
    - gap
    - padding       # new
    - columns       # new
    - align
    - visibility
```

Also update the prose in `schema-systems.md` Section 6.

---

## 8. Files to Update

When implementing these schema additions, update ALL of the following:

| File                     | Change                                                          |
|--------------------------|-----------------------------------------------------------------|
| `schema.json`            | Add `renderMode` to pages; add `surface`/`elevation` to nodes; add `separatorPolicy`/`separators`/`separatorStyle` to `Layout`; enumerate `justify`/`align` |
| `schema-systems.md`      | Section 6: add `padding`, `columns` to allowedOverrides; Section 13: note rendering mode effect on wireframeStyle |
| `schema.md`              | Section 3.4: add `renderMode` + `rendering`; Section 4: add `surface`/`elevation` |
| `schema-canonical.yaml`  | Section 7 (node): add `surface`/`elevation`; Section 9 (layout): add `separatorPolicy`; Section 10 (responsive): add padding/columns; Section 16.1 (page): add `renderMode` + `rendering` |
| `rendering.md`           | Add reference to this file; update Section 6 (wireframe style) to note mode effect |

---

## 9. Rendering Algorithm

### 9.1 Full pipeline

```
1. Load and validate YAML (schema + semantic)
2. Resolve template + slots + injectables + components → flat node tree
3. Read `page.rendering.mode` or `page.renderMode` (default: "line")
4. Emit root: <body class="wf wf-mode-{mode}">
5. Apply CSS variables for mode (Section 3)
6. Walk resolved tree, emit DOM:
   a. Map layout → CSS classes
   b. Map component → HTML element + class
   c. Map wireframeStyle overrides → inline CSS
   d. Mark surfaces: add "wf-surface" to section / region / pane / overlay containers
   e. Encode interactions → data-wf-interactions
   f. Encode state bindings → data-wf-state-bindings
   g. Encode visibility conditions → data-wf-visibility
7. Post-process: stroke resolution pass (Section 4.3)
8. Emit <script> with state defaults and WF_ROUTES
9. Emit <link> to wireframe.css and interactions.js
```

### 9.2 Which nodes become `wf-surface`

A node gets the `wf-surface` class if ANY of the following is true:

- `component: section`
- The node is a template region root (persistent or slot)
- `pane` is defined on the node
- The node is the root of an overlay content tree
- `surface: true`

A node does NOT get `wf-surface` if:

- `component` is any text primitive (`heading`, `paragraph`, `text`)
- `component: button`, `input`, `textarea`, `select`, `checkbox`, `radio`, `toggle`, `icon`
- `component: chart` (borderless placeholder — see Section 6.10)
- `component: divider` or `component: spacer`
- The node is a pure layout wrapper with `use` referencing a component
  (the component's root handles its own surface class)
- `surface: false`

### 9.3 Density effect

When `rendering.density: compact`, the renderer multiplies all `gap` and
`padding` CSS output values by `0.65` (rounded to nearest px). This does not
modify the YAML values — it is a render-time scaling only.

---

## 10. Examples

### 10.1 Two cards side-by-side — card mode, gap > 0

YAML:
```yaml
rendering:
  mode: card

slots:
  - slotId: main
    content:
      - id: kpis
        component: section
        props: { title: "KPIs" }
        layout: { type: row, gap: 16, padding: 16 }
        children:
          - id: revenue_card
            component: section
            props: { title: "Revenue" }
          - id: orders_card
            component: section
            props: { title: "Orders" }
```

Rendered HTML structure:
```html
<div class="wf-section wf-surface" data-wf-id="kpis"
     data-wf-layout-type="row" data-wf-gap="16"
     style="display:flex; flex-direction:row; gap:16px; padding:16px">
  <div class="wf-section-title">KPIs</div>
  <div class="wf-section-body" style="display:flex; flex-direction:row; gap:16px">
    <div class="wf-section wf-surface" data-wf-id="revenue_card">
      <div class="wf-section-title">Revenue</div>
    </div>
    <div class="wf-section wf-surface" data-wf-id="orders_card">
      <div class="wf-section-title">Orders</div>
    </div>
  </div>
</div>
```

Result in card mode: grey page bg, white cards, 16px gap = grey gutter between
cards. No double border. No dividers needed.

### 10.2 Two sections flush — line mode, gap = 0, separators: between

YAML:
```yaml
rendering:
  mode: line

slots:
  - slotId: main
    content:
      - id: panel_row
        component: section
        layout: { type: row, gap: 0, separators: between }
        children:
          - id: left_panel
            component: section
            props: { title: "Left" }
          - id: right_panel
            component: section
            props: { title: "Right" }
```

Rendered HTML structure:
```html
<div class="wf-section wf-surface wf-divide-x" data-wf-id="panel_row"
     data-wf-layout-type="row" data-wf-gap="0" data-wf-separators="between"
     style="display:flex; flex-direction:row">
  <!-- children do NOT get wf-surface (suppressed by stroke resolution) -->
  <div class="wf-section" data-wf-id="left_panel" style="flex:1; padding:16px">
    <div class="wf-section-title">Left</div>
  </div>
  <div class="wf-section" data-wf-id="right_panel" style="flex:1; padding:16px">
    <div class="wf-section-title">Right</div>
  </div>
</div>
```

Result in line mode: outer outline on the parent, single hairline divider
between Left and Right. No double line.

---

## Related files

| File                                          | Contents                                      |
|-----------------------------------------------|-----------------------------------------------|
| [rendering.md](rendering.md)                  | Build/serve pipeline, viewport dimensions, HTML primitives |
| [schema.md](schema.md)                        | Document types, core node model               |
| [schema-systems.md](schema-systems.md)        | Layout, state, interactions, overlays, validation |
| [schema-canonical.yaml](schema-canonical.yaml) | Canonical YAML definition                    |
| [schema.json](../../engine/schema/schema.json) | Formal JSON Schema                            |
| [wireframe-rendering-research.md](wireframe-rendering-research.md) | Source research document |
