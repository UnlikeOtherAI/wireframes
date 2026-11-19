# Text rendering

How text stays inside the box that draws it. The styles are in
`engine/renderer/styles/{base,content,data}.js`.

## Text stays in its box

A framed box (`data-wf-frame="surface"`: a card, tile, stat or panel) never
lets a word paint past its edge:

- The box's own title and description (`.wf-block-head`), and a `heading`,
  `paragraph` or `text` placed straight in it, use
  `overflow-wrap: break-word`. A word or URL wider than the box breaks inside
  it. `break-word` does not change min-content sizing, so no box grows or
  shrinks because of it.
- A stat wraps its label instead of truncating it, and its number sits in its
  own `.wf-stat-number` box with `overflow-wrap: anywhere`. In a tile narrower
  than the number, the digits wrap inside the tile rather than spill or be
  painted over by the next tile. The delta wraps below as one unit.
- List rows stay one-line summaries. The title (`.wf-list-title`) and the
  secondary text (`.wf-list-text`) are blocks with `text-overflow: ellipsis`,
  so a long title ends in a drawn ellipsis rather than being clipped
  mid-glyph. A badge sits inline after the title.
- Grid tracks are `minmax(0, 1fr)`, so long content wraps inside its tile and
  never widens it ([rendering-data.md § Grid columns](rendering-data.md#grid-columns)).

Text in unframed groups keeps its natural word widths. It has no visible edge
to cross, and breaking it mid-word would only make it harder to read.
Buttons, badges, tabs and control labels keep `white-space: nowrap`.

`cli/test/text-containment-browser.test.js` measures every text rect against
its surface at 1280 and 390 px, in card and line mode, in Chromium and
(where installed) WebKit.

## Line breaks

A newline the author wrote is a line break in prose:

- `heading`, `paragraph` and `text` text;
- the `title` and `description` of `card`, `section`, `form` and `upload`;
- `alert` and `empty_state` title and text.

These use `white-space: pre-line`, so a newline breaks the line while runs of
spaces still collapse. It is CSS, not `<br>`, so text a state binding sets at
runtime breaks the same way. The renderer drops a block scalar's leading and
trailing newlines, such as the one a `|` block ends with, so they add no
empty line.

In YAML, a literal block (`|` or `|-`) keeps its newlines, and so does `"\n"`
in a quoted string. A folded block (`>` or `>-`) turns single newlines into
spaces, so existing folded text renders exactly as before. A blank line
inside a folded block becomes one newline, which now starts a new line, as
the paragraph break it stands for.

List rows, labels, tabs, menus, buttons and table cells are one-line
summaries, so a newline there collapses to a space, as before.
`cli/test/line-breaks-browser.test.js` counts the line boxes of each case.
