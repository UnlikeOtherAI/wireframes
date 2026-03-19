# Design System — Visual Language Reference

> **Source:** `docs/inspiration.png` (RentFlow dashboard by Dribbble)
> **Target platforms:** Web admin, iPad app, Mobile app
> **CSS framework:** Tailwind CSS
> **Icon set:** Font Awesome 6 (solid + regular)
> **Adaptations:** Left sidebar may serve as chat panel, workspace nav, or traditional menu

---

## 1. Color Palette

### Primary

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `primary-500` | `#F56522` | `bg-primary-500` | Active nav, CTA buttons, chart accents, toggle/pill active |
| `primary-600` | `#E05A1D` | `bg-primary-600` | Button hover, pressed states |
| `primary-50` | `#FEF0EB` | `bg-primary-50` | Active nav bg, hover tints, selected row bg |
| `primary-100` | `#FDDDD0` | `bg-primary-100` | Light badge bg, chart donut tertiary |
| `primary-700` | `#C44D18` | `bg-primary-700` | Dark accent for gradients |

### Neutrals

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `page-bg` | `#F5F3F0` | `bg-page` | Full-page background (warm off-white) |
| `card-bg` | `#FFFFFF` | `bg-white` | All card/panel surfaces |
| `sidebar-bg` | `#FFFFFF` | `bg-white` | Sidebar background |
| `border-default` | `#ECEAE6` | `border-border` | Card borders, dividers, table lines |
| `border-subtle` | `#F5F3F0` | `border-border-subtle` | Inner separators, very faint lines |
| `text-primary` | `#1A1D1F` | `text-gray-900` | Headings, KPI numbers, primary labels |
| `text-secondary` | `#6F767E` | `text-gray-500` | Subheadings, descriptions, secondary labels |
| `text-tertiary` | `#9A9FA5` | `text-gray-400` | Timestamps, hints, placeholder text |
| `text-on-primary` | `#FFFFFF` | `text-white` | Text on orange/primary backgrounds |

### Semantic

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| `success-text` | `#22C55E` | `text-green-500` | Positive % change indicators |
| `success-bg` | `#F0FDF4` | `bg-green-50` | Success badge background |
| `error-text` | `#EF4444` | `text-red-500` | Failed status text, negative indicators |
| `error-bg` | `#FEF2F2` | `bg-red-50` | Error badge background |
| `warning-text` | `#F56522` | `text-primary-500` | Pending status text |
| `warning-bg` | `#FEF0EB` | `bg-primary-50` | Pending badge background |

### Chart Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `chart-bar-1` | `#F56522` | Primary bar / filled segment |
| `chart-bar-2` | `#F9A87C` | Secondary bar / lighter segment |
| `chart-line` | `#F56522` | Sparkline / trend line |
| `chart-donut-1` | `#F56522` | Donut primary segment |
| `chart-donut-2` | `#F9A87C` | Donut secondary segment |
| `chart-donut-3` | `#FDDDD0` | Donut tertiary segment |

---

## 2. Typography

### Font Stack

```
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

Tailwind: `font-sans` with Inter configured in `tailwind.config.js`.

### Type Scale

| Token | Size | Weight | Line Height | Tailwind | Usage |
|-------|------|--------|-------------|----------|-------|
| `display` | 28px | 700 (bold) | 1.2 | `text-[28px] font-bold leading-tight` | KPI large numbers |
| `heading-lg` | 20px | 600 (semibold) | 1.3 | `text-xl font-semibold` | Section titles ("Sales Analytics") |
| `heading-md` | 16px | 600 (semibold) | 1.4 | `text-base font-semibold` | Card titles, property names |
| `heading-sm` | 14px | 600 (semibold) | 1.4 | `text-sm font-semibold` | Table column headers, nav group headers |
| `body` | 14px | 400 (regular) | 1.5 | `text-sm font-normal` | Body text, table cells, descriptions |
| `body-medium` | 14px | 500 (medium) | 1.5 | `text-sm font-medium` | Nav items, active labels, button text |
| `caption` | 12px | 400 (regular) | 1.5 | `text-xs font-normal` | Timestamps, meta info, chart axis labels |
| `caption-medium` | 12px | 500 (medium) | 1.5 | `text-xs font-medium` | Badge text, small labels, percentages |
| `overline` | 11px | 500 (medium) | 1.3 | `text-[11px] font-medium uppercase tracking-wider` | Section group headers ("Home", "Others") |

### Letter Spacing

- Overline/section labels: `tracking-wider` (0.05em)
- All other text: default (0)

---

## 3. Spacing & Layout

### Page-Level Spacing

| Property | Value | Tailwind |
|----------|-------|----------|
| Page background padding | 24px | `p-6` |
| Gap between sidebar and content | 0 (sidebar is flush) | — |
| Gap between main content and right sidebar | 16px | `gap-4` |
| Gap between card rows | 16px | `gap-4` |
| Gap between card columns | 16px | `gap-4` |

### Card Internal Spacing

| Property | Value | Tailwind |
|----------|-------|----------|
| Card padding | 20px | `p-5` |
| Card padding (compact, e.g. KPI) | 16px | `p-4` |
| Heading-to-content gap | 16px | `mb-4` |
| Label-to-value gap | 4px | `gap-1` |
| Between stacked items | 12px | `space-y-3` |
| Icon-to-text gap (inline) | 8px | `gap-2` |
| Icon-to-text gap (nav items) | 12px | `gap-3` |

### Component Spacing

| Property | Value | Tailwind |
|----------|-------|----------|
| Table row height | 56px | `h-14` |
| Table cell horizontal padding | 16px | `px-4` |
| Table cell vertical padding | 12px | `py-3` |
| Button padding (default) | 10px 16px | `px-4 py-2.5` |
| Button padding (small) | 6px 12px | `px-3 py-1.5` |
| Search input padding | 10px 12px | `px-3 py-2.5` |
| Badge padding | 4px 10px | `px-2.5 py-1` |

---

## 4. Corner Radii

| Element | Radius | Tailwind |
|---------|--------|----------|
| Cards / panels | 16px | `rounded-2xl` |
| Sidebar container | 16px (right edge only on desktop) | `rounded-r-2xl` or full `rounded-2xl` when floating |
| Buttons (default) | 10px | `rounded-[10px]` |
| Buttons (small/pill) | 20px (full pill) | `rounded-full` |
| Search input | 10px | `rounded-[10px]` |
| Active nav item | 10px | `rounded-[10px]` |
| Status badges | 12px (pill) | `rounded-full` |
| Avatar | 50% (circle) | `rounded-full` |
| Property images | 12px | `rounded-xl` |
| Toggle pill (Monthly/Annually) | 20px outer, 16px inner | `rounded-full` |
| Table container | 16px (inherits card) | `rounded-2xl` |
| Dropdown menus | 12px | `rounded-xl` |
| Tooltips | 8px | `rounded-lg` |
| CTA card (upgrade) | 16px | `rounded-2xl` |

---

## 5. Shadows & Elevation

The design uses a flat, card-on-tinted-background approach. Shadows are minimal.

| Level | CSS | Tailwind | Usage |
|-------|-----|----------|-------|
| `elevation-0` | none | `shadow-none` | Cards on warm bg (contrast is enough) |
| `elevation-1` | `0 4px 12px rgba(0,0,0,0.06)` | `shadow-card-hover` | Subtle lift on hover for interactive cards |
| `elevation-2` | `0 4px 12px rgba(0,0,0,0.08)` | `shadow-dropdown` | Dropdowns, popovers, floating menus |
| `elevation-3` | `0 8px 24px rgba(0,0,0,0.10)` | `shadow-modal` | Modals, dialogs, toasts |
| `elevation-sidebar` | `2px 0 8px rgba(0,0,0,0.04)` | `shadow-sidebar` | Sidebar right edge shadow (optional) |

### Card Hover Effect

```css
transition: box-shadow 150ms ease, transform 150ms ease;
/* On hover: */
box-shadow: 0 4px 12px rgba(0,0,0,0.06);
transform: translateY(-1px);
```

Tailwind: `transition-all duration-150 hover:shadow-card-hover hover:-translate-y-px`

---

## 6. Borders & Dividers

| Element | Border | Tailwind |
|---------|--------|----------|
| Card border | 1px solid `#ECEAE6` | `border border-[#ECEAE6]` |
| Table row divider | 1px solid `#F0EDEA` | `divide-y divide-[#F0EDEA]` |
| Sidebar divider (between groups) | 1px solid `#F0EDEA` | `border-b border-[#F0EDEA]` |
| Input border (default) | 1px solid `#ECEAE6` | `border border-[#ECEAE6]` |
| Input border (focused) | 1.5px solid `#F56522` | `focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20` |
| Search input border | 1px solid `#ECEAE6` | `border border-[#ECEAE6]` |

---

## 7. Component Specifications

### 7.1 Sidebar (Left Navigation)

```
Width:           240px (desktop), full-screen overlay (mobile)
Background:      #FFFFFF
Padding:         16px
Border-right:    none (relies on page bg contrast)
```

**Logo area:**
- Height: 48px
- Padding-bottom: 24px
- Logo icon: 28px, primary color
- Logo text: 18px, font-bold, text-primary

**Nav group header:**
- Font: overline (11px, medium, uppercase, tracking-wider)
- Color: text-tertiary
- Margin-top: 24px, margin-bottom: 8px

**Nav item:**
- Height: 36px
- Padding: 8px 12px
- Border-radius: 10px
- Font: body-medium (14px, 500)
- Icon: 16px, 12px gap to label
- FA icons: `fa-table-cells-large` (dashboard), `fa-compass` (discover), `fa-building` (property), `fa-users` (customer), `fa-chart-line` (analytics), `fa-clipboard-list` (orders), `fa-repeat` (transaction), `fa-inbox` (inbox), `fa-calendar` (calendar)

**Nav item states:**

| State | Text | Background | Border |
|-------|------|------------|--------|
| Default | `text-secondary` | transparent | none |
| Hover | `text-primary` | `#F6F4F2` | none |
| Active | `primary-500` | `primary-50` | 1px solid `primary-500`/25 |
| Focus-visible | inherit | inherit | `ring-2 ring-primary-500/30` |
| Disabled | `text-tertiary` | transparent | none |

**Bottom CTA card:**
- Background: gradient `from-primary-500 to-primary-700`
- Border-radius: 16px
- Padding: 20px
- Icon: 32px circle with white icon
- Title: 16px, bold, white
- Subtitle: 12px, white/80
- Button: white bg, primary text, rounded-full, 14px medium

### 7.2 Top Header Bar

```
Height:          64px
Background:      transparent (sits on page-bg)
Padding:         0 24px
Layout:          flex row, items-center, justify-between
```

**Search input:**
- Width: 280px
- Height: 40px
- Background: white
- Border: 1px solid border-default
- Border-radius: 10px
- Placeholder: "Search task" in text-tertiary
- Left icon: `fa-magnifying-glass` 14px text-tertiary
- Right badge: keyboard shortcut indicator, 12px mono text, bg `#F6F4F2`, rounded-md, px-1.5

**Right controls:**
- Icon buttons: 40px circle, rounded-full, border 1px border-default, bg-white
- Icons: `fa-envelope` (messages), `fa-bell` (notifications), 18px, text-secondary
- Notification dot: 8px circle, bg-primary-500, absolute top-1.5 right-1.5
- Avatar: 40px circle, object-cover
- User name: 14px, semibold, text-primary
- User email: 12px, text-tertiary

### 7.3 KPI Stat Cards

```
Layout:          grid, 3 columns, gap-4
Card height:     auto (~120px)
Padding:         16px 20px
```

**Structure:**
- Top row: Title (caption-medium, text-secondary) + Icon (right-aligned, 36px circle bg primary-50, icon primary-500)
- Bottom row: Large number (display, 28px bold) + % change badge + mini sparkline
- Percentage badge: caption-medium, success-text on success-bg or error-text on error-bg, rounded-full, px-2 py-0.5
- Sparkline: 60px wide, 28px tall, stroke primary-500, stroke-width 2, no fill
- FA card icons: `fa-building` (properties), `fa-pen-to-square` (new agent), `fa-user-group` (tenants)

### 7.4 Chart Cards

**Bar Chart (Sales Analytics):**
- Card: full card styling (rounded-2xl, p-5, border)
- Header: heading-lg left, toggle pill right ("Monthly" / "Annually"), three-dot menu
- Toggle pill: bg `#F0EDEA`, active segment bg primary-500 text-white, rounded-full, 28px height
- Bars: rounded-t-md (4px top radius), gap-1 between grouped bars
- Bar colors: primary-500 (rent), primary-200 `#F9A87C` (sale)
- Legend: 8px circles + caption text, positioned top-right inside chart area
- Axis labels: caption, text-tertiary
- Grid lines: 1px dashed `#F0EDEA`

**Donut Chart (Property Overview):**
- Card: same card styling
- Donut: 120px diameter, 20px stroke width, rounded linecaps
- Center label: "$12,500" heading-md bold, "Total Revenue" caption text-secondary
- Legend: right side, vertical list, 8px color dot + label + value
- Segments: primary-500, primary-200, primary-100

### 7.5 Data Table

**Container:** inside card (inherits rounded-2xl, border, bg-white)

**Table header row:**
- Background: transparent (or very faint `#FAFAF9`)
- Height: 44px
- Font: heading-sm (14px, semibold), text-secondary
- Border-bottom: 1px solid border-default
- Checkbox: 18px, rounded-md, border 1.5px border-default

**Table toolbar:**
- Height: 48px
- Title: heading-lg left-aligned
- Search: compact version, 200px wide
- Filter button: icon + "Filter", bordered, rounded-[10px]
- Sort button: icon + "Sort by", bordered, rounded-[10px]
- FA toolbar icons: `fa-magnifying-glass`, `fa-filter`, `fa-sort`

**Table data row:**
- Height: 56px
- Font: body (14px, regular)
- Hover: bg `#FAFAF9`
- Divider: 1px solid border-subtle
- Avatar in row: 32px circle
- Status badge: pill, rounded-full, px-2.5 py-1
- Three-dot menu: `fa-ellipsis-vertical`, text-tertiary, 32px hit area

### 7.6 Right Sidebar (Property Cards / Detail Panel)

```
Width:           300px (desktop), bottom sheet (mobile)
Background:      #FFFFFF
Border-radius:   16px
Padding:         20px
```

**Property card:**
- Image: full-width, 160px height, rounded-xl, object-cover
- Price: heading-md, bold, text-primary, mt-3
- Suffix: body, text-secondary, inline "/month"
- Title: heading-sm, text-primary, mt-1
- Location: caption, text-tertiary, with `fa-location-dot` icon
- Amenity row: flex row, gap-4, mt-2, each item has icon + caption text
- Amenity icons: `fa-bed`, `fa-bath`, `fa-ruler-combined` (or `fa-expand`)
- Three-dot menu: absolute top-right of card
- Divider between cards: 1px solid border-subtle, my-4

### 7.7 Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | primary-500 | white | none | primary-600, shadow-sm |
| Secondary | white | text-primary | 1px border-default | bg `#F6F4F2` |
| Ghost | transparent | text-secondary | none | bg `#F6F4F2` |
| Danger | error-bg | error-text | none | darker red bg |

All buttons: `rounded-[10px]`, `px-4 py-2.5`, `text-sm font-medium`, `transition-all duration-150`

**Disabled state:** `opacity-50 cursor-not-allowed pointer-events-none` — applies to all variants.

**Loading state:** replace text with 16px spinner (`fa-spinner fa-spin`), maintain button width, apply disabled treatment.

### 7.8 Form Inputs

```
Height:          40px
Background:      white
Border:          1px solid #ECEAE6
Border-radius:   10px
Padding:         10px 12px
Font:            14px regular
Placeholder:     text-tertiary
Focus ring:      1.5px primary-500, ring-1 ring-primary-500/20
```

### 7.9 Badges / Status Pills

```
Padding:         4px 10px
Border-radius:   full (pill)
Font:            12px medium
```

| Status | Text Color | Background | Border |
|--------|-----------|------------|--------|
| Pending | `#F56522` | `#FEF0EB` | 1px solid `#F56522`/20 |
| Active / Success | `#22C55E` | `#F0FDF4` | 1px solid `#22C55E`/20 |
| Failed / Error | `#EF4444` | `#FEF2F2` | 1px solid `#EF4444`/20 |
| Neutral / Draft | `#6F767E` | `#F0EDEA` | 1px solid `#6F767E`/15 |

### 7.10 Avatars

| Size | Dimension | Tailwind | Usage |
|------|-----------|----------|-------|
| `xs` | 24px | `w-6 h-6` | Inline mentions |
| `sm` | 32px | `w-8 h-8` | Table rows, compact lists |
| `md` | 40px | `w-10 h-10` | Header profile, chat |
| `lg` | 48px | `w-12 h-12` | Profile cards |
| `xl` | 64px | `w-16 h-16` | Settings, profile page |

All: `rounded-full object-cover border-2 border-white`

**Initial fallback** (no photo): `bg-primary-50 text-primary-500 font-medium`, centered uppercase initials. Font size scales with avatar: xs=10px, sm=11px, md=14px, lg=16px, xl=20px.

---

## 8. Layout Grid

### Desktop (>= 1280px)

```
Sidebar:         240px fixed left
Content:         flex-1 (fluid)
Right panel:     300px fixed right (optional, context-dependent)
Page padding:    24px
Content grid:    CSS grid or flex, gap-4
Max content:     none (fluid within remaining space)
```

### Tablet / iPad (768px - 1279px)

```
Sidebar:         collapsed to 64px icon-only rail, expandable on tap
Content:         fluid
Right panel:     hidden, accessible as slide-over from right
Page padding:    16px
```

### Mobile (< 768px)

```
Sidebar:         hidden, hamburger menu opens full-screen overlay
Content:         single column, full width
Right panel:     hidden, opens as bottom sheet
Page padding:    12px
Card padding:    16px
```

---

## 9. Interaction & Motion

### Transitions

| Property | Duration | Easing | Tailwind |
|----------|----------|--------|----------|
| Colors, backgrounds | 150ms | ease | `transition-colors duration-150` |
| Shadows, transforms | 150ms | ease | `transition-all duration-150` |
| Sidebar expand/collapse | 200ms | ease-in-out | `transition-all duration-200` |
| Dropdown open | 150ms | ease-out | `transition-all duration-150` |
| Page/route transitions | 200ms | ease-in-out | — |
| Toast enter | 300ms | ease-out | — |
| Toast exit | 200ms | ease-in | — |

### Hover States

- Cards: subtle lift (`hover:-translate-y-px hover:shadow-card-hover`)
- Buttons: darken bg by one shade
- Nav items: bg shifts to `#F6F4F2`, text darkens
- Table rows: bg shifts to `#FAFAF9`
- Icon buttons: bg shifts to `#F6F4F2`

### Focus States

- All interactive elements: `focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:outline-none`
- Inputs: border changes to primary-500

---

## 10. Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        page: '#F5F3F0',
        primary: {
          50:  '#FEF0EB',
          100: '#FDDDD0',
          200: '#F9A87C',
          300: '#F78B55',
          400: '#F6763B',
          500: '#F56522',
          600: '#E05A1D',
          700: '#C44D18',
          800: '#A34013',
          900: '#7C310E',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#FAFAF9',
          muted: '#F6F4F2',
        },
        border: {
          DEFAULT: '#ECEAE6',
          subtle: '#F5F3F0',
          muted: '#F0EDEA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'button': '10px',
        'input': '10px',
      },
      boxShadow: {
        'card-hover': '0 4px 12px rgba(0,0,0,0.06)',
        'dropdown': '0 4px 12px rgba(0,0,0,0.08)',
        'modal': '0 8px 24px rgba(0,0,0,0.10)',
        'sidebar': '2px 0 8px rgba(0,0,0,0.04)',
      },
      spacing: {
        'sidebar': '240px',
        'sidebar-collapsed': '64px',
        'right-panel': '300px',
      },
    },
  },
};
```

---

## 11. Icon Mapping (Font Awesome 6)

### Navigation

| Concept | FA Class | Style |
|---------|----------|-------|
| Dashboard / Grid | `fa-table-cells-large` | solid |
| Discover / Explore | `fa-compass` | regular |
| Property / Building | `fa-building` | solid |
| Customers / Users | `fa-users` | solid |
| Analytics / Chart | `fa-chart-line` | solid |
| Orders / Clipboard | `fa-clipboard-list` | solid |
| Transactions | `fa-repeat` | solid |
| Inbox / Messages | `fa-inbox` | solid |
| Calendar | `fa-calendar` | regular |
| Chat / Messaging | `fa-comment` | regular |
| Workspace | `fa-briefcase` | solid |

### Actions

| Concept | FA Class | Style |
|---------|----------|-------|
| Search | `fa-magnifying-glass` | solid |
| Filter | `fa-filter` | solid |
| Sort | `fa-sort` | solid |
| More / Menu | `fa-ellipsis-vertical` | solid |
| Edit | `fa-pen-to-square` | solid |
| Delete | `fa-trash` | solid |
| Add / Create | `fa-plus` | solid |
| Close | `fa-xmark` | solid |
| Settings | `fa-gear` | solid |
| Notifications | `fa-bell` | regular |
| Email | `fa-envelope` | regular |
| Download | `fa-download` | solid |
| Upload | `fa-upload` | solid |
| Refresh | `fa-arrows-rotate` | solid |

### Data / Content

| Concept | FA Class | Style |
|---------|----------|-------|
| Location | `fa-location-dot` | solid |
| Bed | `fa-bed` | solid |
| Bath | `fa-bath` | solid |
| Area / Size | `fa-ruler-combined` | solid |
| Price / Money | `fa-dollar-sign` | solid |
| User / Profile | `fa-circle-user` | regular |
| Tag | `fa-tag` | solid |
| Check / Success | `fa-circle-check` | solid |
| Warning | `fa-triangle-exclamation` | solid |
| Error / Fail | `fa-circle-xmark` | solid |
| Info | `fa-circle-info` | solid |
| Arrow up (positive) | `fa-arrow-up` | solid |
| Arrow down (negative) | `fa-arrow-down` | solid |

---

## 12. Responsive Breakpoints

```js
// Matches Tailwind defaults, used consistently
screens: {
  'sm': '640px',    // Mobile landscape
  'md': '768px',    // Tablet portrait / iPad mini
  'lg': '1024px',   // Tablet landscape / iPad
  'xl': '1280px',   // Desktop
  '2xl': '1536px',  // Large desktop
}
```

### Sidebar Behavior

| Breakpoint | Sidebar State |
|------------|---------------|
| `< md` | Hidden; hamburger icon in header opens full-screen overlay |
| `md` to `< lg` | Icon rail (64px), tap to expand full-width overlay |
| `lg` to `< xl` | Icon rail (64px), tap to expand inline (pushes content) |
| `>= xl` | Full sidebar (240px) always visible |

### Right Panel Behavior

| Breakpoint | Panel State |
|------------|-------------|
| `< xl` | Hidden; button opens bottom sheet (mobile) or slide-over (tablet) |
| `>= xl` | Visible as fixed right column (300px) |

---

## 13. Dark Mode Tokens (Future)

| Token | Light | Dark |
|-------|-------|------|
| `page-bg` | `#F5F3F0` | `#1A1D1F` |
| `card-bg` | `#FFFFFF` | `#26292B` |
| `text-primary` | `#1A1D1F` | `#F5F3F0` |
| `text-secondary` | `#6F767E` | `#9A9FA5` |
| `border-default` | `#ECEAE6` | `#33363A` |
| `primary-500` | `#F56522` | `#F8793E` |

---

## 14. Gradient Recipes

**CTA / Upgrade card:**
```css
background: linear-gradient(135deg, #F56522 0%, #C44D18 100%);
```
Tailwind: `bg-gradient-to-br from-primary-500 to-primary-700`

**Sparkline area fill (subtle):**
```css
background: linear-gradient(180deg, rgba(245,101,34,0.15) 0%, rgba(245,101,34,0) 100%);
```

**Skeleton loading shimmer:**
```css
background: linear-gradient(90deg, #F5F3F0 25%, #ECEAE6 50%, #F5F3F0 75%);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

---

## 15. Sidebar Adaptations

The left sidebar is context-adaptive. Same styling, different content:

| Context | Sidebar Content |
|---------|----------------|
| **Admin dashboard** | Navigation menu (as in reference) |
| **Chat / Messaging** | Conversation list with avatars, last message preview, timestamps |
| **Workspace** | Project list, folder tree, recent files |
| **Settings** | Settings category list (profile, billing, team, integrations) |

**Common sidebar rules regardless of context:**
- Same 240px width, white bg, 16px padding
- Same nav item height (36px), border-radius (10px), hover/active states
- Active item uses primary-50 bg, primary-500 text, faint primary-500/25 border
- Bottom area reserved for CTA or user profile card
- Scrollable middle section with `overflow-y-auto` and subtle scrollbar

---

## 16. Icon Sizing Rules

| Context | Size | Tailwind | Notes |
|---------|------|----------|-------|
| Nav sidebar | 16px | `text-base` (w-4) | Centered in 36px row |
| Header actions | 18px | `text-lg` | Inside 40px circular buttons |
| KPI card icon | 18px | `text-lg` | Inside 36px circle |
| Table row action | 16px | `text-base` | Three-dot menu, inline actions |
| Badge / pill inline | 12px | `text-xs` | Inline with 12px text |
| Amenity row | 14px | `text-sm` | Property card amenities |
| Search input | 14px | `text-sm` | Left-aligned magnifying glass |
| Chart legend | 8px | — | Colored dot, not FA icon |

---

## 17. Table Selection States

**Checkbox:**
- Size: 18px, `rounded-md`, border 1.5px `border-default`
- Unchecked: white bg, `border-default` border
- Checked: `primary-500` bg, white checkmark, no visible border
- Indeterminate: `primary-500` bg, white dash
- Hover (unchecked): border darkens to `#D5D2CE`

**Selected row:**
- Background: `primary-50` (`#FEF0EB`)
- Left border accent: 2px solid `primary-500` (optional)
- Checkbox: checked state

**Bulk action bar** (appears when 1+ rows selected):
- Sticky top of table, bg-white, shadow-sm, rounded-xl
- Shows: selected count, "Select all" link, action buttons (Delete, Export, Assign)
- Dismiss: "Clear selection" text button

---

## 18. Search Field States

| State | Background | Border | Icon | Text |
|-------|-----------|--------|------|------|
| Default | white | `border-default` | `text-tertiary` | placeholder `text-tertiary` |
| Hover | white | `#D5D2CE` | `text-secondary` | placeholder `text-tertiary` |
| Focused | white | `primary-500` 1.5px + ring | `text-secondary` | input `text-primary` |
| Filled | white | `border-default` | `text-secondary` | input `text-primary` |
| Filled + clear | white | `border-default` | `text-secondary` | `fa-xmark` right, 14px, `text-tertiary` |

Shortcut badge (right side): `text-[11px] font-mono`, bg `#F6F4F2`, `rounded-md`, `px-1.5 py-0.5`

---

## 19. Empty, Loading & Error States

### Loading (Skeleton)

All components use the shimmer gradient from Section 14. Structure mirrors the real component layout.

| Component | Skeleton Shape |
|-----------|---------------|
| KPI card | 1 short bar (title) + 1 wide bar (number) + 1 small bar (badge) |
| Bar chart | 6 vertical bars of varying height, no labels |
| Donut chart | Circle with inner circle, no labels |
| Table | 5 rows of alternating-width bars |
| Right panel card | Rounded rectangle (image) + 2 bars (text) |

### Empty

| Component | Content |
|-----------|---------|
| Table | Centered `fa-inbox` 48px `text-tertiary`, "No results found" `heading-sm`, "Try adjusting your filters" `caption text-tertiary` |
| Right panel | "No properties selected" `body text-secondary`, centered |
| Chart | "No data available" centered inside chart area, `caption text-secondary` |

### Error

- Red-tinted card: `bg-red-50 border border-red-200 rounded-xl p-4`
- Icon: `fa-circle-exclamation` 20px `text-red-500`
- Message: `body text-red-700`
- Retry button: ghost style, `text-red-600`

---

## 20. Scrollbar Treatment

```css
/* Sidebar and right panel scrollable areas */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #D5D2CE;
  border-radius: 2px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #B5B2AE;
}
```

Tailwind: use `scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent` (requires `tailwind-scrollbar` plugin) or apply via `@layer utilities`.

Table horizontal scroll: standard browser scrollbar, no customization.

---

## 21. Mobile Dashboard Adaptations

### KPI Row
- Changes from 3-column grid to horizontal scroll (`overflow-x-auto flex gap-3`)
- Cards: min-width 200px, snap to center (`snap-x snap-mandatory`, `snap-center`)
- Sparklines hidden on mobile to save space

### Charts
- Bar chart and donut chart stack vertically (full width each)
- Bar chart: reduce to 4 visible bars, horizontal scroll for more
- Donut chart: legend moves below the donut (stacks vertically)
- Toggle pill remains above chart

### Table
- Horizontal scroll with sticky first column (name/avatar)
- Or: card view — each row becomes a card with label-value pairs stacked vertically
- Sort/filter buttons move into a bottom sheet triggered by filter icon
- Checkbox column hidden; long-press to select

### Right Panel
- Opens as bottom sheet, `max-height: 80vh`, drag handle at top
- Property cards stack vertically, full width
- Dismiss: swipe down or tap backdrop

### Header
- Search icon only (expands to full-width input on tap)
- Notification/message icons remain
- Avatar moves to hamburger menu panel

---

## 22. Motion Specifications

### Dropdown / Popover
```css
/* Enter */
opacity: 0 → 1; transform: scale(0.95) → scale(1);
duration: 150ms; easing: ease-out;
/* Exit */
opacity: 1 → 0; transform: scale(1) → scale(0.95);
duration: 100ms; easing: ease-in;
```

### Slide-Over (Right Panel on Tablet)
```css
transform: translateX(100%) → translateX(0);
duration: 250ms; easing: cubic-bezier(0.16, 1, 0.3, 1);
/* Backdrop: opacity 0 → 0.3, duration 200ms */
```

### Bottom Sheet (Mobile)
```css
transform: translateY(100%) → translateY(0);
duration: 300ms; easing: cubic-bezier(0.16, 1, 0.3, 1);
/* Backdrop: opacity 0 → 0.3, duration 200ms */
```

### Sidebar Expand/Collapse (Tablet)
```css
width: 64px → 240px;
duration: 200ms; easing: ease-in-out;
/* Icon labels fade in after width transition completes */
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
Tailwind: `motion-reduce:transition-none motion-reduce:animate-none`
