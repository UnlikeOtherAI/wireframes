# Wireframe elements — cheat sheet

## Which element

- **containers**: section, card, stack, row, grid, split, form, carousel
- **text**: heading, paragraph, text, code, badge, avatar, icon, image, rating, stat, progress, skeleton, divider, spacer, empty_state
- **controls**: button, segmented, input, textarea, select, checkbox, radio, toggle, choice_group, tags_input, upload, picker, editor
- **navigation**: tab_bar, bottom_tab_bar, breadcrumb, pagination, stepper, nav, menu, app_bar, action_sheet, page_header
- **data**: table, list, chart, calendar, kanban, tree, accordion
- **feedback**: alert

Pick the element that *is* the thing. Do not build a card out of a section and a
border; use `card`. Do not build a nav out of buttons; use `nav`.

## Boxes: the one rule that matters

Only some elements draw a visible box. The engine decides, in this order:

1. `surface: true` / `surface: false` on the node wins over everything.
2. A border in `wireframeStyle` means you want a box.
3. The element type decides: `card`, `alert`, `code`, `upload`, `editor`,
   `calendar`, `picker` always box; `row`, `stack`, `grid`, `split`, `form`
   never do; `tab_bar`, `app_bar`, `divider` draw one edge.
4. Overlay chrome owns the frame, so overlay content never double-boxes.
5. Template regions box unless they are a slot or `role: main`.
6. A pane is a panel, so it boxes.
7. If the parent separates its children, the parent draws the strokes.
8. Grid children are tiles, so they box.
9. Inside a box, nothing boxes itself again — use `card` if you want one.
10. At the top of a page a `section` boxes, unless it is an untitled row
    (that reads as a toolbar).

`section` means "engine, you decide". `card`, `row`, `stack` and `grid` are
explicit — prefer them when you know what you want.

Run `wf why <nodeId> --page <pageId>` to see the rule that fired and the one
edit that flips it.

## Colour

The wireframe is greyscale. Four hues exist, and they answer one question —
how bad is this:

| Where | How to ask for it |
|---|---|
| `alert` | `variant: info \| success \| warning \| error` tints the left stripe |
| `badge` | `tone: info \| success \| warning \| danger` makes it a status pill |
| `button` | `variant: danger` for an action that destroys something |
| `input` and friends | `error: <message>` turns the field and its message red |
| `menu` / `action_sheet` rows | `danger: true` |

Nothing else takes a hue. Charts, stat trends, headings, primary buttons and
every fill stay grey on purpose: a wireframe that colours by brand or by
category stops reading as a wireframe. `badge.variant` is the shape
(neutral, outline, dot, pill); `badge.tone` is the status.

## Proportions

Give a region a `role` and it gets the right size automatically:
header, app_bar, sidebar, nav, main, aside, footer, toolbar, tabbar, form, dialog, sheet, drawer, content.

A `role: sidebar` region is 256px on web, 220 on tablet; a header is 56 tall.
Override one value project-wide in `manifest.sizing`, or locally with `size`
on the node. Available tokens: sidebar.width, sidebar.collapsedWidth, sidebar.minWidth, aside.width, header.height, tabbar.height, footer.minHeight, page.gutter, content.narrowWidth, card.padding, card.gap, grid.gap, control.height, control.minWidth, row.height, modal.width, drawer.width, sheet.maxHeight, chart.height, stat.minHeight, statusbar.height, homeindicator.height.

Never hand-size a sidebar, header, footer, tab bar or control unless the design
actually differs from the default.

## Mobile

Set `viewport.platform` to `ios` or `android` (it defaults to `ios` for
`device: mobile`). The elements are the same; only chrome changes — control
heights, corner radii, title alignment, status bar, home indicator. Native-only
elements: `app_bar`, `bottom_tab_bar`, `action_sheet`, `picker`,
`list` with `kind: settings`, `input` with `inputType: stepper`, and
`button` with `fab: true`.

## Popups, dropdowns and dialogs

Overlays live in `page.overlays` (or `template.overlays`) and open from an
interaction:

```yaml
- id: open_menu
  component: button
  props: { label: Actions }
  interaction:
    - type: open_overlay
      targetOverlay: actions_menu
overlays:
  - id: actions_menu
    type: menu           # modal alert dropdown popover menu drawer_left
                         # drawer_right bottom_sheet toast tooltip
    trigger: open_menu   # anchors the popup to that node
    placement: bottom    # top bottom left right center
    dismissOn: [outside, escape]
    props:
      title: Actions
      actions: [{ label: Cancel }, { label: Save, variant: primary }]
    content:
      - id: actions_list
        component: menu
        props:
          items: [Rename, Duplicate, { label: Delete, danger: true }]
```

Anchored types (`dropdown`, `popover`, `menu`, `tooltip`) position themselves
against their `trigger` at runtime, flip when they would overflow, and match the
trigger's width. `dismissOn` accepts `backdrop`, `outside`, `escape`, `timeout`.

## Placeholders

Leave text out and the element renders a skeleton bar rather than a gap, which
is what a wireframe should show. `paragraph: { lines: 3 }`, `skeleton`,
`table: { state: loading }` and `image` with no `src` all do this.

