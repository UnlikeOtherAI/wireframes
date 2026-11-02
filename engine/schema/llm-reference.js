'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require('./constants');

const schemaPath = path.resolve(__dirname, 'schema.json');

function loadSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

function extractEnumValues(schema, defPath) {
  const parts = defPath.split('.');
  let current = schema.$defs;
  for (const part of parts) {
    current = current?.[part];
  }
  return Array.isArray(current) ? current : [];
}

function generateLlmReference() {
  const schema = loadSchema();
  const primitives = extractEnumValues(schema, 'PrimitiveComponent.enum');
  const interactionTypes = extractEnumValues(schema, 'Interaction.properties.type.enum');
  const overlayTypes = extractEnumValues(schema, 'Overlay.properties.type.enum');
  const gestureTypes = extractEnumValues(schema, 'Interaction.properties.gestureType.enum');
  const layoutTypes = extractEnumValues(schema, 'Layout.properties.type.enum');
  const devices = extractEnumValues(schema, 'Viewport.properties.device.enum');

  return `# Wireframe CLI — LLM Reference
# Generated from schema.json v${SUPPORTED_SPEC_VERSION}
# Feed this to an LLM before asking it to create wireframe YAML files.

## Quick Start

1. Initialize: wf init my_project && cd my_project
2. Add a page: wf page add dashboard --path /dashboard --template main_template --device web
3. Add nodes: wf node add dashboard --parent main_content --id user_table --component table --props '{"columns":[{"key":"name","label":"Name"}]}'
4. Validate: wf validate
5. Build: wf build
6. Preview: wf serve

## CRITICAL RULES — Read These First

### Field Name Gotchas
- The field is "interaction" (array), NOT "interactions" — this is the #1 mistake.
- Navigation uses "targetRoute" (camelCase), NOT "target".
- Overlay interactions use "targetOverlay", NOT "overlay" or "target".
- Node identity uses "component" for primitives, "use" for custom components — never both.
- Table columns require "key" field (or "label" from which key auto-derives).

### Common Component Mistakes
- There is NO "card" component. Use "section" instead.
- There is NO "container" component. Use "section" instead.
- There is NO "label" component. Use "text" instead.
- There is NO "textfield" component. Use "input" instead.
- There is NO "separator" component. Use "divider" instead.

## Icons (Font Awesome)

Font Awesome Free is loaded automatically. Use the "icon" component for standalone icons, or the "icon" prop on buttons.

\`\`\`yaml
# Standalone icon
- id: settings_icon
  component: icon
  props:
    name: gear             # Font Awesome icon name (without fa- prefix)
    style: solid           # solid (default) | regular | brands
    size: lg               # xs | sm | lg | xl | 2xl (optional)

# Button with icon
- id: save_btn
  component: button
  props:
    label: "Save"
    icon: floppy-disk      # adds icon before label
\`\`\`

Button icon also supports iconStyle (solid|regular|brands) and iconSize (xs|sm|lg|xl|2xl).

\`\`\`yaml
# Bottom tab bar with icons (iOS-style)
- id: bottom_nav
  component: bottom_tab_bar
  children:
    - id: home_tab
      component: button
      props: { label: "Home", icon: house }
    - id: search_tab
      component: button
      props: { label: "Search", icon: magnifying-glass }
    - id: profile_tab
      component: button
      props: { label: "Profile", icon: user }
\`\`\`

Browse icons at https://fontawesome.com/search?o=r&m=free

## Document Types

Every YAML file needs: documentType, specVersion: "${SUPPORTED_SPEC_VERSION}", id

Types: manifest, sitemap, templates, components, page, dataset

## Project Structure

\`\`\`
manifest.yaml          — project metadata
sitemap.yaml           — routes + appState
templates.yaml         — page shells (persistent regions + slots)
components.yaml        — reusable node trees
pages/<page_id>.yaml   — individual page content
data/<dataset_id>.yaml — optional mock data for tables/lists
\`\`\`

## Page YAML Structure

\`\`\`yaml
documentType: page
specVersion: "${SUPPORTED_SPEC_VERSION}"
id: my_page
page:
  id: my_page
  template: main_template      # must exist in templates.yaml
  viewport:
    device: web                # mobile | tablet | web
    # orientation: portrait    # auto-defaults: mobile=portrait, tablet=landscape, web=omitted
  wireframeStyle:
    border:
      style: solid             # solid | dashed
  slots:                       # array of slot fills
    - slotId: main_content     # must match a slot in the template
      content:                 # array of Node objects
        - id: heading_1
          component: heading
          props:
            label: "Dashboard"
        - id: user_table
          component: table
          props:
            columns:
              - { key: name, label: "Name" }
              - { key: email, label: "Email" }
              - { label: "Status" }       # key auto-derives to "status"
            rows:
              - { name: Alice, email: a@b.com, status: Active }
  # Optional fields:
  # renderMode: line | card
  # rendering: { mode: line|card, density: comfortable|compact }
  # pageState: { key: value }
  # dataSources: [{ id: ds_id, dataset: dataset_id }]
  # overlays: [{ id: ..., type: ..., content: [...] }]
\`\`\`

## Node Structure

Every node MUST have "id" and exactly one of: "component", "use", or "injectable".

\`\`\`yaml
id: my_node                      # REQUIRED — snake_case
component: section               # primitive component type
# OR
use: my_custom_component         # reference to components.yaml
props:                           # component-specific properties
  label: "My Label"
  title: "My Title"
layout:                          # how children are arranged
  type: stack                    # ${layoutTypes.join(' | ')}
  gap: 16
  padding: 12
size:
  width: 300                     # number (px) or string (e.g. "50%", "100%")
  height: 200
  minWidth: 100
  maxWidth: 500
children:                        # nested Node array
  - id: child_1
    component: text
    props: { label: "Hello" }
interaction:                     # array of interactions (NOT "interactions")
  - type: navigation
    targetRoute: dashboard       # route id from sitemap.yaml
visibility:
  condition:
    type: state_equals
    scope: page                  # page | app
    key: show_details
    equals: true
\`\`\`

## Primitive Components

${primitives.map((p) => `- ${p}`).join('\n')}

### Component Props Quick Reference

- heading: { text, label alias, level: 1-6 }
- paragraph: { text, label alias }
- text: { text, label alias, variant: body|meta }
- image: { src, alt, width, height }
- icon: { name: "house", style: solid|regular|brands, size: xs|sm|lg|xl|2xl }
- button: { label, icon: "icon-name", iconStyle, iconSize, variant: primary|secondary|ghost|danger }
- input: { label, placeholder, inputType: text|email|password|number|search }
- textarea: { label, placeholder, rows }
- select: { label, placeholder, options: [{ value, label }] }
- checkbox: { label }
- radio: { label }
- toggle: { label }
- section: { title }
- table: { columns: [{ key, label, width? }], rows: [{ ...values }], emptyText? }
- chart: { chartType: line|bar|vertical|horizontal|gauge|donut, title, label, data }
- tab_bar: (in-page tabs — children with button nodes, 8px gap, NOT stretched)
- bottom_tab_bar: (iOS-style bottom navigation — children stretch equally, icon stacked above label, 4px gap)
- divider: (no props)
- spacer: { size } — percentage size in flex parents acts as a flexible spacer

## Interactions

Field name is "interaction" (array), not "interactions".

${interactionTypes.map((t) => `- ${t}`).join('\n')}

### Interaction Required Fields

- navigation: { type, targetRoute }         — targetRoute is a route id
- open_overlay: { type, targetOverlay }      — overlay id
- close_overlay: { type, targetOverlay }     — overlay id
- toggle: { type, scope, stateKey }          — scope: page|app
- set_state: { type, scope, stateKey, value }
- submit: { type, formId }                   — formId must match a node id
- action: { type, actionId }
- gesture: { type, gestureType }             — ${gestureTypes.join(' | ')}

## Overlays

Types: ${overlayTypes.join(', ')}

Overlays support a "size" property for width/height control. Modals and alerts are centered by default. Content scrolls automatically when it exceeds the overlay height.

\`\`\`yaml
overlays:
  - id: confirm_dialog
    type: modal
    size:
      width: 500              # px or string (e.g. "80%")
      maxHeight: 600           # scrolls if content exceeds this
    content:
      - id: confirm_text
        component: paragraph
        props: { label: "Are you sure?" }
      - id: confirm_btn
        component: button
        props: { label: "Confirm" }
        interaction:
          - type: close_overlay
            targetOverlay: confirm_dialog
\`\`\`

dropdown/popover/menu/tooltip require "trigger" (node id) and "placement" (top|bottom|left|right|center).

## Templates

Templates define the page shell. Pages inject content into "slot" regions only.

\`\`\`yaml
templates:
  main_template:
    layout: { type: stack }
    regions:
      - id: top_nav
        kind: persistent        # pages cannot override this
        component: section
        children: [...]
      - id: main_content
        kind: slot              # pages inject content here
\`\`\`

## Viewport

- web: { device: "web" } — no orientation needed
- mobile: { device: "mobile", orientation: "portrait" } — defaults to portrait if omitted
- tablet: { device: "tablet", orientation: "landscape" } — defaults to landscape if omitted

Devices: ${devices.join(', ')}

## Table Columns

Each column needs at minimum a "key" or a "label":
- { key: "name", label: "Full Name" } — explicit key and label
- { key: "email" } — label defaults to key
- { label: "Phone Number" } — key auto-derives to "phone_number"
- "status" — string shorthand, both key and label are "status"

## State

Two scopes: appState (in sitemap.yaml, persists across pages) and pageState (in page, resets on nav).
State keys must be declared before being referenced.

## Layout Tips

- To make a node fill parent width: \`size: { width: "100%" }\`
- To spread children evenly in a row: \`layout: { type: row, justify: space-evenly }\`
- Children in a row layout default to shrink-fit; use \`size: { width: "100%" }\` on each child to stretch
- Tab bars default to row layout with gap and flex-stretch children (like iOS UITabBarController bottom tabs)

## Building and Previewing

### wf build

Renders every page into static HTML files. Each page becomes a standalone wireframe you can open in a browser.

\`\`\`bash
wf build                 # outputs to ./build/
wf build --out dist      # outputs to ./dist/
\`\`\`

The build resolves templates, fills slots, expands components, binds datasets, and renders all nodes as wireframe HTML. Output is a self-contained static site with navigation between pages.

### wf serve

Starts a local dev server that builds and serves the wireframe site. Useful for previewing layouts, testing navigation, and verifying interactions.

\`\`\`bash
wf serve                 # starts on default port
wf serve --port 4000     # starts on port 4000
\`\`\`

Open the URL in a browser to see the rendered wireframes. The server rebuilds on each request so changes to YAML files are reflected immediately.

## CLI Commands Reference

wf init <name>                     — scaffold a new wireframe project
wf page add <id> --path <p> --template <t> --device <d> [--orientation <o>]
wf page remove <id>
wf page list
wf node add <pageId> --parent <parentId> --id <nodeId> --component <type> [--props '<json>']
wf component add <id> --root '<yaml>'
wf overlay add <pageId> --id <overlayId> --type <type> --content '<yaml>'
wf validate [--strict] [--json]    — validate schema + semantic checks
wf lint                            — check naming conventions and primitive prop diagnostics
wf doctor                          — check project health and references
wf build [--out <dir>]             — render all pages to static HTML
wf serve [--port <n>]              — start local preview server
wf schema                          — print allowed types
wf schema --doc <type>             — print full structure (page, node, manifest, etc.)
wf llm                             — print this reference
wf tree <pageId>                   — print resolved node tree
wf inspect <pageId> <nodeId>       — inspect a node
wf routes                          — list all routes
wf data add <id> --primaryKey <k>
wf data item add <datasetId> --item '<json>'
wf export [--out <file>]           — package project as ZIP
wf screenshots [--page <id>]       — render screenshots with Playwright
`;
}

module.exports = { generateLlmReference };
