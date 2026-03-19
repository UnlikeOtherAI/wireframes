'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require('./constants');

const schemaPath = path.resolve(__dirname, '..', '..', 'schema.json');

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
data/<dataset_id>.yaml — mock data for tables/lists
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
  width: 300                     # number (px) or string (e.g. "50%")
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

- heading: { label, level: 1-6 }
- paragraph: { label }
- text: { label }
- image: { src, alt, width, height }
- button: { label, variant: primary|secondary|ghost }
- input: { label, placeholder, type: text|email|password|number }
- textarea: { label, placeholder }
- select: { label, placeholder, options: [{ value, label }] }
- checkbox: { label }
- toggle: { label }
- section: { title }
- table: { columns: [{ key, label, width? }], rows: [{ ...values }], emptyText? }
- tab_bar: (use children with button nodes)
- divider: (no props)
- spacer: (no props, use size.height)

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

\`\`\`yaml
overlays:
  - id: confirm_dialog
    type: modal
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

## CLI Commands Reference

wf init <name>                     — scaffold project
wf page add <id> --path <p> --template <t> --device <d> [--orientation <o>]
wf page remove <id>
wf page list
wf node add <pageId> --parent <parentId> --id <nodeId> --component <type> [--props '<json>']
wf component add <id> --root '<yaml>'
wf overlay add <pageId> --id <overlayId> --type <type> --content '<yaml>'
wf validate [--strict] [--json]
wf lint
wf doctor
wf build [--out <dir>]
wf serve [--port <n>]
wf schema                          — print allowed types
wf schema --doc <type>             — print full structure (page, node, manifest, etc.)
wf llm                             — print this reference
wf tree <pageId>                   — print resolved node tree
wf inspect <pageId> <nodeId>       — inspect a node
wf routes                          — list all routes
wf data add <id> --primaryKey <k>
wf data item add <datasetId> --item '<json>'
wf export [--out <file>]
wf screenshots [--page <id>]
`;
}

module.exports = { generateLlmReference };
