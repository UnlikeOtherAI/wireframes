# Named company skins

A skin changes colours and border/corner treatment, without changing content, layout, routes, data, behavior or the app shell. Definitions stay in the project manifest and work offline.

## Data

`manifest.designSystem` contains a `skins` map and optional `activeSkin`. Each skin has a non-empty `name`, optional `defaults` and `roles`. Appearance values contain partial `colors`, `border` and `corner`. Border/corner use the existing partial style contract. Colours are separate from ordinary `wireframeStyle`.

Colour fields are `text`, `background`, `border` and `accent`. Values are `#RRGGBB`; background also accepts `transparent`. Token references, arbitrary CSS and remote assets are unsupported.

Role keys are canonical primitives or their standard variants: `button`, `button.primary`, `input.plain`, `card`, etc. The single registry defines these keys. Existing `props.variant` selects a variant role. Structural `node.role` remains unchanged.

Skin IDs start with a lowercase letter and contain lowercase letters, digits or underscores. `wireframe` is reserved for legacy appearance. Unknown selected skins/roles, malformed colours and unknown fields fail validation.

## Version

Saving named skins promotes manifest `specVersion` and `manifest.schemaVersion` to `1.2`. Other documents and new ordinary projects remain `1.1`. Switching to Wireframe retains 1.2 because skins remain saved. Packing keeps `wf/1`.

The new loader accepts both manifest versions. Older validating loaders reject 1.2 through their existing version gate. Previously shipped render-only browser clients cannot be forced to warn by a new field; they are unsupported for skinned projects and equivalent brand rendering is not promised.

## Resolution

Later leaves win: existing renderer defaults; manifest default style; skin defaults; page style; primitive role; variant role; explicit resolved node/component style. Reusable-component expansion keeps its existing definition/instance merge. Explicit local corners win even when equal to page values.

No active named skin bypasses the skin path and preserves legacy output. A shared page helper serves pure/disk build, serve, screenshots and introspection. Each primitive's own generated markup is painted before children are rendered independently, preventing parent role leakage.

Explicit skinned/local corners beat platform and mode on painted parts. Pill uses the parent implementation's node-local marker and circular caps. Numeric corners remain numeric in line/card modes. Legacy numeric-radius inheritance outside active skins is unchanged.

## Painted parts

| Field | Consumers |
| --- | --- |
| Text | Own labels/text/icons, including composite actions; child nodes resolve independently. |
| Background | Existing framed surfaces, control boxes, button faces, badges, avatars, placeholders and progress/skeleton tracks. Does not create a frame. |
| Border | Existing surface outlines, edges and control borders. |
| Accent | Focus rings, checked marks, toggles, range/progress fills, selected navigation/segments/pages/steps, ratings and picker text. |

Catalogue metadata exposes applicable fields; a spacer has none. Plain input retains its unframed treatment. State props determine whether a painted state is visible.

Invalid-field borders and error labels retain error tone. Generic palettes do not replace danger/status cues. Explicit severity-role colour is deliberate; status `tone` remains authoritative. Composite buttons use the same role resolver as standalone buttons.

Transparent-background contrast needs its actual composited backdrop. A host must not display a guessed ratio.

## API

The workspace package `@wireframes/engine/design-system` exports:

- `getDesignSystem(documentMap)` returns `{activeSkin, skins, components}`. Components contain `component, family, summary, aliases, variants, defaultVariant, colors`.
- `updateDesignSystem(documentMap, {skin?: {id, value}, activeSkin?})` returns `{ok: true, documentMap}` or `{ok: false, error, details: {errors}}`. Upsert and selection validate atomically on a clone, without mutating caller Maps/documents.

Copying uses an upsert into the destination. There is no global store, live cross-project link or deletion API. The host commits successful serialized results through existing revisions.

`buildCataloguePage({documentMap, sample?: {component, variant?}, mode, platform, fontAwesomeHref})` returns full HTML containing every registry sample. With a document map, cards expose `data-wf-catalogue-component` and `data-wf-catalogue-variant` for host selection. The engine adds no native bridge/editor UI. A sample override affects only the named demo; no-project calls retain the standalone catalogue.

Existing CLI validation/build/export commands support this data. This tranche adds no `wf skin` family or native/admin editor. The native host owns its read/preview/apply bridges, drafts, history and physical-iPad acceptance.
