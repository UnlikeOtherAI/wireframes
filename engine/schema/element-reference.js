'use strict';

const { PRIMITIVES, FAMILY_ORDER, ALIASES } = require('./primitive-registry');
const { ROLES, tokenNames } = require('../renderer/sizing-tokens');

const FAMILY_TITLE = {
  containers: 'Containers — layout and framing',
  text: 'Text, media and status',
  controls: 'Controls',
  navigation: 'Navigation',
  data: 'Data',
  feedback: 'Feedback',
};

const FRAME_NOTE = {
  S: 'always a box',
  C: 'box decided by the frame rules',
  N: 'never a box',
  E: 'one divider edge, never a box',
};

function propSignature(entry) {
  const parts = Object.entries(entry.props || {}).map(([name, spec]) => {
    if (Array.isArray(spec.enum)) return `${name}: ${spec.enum.join('|')}`;
    if (spec.aliasOf) return `${name} (alias of ${spec.aliasOf})`;
    return name;
  });
  return parts.length > 0 ? `{ ${parts.join(', ')} }` : '(no props)';
}

/** The full element catalogue, generated so it can never drift from the code. */
function elementCatalogue() {
  const sections = FAMILY_ORDER.map((family) => {
    const rows = PRIMITIVES.filter((entry) => entry.family === family).map((entry) => (
      `- **${entry.name}** — ${entry.summary} _(${FRAME_NOTE[entry.frame]})_\n`
      + `  - props: ${propSignature(entry)}\n`
      + `  - e.g. \`${entry.example}\``
    ));
    return `### ${FAMILY_TITLE[family] || family}\n\n${rows.join('\n')}`;
  });

  const aliasRows = Array.from(ALIASES.entries())
    .map(([alias, target]) => `\`${alias}\` → \`${target}\``)
    .join(', ');

  return `## Elements

${sections.join('\n\n')}

### Aliases

These names resolve silently to the element on the right: ${aliasRows}.
`;
}

/** The short cheat sheet an agent loads once, kept deliberately small. */
function elementCheatSheet() {
  const byFamily = FAMILY_ORDER.map((family) => {
    const names = PRIMITIVES.filter((entry) => entry.family === family).map((entry) => entry.name);
    return `- **${family}**: ${names.join(', ')}`;
  }).join('\n');

  return `# Wireframe elements — cheat sheet

## Which element

${byFamily}

Pick the element that *is* the thing. Do not build a card out of a section and a
border; use \`card\`. Do not build a nav out of buttons; use \`nav\`.

## Boxes: the one rule that matters

Only some elements draw a visible box. The engine decides, in this order:

1. \`surface: true\` / \`surface: false\` on the node wins over everything.
2. A border in \`wireframeStyle\` means you want a box.
3. The element type decides: \`card\`, \`alert\`, \`code\`, \`upload\`, \`editor\`,
   \`calendar\`, \`picker\` always box; \`row\`, \`stack\`, \`grid\`, \`split\`, \`form\`
   never do; \`tab_bar\`, \`app_bar\`, \`divider\` draw one edge.
4. Overlay chrome owns the frame, so overlay content never double-boxes.
5. Template regions box unless they are a slot or \`role: main\`.
6. A pane is a panel, so it boxes.
7. If the parent separates its children, the parent draws the strokes.
8. Grid children are tiles, so they box.
9. Inside a box, nothing boxes itself again — use \`card\` if you want one.
10. At the top of a page a \`section\` boxes, unless it is an untitled row
    (that reads as a toolbar).

\`section\` means "engine, you decide". \`card\`, \`row\`, \`stack\` and \`grid\` are
explicit — prefer them when you know what you want.

Run \`wf why <nodeId> --page <pageId>\` to see the rule that fired and the one
edit that flips it.

## Colour

The wireframe is greyscale. Four hues exist, and they answer one question —
how bad is this:

| Where | How to ask for it |
|---|---|
| \`alert\` | \`variant: info \\| success \\| warning \\| error\` tints the left stripe |
| \`badge\` | \`tone: info \\| success \\| warning \\| danger\` makes it a status pill |
| \`button\` | \`variant: danger\` for an action that destroys something |
| \`input\` and friends | \`error: <message>\` turns the field and its message red |
| \`menu\` / \`action_sheet\` rows | \`danger: true\` |

Nothing else takes a hue. Charts, stat trends, headings, primary buttons and
every fill stay grey on purpose: a wireframe that colours by brand or by
category stops reading as a wireframe. \`badge.variant\` is the shape
(neutral, outline, dot, pill); \`badge.tone\` is the status.

## Proportions

Give a region a \`role\` and it gets the right size automatically:
${ROLES.join(', ')}.

A \`role: sidebar\` region is 256px on web, 220 on tablet; a header is 56 tall.
Override one value project-wide in \`manifest.sizing\`, or locally with \`size\`
on the node. Available tokens: ${tokenNames().join(', ')}.

Never hand-size a sidebar, header, footer, tab bar or control unless the design
actually differs from the default.

## Mobile

Set \`viewport.platform\` to \`ios\` or \`android\` (it defaults to \`ios\` for
\`device: mobile\`). The elements are the same; only chrome changes — control
heights, corner radii, title alignment, status bar, home indicator. Native-only
elements: \`app_bar\`, \`bottom_tab_bar\`, \`action_sheet\`, \`picker\`,
\`list\` with \`kind: settings\`, \`input\` with \`inputType: stepper\`, and
\`button\` with \`fab: true\`.

## Popups, dropdowns and dialogs

Overlays live in \`page.overlays\` (or \`template.overlays\`) and open from an
interaction:

\`\`\`yaml
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
\`\`\`

Anchored types (\`dropdown\`, \`popover\`, \`menu\`, \`tooltip\`) position themselves
against their \`trigger\` at runtime, flip when they would overflow, and match the
trigger's width. \`dismissOn\` accepts \`backdrop\`, \`outside\`, \`escape\`, \`timeout\`.

## Placeholders

Leave text out and the element renders a skeleton bar rather than a gap, which
is what a wireframe should show. \`paragraph: { lines: 3 }\`, \`skeleton\`,
\`table: { state: loading }\` and \`image\` with no \`src\` all do this.

## Commands an agent reaches for

| Command | What it answers |
|---|---|
| \`wf llm --short\` | this page, generated from the code |
| \`wf llm --element <name>\` | one element's props, with an example |
| \`wf llm --family <name>\` | every element in a family |
| \`wf catalogue\` | every element rendered, as a page you can open |
| \`wf why <nodeId> --page <pageId>\` | why that node did or did not get a box, and how to change it |
| \`wf validate\` | schema and semantic errors, with the address of each |
| \`wf lint\` | the mistakes an agent actually makes, each with a suggestion |
| \`wf inspect <address>\` | the resolved node at an address |
| \`wf tree <page>\` | the resolved page tree |
| \`wf routes\` | every route id, path, page and template |
| \`wf build\` | static HTML you can open |
| \`wf pack\` / \`wf unpack\` | one .wf file in, a project folder out |
| \`wf screenshots\` | rendered PNGs, to check your own work |

## Reading the output back

Build the project and read the markup: every node carries \`data-wf-frame\`, so
you can see what the engine decided without guessing. Turn on
\`rendering.explain: true\` on a page and each node also carries
\`data-wf-why="<rule>:<reason>"\`.

## What the linter will tell you

| Code | Meaning |
|---|---|
| \`SECTION_INTENT\` | a \`section\` that would read better as \`row\`, \`stack\` or \`card\` |
| \`REDUNDANT_SURFACE\` | a \`surface:\` that matches what the rules already decide |
| \`UNKNOWN_PROP\` / \`UNKNOWN_PROP_VALUE\` | with the nearest valid name |
| \`UNKNOWN_ROLE\` | a role that drives no proportions |
| \`MISSING_TEXT\` | an element rendering a skeleton you may not have intended |
| \`UNLABELED_FIELD\` | a field with no label |
| \`ORPHAN_LAYOUT\`, \`EMPTY_CONTAINER\`, \`DEEP_NESTING\` | structure that will not render as intended |
`;
}

module.exports = { elementCatalogue, elementCheatSheet };
