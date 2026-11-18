# Component library expansion: shared items and fields, component slots, std patterns, new elements, measurement overlay

Status: designed; implementation on branch `claude/component-library`.

Source inspected on 18 November 2026: `UnlikeOtherAI/wireframes` `origin/main` at
`b3dfb81`, plus the docs shipped inside `@ui-sdk/react@0.1.0-beta.10` (Vercel Labs,
Apache-2.0, <https://ui-sdk.dev>). UI SDK is a source of ideas only. Nothing here adds
it as a dependency or copies its code.

This plan finishes the `std` library (tranche T13) of
[2026-11-02-element-library-overhaul.md](2026-11-02-element-library-overhaul.md) and
leaves that plan's other open tranches (T4, T12, T14, T17) open.

## 1. Problem Statement

The registry has 54 primitives, but five problems limit how freely a wireframe can be
designed:

1. **Every collection element invents its own item shape.** `list` items use
   `title`/`text`, `nav` marks group headers with `group`/`heading` entries, `menu`
   marks separators with `divider: true`, tabs use `active`, `accordion` uses `open`,
   `stepper` uses a `current` index, and `select`/`segmented`/`choice_group` use
   `options` plus a top-level `value`. An author or agent has to learn each one. UI SDK
   uses one list shape for Select, Combobox, Menu, Command and Tree: strings or objects,
   with group and separator entries.
2. **Form controls do not share a field contract.** `input`, `textarea` and `select`
   have `label`/`help`/`error`/`required`/`disabled`. `checkbox`/`radio`/`toggle` have
   only `description`/`disabled`. `choice_group`, `tags_input`, `upload`, `picker`,
   `editor` and `segmented` lack most of these, and no control has `readonly`. A form
   wireframe therefore cannot show a consistent invalid, disabled or read-only state.
   UI SDK has one Field (label, description, error) for every control, and one state
   vocabulary exposed as attributes: `disabled`, `required`, `readonly`, `invalid`,
   `checked`, `selected`, `current`, `expanded`, `pressed`, `loading`.
3. **Reusable components cannot take content.** Instance `children` replace the whole
   component body (`engine/resolver/index.js:258-266`), so a component cannot have named
   parts such as a header, body and footer. None of the three wireframe projects in the
   repo uses `use:` at all.
4. **There are no shipped screen patterns.** The overhaul's `std` library (T13) never
   landed, so every login, settings page or site footer is rebuilt by hand.
5. **Sizes and spacing cannot be inspected in a rendered wireframe.** The user asked for
   the dimension lines shown in ui-sdk.dev's "blueprint" drawings: width and height
   bars with pixel labels.

UI SDK also has elements we lack: a command palette, a toolbar, a menubar, a site-level
top navigation menu, a pressed toggle button, an indeterminate checkbox, numeric bounds
on range and number inputs, and a timeline of bars on a shared axis (Waterfall).

## 2. Current Behavior

| Area | Where | Behavior today |
|---|---|---|
| Element registry | `engine/schema/primitive-registry/{containers,text,controls,navigation,data,feedback}.js`, `index.js` | One descriptor per element: `name`, `family`, `frame`, `summary`, `props` (type/enum/primary), `sizing`, `example`. Feeds the schema, lint, `wf llm`, the catalogue and renderer dispatch. |
| Schema | `engine/schema/schema.json`, `scripts/sync-schema-primitives.js` | The primitive section is generated from the registry. `cli/test/schema-registry-drift.test.js` fails on drift. Node-level keys (`use`, `children`, `slots` on pages) are hand-written. |
| Items | `engine/renderer/render-lib.js:74` `items(value, key)` | Turns strings into `{label}` and copies `title` to `label`. Each family renderer then reads its own keys, for example `navigation.js:141` (`group`/`heading` headers) and `navigation.js:161` (`divider: true`). |
| Actions | `render-lib.js:90` `actionButtons` | Renders `actions[]` on headers, cards, alerts and overlays as buttons with `label`/`icon`/`variant`/`route`. |
| Field props | registry `controls.js`; renderer `primitives/controls.js` (301 lines) | Each control renders its own label and help markup, and the props differ per control as listed in §1. |
| State markup | `render-attrs.js`, `node-shell.js` | `data-wf-*` attributes carry frame, edge, variant, interactions and pane state. There is no shared state attribute set. |
| Components | `engine/resolver/index.js:220-300`, `engine/component-registry/{core,index,expansion}.js` | `use:` clones the component root, merges `propDefaults` and substitutes `{{props.x}}`. Instance keys override root keys, so instance `children` replace the root's children. Internal ids are namespaced under the instance id. |
| Component CLI | `cli/commands/commands/component.js` (80 lines) | `add`, `remove` and `list`. |
| Validation | `engine/doctor/semantic-validator.js` (716 lines, already over the 500-line cap), `engine/doctor/reference-checks.js` | Checks references, ids, slots and injectables for templates. |
| Runtime | `engine/renderer/interactions*.js` | Page script for navigation, overlays, state, panes and controls. It posts `wf:navigate` to a parent frame. |
| Admin preview | `admin/src/features/editor/PreviewToolbar.tsx`, `PreviewPane.tsx`, `features/workspace/WorkspacePreview.tsx:131,242` | The host reaches into the same-origin iframe document to outline a node, and the page posts `wf:nodeClick`. |
| Browser library | `renderer/src/mount.ts:34-41` | `createWireframe()` returns `setPage`, `navigate`, `setMode`, `setPlatform`, `explain`, `html` and `destroy`. |
| Catalogue | `engine/catalogue/*`, `wf catalogue` → `docs/catalogue/index.html` | Renders every registry example. A test fails if the committed catalogue drifts. |
| Gallery | `engine/renderer/__fixtures__/gallery/pages/*.yaml`, `pnpm gallery:update` → `cli/test/__screenshots__/gallery/win32/*.png` | Playwright baselines, one page per family plus line-mode and auth pages. |

## 3. Desired Behavior

- Every element that takes a list (`items`, `options`, `tabs`, `steps`, `actions`)
  accepts one item shape. It can be a string, or an object with the same keys
  everywhere, with group, heading and separator entries. Legacy keys keep working.
- Every form control accepts the same field props (`label`, `help`, `error`,
  `required`, `disabled`, `readonly`) and renders them through one shell. Every element
  and item exposes its state through one attribute set plus matching ARIA.
- A reusable component can declare named slots. An instance fills them by name, and
  plain instance `children` fill the default slot.
- `std.*` patterns ship with the engine, can be used without an import, and can be
  copied into a project to be edited.
- New elements: `command`, `toolbar`, `menubar`, `nav` `variant: top`,
  `button.pressed`, `checkbox.indeterminate`, `input` `min`/`max`/`step` with a two-thumb
  range, and `chart` `chartType: gantt`.
- A measurement mode in every rendered page draws width and height dimension lines,
  padding, gaps and distances. Admin previews turn it on from a toolbar toggle, the
  browser library through `setMeasure(on)`, and standalone pages with a key.

## 4. Design

### 4.1 Shared item model

New `engine/renderer/items.js` exports `normalizeItems(value, options)`. `render-lib.js`
re-exports it, and `lib.items` becomes a thin wrapper so existing callers keep working.
Every family renderer reads only the canonical keys it returns.

| Canonical key | Legacy aliases accepted | Meaning |
|---|---|---|
| `label` | `title` | Primary text. A bare string or number becomes `{ label }`. |
| `description` | `text` | Secondary line. |
| `value` | — | Identity for choice elements. Defaults to `label`. |
| `icon`, `iconStyle`, `avatar`, `badge`, `meta`, `shortcut`, `route` | — | Decorations and navigation. An item with `route` renders as a link, using the route table like buttons do. |
| `tone` | `danger: true` → `tone: danger` | `neutral`, `info`, `success`, `warning` or `danger`. |
| `selected` | `active` | Chosen or highlighted entry (tab, nav link, list row, option, command row). |
| `current` | — | Position in a sequence (breadcrumb, stepper). |
| `checked` | — | `true`, `false` or `mixed`, for checkable menu and toolbar items. |
| `disabled` | — | Not available. |
| `expanded` | `open` | Disclosed children (tree, accordion, nav and menubar submenus). |
| `items` | `children` | Nested items. |
| `type` | `divider: true` → `separator`; `{group: X}` or `{heading: X}` → `{type: heading, label: X}` | `item` (default), `separator`, `heading` (a flat header line) or `group` (`label` plus nested `items`). |

Rules:

- An element-level `value` (string, or an array for multi-select) marks matching items
  as `selected`. An explicit `selected: false` on an item wins.
- Element-specific keys stay allowed and pass through untouched, for example list
  `actions`, kanban `cards` and command `keywords`.
- The function is pure and deterministic, and never mutates its input.
- `schema.json` gets a generated `$defs/Item`. It is an `anyOf` of string, number and an
  object listing the canonical and alias keys, with `additionalProperties: true`, so
  element extras stay valid. Each item-array prop in the registry declares
  `items: true`, and the sync script points that prop at `$defs/Item`.
- `lib.actionButtons` reads actions through the model. Actions gain `disabled`,
  `pressed` and `tone`, so a disabled primary action in a dialog footer is one key.

### 4.2 Shared field contract and state attributes

New `engine/schema/primitive-registry/shared.js` exports `FIELD_PROPS`:

```js
{ label: { type: 'string' }, help: { type: 'string' }, error: { type: 'string' },
  required: { type: 'boolean' }, disabled: { type: 'boolean' }, readonly: { type: 'boolean' } }
```

It also exports the item-array marker used in §4.1. Control descriptors spread
`FIELD_PROPS` and keep their own `primary` marker. `checkbox`, `radio` and `toggle`
keep `description` as an accepted alias of `help`; `help` is canonical.

New `engine/renderer/field.js` exports `renderField(ctx, props, controlHtml, options)`.
`render-lib` re-exports it. It renders, in order:

1. The label, with a required marker.
2. The control.
3. Help text.
4. Error text with an error glyph. When both help and error exist, error goes after
   help.

`readonly` renders the value as plain text inside a lighter frame, with no caret,
spinner or chevron. `disabled` uses the existing disabled treatment. `error` turns on
the invalid treatment through the existing severity colour variables, so skins restyle
it.

**State attributes.** The node element (or item element) carries boolean presence
attributes, with matching ARIA where the element is interactive:

| Attribute | ARIA | Set by |
|---|---|---|
| `data-wf-disabled` | `aria-disabled="true"` | `disabled` on a node or item |
| `data-wf-readonly` | `aria-readonly="true"` | `readonly` |
| `data-wf-required` | `aria-required="true"` | `required` |
| `data-wf-invalid` | `aria-invalid="true"` | non-empty `error` |
| `data-wf-loading` | `aria-busy="true"` | `loading` (button, table `state: loading`) |
| `data-wf-pressed` | `aria-pressed` | `button.pressed`, toolbar items |
| `data-wf-checked` (`="mixed"` when indeterminate) | `aria-checked` | checkbox, radio, toggle, checkable items |
| `data-wf-selected` | `aria-selected` or `aria-current="page"` for nav | items |
| `data-wf-current` | `aria-current="step"` / `"location"` | stepper and breadcrumb items |
| `data-wf-expanded` | `aria-expanded` | tree, accordion, nav and menubar items |

`render-attrs.js` gets one helper, `stateAttrs(state)`, that builds both lists so no
renderer spells them by hand. If an attribute already exists with the same meaning,
reuse it rather than adding a second name.

### 4.3 Component slots

A node inside a component document may be a **slot placeholder**:

```yaml
components:
  panel:
    propDefaults: { title: Details }
    root:
      id: panel
      component: card
      props: { title: "{{props.title}}" }
      children:
        - { id: body, slot: default }           # filled by instance children
        - id: footer
          slot: footer
          children:                             # fallback when the instance passes nothing
            - { id: close, component: button, props: { label: Close } }
```

The instance fills it:

```yaml
- id: billing_panel
  use: panel
  props: { title: Billing }
  children:                                     # same as slots.default
    - { id: plan_name, component: heading, props: { text: Pro plan } }
  slots:
    footer:
      - { id: upgrade, component: button, props: { label: Upgrade, variant: primary } }
```

Rules:

1. A placeholder has `id` and `slot: <name>`. It has no `component` or `use`, and its
   optional `children` are the fallback content. Slot names match the `Id` pattern;
   `default` is the conventional name. The node model's "`component` or `use` or
   `injectable`" requirement gains a fourth option, `slot`.
2. Resolution replaces the placeholder in place with the instance's content for that
   slot, or else its fallback. With neither, it is removed. The placeholder never
   renders a box of its own, so content inherits the parent layout position.
3. Instance `children` mean `slots.default`. If the component declares **no**
   placeholders at all, instance `children` keep today's behaviour of replacing the
   root's children, so existing projects and tests are unaffected.
4. Content passed into a slot belongs to the document that wrote it. Its ids are **not**
   namespaced under the instance, `{{props.x}}` substitution is **not** applied to it,
   and its source stamps, addresses, `wf node` edits and admin selection resolve to that
   document. Component-internal nodes keep today's namespacing and substitution.
5. Slot content resolves before nested `use:` expansion inside the component. A nested
   instance in a component may pass the outer component's placeholders on as its own
   slot content.
6. New semantic codes, in a new `engine/doctor/component-slots.js`, because
   `semantic-validator.js` must not grow:
   - `UNKNOWN_COMPONENT_SLOT` (error): an instance fills a slot the component lacks.
     The message lists the valid names.
   - `DUPLICATE_COMPONENT_SLOT` (error): two placeholders share a name in one component.
   - `SLOT_OUTSIDE_COMPONENT` (error): a placeholder appears in a page or template.
   - `EMPTY_COMPONENT_SLOT` (info): neither content nor fallback.
7. `wf component show <id>` prints props with defaults and hints, slots with their
   fallback summary, and the root outline. `wf component list` shows each component's
   slot names.

### 4.4 `std` pattern library

- Patterns live in `engine/stdlib/`. They are authored as YAML text inside JS modules
  and parsed with the bundled js-yaml, so there is no filesystem access at runtime. The
  folder is added to `cli/test/engine-boundary.test.js` so the browser bundle includes
  it.
- The `std` alias is reserved and available in every project without an import.
  Declaring an import alias `std` is an error, `RESERVED_IMPORT_ALIAS`. A project
  component whose id starts with `std.` is rejected by the existing id rules.
- Initial set, all using slots and `propDefaults`/`propHints`:
  - Auth: `std.login`, `std.signup`, `std.forgot_password`.
  - Marketing: `std.site_header`, `std.hero`, `std.feature_grid`, `std.pricing_table`,
    `std.testimonials`, `std.cta_band`, `std.site_footer`.
  - App: `std.settings_page`, `std.data_page` (page header, `filters` slot, table,
    pagination), `std.detail_page`, `std.onboarding_step`, `std.confirm_dialog` (overlay
    body), `std.search_bar`, `std.not_found`.
- New commands:
  - `wf component list --std` lists the patterns.
  - `wf component show std.<name>` describes one.
  - `wf component copy std.<name> [--as <id>] [--file <components document>]` copies
    the definition into the project. It refuses to overwrite an existing id, so the
    author can own and edit the copy.
- The catalogue gains a "Patterns" section that renders each pattern with its defaults.
  `wf llm` lists the patterns with their props and slots, generated from the definitions.
- Patterns use only elements that exist when the tranche runs. Swapping in elements from
  the other tranches, such as `nav` `variant: top` in `std.site_header`, happens at
  integration.

### 4.5 New elements and states

| Family | Change | Props |
|---|---|---|
| navigation | **`command`** (new): a command palette with a search field and results | `placeholder` (primary), `query`, `items` (groups and items with `icon`, `description`, `shortcut`, `selected`), `empty` (text when there are no items), `footer: bool` (keyboard-hint row) |
| navigation | **`menubar`** (new): a desktop application menu row | `items` (top-level menus with nested `items`), `open` (value or label of the menu drawn open, with its panel below the trigger) |
| navigation | **`nav` `variant: top`**: horizontal site navigation | Existing `items`. Items with nested `items` show a chevron, and `open` draws that item's panel (links with icon and description). |
| controls | **`toolbar`** (new): a row of icon buttons and toggles | `items` (each with `icon`, `label`, `pressed`, `disabled`, `checked`, plus `separator` entries), `size: sm\|md\|lg`, `orientation: row\|stack`, `labels: bool` (show labels next to icons) |
| controls | `button.pressed` | Toggle-button state. Works with `iconOnly`. |
| controls | `checkbox.indeterminate` | Mixed state. Overrides `checked`. |
| controls | `input` `min`, `max`, `step` | For `number`, `range` and `stepper`. `range` places the thumb at `value` within `min..max` (default `0..100`), and `value: [low, high]` draws two thumbs. |
| controls | Field contract (§4.2) on every control | `input`, `textarea`, `select`, `checkbox`, `radio`, `toggle`, `choice_group`, `tags_input`, `upload`, `picker`, `editor`, `segmented` |
| data | **`chart` `chartType: gantt`** | `data: [{ label, start, end, tone? }]` on a numeric axis, plus `ticks: [labels]`. Row labels sit on the left. Without data it draws deterministic seeded bars, like the other chart types. |
| all | Item model (§4.1) in every item-taking element | navigation: `tab_bar`, `bottom_tab_bar`, `breadcrumb`, `stepper`, `nav`, `menu`, `action_sheet`, `page_header`, `app_bar`. controls: `select`, `segmented`, `choice_group`, `picker`. data: `list`, `tree`, `accordion`, `kanban` cards. containers: `carousel`. Actions: `card`, `alert`, `empty_state`, overlays. |

Each new element follows `AGENTS.md`: a registry entry with a renderable `example`, a
renderer in its family file, family CSS, and a gallery example in both modes. Frame
classes follow `frame-rules.js`; each family owner records the chosen class and the
reason in the registry entry's `summary`. Family files that would pass 500 lines split
into `<family>-<topic>.js`.

### 4.6 Measurement overlay

**Runtime.** A new `engine/renderer/interactions-measure.js` is wired into the page
runtime. It is inert until switched on and adds no markup or attributes to the static
output, so builds stay byte-identical.

**Switching it on and off.**
- From a host: a `{ type: 'wf:measure', on: boolean }` message posted into the page.
- From the browser library: a new `createWireframe()` method, `setMeasure(on: boolean)`.
- In a standalone page (`wf serve`, built HTML, published previews): pressing `m`
  toggles it, except while focus is in a text field or editable element. `Escape`
  unpins first and turns measurement off second.

**What it draws.** Everything goes into a single `pointer-events: none` layer marked
`data-wf-measure`, which source annotation, selection and the frame rules ignore.

- **Hovering a node:** its outline, a width dimension line above it (below when there
  is no room) and a height line beside it. Both lines are hairlines with end ticks and a
  monospace label chip.
- **Hovering a container:** its padding as tinted bands with values, and the gaps
  between its children.
- **Clicking a node:** pins it. Hovering another node then shows the horizontal and
  vertical distances between the two. While measuring, clicks never fire interactions,
  navigation or overlays.

**Units.** Labels show layout pixels at 1:1, rounded to whole numbers. They stay
correct when the host scales the preview or device frame: divide by the ratio of
`getBoundingClientRect()` to `offsetWidth`.

**Admin.**
- A "Measure" toggle with a ruler icon goes in `PreviewToolbar` and in the workspace
  preview controls. It has `aria-pressed`, a visible label or tooltip, a hit target of at
  least 44×44 px, and a translated string in `admin/src/i18n/locales/en.json`.
- The toggle state is remembered per viewer in `localStorage`.
- The `Workspace` control interface gains `setMeasure(on)`.
- `admin_wireframes` pages that show these toolbars are updated and rebuilt, per
  "Wireframe & Brief Sync".

### 4.7 Docs and generated artefacts

Each tranche lands the docs for what it adds:

- Registry and schema: `schema.json` regenerated by the sync script. Node-level keys
  (`slot`, instance `slots`) are written by hand.
- Schema docs: `schema.md`, `schema-systems.md` and `schema-canonical.yaml`.
- Rendering docs: the matching `rendering*.md` file.
- `brief.md` for CLI changes.
- `wf-format.md` for the browser API.
- `architecture.md` for the `Workspace` interface.
- New `docs/cli/stdlib.md`.

Generated files are never hand-edited or hand-merged. After a merge they are rebuilt
with their command:

- `node scripts/sync-schema-primitives.js` (schema)
- `wf catalogue` (catalogue)
- `wf llm --short > docs/cli/agent-guide.md` (agent guide)
- `pnpm gallery:update` on Maxis (gallery baselines)

### 4.8 Compatibility

- Every legacy item key, `description` on choice controls, and component instances
  without placeholders keep rendering exactly as before. The existing gallery baselines
  for unchanged elements must not move.
- The browser library and `.wf` format change only by addition. The separate mobile
  host keeps working unchanged.

## 5. Implementation Order

| # | Tranche | Owns (create or modify) | Depends on |
|---|---|---|---|
| T0 | Baseline (done, `9640bf8`): `.gitattributes` keeps generated artefacts LF. On `b3dfb81` on Maxis: CLI 285/285 pass, renderer 140/140, admin 181/183. | `.gitattributes` | — |
| T1 | Shared item and field contracts | `engine/renderer/items.js` (new), `engine/renderer/field.js` (new), `engine/renderer/render-lib.js`, `engine/renderer/render-attrs.js` (`stateAttrs`), `engine/schema/primitive-registry/shared.js` (new), `primitive-registry/index.js` (marker plumbing only), `scripts/sync-schema-primitives.js`, `engine/schema/schema.json` (regenerated), `engine/schema/llm-reference.js` (shared Items and Fields sections), tests `cli/test/items.test.js` and `field.test.js`; docs: `schema-systems.md`, `schema.md`, `schema-canonical.yaml`, `rendering.md` (state attributes), `agent-guide.md` (regenerated) | T0 |
| T2 | Component slots | `engine/resolver/**`, `engine/component-registry/**`, `engine/doctor/component-slots.js` (new) plus a one-line hook in the doctor entry, `engine/build/source-stamps.js` and addressing as needed, hand-written node definitions in `schema.json`, `cli/commands/commands/component.js` (`show`, slot names in `list`), tests; docs: `schema.md` §3.3/§4, `schema-systems.md` validation, `schema-canonical.yaml`, `brief.md` | T0 |
| T3 | Measurement overlay | `engine/renderer/interactions-measure.js` (new), the minimal hook in `interactions.js`, `renderer/src/mount.ts` and its types, `admin/src/features/editor/{PreviewToolbar,PreviewPane}.tsx`, `admin/src/features/workspace/**`, `admin/src/i18n/locales/en.json`, admin tests, `cli/test/measure-browser.test.js` (new), `admin_wireframes/**` (toolbar screens and build); docs: `rendering.md` (measurement section), `brief.md`, `wf-format.md`, `architecture.md` | T0 |
| T4 | Navigation family | `engine/renderer/primitives/navigation*.js`, `engine/renderer/styles/navigation.js`, `primitive-registry/navigation.js`, gallery `navigation_elements.yaml` (and a new page if needed) with its baselines, `docs/cli/rendering-navigation.md` | T1 |
| T5 | Controls family | `engine/renderer/primitives/controls*.js`, `engine/renderer/styles/controls.js`, `primitive-registry/controls.js`, gallery `forms.yaml`, `line_forms.yaml` and `auth.yaml` with their baselines, `docs/cli/rendering-controls.md` | T1 |
| T6 | Data, containers, text and feedback | `engine/renderer/primitives/{data-structures,chart,containers,text,table}.js`, `styles/{data,containers,content}.js`, `primitive-registry/{data,containers,text,feedback}.js`, gallery `data`, `charts`, `containers`, `content` and `line_structure` pages with their baselines, the matching `rendering.md` sections | T1 |
| T7 | `std` patterns | `engine/stdlib/**` (new), `std` alias injection in `engine/component-registry/**`, `engine/catalogue/**` (Patterns section), `cli/commands/commands/component.js` (`--std`, `copy`), the std list in `llm-reference.js`, `cli/test/engine-boundary.test.js`, tests; docs: `stdlib.md` (new), `brief.md`, `schema.md` (reserved alias) | T1, T2 |
| T8 | Integration (orchestrator) | Merges; regenerated artefacts; the swap in §4.4; docs reconciliation; a note in the overhaul plan that T13 is delivered here; full verification; independent final review; one PR | all |

T1, T2 and T3 run in parallel. T4, T5 and T6 start when T1 has merged, and T7 starts
when T1 and T2 have merged. A family tranche edits no other family's files. Anything
shared that it needs goes through T1's helpers; if a helper is missing, the tranche
reports it rather than editing `render-lib.js`.

## 6. Edge Cases

- **Item is `null`, an array or a boolean:** skipped, as `lib.items` does today.
  **Item with only `type: separator`:** valid.
- **`value` matches several items:** every match is selected. For single-choice
  elements, the renderer marks only the first and lint reports `AMBIGUOUS_VALUE` (info).
- **`selected: true` on an item and a different element-level `value`:** the item key
  wins.
- **Both `help` and `description` on a checkbox:** `help` wins, and lint reports
  `TEXT_PROP_ALIAS`-style info.
- **`readonly` together with `disabled`:** `disabled` wins visually; both attributes are
  emitted.
- **`checkbox.indeterminate` with `checked: true`:** indeterminate wins.
- **Placeholder with fallback while the instance passes `slots.x: []`:** an empty array
  is "explicitly empty", so the fallback is not used.
- **The same instance id used twice on a page:** existing `DUPLICATE_NODE_ID` rules
  apply to internal ids, and slot content ids are checked in the page scope.
- **Slot content containing a `use:` of the same component:** existing recursion
  detection still applies.
- **A collection binding inside a slot:** `{{item.x}}` resolves in the page context
  where the content was written.
- **Measure mode while an overlay is open:** overlays are measurable. Clicks pin rather
  than dismiss.
- **Measure mode on touch platforms:** tap pins and a second tap on the same node
  unpins. There is no hover, so pinned and tapped distances replace hover distances.
- **Measure mode and `prefers-reduced-motion`:** no animation in either case.
- **A page inside a scaled device frame in admin:** labels report unscaled CSS pixels
  (§4.6).
- **Determinism:** `normalizeItems`, `renderField`, slot resolution, std definitions
  and gantt placeholder bars are pure functions of their input, with no randomness or
  dates. Measurement is runtime-only.

## 7. Non-Goals

- No dependency on `@ui-sdk/*` or any component framework, and no React in the engine.
- No emulation of keyboard behaviour (typeahead, roving focus) inside wireframes.
- No colour-picker area, image cropper, mention trigger menu or trace-waterfall view
  beyond the `gantt` chart.
- No migration of `admin_wireframes`, `web_wireframes` or `wireframe_studio` to the
  newer elements. That is the overhaul's T17 and stays a follow-up.
- No overhaul T4 (shorthand normalizer), T12 (`wf apply`) or T14 (core/fs split).
- No admin UI for browsing or copying `std` patterns.
- No measured screenshots or exports (`wf screenshots --measure`). Follow-up.
- No changes to the separate mobile repository.

## 8. Verification

- **Each tranche:**
  - Focused tests locally on Minis.
  - The full CLI (`cd cli && node --test`), renderer and admin suites on Maxis, in the
    tranche's own Maxis worktree.
  - Gallery baselines regenerated on Maxis for the tranche's own pages.
  - `wf validate` and `wf build` clean in `admin_wireframes`, `web_wireframes` and
    `wireframe_studio`.
- **Renderer changes:** visual fixtures checked in Playwright for both modes.
- **The measurement overlay:** a Playwright browser test that checks:
  - A label equals the node's CSS width.
  - The pinned distance is correct.
  - Clicks do not navigate while measuring.
  - Turning it off removes the layer.
  - Built HTML is unchanged.
- **Integration (T8):** everything above on the merged branch, plus hands-on use. Pages
  that use every new element, slot and pattern are opened and clicked through in a
  browser via `wf serve`, and the Measure toggle is used in the admin preview.
- **Known baseline failures:** the 2 admin `projectSettingsPage.test.tsx` failures that
  already fail on `b3dfb81` are recorded, not counted as regressions.

## 9. Review Findings

(Appended after the cross-provider review.)
