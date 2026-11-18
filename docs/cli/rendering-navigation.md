# Navigation rendering

Navigation rails and panel colours, the shared item model in the navigation
family, item states, and the `command`, `menubar` and `nav variant: top`
elements. The item model itself is in
[schema-systems.md §15.4](schema-systems.md); the state serializer and owners
are in [rendering-states.md](rendering-states.md).

## Rails and panel colours

Use nav.props.variant: rail for a compact primary rail, or sidebar for coloured
side navigation. Omitting variant preserves the existing navigation treatment.
Rail uses sidebar.collapsedWidth (64px by default); size.width overrides it.
Its whole icon-and-label tile is clickable and at least 44×44px. iconStyle on
items supports solid, regular and brands. Long labels retain their accessible name.
collapsed hides the rail caption visually while preserving its accessible name.

Company skins can use nav.rail and nav.sidebar roles. Explicit nav/app_bar
backgrounds paint the panel, including background set on the node itself.
Inherited page/skin defaults alone preserve transparent legacy panels. A selected
rail icon box or sidebar row uses accent for its fill and text for its foreground;
choose a pair with at least 4.5:1 contrast. The no-variant selected style is unchanged.

## Items

Every navigation list reads the shared item model through its profile:

| Prop | Profile |
|---|---|
| `tab_bar.tabs`, `bottom_tab_bar.tabs`, `page_header.tabs` | `tabs` |
| `breadcrumb.items`, `stepper.steps`, `page_header.breadcrumb` | `basic` |
| `nav.items` | `nav` |
| `menu.items`, `action_sheet.items` | `menu` |
| `page_header.actions` | `basic`, through `lib.actionButtons` |
| `command.items`, `menubar.items` | `canonical` |

App-bar `actions` are glyph names, not items. Tab, crumb and step lists skip
`separator` and `heading` entries. Menus, the action sheet, `nav`, `command`
and `menubar` panels draw them: a `separator` is a rule, a `heading` a small
caption, and a `group` its heading followed by its items.

## Which item is on

Tabs, nav rows, crumbs and steps have one "on" state each. It is decided in
this order:

1. An item's own `selected`, or its `current` when `selected` is absent. Items
   marked `true` are exactly the ones on.
2. Otherwise the element's own rule:
   - `nav`: every row whose `route` is the page being rendered.
   - `breadcrumb` and `page_header.breadcrumb`: the last crumb.
   - `stepper`: step number `current` (default 1).
   - Tabs have no rule: nothing is on.
3. The rule never turns on an item marked `selected: false` (or
   `current: false`).

`nav` decides across all its levels at once: a `selected: true` on a nested row
turns route inference off for the whole nav. `pagination` marks page `page`.

Menu, command and menubar rows keep `selected` (a highlighted row) and
`current` apart.

## State attributes

States go on the element that owns them, through `lib.stateAttrs`:

| Element | Markup | On | Disabled |
|---|---|---|---|
| `tab_bar` tab without a route | `<button>` | `aria-pressed="true" data-wf-selected` | native `disabled`, `data-wf-disabled` |
| Routed tab, `bottom_tab_bar` and `page_header` tabs | `<a>` or `<span>` | `aria-current="page" data-wf-current` | `aria-disabled="true" data-wf-disabled` |
| `nav` row | `<a>` or `<span>` | `aria-current="page" data-wf-current` | `aria-disabled="true" data-wf-disabled` |
| Crumb | `<a>` or `<span>` | `aria-current="location" data-wf-current` | `aria-disabled="true" data-wf-disabled` |
| Step | `<span class="wf-step">` | `aria-current="step" data-wf-current` | `aria-disabled="true" data-wf-disabled` |
| Current page number or dot | `<button>` or `<span>` | `aria-current="page" data-wf-current` | — |
| Menu, command and menubar panel row | `<a>` or `<span>` | `data-wf-selected`; `current` adds `aria-current="true" data-wf-current` | `aria-disabled="true" data-wf-disabled` |
| Action sheet row | `<button>` | — | native `disabled`, `data-wf-disabled` |

A tab button that was blank or unselectable was already disabled; it keeps its
bare `disabled` attribute. Tab buttons keep `aria-pressed` semantics, and the
runtime updates `data-wf-selected` whenever it updates `aria-pressed`.

Disabled rows are drawn at reduced opacity. A selected menu or command row
gets a fill in card mode and a dashed outline in line mode; a current one is
bold. Legacy markup only gains attributes, so tabs, nav rows, crumbs, steps
and page numbers that were already on look exactly as before.

## Links

An item `route` renders a link in `nav`, `breadcrumb`, `tab_bar`,
`bottom_tab_bar`, `page_header` crumbs and tabs, `menu` and `command`:

- A known route id is `<a href data-wf-route-target>`.
- An unknown route id is plain text, as before.
- A `disabled` item has no `href`: it is a `<span>` with `aria-disabled`.
- When the element itself has an `interaction`, no item links, so anchors
  never nest and a click runs only the element's interaction. `page_header`
  actions then render as plain buttons.
- The current crumb never links.

`menubar` panel rows are display-only and never link.

## Expanded rows

A `nav` row with nested `items` shows them, as before. Setting `expanded`
makes it a disclosure:

- `expanded: true`: children shown, a down chevron, `aria-expanded="true"
  data-wf-expanded`.
- `expanded: false`: children hidden, a right chevron, `aria-expanded="false"`.

Without `expanded`, the row has no chevron and no `aria-expanded`.

## `nav` `variant: top`

A horizontal site menu (`wf-nav-top`):

- A top-level item without children is a link, like a sidebar row.
- A top-level item with nested `items`, or a `type: group`, is a disclosure
  `<button>` with a down chevron and `aria-expanded`. Its own `route` is not
  used.
- `open` names the item whose panel is drawn, by `value` or `label`. Without a
  match, the first item with `expanded: true` opens. Only one panel is open.
- The panel (`wf-nav-panel`) hangs below its trigger, out of the layout flow,
  so give the region room for it. Each entry is a link with an icon box, the
  label and a `description` line. Headings, groups and separators work inside
  the panel.
- Separators at the top level are short vertical rules.

```yaml
- nav:
    variant: top
    open: Products
    items:
      - label: Products
        items:
          - { label: Analytics, icon: chart-line, description: Dashboards and reports, route: analytics }
          - { label: Automation, icon: bolt, description: Scheduled workflows, route: automation }
      - { label: Pricing, route: pricing }
```

## `menubar`

A desktop application menu row (`wf-menubar`), never framed:

- Each top-level item is a `<button class="wf-menubar-trigger">`. Items with
  nested `items` are disclosures with `aria-expanded`.
- `open` names the menu drawn open, by `value` or `label`; without a match, the
  first item with `expanded: true` opens. The panel (`wf-menubar-panel`) hangs
  below its trigger, out of the layout flow.
- Panel rows draw the icon, label and `shortcut` as key chips. A row with
  nested `items` shows a right chevron; its submenu is not drawn.
- Rows support `separator`, `heading` and `group` entries, plus `disabled`,
  `selected` and `current`.

```yaml
- menubar:
    open: Edit
    items:
      - { label: File, items: [New, Open] }
      - label: Edit
        items:
          - { label: Undo, shortcut: "⌘Z" }
          - { type: separator }
          - { label: Find, items: [Find…, Replace…] }
```

## `command`

A display-only command palette (`wf-command`). Its frame follows the frame
rules (`C`): a box on its own, unframed inside a card or modal.

- The search row shows `query` in ink, or `placeholder` muted. With neither,
  it shows a skeleton bar.
- `items` are rows with `icon`, `label`, `description` and `shortcut`.
  Consecutive rows form one list; a `group` is its heading plus its own list.
  `heading` and `separator` entries draw on their own.
- `selected` highlights a row. A row with a known `route` is a link.
- With no rows, `empty` is shown (default "No results found.").
- `footer: true` adds a key-hint bar: ↑ ↓ Navigate, ↵ Open, esc Close.

Lists are plain `<ul>` elements; there are no `listbox` or `option` roles.

```yaml
- command:
    placeholder: Search or run a command
    footer: true
    items:
      - type: group
        label: Suggestions
        items:
          - { label: New project, icon: plus, shortcut: "⌘N", selected: true }
          - { label: Settings, icon: gear, description: Workspace preferences, route: settings }
```

## Key chips

`command` rows and `menubar` panel rows draw `shortcut` as `<kbd class="wf-kbd">`
chips inside `<span class="wf-keys">`. `menu` keeps its plain shortcut text.

- A list (`[⌘, K]`) is one chip per entry.
- A string splits on spaces and on `+` between keys: `Ctrl+K` is Ctrl, K and
  `G D` is G, D.
- Leading modifier glyphs (⌘ ⇧ ⌥ ⌃) become chips of their own: `⌘⇧P` is ⌘, ⇧,
  P, and `⌘+` is ⌘, +.

Line mode draws chips square with a dark outline.

## Action sheet

`action_sheet` items use the `menu` profile. `{divider: true}` and
`type: separator` now draw a gap between row groups instead of a blank row; a
`heading` or `group` label is a small centred caption; `disabled` rows are
native disabled buttons. Item routes are not used.
