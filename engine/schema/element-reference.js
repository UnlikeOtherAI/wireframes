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
`;
}

module.exports = { elementCatalogue, elementCheatSheet };
