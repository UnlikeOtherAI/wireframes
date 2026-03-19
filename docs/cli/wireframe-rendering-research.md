# Rendering Wireframes from YAML in Two Modes

> Source document — deep research artifact. Treat as authoritative.
> Incorporated into [rendering-modes.md](rendering-modes.md).

---

## Executive summary

Low‑fidelity wireframes are most effective when they keep attention on structure, hierarchy, and user flow rather than polish. Guidance from Nielsen Norman Group and Figma consistently frames low‑fidelity work as simplified, grayscale representations using basic shapes and minimal typographic variation, specifically to accelerate iteration and focus critique on layout and interaction rather than aesthetics.

For your two rendering modes, the "double border" problem is best treated as a rendering responsibility, not something authors have to micromanage per node. The robust pattern is:

- Treat space (gap) as a first‑class, schema‑driven layout feature and render it with CSS gap (grid/flex) rather than margins, so the "in‑between" is always intentional and visible.
- When two sibling boxes must be visually separated without a gap, do not draw borders on both boxes; instead draw a single divider at the parent level (Tailwind divide-x/divide-y) or via a systematic "only one side draws the stroke" rule. Tailwind's divider utilities implement this "between children" approach explicitly.
- In greyscale card mode, your intuition is correct: a light grey page background plus white cards makes borders between adjacent cards largely redundant; separation is carried by background contrast + gap gutters + subtle elevation, a pattern echoed in surface/elevation guidance in Material and platform design guidance in general.
- Your current schema already has strong foundations for this: layout.gap, layout.padding, layout types (stack/row/grid), an overlay system, and a per‑page wireframeStyle system.

What's missing for "proper" rendering across two modes is primarily (a) explicit render mode / theme token configuration and (b) a few schema/validator tweaks so responsive spacing and separators are consistently expressible.

---

## Visual language for the two modes

A reliable wireframe renderer needs a small, explicit "visual language" so the output is consistent across pages and authors. Below is a practical, renderer‑friendly vocabulary that stays low‑fidelity while being deterministic.

### Token sets

Use a single token system shared by both modes; each mode then maps those tokens to different CSS variables / Tailwind class recipes.

#### Spacing tokens (4px base)

This aligns with common UI spacing practice and maps cleanly to Tailwind's default spacing scale.

| Token | px  | Typical use                              |
|-------|-----|------------------------------------------|
| s0    | 0   | flush adjacency (rare; tables, segmented controls) |
| s1    | 4   | tight internal padding, icon gaps        |
| s2    | 8   | default "touch separation" in dense areas |
| s3    | 12  | comfortable inner padding, small card gaps |
| s4    | 16  | default layout gap between cards/sections |
| s6    | 24  | major section spacing                    |
| s8    | 32  | page‑level spacing blocks                |

#### Stroke tokens (single‑stroke discipline)

| Token    | CSS meaning | When used                                  |
|----------|-------------|-------------------------------------------|
| hairline | 1px stroke  | default outlines/dividers                 |
| emphasis | 2px stroke  | key containers (rare), selected state     |

CSS borders are part of the box model; outlines are painted "over" the box and don't cause reflow. For wireframe emphasis (hover/selected/focus), outlines are often preferable because they don't shift layout.

#### Radius tokens

| Token | line mode | card mode |
|-------|-----------|-----------|
| r0    | 0         | 0–4       |
| r2    | 2         | 8         |
| r3    | 4         | 12        |

In pure‑line mode, sharp corners reinforce "blueprint" feel; in card mode, rounded corners signal surfaces.

#### Typography tokens (minimal scale)

| Role  | Size    | Weight | Notes                  |
|-------|---------|--------|------------------------|
| title | 18–20px | 600    | page/section titles    |
| body  | 14–16px | 400    | default text           |
| meta  | 12–13px | 400    | labels, helper text    |

#### Iconography tokens (wireframe‑safe)

| Token       | Rendering                               |
|-------------|-----------------------------------------|
| icon_stub   | simple square/circle glyph (no brand icons) |
| chevron     | > marker for selects/menus              |
| avatar_stub | circle with initials                    |

### Component boundary rules

To address "everything got a box" directly:

- Only "surfaces" get full bounds (sections/cards/modals/panes/forms).
- Controls do not always get boxes in pure‑line mode: buttons can render as label + subtle underline/brackets, while inputs/selects typically need a boundary because otherwise they are ambiguous as fields.
- Dividers are separate from boxes: represent adjacency with a single divider line rather than two touching box borders.

---

## Rendering space and avoiding double borders

Your core scenario—two cards/sections next to each other—has exactly three "correct" separation strategies. The renderer can choose automatically based on context (mode + layout rules + gap).

### Strategy one: gutter space

This is the cleanest approach for both modes, and especially for card mode.

- Use parent layout gap to make the in‑between space explicit and stable.
- In card mode, set the page background to light grey and cards to white; the gap reveals the grey "gutter", so no internal dividers are required.
- CSS gap is defined for grid and flex layouts; it avoids per‑child margin hacks and keeps spacing consistent.

### Strategy two: parent dividers

When two items must be flush (gap = 0) but still separated by a line, draw exactly one line between them:

- A parent "divider system" draws separators between children.
- Tailwind's divide-x / divide-y does this by applying a border only to "not last child" (and has reverse helpers).
- This avoids the 2px "double stroke" entirely.

### Strategy three: single‑sided borders

When you need more custom control than divide-* (for example, only certain siblings have separators, or complex nested patterns), implement a deterministic rule:

- In a row: only draw border-left on children except the first (or only border-right on children except the last).
- In a stack: only draw border-top on children except the first.

This is equivalent to divide-* in spirit, but you own the selector logic.

### Outline vs border

Outlines are painted "over" the element and don't affect layout or cause reflow when toggled. That makes them excellent for selection/focus states and "inspect mode" highlighting in your renderer.

Borders, by contrast, participate in box sizing; switching border thickness can shift layout unless you compensate.

In practical wireframe rendering:

- Use borders for structural lines you want to be part of the geometry (e.g., a card's frame).
- Use outlines / rings for transient emphasis (selected, hovered, focus).

### Emerging standards: gap decorations

A brand‑new CSS Working Draft introduces "gap decorations" for grid/flex gutters (properties like row-rule and column-rule plus overlap control), essentially standardising "draw separators in the gap, not on the boxes". This is directly relevant to your "space in between" problem, but as a draft it should be treated as experimental until widely implemented.

For a production‑grade renderer today, emulate this behaviour with divide-* or pseudo‑elements.

---

## Component definitions and schema recommendations

### What your current schema already enables

Your current spec is structurally strong: it defines a deterministic node tree with layout primitives, sizing, grid placement, overlays, panes, visibility conditions, and a per‑page wireframe style contract.

Notably for the "spacing between two cards" problem:

- layout.gap exists and should be the canonical way to represent spacing.
- divider and spacer primitives exist for explicit separation when needed.
- wireframeStyle exists (border style/width, corner style/radius), but it is currently too small to fully describe card mode's surface/background/elevation.

### What's missing for "proper" two‑mode rendering

The missing pieces are mostly about render configuration and tokens, not about adding ad‑hoc styling to every node.

#### Recommended additions (minimal but high impact)

**Add page.rendering to select mode + theme**

So a page can declare:

- which mode to render (line or card)
- density (compact/comfortable) if desired

```yaml
rendering:
  mode: card          # card | line
  density: comfortable
```

**Extend responsiveness overrides**

Your responsive.allowedOverrides list currently omits padding and columns even though they are core layout fields. In practical UI, both are frequently responsive, and without them authors will emulate with spacers or extra wrappers. Recommend adding at least padding and columns to allowed overrides.

**Tighten layout.align / layout.justify values**

They are currently free strings. Consider enumerations aligned to flex/grid alignment keywords, because invalid values will silently degrade and harm determinism.

**Add separator intent at the layout level**

To solve "gap vs divider" consistently without author micromanagement, add:

```yaml
layout:
  separators: none | between
  separatorStyle: solid | dashed
```

This lets you enforce the rule:
If gap > 0, use gutters. If gap == 0 and separators requested, use parent dividers.

---

## Tailwind implementation patterns for both modes

### Card mode "grey background + white cards" recipe

- Page background: `bg-gray-100`
- Card: white surface + radius + subtle shadow
- Layout gaps: `gap-*` so the grey shows through gutters

Example:

```html
<div class="min-h-screen bg-gray-100 p-6">
  <div class="grid grid-cols-2 gap-6">
    <section class="rounded-xl bg-white shadow-sm p-5">
      <h3 class="text-gray-900 text-base font-semibold">Card A</h3>
      <button class="mt-6 inline-flex items-center justify-center rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800">
        Button
      </button>
    </section>
    <section class="rounded-xl bg-white shadow-sm p-5">
      <!-- ... -->
    </section>
  </div>
</div>
```

### Pure‑line mode recipe

Core rules:

- Prefer outlines for surface bounds and state highlights (no reflow).
- Use gap for separation wherever possible.
- When gap must be zero: use parent dividers (divide-x, divide-y).

Example:

```html
<div class="min-h-screen bg-white p-6">
  <div class="flex gap-6">
    <section class="outline outline-1 outline-gray-600 p-4">
      <div class="text-sm text-gray-900">Section A</div>
    </section>
    <section class="outline outline-1 outline-gray-600 p-4">
      <div class="text-sm text-gray-900">Section B</div>
    </section>
  </div>

  <!-- flush adjacency with single divider -->
  <div class="mt-8 outline outline-1 outline-gray-600 divide-x divide-gray-600 flex">
    <div class="p-4 flex-1">Left</div>
    <div class="p-4 flex-1">Right</div>
  </div>
</div>
```

### Renderer-friendly class mapping patterns

A deterministic mapping layer works best if you treat Tailwind classes as output, not as author input.

- `layout.type: row` → `flex`
- `layout.type: stack` → `flex flex-col`
- `layout.type: grid` → `grid` + `grid-cols-{n}`
- `layout.gap: 16` → `gap-4` (or `gap-[16px]`)
- `wireframeStyle.border.width: thin|medium` → `border` vs `border-2` (or outline equivalents)
- `wireframeStyle.border.style: solid|dashed` → `border-solid` vs `border-dashed` (or `divide-dashed`)

---

## Rendering engine algorithms

### Layout relationship

```
Page (template + slots)
  → Template slot region
    → Node (section/card container)
      → layout (row|grid|stack)
        → Child surface A
        → Child surface B
        → gap==0?
            no  → Render with gap (gutters visible)
            yes → Render separators at parent (divide-x/y)
```

### Pseudocode: DOM rendering without double lines

```
function renderPage(pageDoc, resolvedTree, mode, themeTokens):
  root = createElement("div")
  root.classList += ["wf", mode == "card" ? "wf-mode-card" : "wf-mode-line"]

  applyThemeVars(root, themeTokens, mode)
  renderNodeTree(root, resolvedTree.root, mode, themeTokens)
  postProcessStrokeResolution(root, mode, themeTokens)
  return root

function postProcessStrokeResolution(root, mode, themeTokens):
  for each containerEl in root where containerEl has layout:
    layout = containerEl.dataset.layoutType
    gapPx  = containerEl.dataset.gapPx

    if gapPx > 0:
      // Gutters win — no special divider handling needed
      continue

    if layout in ["row", "stack", "grid"] and containerWantsSeparators(containerEl):
      // Remove child outer strokes that would double up
      for child in directChildren(containerEl):
        child.classList.remove("border", "border-2", "outline", ...)
      // Add parent separators instead
      if layout == "row":   containerEl.classList.add("divide-x")
      if layout == "stack": containerEl.classList.add("divide-y")
```

---

## Technique comparison: "no double lines"

| Technique              | Best for                          | Pros                                              | Cons                                            |
|------------------------|-----------------------------------|---------------------------------------------------|-------------------------------------------------|
| Gutters via gap        | cards/sections; card mode         | shows spacing directly; minimal CSS               | requires nonzero gap; no divider when flush     |
| Parent dividers        | flush adjacency; lists            | guarantees single stroke; simple mapping          | primarily between direct children              |
| Single‑sided borders   | complex patterns, partial seps    | precise control; no Tailwind dependency           | requires custom selectors; easy to get wrong   |
| Outlines for emphasis  | focus/selected/inspect highlight  | no reflow; ideal for state overlay                | not suitable for between-children; can overlap |

---

## Accessibility and contrast

Even wireframes can be interactive artifacts; when they are, basic accessibility rules still apply.

- Non‑text contrast: essential component boundaries and states should meet 3:1 contrast against adjacent colours.
- Focus visibility is addressed in WCAG 2.2; focus indicators must be clearly visible.
- Target size: WCAG 2.2 adds a minimum pointer target size (24×24 CSS px). Platform guidance recommends larger: 44×44pt (Apple HIG), 48dp (Android). These are useful defaults for card mode prototypes.

---

## Prioritized authoritative sources

**Standards (normative):**
- W3C CSS Grid/Flex layout and gap/alignment model
- CSS outline behaviour (drawn over box; no reflow)
- WCAG 2.2 non-text contrast, focus appearance, and target size

**Framework documentation:**
- Tailwind CSS: gap, borders, divide-*, outlines, shadows

**Platform design guidance:**
- Apple HIG: 44×44pt button hit regions
- Android Developer: 48dp touch targets

**Design systems:**
- Material Design: elevation/surfaces/cards specifications

**UX practice:**
- NNG/Figma: low-fidelity wireframing conventions
