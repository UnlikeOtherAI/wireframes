# Design system and named skins

Status: proposed design; no skin implementation is delivered by this document.

Source inspected on 4 November 2026: `UnlikeOtherAI/wireframes` at `47aaeeec9a75afc6ad57d1d93aef6c2f9f9882bf`, and the separate `UnlikeOtherAI/wireframe-mobile` repository at `4e2b80523b2f951701fd205b5053396cb603d7cb`. A different-provider adversarial review is required before implementation. Append findings and decisions to this document.

## Problem Statement

A person can build clickable wireframes but cannot inspect every supported component in the app, assign semantic appearance roles, edit real company colours, or save and switch reusable named skins. Repeating literal colours on nodes would make later changes unreliable. The feature must work on an offline iPad and travel with exported projects.

The smallest useful solution is a component gallery generated from the existing registry, an inspector for one component at a time, and named skin data in the existing manifest. The shared engine resolves that data for the CLI, browser and native host. No separate component library, account service or server store is needed.

## Current Behavior

| Area | Source and behavior |
| --- | --- |
| Components | `engine/schema/primitive-registry/index.js` collects 56 canonical primitives in six families at the inspected revision. Entries own props, aliases, frame class and examples. `scripts/sync-schema-primitives.js` generates schema sections. |
| Catalogue | `engine/catalogue/index.js` renders every entry through `renderNode`; `engine/catalogue/demos.js` parses examples and fills illustrative container children. `wf catalogue` generates the public catalogue, which is not editable. |
| Structural roles | `engine/renderer/sizing-tokens.js`, `frame-rules.js` and `node-shell.js` use `node.role` for header/sidebar/main and other layout roles. These affect dimensions and frames. |
| Appearance | `engine/renderer/styles/base.js` defines grey ink/fill/line variables and severity colours. `styles/controls.js` and primitive renderers implement variants and states. There is no company skin. |
| Existing styles | `engine/schema/schema.json` defines manifest `defaultWireframeStyle`, page `wireframeStyle` and node/overlay `WireframeStyleOverride`. `engine/renderer/wireframe-styles.js` merges border/corner values. Manifest sizing already has its own resolver. |
| Browser/export | `renderer/src/mount.ts` changes page, mode and platform but has no skin API. `engine/wf-format/index.js` and `renderer/src/wf.ts` serialize project documents to deterministic `.wf` text. |
| Mobile editing | Mobile `web/src/host.ts` selects source-annotated nodes and distinguishes live interaction from selection. Source/definition/row metadata identifies shared and repeated nodes. `web/src/edit.ts` validates a project copy and renders its pages before accepting an edit. |
| Mobile persistence | Mobile `core/src/store.cpp` stores complete `.wf` revisions in SQLite; `ios/Wireframes/App/AppModel.swift` supports undo, redo and named versions. |
| View preferences | Mobile `RenderingStyle.swift` and `RenderingSheet.swift` expose corners, cards/lines and adaptation outside project revisions. `web/src/host.ts:applyRendering` currently writes corner/mode overrides into the in-memory project. Skin implementation must separate the render copy from persisted design content. |

Greyscale rendering is intentional in the current documentation. Brand skins explicitly extend that contract. Projects without a skin retain their current appearance.

### Existing UOA identity conflict

`docs/architecture.md` endorses local User and Invite entities. `api/src/db/schema.ts` durably stores `users.email`, `users.displayName` and invitation email/token data alongside `ssoSubject`. This conflicts with the supplied UOA identity/profile/invitation authority rule. Product-specific project permissions need classification separately from UOA organisation/team membership.

Do not add an account-owned skin table or build this feature on those duplicated fields. The separate required remedy is an API-backed refactor and data migration:

1. Inventory profile/invitation readers, writes, foreign keys and API responses. Separate genuine product extension data and project permissions from UOA-owned identity, organisations, teams and membership.
2. Resolve users by stable UOA subject and organisations/teams by UOA IDs with the required 1:1 mapping. Read profiles and membership from UOA, using only bounded in-memory caching and revocation-aware checks.
3. Match existing subjects and invitations through supported UOA APIs before migrating references. Preserve unresolved or ambiguous records for explicit resolution; do not manufacture UOA users or treat email as durable identity.
4. Move invitation creation, acceptance and revocation to UOA. Reconcile pending invitations, then retire local invitation tokens. Do not add a compatibility identity store.
5. Migrate product references to stable UOA identifiers and remove duplicate server profile/invitation storage after validation and rollback preparation. Rollback must not restore a second identity authority.
6. Exercise existing-user access, fresh invitations, revocation and multiple UOA organisations. Update architecture documentation to reflect the actual ownership contract.

This requires a separately reviewed scope and access to the actual UOA API. No auth refactor or migration is implemented here.

## Desired Behavior

From **Page style → Design system**, the person browses every supported primitive, selects one, chooses an appearance role and edits its colours and existing border/corner controls. They save a named skin, switch it across the project's pages and reuse a copy in another wireframe while offline.

Primary and secondary buttons remain the existing button primitive and variants. A skin changes appearance, never content, data, navigation, platform chrome, component availability or layout. A real wireframe component can receive a role or an explicit local override.

## Design

### Minimal schema

Add optional `manifest.designSystem` containing `activeSkin` and a `skins` map. Each skin contains a display `name`, a flat `colors` token map, optional `defaults`, and a `roles` map. Defaults and role values reuse `WireframeStyleOverride`, extended with an optional `colors` object; allow that colour extension on existing manifest/page/node/overlay styles. Add optional `node.skinRole` for explicit appearance selection. Keep `node.role` unchanged.

```yaml
manifest:
  projectId: acme
  name: Acme checkout
  schemaVersion: '1.1'
  designSystem:
    activeSkin: acme
    skins:
      acme:
        name: Acme
        colors:
          brand: '#1457D9'
          on_brand: '#FFFFFF'
          ink: '#172033'
          surface: '#FFFFFF'
          border: '#CCD3DF'
        defaults:
          colors:
            text: { token: ink }
            background: { token: surface }
            border: { token: border }
        roles:
          button.primary:
            colors:
              background: { token: brand }
              text: { token: on_brand }
              border: { token: brand }
            corner: { style: pill }
          button.secondary:
            colors:
              background: { token: surface }
              text: { token: brand }
              border: { token: brand }
          input:
            colors:
              background: { token: surface }
              text: { token: ink }
              border: { token: border }
              accent: { token: brand }
```

This is a proposed fragment, not input accepted by the inspected engine. `pill` is the coordinated corner-style extension being implemented independently.

- Skin/token IDs use the existing `Id` grammar. Display names are editable Unicode text. Reserved skin ID `wireframe`, or absent `activeSkin`, selects the existing built-in appearance; it cannot be overwritten.
- Tokens contain concrete `#RRGGBB`. Colour fields accept `#RRGGBB`, `{ token: id }`, or `transparent` for background only. No CSS expressions, URLs, selectors, arbitrary properties or recursive token aliases.
- The four colour properties are `text`, `background`, `border`, `accent`. Reuse existing border/corner controls. Sizing, density and layout keep their own contracts.
- Role keys are canonical primitive names, optionally with one suffix: `button`, `button.primary`, `button.checkout`. Resolve primitive aliases first. Reject a role targeting an unrelated primitive.
- Built-in role choices derive from registry names and supported `variant` enums. Declare any actual renderer default once on its registry entry; do not maintain another default list. Entries without variants still have their primitive role. Custom roles are the union of role keys in saved skins, with no separate persisted catalogue.
- Existing `props.variant` selects standard roles. Choosing Primary button sets `variant: primary` and clears a conflicting explicit `skinRole`. A custom selection writes `skinRole: button.checkout`, preserving behavior/state props.
- Validate `skinRole` against the resolved primitive for reusable component uses. Inspect compound reusable components through their existing source nodes; do not invent another component system.
- Reset removes the relevant override. Do not persist empty strings or null values.

Keep the `.wf` container at `wf/1`: no new document type is needed. The inspected schema pins `specVersion` to `1.1`; the first release should add optional fields under that contract and document minimum supported engine/mobile versions. If implementation needs a schema-version change, review the full tool compatibility impact explicitly. Older editors must never silently strip skin data.

### Resolution, inheritance and precedence

Resolve properties in the engine before emitting CSS. Merge nested styles by leaf. Low-to-high precedence is:

1. Existing engine defaults for mode, platform, primitive variant and state.
2. Manifest `defaultWireframeStyle`.
3. Active skin `defaults`.
4. Page `wireframeStyle`.
5. Active skin's primitive role, such as `button`.
6. Active skin's selected specific role, such as `button.primary`.
7. Reusable definition's explicit style.
8. Instance/node/overlay explicit style, through existing resolver inheritance.

Use `skinRole` when supplied; otherwise infer the specific role from registry variant/default metadata. A specific role inherits its primitive role. Skins do not inherit from other skins; roles have no arbitrary `extends` chains.

Resolve token references only against the active skin. An absent selected skin or an unknown token in an active definition is a validation error with its property path. If a custom role is valid in another saved skin but missing from the selected skin, use the active skin's primitive base role and show “Using default style” with the missing role name. Preserve its selector so switching back restores it. A role unknown to every skin and the registry is an error.

No-skin projects must render identically. Preserve existing disabled/loading/checked/error/focus behavior and severity indicators. Do not turn an error into a company-accent-only cue. The palette supplies base colours; custom state palettes are outside this first version.

Apply colours to actual painted parts: controls, labels and icons use the role text; surfaces use background only where frame rules permit. A colour must not turn a group/content primitive into a framed box or an edge into a filled surface. Composite action buttons use the same button-role resolver as standalone buttons. Keep painted-part mappings next to existing primitive renderers, never in arbitrary skin CSS.

Recompute role colours at node boundaries rather than allowing parent-role CSS variables to cascade into unrelated child controls. A purple card must not silently make its primary button purple. Text within a painted part may inherit that part's text colour.

`corner.style: pill` reuses the existing style object. It wins over numerical radius, rounds caps to half the shorter rendered dimension and is not divided by three in line mode. Verify intrinsic buttons, stretched inputs and square icon buttons. Preserve existing sharp/rounded behavior.

Line/card mode and platform remain independent of skins. Brand colours render in either mode while frame treatment stays mode-specific. The Wireframe skin restores neutral colours. Icons, icon placement, crossed labelled placeholders and sticky regions keep their existing primitive/prop interfaces.

### Persistence and switching

Save a validated skin draft as one normal project revision. The active skin ID is project content, not an app preference. Undo/redo covers skin edits, switching and assignments. Switching changes one manifest reference instead of rewriting every node.

The picker lists saved skins and **Copy from another project**. Read a saved manifest through the existing local project store, copy its skin into the destination, and validate it. This supports offline cross-wireframe reuse without a new global store or live link. Editing the destination never changes the source. An ID collision with different content offers Replace or Save as new; show affected current-project uses before Replace. Matching display names do not overwrite IDs.

Existing `.wf` export/import carries every skin. Deleting an active skin must select its replacement atomically. Block deletion of the only definition of a referenced custom role until those uses are reassigned; list affected pages. Rename changes display name, not ID. A standalone skin format and automatic propagation across projects can wait.

Preview on a cloned document map. Never serialize the render copy into project content. For skinned projects, Page style gains **Use design settings** for corners; existing rounded/square preferences become visible, explicit preview overrides. Preserve old project preferences and avoid automatically rewriting existing files. Export always serializes saved design content.

### Registry-backed component catalogue

Expose a small catalogue model generated from `PRIMITIVES`, `FAMILY_ORDER`, aliases and `demoFor`, consumed by both the existing HTML catalogue and app. Render examples through the shared engine, not SwiftUI replicas. The inspected count is 56; acceptance compares against the registry at the built revision, not a fixed count.

Show every canonical component once, grouped by family, with name, example and current role. Search name, aliases and summary. Aliases point to canonical entries. Container outer targets remain selectable separately from their example children.

Derive variant choices from registry props. Existing state props and examples provide disabled/loading/checked/error samples; add renderable sample metadata to an entry when a state needs several props. This is not another component list or a promise to enumerate every arbitrary prop combination.

Selection must not activate links or submit actions. A separate **Try component** action exercises supported behavior and returns to editing without losing the draft. Generated composite parts without a source address cannot pretend to be individually editable; identify the owning primitive and its inherited shared role.

Reuse the full Font Awesome Free solid/regular/brands picker and bundled assets. Do not duplicate icons inside skins or send the full icon catalogue into model context.

### iPad interaction

1. Open a project and **Page style → Design system**. Choose New skin or a saved skin. Duplicate the built-in Wireframe skin to edit it.
2. Browse the searchable gallery. Landscape can show the list, selected example and inspector; portrait/split view uses a detail sheet with Back rather than cramped columns.
3. Select an example. The inspector names primitive, role and scope. Choose a standard role or create a named custom role from the current appearance.
4. Edit Text, Fill, Border and Accent via token, colour picker or hex field. Token edits preview every referencing role; show affected role/use counts. Display measured text/background contrast and retain the exact supplied colour instead of silently modifying it.
5. Edit existing border/corner controls, including Pill. Reset a property to its inherited value. Explain unsupported painted parts instead of showing ineffective controls.
6. Save once, close and inspect the actual page. Cancel discards the draft; leaving a dirty draft offers Save, Discard or Continue editing.
7. In the wireframe, select a real component and assign a role/local override. Scope explicitly says This instance, Shared component or Skin role. Shared edits identify affected pages before commit; repeated rows identify their shared source.
8. Switch skins, navigate pages, undo/redo and export with Wi-Fi disabled and no model loaded.

Require 44×44 point hit areas, 8-point spacing, accessible names/values, keyboard focus and the existing localization pipeline. Preserve selection, search, project page and scroll while editing. Test Dynamic Type and keyboard-visible hex/name entry so Save/Cancel stay reachable. Company skins style wireframes and samples only, not the app shell.

### CLI, browser, API and mobile parity

Add pure engine functions over document maps for catalogue enumeration, resolved appearance, skin validation/save/delete/copy/select and role assignment/reset. Follow neighboring engine result/error patterns; do not add a service framework.

Add `wf skin list|show|save|use|remove|copy` through the existing CLI command registry. Save accepts a YAML definition, copy accepts source project and skin ID, and `use wireframe` restores built-in appearance. Use neighboring flag conventions and document exact syntax before implementation delivery. Existing node update supports the new selector and colour fields.

`wf validate` reports missing skins/tokens and incompatible/unknown roles. `wf why` reports resolved role, each property's winning source and fallback. Catalogue/build/screenshots/export use the same resolver; a preview skin override never rewrites files.

Browser mount options gain `skin` and the instance gains `setSkin(id)` for preview. Shared authoring operations persist changes; mounting must not mutate the caller's design. Identical documents/viewport/platform/mode must resolve identically in CLI and browser.

The API already stores YAML documents; no skin table or auth route is required. If admin adapters are in the implementation scope, preserve route/controller/service/repository layering. Mobile invokes the same engine authoring operations for deterministic inspector edits, permits the new node fields in `web/src/edit.ts`, and uses the existing validation/render gate and revision commit. No model is needed.

Agent context includes selected role and relevant tokens, with on-demand lookup for more. Do not load all saved projects, every example or thousands of icons. Unrelated edits preserve skin fields; reject unsupported mutations rather than deleting data.

Update registry-generated schema sections and all schema contracts together: `schema.json`, `schema.md`, `schema-systems.md`, `schema-canonical.yaml`, CLI brief, rendering docs and generated references. Update affected admin/mobile wireframe specifications when those controls are implemented.

## Implementation Order

1. Obtain a different-provider adversarial review. Record adopt/defer/reject decisions and settle resolution/override semantics before engine changes.
2. Add schema and pure resolver/validator. Coordinate with final pill/icon/sticky/placeholder interfaces instead of implementing parallel variants.
3. Apply resolved styles to existing primitive renderers and composite actions; expose catalogue and CLI/browser adapters. Verify all registry entries and relevant states.
4. Build the iPad gallery/inspector/save/switch flow using the existing WebView, revision store and source metadata. Update its renderer dependency only after the engine change lands.
5. Exercise offline export/reopen, copying, recovery, shared components and the physical-iPad flows below. Implement affected admin/API adapters only if included in the bounded brief.
6. Audit schema/docs/wireframes, screenshots and review findings. Move this plan to `docs/done/` only after delivery.

### Acceptance targets and actual flows to test

These are targets, not measurements already achieved. Record exact revisions, iPad model/OS, viewport, network state, fixture size and actual results. A real iPad is the primary acceptance device; Playwright and simulators supplement it.

| Flow | Required result |
| --- | --- |
| Every component | Render and select 100% of canonical registry entries. Every alias search reaches its canonical component. No blank samples or alias duplicates. |
| Company colours offline | In airplane mode, create Acme with the exact five example hex colours, style primary/secondary buttons and inputs, save and reopen the app. Resolved colours match, with no network/model request. |
| Complex prototype | Use at least 8 linked pages and 200 nodes, reusable components, lists, forms, overlays, icons and sticky regions. Switch two skins; all pages update with zero changed content, route, interaction or dataset fields. |
| Precedence | Combine primitive role, specific role, page style, shared definition and instance override. Inspect actual colours/corners and `wf why`; every winning source matches the specified order. |
| Behavior | Exercise navigation, validation, focus, disabled/loading buttons, toggles, overlay and repeated list. Selection edits rather than activates; Try mode activates. Appearance changes preserve behavior. |
| Coordinated primitives | Check Free solid/regular/brand icons in leading/trailing/centre positions, 44-point pill controls, crossed labelled image placeholders and sticky header/footer. Colours do not change geometry or stacking. |
| Recovery | Undo/redo token edit, role assignment and switch. Reject bad hex, unknown token, incompatible role and absent skin with no partial revision. Discard a draft and verify prior appearance. |
| Reuse/export | Copy into a second project and edit the copy without changing the source. Export/import both `.wf` files; CLI/mobile resolve equivalent appearance. Unchanged packing stays deterministic. |
| Missing custom role | Switch to a skin lacking the role, see its declared fallback and diagnostic, then switch back and recover its original appearance without rewriting the selector. |
| iPad ergonomics | Test portrait, landscape, split view, largest supported accessibility text, VoiceOver and keyboard-visible entry. No clipped actions, inaccessible fields or accidental activation. |
| Responsiveness | Record 20 edits/switches on the physical iPad and 8-page/200-node fixture. Target p95 ≤250 ms from completed colour input to example update; ≤500 ms from saved-skin choice to current-page update; cold gallery opening ≤2 s. Report actual numbers. |
| Compatibility | Open a pre-feature project without skins in CLI/browser/iPad; output and editing/export remain unchanged. Supported older clients must not silently strip a skin or claim matching brand appearance. |

For visibly changed UI, capture base/final states with matching viewport, device, theme and state. Embed Before/After pairs for the changed Page style entry, gallery, inspector and save/switch states; a new screen has “No prior equivalent” in Before. Do not capture unchanged journey pages merely because verification visits them.

Run required repository and focused schema/catalogue/rendering checks during implementation on the designated host. No native build is needed for this document. Tests and source inspection do not establish manual iPad verification.

## Edge Cases

- Local overrides survive switching and are labelled; Reset resumes inheritance.
- A stale draft cannot overwrite a newer model edit: commit against its base revision and visibly rebase or reopen when it changed.
- Large galleries may render visible samples first if measurements require it, but search and selection must retain every entry.
- Shared/repeated nodes preserve source/definition/row addressing and explicit scope; no invented per-rendered-row edits.
- Poor company contrast is shown with ratio and affected pair; retain exact colour. Editor focus/selection stays readable independently.
- Missing assets use existing labelled placeholders. Skins fetch no replacement images or fonts.
- Removing the last definition of a used custom role is blocked with affected locations. Registry roles remain available in empty skins.
- Unsupported future fields survive read-only viewing and unrelated edits; surface unsupported semantics rather than claiming parity.
- Export serializes the design, not temporary mode/corner/skin preview overrides.

## Non-Goals

No new identity/org/team/invitation store or auth changes; no cloud marketplace/global service/live cross-project links; no arbitrary CSS, token expression language, nested skin inheritance or duplicate component library; no font uploads/full typography system, arbitrary layout tokens or animation designer; no replacement of mode/platform/sizing/behavior; no company theme for the app shell; no model requirement for inspector editing.

## Review and Verification Record

Source inspection only. No skin implementation, native build, rendered iPad flow, screenshot acceptance or performance measurement is claimed. The Mac noninteractive shell lacked `rg`, `node` and `steroids`; source inspection used available read-only tools. Required cross-provider review is pending and must be recorded before implementation.