# A leading control in an app bar

## Problem Statement

An app bar could not hold a button on its leading side. `leading` drew a glyph, which cannot be
pressed, and the bar's children were always drawn after its actions. A menu button that opens a
drawer could only sit on the trailing side.

It was found on an iPad: "this needs to be moved to the other side, so it needs to be on the
left", said of a menu button in a bar with a title. No edit could do it, so the on-device model
moved the button out of the bar three times.

## Current Behavior

- `renderAppBar` (`engine/renderer/primitives/navigation.js`) draws `props.leading` as an icon
  in `.wf-appbar-leading`, then the title, then `.wf-appbar-actions`.
- `renderNode` (`engine/renderer/primitives.js`) appends the bar's children after that markup.
- A bar with children and no title, leading or actions is a plain row of its children.

## Desired Behavior

`app_bar.props.leading` is an icon name, or the id of one of the bar's own children. A named
child is drawn before the title in place of a glyph, with its interaction. The bar's other
children stay after its actions. A child's id wins over an icon of the same name.

## Design

- `engine/schema/leading-child.js` holds the rule: `leadingChild(node)` finds the child, and
  `renameLeading(node, rename)` keeps the reference when ids are rewritten.
- `renderAppBar` draws no glyph when `leading` names a child.
- `renderNode` renders that child first, in its own `.wf-node-children` wrapper, and the rest
  after the bar's own markup.
- The resolver renames the reference with the child inside a reusable component
  (`namespaceNodeIds`, and the component's root), and `suffixNodeIds` does in a bound list.
- The schema is unchanged: `leading` is still a string. The registry summary, `schema.json`
  and the catalogue say "a leading glyph or control".

## Implementation Order

1. The rule and the renderer, with unit tests.
2. The id renames, with tests for a bound list and a reusable component.
3. Registry summary, regenerated `schema.json` and catalogue, and the docs.

## Edge Cases

- **`leading` names no child:** it is an icon name, as before.
- **A child named like an icon** (`bars`): the child is drawn.
- **`children` is not a list:** the glyph is drawn.
- **Two children with one id:** already a doctor error. The first is drawn.
- **The named child is hidden by a state:** it is drawn hidden, and no glyph takes its place.
- **A bar with `children` and `content`:** the content is drawn once, with the rest.

## Non-Goals

- **More than one leading child.** One back or menu control is what a bar has.
- **A leading child in `page_header` or `nav`.** Nothing has asked for it.
- **Validating `leading` as an icon.** It was never checked, and still is not.

## Review

Codex (`gpt-6.2-sol`) reviewed the first commit, `df73554`.

| Finding | Decision |
| --- | --- |
| Inside a reusable component the child becomes `top__burger` and `leading` stays `burger`, at the root and nested | Adopted. `renameLeading` in the resolver, with a test through `renderPage` |
| In a bound list the child becomes `burger_0` and `leading` stays `burger` | Adopted. `renameLeading` in `suffixNodeIds`, with a test |
| A bar with `children` and `content` draws the content twice | Adopted. The leading wrapper is given the child alone |
| Registry summary, `schema.json`, catalogue, `schema-systems.md`, `schema-canonical.yaml` and the rendering spec still said glyph only, and the note in `schema.md` split a table | Adopted |
| Tests assert order with `indexOf`, which passes when markup is missing | Adopted. Every piece is required first |
| Exercise a named leading button in the Playwright drawer fixture | Deferred. It was checked in Edge with a script: the button is at the left edge, opens the drawer, and a glyph bar is unchanged. No fixture was added to the suite |

It found no icon-only reader of `leading` in lint, source lint, doctor, validation or paint.
