'use strict';

// The source linter on component slots, built-in `std.*` patterns and the
// element props added with them: every finding inside a slot fill points at
// the YAML that holds it, through `slots.<name>[i]`.

const test = require('node:test');
const assert = require('node:assert/strict');

const { lintSources } = require('../../engine/lint/source');

const MANIFEST = `documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  projectId: slots_lint
  name: Slots lint
  schemaVersion: "1.1"
`;

const SITEMAP = `documentType: sitemap
specVersion: "1.1"
id: sitemap
routes:
  - id: home
    path: /
    page: home
    template: main
`;

const TEMPLATES = `documentType: templates
specVersion: "1.1"
id: templates
templates:
  main:
    layout:
      type: stack
    regions:
      - id: main
        kind: slot
`;

const COMPONENTS = `documentType: components
specVersion: "1.1"
id: components
components:
  panel:
    root:
      id: panel
      component: card
      children:
        - id: body
          slot: default
        - id: footer
          slot: footer
          children:
            - id: close
              component: button
              props:
                label: Close
`;

function page(content) {
  return `documentType: page
specVersion: "1.1"
id: home
page:
  id: home
  template: main
  viewport:
    device: web
  slots:
    - slotId: main
      content:
${content}`;
}

function project({ components = COMPONENTS, content, extra = [] }) {
  return [
    { name: 'manifest.yaml', text: MANIFEST },
    { name: 'sitemap.yaml', text: SITEMAP },
    { name: 'templates.yaml', text: TEMPLATES },
    { name: 'components.yaml', text: components },
    { name: 'pages/home.yaml', text: page(content) },
    ...extra,
  ];
}

/** The zero-based number of the first line that is exactly `line`, at or after line `from`. */
function lineOf(text, line, from = 0) {
  return text.split('\n').indexOf(line, from);
}

function underlined(sources, diagnostic) {
  const text = sources.find((source) => source.name === diagnostic.source).text;
  return text.slice(diagnostic.range.start.offset, diagnostic.range.end.offset);
}

function only(result, code) {
  const matches = result.diagnostics.filter((diagnostic) => diagnostic.code === code);
  assert.equal(matches.length, 1, `expected one ${code}, got ${JSON.stringify(result.diagnostics.map((d) => `${d.code} ${d.message}`))}`);
  return matches[0];
}

const codes = (result) => result.diagnostics.map((diagnostic) => diagnostic.code);

test('a page filling a component slot lints clean', () => {
  const sources = project({ content: `        - id: billing
          use: panel
          children:
            - id: plan_name
              component: heading
              props:
                text: Pro plan
          slots:
            footer:
              - id: upgrade
                component: button
                props:
                  label: Upgrade
` });
  const result = lintSources(sources);
  assert.deepEqual(result.diagnostics, []);
});

test('element findings inside a page-authored fill point into slots.<name>[i]', () => {
  const sources = project({ content: `        - id: billing
          use: panel
          children:
            - id: plan_name
              component: heading
              props:
                text: Pro plan
          slots:
            footer:
              - id: upgrade
                component: button
                props:
                  label: Upgrade
              - id: Bad_Id
                component: button
                props:
                  lable: Later
` });
  const result = lintSources(sources);

  const prop = only(result, 'UNKNOWN_PROP');
  assert.equal(prop.source, 'pages/home.yaml');
  assert.equal(prop.path, '$.page.slots[0].content[0].slots.footer[1].props.lable');
  assert.equal(underlined(sources, prop), 'lable');

  const id = only(result, 'UPPERCASE_ID');
  assert.equal(id.path, '$.page.slots[0].content[0].slots.footer[1].id');
  assert.equal(underlined(sources, id), 'Bad_Id');
});

test('a broken reference inside a fill is underlined at its use', () => {
  const sources = project({ content: `        - id: billing
          use: panel
          children: []
          slots:
            footer:
              - id: missing
                use: nowhere
` });
  const broken = only(lintSources(sources), 'BROKEN_COMPONENT_REFERENCE');
  assert.equal(broken.path, '$.page.slots[0].content[0].slots.footer[0].use');
  assert.equal(underlined(sources, broken), 'nowhere');
});

test('an interaction inside a fill is underlined at the node that has it', () => {
  const sources = project({ content: `        - id: billing
          use: panel
          children: []
          slots:
            footer:
              - id: go_away
                component: button
                props:
                  label: Go
                interaction:
                  - type: navigation
                    targetRoute: nowhere
` });
  const route = only(lintSources(sources), 'INVALID_TARGET_ROUTE');
  assert.equal(route.source, 'pages/home.yaml');
  assert.equal(underlined(sources, route), 'go_away');
});

test('slot diagnostics point at the fill, the key or the placeholder they are about', () => {
  const components = `${COMPONENTS}  twice:
    root:
      id: twice
      component: stack
      children:
        - id: first
          slot: extra
        - id: second
          slot: extra
`;
  const sources = project({ components, content: `        - id: billing
          use: panel
          children:
            - id: a
              component: text
              props:
                text: A
          slots:
            default: []
            aside: []
        - id: quiet
          use: panel
        - id: loose
          component: stack
          slots:
            footer: []
        - id: stray
          slot: default
        - id: both
          use: twice
` });
  const result = lintSources(sources);

  const unknown = only(result, 'UNKNOWN_COMPONENT_SLOT');
  assert.equal(unknown.path, '$.page.slots[0].content[0].slots.aside');
  assert.equal(underlined(sources, unknown), 'aside');

  const doubled = only(result, 'DUPLICATE_DEFAULT_SLOT_FILL');
  assert.equal(underlined(sources, doubled), 'default');
  assert.equal(doubled.range.start.line, lineOf(sources[4].text, '            default: []'));

  const withoutUse = only(result, 'SLOTS_WITHOUT_USE');
  assert.equal(withoutUse.path, '$.page.slots[0].content[2].slots');
  assert.equal(underlined(sources, withoutUse), 'slots');

  const outside = only(result, 'SLOT_OUTSIDE_COMPONENT');
  assert.equal(outside.path, '$.page.slots[0].content[3].slot');
  assert.equal(underlined(sources, outside), 'slot');

  const duplicate = only(result, 'DUPLICATE_COMPONENT_SLOT');
  assert.equal(duplicate.source, 'components.yaml');
  assert.equal(duplicate.path, '$.components.twice.root.children[1].slot');
  assert.equal(underlined(sources, duplicate), 'extra');
  const firstExtra = lineOf(sources[3].text, '          slot: extra');
  assert.equal(duplicate.range.start.line, lineOf(sources[3].text, '          slot: extra', firstExtra + 1));

  const empty = result.diagnostics.find((diagnostic) => diagnostic.code === 'EMPTY_COMPONENT_SLOT' && /"quiet"/.test(diagnostic.message));
  assert.equal(empty.severity, 'info');
  assert.equal(underlined(sources, empty), 'quiet');
});

test('fills a component writes for a nested instance are linted where the component writes them', () => {
  const components = `${COMPONENTS}  layout:
    root:
      id: layout
      component: stack
      children:
        - id: body
          component: heading
          props:
            text: Settings
        - id: profile
          use: panel
          slots:
            default:
              - id: content
                slot: default
            footer:
              - id: save
                component: button
                props:
                  colour: red
`;
  const sources = project({ components, content: `        - id: settings
          use: layout
          children:
            - id: name
              component: input
              props:
                label: Name
` });
  const result = lintSources(sources);
  assert.ok(!codes(result).includes('DUPLICATE_NODE_ID'), 'the nested panel reuses "body" in its own id scope');
  const prop = only(result, 'UNKNOWN_PROP');
  assert.equal(prop.source, 'components.yaml');
  assert.equal(prop.path, '$.components.layout.root.children[1].slots.footer[0].props.colour');
  assert.equal(underlined(sources, prop), 'colour');
});

test('a real duplicate inside one definition is underlined where it was repeated', () => {
  const components = `${COMPONENTS}  layout:
    root:
      id: layout
      component: stack
      children:
        - id: body
          component: heading
          props:
            text: Settings
        - id: profile
          use: panel
        - id: body
          component: text
          props:
            text: Again
`;
  const sources = project({ components, content: `        - id: settings
          use: layout
` });
  const duplicate = lintSources(sources).diagnostics
    .find((diagnostic) => diagnostic.code === 'DUPLICATE_NODE_ID' && /Component "layout" defines duplicate node id "body"/.test(diagnostic.message));
  assert.equal(duplicate.source, 'components.yaml');
  assert.equal(underlined(sources, duplicate), 'body');
  const lines = sources[3].text.split('\n');
  assert.equal(duplicate.range.start.line, lines.lastIndexOf('        - id: body'), 'the repeated "body", not the first');
});

test('a page using a built-in std pattern lints clean, and a typo is underlined', () => {
  const clean = project({ content: `        - id: sign_in
          use: std.login
        - id: orders
          use: std.data_page
          slots:
            filters:
              - id: status_filter
                component: select
                props:
                  label: Status
                  options: [Open, Closed]
        - id: billing
          use: panel
          children: []
` });
  const result = lintSources(clean);
  assert.deepEqual(result.diagnostics, [], 'built-ins resolve, take fills and never count as unused');

  const typo = project({ content: `        - id: sign_in
          use: std.logn
` });
  const broken = only(lintSources(typo), 'BROKEN_COMPONENT_REFERENCE');
  assert.equal(underlined(typo, broken), 'std.logn');
});

test('a std import alias is reported at its key', () => {
  const sources = project({
    components: COMPONENTS.replace('id: components\n', 'id: components\nimports:\n  std: ./shared/std.yaml\n'),
    content: `        - id: sign_in
          use: std.login
        - id: billing
          use: panel
`,
    extra: [{ name: 'shared/std.yaml', text: `documentType: components
specVersion: "1.1"
id: mine
components:
  login:
    root:
      id: login
      component: text
      props:
        text: Our login
` }],
  });
  const shadowed = only(lintSources(sources), 'STD_ALIAS_SHADOWED');
  assert.equal(shadowed.severity, 'info');
  assert.equal(shadowed.source, 'components.yaml');
  assert.equal(underlined(sources, shadowed), 'std');
  assert.match(shadowed.message, /^components imports components as "std".*shadowed: std\.login\)/);
});

test('the new elements and field props lint clean', () => {
  const sources = project({ content: `        - id: billing
          use: panel
          children: []
        - id: palette
          component: command
          props:
            placeholder: Search or run a command
            items:
              - type: group
                label: Suggestions
                items:
                  - { icon: plus, label: New project, shortcut: "⌘N", selected: true }
        - id: menus
          component: menubar
          props:
            items:
              - { label: File, items: [New, Open] }
        - id: format_bar
          component: toolbar
          props:
            items:
              - { label: Bold, icon: bold, pressed: true }
              - { type: separator }
        - id: top_nav
          component: nav
          props:
            variant: top
            items:
              - { label: Home }
        - id: plan
          component: chart
          props:
            chartType: gantt
            title: Plan
        - id: status
          component: select
          props:
            label: Status
            options: [Draft, Ready]
            value: Ready
            help: Pick one
            required: true
        - id: seats
          component: input
          props:
            label: Seats
            inputType: number
            min: 1
            max: 50
            step: 1
            readonly: true
        - id: remember
          component: checkbox
          props:
            label: Remember me
            indeterminate: true
            error: Needed
` });
  const result = lintSources(sources);
  assert.deepEqual(result.diagnostics.filter((diagnostic) => diagnostic.severity !== 'info'), []);
});

test('the item and control rules point at the prop they are about', () => {
  const sources = project({ content: `        - id: status
          component: select
          props:
            label: Status
            options: [{ label: A, value: x }, { label: B, value: x }]
            value: x
        - id: volume
          component: input
          props:
            label: Volume
            value: [1, 2]
        - id: remember
          component: checkbox
          props:
            label: Remember me
            help: Stay signed in
            description: Keep me in
` });
  const result = lintSources(sources);

  const ambiguous = only(result, 'AMBIGUOUS_VALUE');
  assert.equal(ambiguous.path, '$.page.slots[0].content[0].props.value');
  assert.equal(underlined(sources, ambiguous), 'x');

  const range = only(result, 'UNKNOWN_PROP_VALUE');
  assert.equal(range.path, '$.page.slots[0].content[1].props.value');
  assert.equal(underlined(sources, range), '[1, 2]');

  const alias = only(result, 'HELP_PROP_ALIAS');
  assert.equal(alias.path, '$.page.slots[0].content[2].props.description');
  assert.equal(underlined(sources, alias), 'description');
});
