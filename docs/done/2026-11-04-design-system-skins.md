# Design system and named skins

Status: proposed design; no skin implementation is delivered by this document.

Source inspected on 4 November 2026: `UnlikeOtherAI/wireframes` at `47aaeeec9a75afc6ad57d1d93aef6c2f9f9882bf`, and the separate `UnlikeOtherAI/wireframe-mobile` repository at `4e2b80523b2f951701fd205b5053396cb603d7cb`. A different-provider adversarial review is required before implementation. Append findings and decisions to this document.

## Problem Statement

A person can build clickable wireframes but cannot inspect every supported component in the app, assign semantic appearance roles, edit real company colours, or save and switch reusable named skins. Repeating literal colours on nodes would make later changes unreliable. The feature must work on an offline iPad and travel with exported projects.

The smallest useful solution is a component gallery generated from the existing registry, an inspector for one component at a time, and named skin data in the existing manifest. The shared engine resolves that data for the CLI, browser and native host. No separate component library, account service or server store is needed.

## Current Behavior

| Area | Source and behavior |
| --- | --- |
| Components | `engine/schema/primitive-registry/index.js` collects 54 canonical primitives in six families at the inspected revision. Entries own props, aliases, frame class and examples. `scripts/sync-schema-primitives.js` generates schema sections. |
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

### First-release boundary

Ship named project-local skins, the complete registry component catalogue, standard primitive/variant roles, four literal colour fields and existing border/corner controls. There are no custom roles, new node selector, token references, state-palette editor, skin deletion workflow, account/API store or unrelated admin adapters in this release. This section supersedes the broader initial proposal.

### Minimal schema

Add optional `manifest.designSystem: { activeSkin, skins }`. Each skin has a display `name`, optional `defaults`, and a `roles` map. Defaults and role values reuse the existing partial `WireframeStyleOverride`, extended with optional `colors: { text, background, border, accent }`. Colours exist only in skin defaults/roles, in a separate SkinAppearance schema. Existing WireframeStyle objects retain border/corner fields; their explicit local overrides take precedence.

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
        defaults:
          colors:
            text: '#172033'
            background: '#FFFFFF'
            border: '#CCD3DF'
            accent: '#1457D9'
        roles:
          button.primary:
            colors:
              background: '#1457D9'
              text: '#FFFFFF'
              border: '#1457D9'
            corner: { style: pill }
          button.secondary:
            colors:
              background: '#FFFFFF'
              text: '#1457D9'
              border: '#1457D9'
```

This proposed fragment is not accepted by the inspected engine. Pill is the independently coordinated corner-style extension.

- Skin IDs use the existing `Id` grammar; names are editable Unicode text. Reserved `wireframe`, or absent `activeSkin`, means the current built-in appearance. Duplicate it into a named skin to edit it.
- Colours accept `#RRGGBB`; background also accepts `transparent`. No token aliases, CSS expressions, URLs, selectors, arbitrary CSS or remote assets. A shared default colour applies until a role explicitly overrides it.
- Role keys come only from canonical registry primitive names and their existing `variant` enum: `button`, `button.primary`, `button.secondary`, etc. Resolve aliases before matching. Declare renderer default variants on their registry entries where needed; do not create a second mapping. Entries without variants have their primitive role only.
- The standard role selector is the existing `props.variant`. There is no `skinRole` field. Choosing Primary button on a real node writes `props.variant: primary` through the existing edit operation. `node.role` retains structural frame/sizing semantics.
- Reset removes a property. Do not persist null or empty-string style values. Saving a new name/ID copies a skin; renaming its display name preserves ID.

Keep `.wf` at `wf/1`. Saving named skins promotes the manifest specVersion and manifest.schemaVersion to 1.2; other document types remain 1.1. The new engine accepts both manifest versions. Retain 1.2 when switching to Wireframe because saved skins remain. Older validating loaders reject 1.2. Already-shipped render-only browser clients that skip validation cannot be made to warn by a new marker; they are unsupported for skinned files, and brand parity is not claimed.

### Resolution and inheritance

Resolve properties in the engine, merging style leaves in this low-to-high order:

1. Existing engine appearance for mode, platform, variant and state.
2. Manifest `defaultWireframeStyle`.
3. Active skin `defaults`.
4. Page `wireframeStyle`.
5. Active skin's canonical primitive role, such as `button`.
6. Active skin's standard variant role, such as `button.primary`.
7. Reusable definition's explicit style.
8. Instance/node/overlay explicit style through existing resolver behavior.

A missing role definition inherits defaults and the built-in role treatment; every standard role is always available. An absent selected skin or non-registry role key is a validation error. Skins do not inherit from each other. No new layout, sizing, density or elevation system is introduced.

No-skin projects render identically. Preserve existing disabled/loading/checked/error/focus behavior and severity cues. Do not recolour an error solely with company accent. Custom state palettes are out of scope.

Apply colours to painted parts: control labels/icons use role text; backgrounds apply only where existing frame rules allow a surface/control fill. A colour must not give a content/group primitive a box or fill an edge. Composite action buttons use the same button-role resolution as standalone buttons. Keep part mappings in renderer code, never arbitrary selectors in skin data. Recompute colours at node boundaries so a coloured card does not silently recolour its child button.

Use the parent's finalized pill implementation. Platform CSS can override inherited radii on iPad, so emit node-local `data-wf-corner="pill"` and target the actual painted part with sufficient selector specificity. Pill wins over numeric radius, forms caps at half the shorter rendered dimension, and is not reduced by line-mode radius scaling. Check inputs, intrinsic buttons and square icon buttons. Do not broaden this work into repairing the existing nested numeric-radius inheritance bug; preserve existing sharp/rounded behavior and document any observed limitation.

Mode/platform remain independent of skin. Brand colours may render in line or card mode; frame treatment stays mode-specific. Icons and their placement, crossed labelled image placeholders and sticky regions keep the parent's primitive interfaces. The app shell retains its own theme.

### Saving, copying and preview

Save the validated draft as one existing project revision. Active skin ID is project content. Undo/redo covers saves, switches and standard role assignments. Switching changes one manifest reference rather than rewriting nodes.

The picker lists the current project's skins. **Copy from another project** reads a saved manifest from the existing local project store, copies the selected definition and validates it in the destination. Editing a copy never changes the source. ID collisions offer Save as new or Replace with the affected-project scope stated. There is no global library or live cross-project link. Export/import uses the existing `.wf` format. Delete/garbage-collection UI is deferred; unused named skins may remain in a project.

Preview always uses a cloned document map. Never serialize temporary render overrides into saved content. For skinned projects, Page style offers **Use design settings** for corners; rounded/square remain explicit labelled preview overrides. Preserve existing unskinned-project preferences. Export serializes saved design content.

### Complete catalogue and minimal iPad flow

Generate metadata and examples from `PRIMITIVES`, `FAMILY_ORDER`, aliases and `demoFor`. Both the existing HTML catalogue and app consume that model. At the inspected revision there are 54 entries; the implemented count is always the registry's count. Render through the engine, not native approximations.

Show each canonical component once, grouped by family, with its rendered example. Search matches name, alias and summary. A container's labelled outer sample is selectable without accidentally selecting its children. Variants in the inspector come from registry props; choosing one changes that example only until the user assigns it to a real node. No custom-role creation is shown.

1. Open **Page style → Design system**, select a named skin or New skin, and browse the complete gallery.
2. Tap one component. The inspector shows primitive, standard role, four supported colour fields, and border/corner controls. Unpainted parts explain why a control is unavailable. Reset restores inheritance.
3. Enter exact company colours through picker/hex fields. Show contrast for relevant text/background pairs; retain supplied values rather than silently changing them.
4. Save once and inspect the actual wireframe. A dirty draft offers Save, Discard or Continue editing. No model or connection is required.
5. In the wireframe, existing component selection can assign a standard variant. Clearly identify the source and whether the edit affects a shared component or repeated rows. Role editing in the skin inspector affects every use of that role in this project.
6. Switch skins, navigate the prototype, undo/redo, copy a skin and export while offline.

Use the existing WebView, moving its surface into the design-system view just as the app already moves the single host surface. The gallery itself handles sample selection; native controls edit the selected role. Portrait/split view uses one detail sheet with Back rather than compressed columns. No separate Try-component mode is needed for the first release: inspect samples in the gallery and verify behavior in the actual prototype.

Require 44×44-point targets, 8-point spacing, VoiceOver labels/values, keyboard focus and the existing localization pipeline. Preserve gallery search/selection/scroll during previews. Keyboard-visible hex/name entry must leave Save/Cancel reachable. Reuse bundled Font Awesome Free assets and search; no full icon catalogue enters model context.

### Smallest shared engine contract

These names and shapes are the proposed implementation contract, not current exports:

```ts
getDesignSystem(documentMap): {
  activeSkin: string;
  skins: Record<string, Skin>;
  components: Array<{
    component: string; family: string; summary: string;
    aliases: string[]; variants: string[]; defaultVariant: string | null;
  }>;
}

// At most one upsert and one selection, applied atomically to a clone.
updateDesignSystem(documentMap, change: {
  skin?: { id: string; value: Skin };
  activeSkin?: string;
}): { ok: true; documentMap } |
    { ok: false; error: string; details: { errors: Diagnostic[] } };
```

`Skin` is exactly the persisted schema above. Both supplied fields must validate before any result is returned. An upsert can create, replace or rename a skin; selection can be combined with it. Copying passes a source skin value as an upsert, so it needs no special engine operation. Reading has no side effects. Caller-owned Maps/documents remain unchanged. There is no delete endpoint, state engine or custom-role operation.

The renderer uses an internal pure `resolveAppearance` helper with the precedence above. Extend existing `buildCataloguePage` options with `documentMap` and optional `sample: { component, variant? }` to render the current skin and selected variant; the catalogue model remains registry-derived. Normal `renderPage` reads persisted active skin. CLI save/use/list/show call these same functions; existing build/validate/pack/unpack retain parity. Defer a broad CLI command family and new browser mount methods unless needed by the implementation's supported interface; browser preview can clone, update and render using these functions.

### Exact native-host calls

Extend the existing `wfHost` object and `WebHost.call` wrapper with only these three calls:

| Native method / JavaScript call | Arguments and result |
| --- | --- |
| `designSystem(wf:)` → `wfHost.designSystem(wf)` | Parse `.wf`, call `getDesignSystem`, return its JSON metadata. Swift decodes `DesignSystemInfo`. No preview or persistence. |
| `previewDesignSystem(wf:change:sample:)` → `wfHost.previewDesignSystem(wf, change, sample)` | `change` is the exact upsert/selection object above; `sample` is null or `{component, variant?}`. Clone, validate, render catalogue and await iframe load. Return `{ok, diagnostics}` without a project revision or ordinary project `rendered` event. |
| `applyDesignSystem(wf:change:page:)` → `wfHost.applyDesignSystem(wf, change, page)` | Apply the same engine change, run the existing project-validation/all-page render gate, and serialize. Return existing `EditResult` with `wf`, `page`, `changes`, `diagnostics`. This does not write SQLite. |

The trusted host sends `type: "designSystemSelection", component, variant` on gallery selection, handled by `WebHost.onDesignSystemSelection`. Validate both names against the returned catalogue; retain the existing main-frame-only native-message boundary. Gallery rendering does not overwrite real project page lists or complete unrelated `load` waiters. Preserve current gallery scroll/search on re-render and discard stale preview completions with the existing token pattern.

The native model owns the draft and base revision. Save awaits `applyDesignSystem`, then uses the existing render-before-store commit path with the unchanged base-revision check. If the project changed, keep the draft and show the stale-draft error; do not overwrite the newer project. Closing without save restores `host.load(wf: currentProject.wf, page: previousPage)`. Saving restores the normal page through that same commit path. Standard role assignment uses the existing `applyEdit` set operation on `props.variant`; it needs no fourth bridge call.

Keep host transport logic small. If `host.ts`, `WebHost.swift` or `AppModel` would breach repository file limits, move feature helpers to the files below rather than adding another transport. Do not modify C++ storage or add API/admin routes.

### Proposed implementation ownership

This is an ownership proposal for a later bounded assignment, not permission to implement now. The design-system agent would own:

- New `engine/design-system/index.js`: read/update/validate operations; split pure resolution into `engine/design-system/resolve.js` if necessary to stay under 500 lines.
- New `engine/catalogue/model.js`, plus existing `engine/catalogue/index.js` and `engine/catalogue/demos.js`: registry-derived metadata, render options and sample selection attributes.
- New focused `cli/test/design-system.test.js`, plus existing `cli/test/catalogue.test.js`: parity, invalid edits, unchanged input and complete catalogue checks.
- This plan and the design-system portions of schema/rendering/CLI documentation.

Shared files require a sequential integration handoff after the parent's primitive changes: `engine/schema/schema.json`, `engine/schema/primitive-registry/*.js`, `engine/renderer/wireframe-styles.js`, `engine/renderer/node-shell.js`, `engine/renderer/render-attrs.js`, `engine/renderer/primitives/*.js`, `engine/renderer/styles/*.js`, `engine/renderer/index.js`, `engine/build/index.js`, `engine/index.js`, `cli/bin/wf.js`, and `cli/commands/registry.js`. Only files whose actual renderer/adapter needs the skin hook should change; this list is a coordination boundary, not a blanket refactor. The parent retains pill/icon/sticky/placeholder ownership.

If separately assigned the mobile tranche after engine integration, the exact proposed files are new `web/src/design-system.ts`, `ios/Wireframes/App/AppModel+DesignSystem.swift`, `ios/Wireframes/UI/DesignSystemSheet.swift`, `ios/Wireframes/UI/SkinInspector.swift`, and `ios/Wireframes/Core/DesignSystemTypes.swift`; existing `web/src/host.ts`, `web/src/edit.ts` (export/reuse its validation gate only), `ios/Wireframes/Web/WebHost.swift`, `ios/Wireframes/App/RenderingStyle.swift`, `ios/Wireframes/UI/RenderingSheet.swift`, plus native project source registration/localization files if required by its build. The parent should allocate this tranche explicitly; no mobile file is currently assigned to this design-only task.

## Implementation Order

1. Obtain a different-provider adversarial review. Record adopt/defer/reject decisions and settle resolution/override semantics before engine changes.
2. Add schema and pure read/update/resolver/validator functions. Coordinate with final pill/icon/sticky/placeholder interfaces instead of implementing parallel variants.
3. Apply resolved styles to existing primitive renderers and composite actions; expose catalogue and CLI/browser adapters. Verify all registry entries and relevant states.
4. Build the iPad gallery/inspector/save/switch flow using the existing WebView, revision store and source metadata. Update its renderer dependency only after the engine change lands.
5. Exercise offline export/reopen, copying, recovery, shared components and the physical-iPad flows below. Do not add unrelated admin/API adapters.
6. Audit schema/docs/wireframes, screenshots and review findings. Move this plan to `docs/done/` only after delivery.

### Acceptance targets and actual flows to test

These are targets, not measurements already achieved. Record exact revisions, iPad model/OS, viewport, network state, fixture size and actual results. A real iPad is the primary acceptance device; Playwright and simulators supplement it.

| Flow | Required result |
| --- | --- |
| Every component | Render and select 100% of canonical registry entries. Every alias search reaches its canonical component. No blank samples or alias duplicates. |
| Company colours offline | In airplane mode, create Acme with the exact four default example hex colours, style primary/secondary buttons and inputs, save and reopen the app. Resolved colours match, with no network/model request. |
| Complex prototype | Use at least 8 linked pages and 200 nodes, reusable components, lists, forms, overlays, icons and sticky regions. Switch two skins; all pages update with zero changed content, route, interaction or dataset fields. |
| Precedence | Combine primitive role, specific role, page style, shared definition and instance override. Inspect actual colours/corners and `wf why`; every winning source matches the specified order. |
| Behavior | Exercise navigation, validation, focus, disabled/loading buttons, toggles, overlay and repeated list. Gallery selection edits rather than activates; the actual prototype remains interactive. Appearance changes preserve behavior. |
| Coordinated primitives | Check Free solid/regular/brand icons in leading/trailing/centre positions, 44-point pill controls, crossed labelled image placeholders and sticky header/footer. Colours do not change geometry or stacking. |
| Recovery | Undo/redo colour edit, standard role assignment and switch. Reject bad hex, non-registry role key and absent skin with no partial revision. Discard a draft and verify prior appearance. |
| Reuse/export | Copy into a second project and edit the copy without changing the source. Export/import both `.wf` files; CLI/mobile resolve equivalent appearance. Unchanged packing stays deterministic. |
| Partial skin | Switch to a skin without a specific standard-role override. Verify primitive/default/built-in inheritance, then switch back and recover the original appearance without rewriting nodes. |
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
- Standard registry roles remain available in empty/partial skins. Unused skins remain stored; deletion UI is deferred.
- Unsupported future fields survive read-only viewing and unrelated edits; surface unsupported semantics rather than claiming parity.
- Export serializes the design, not temporary mode/corner/skin preview overrides.

## Non-Goals

No new identity/org/team/invitation store or auth changes; no cloud marketplace/global service/live cross-project links; no custom roles, token references, skin deletion workflow, arbitrary CSS, nested skin inheritance or duplicate component library; no font uploads/full typography system, arbitrary layout tokens or animation designer; no replacement of mode/platform/sizing/behavior; no company theme for the app shell; no model requirement for inspector editing.

## Review and Verification Record

Source inspection only. No skin implementation, native build, rendered iPad flow, screenshot acceptance or performance measurement is claimed. The Mac noninteractive shell lacked `rg`, `node` and `steroids`; source inspection used available read-only tools. Required cross-provider review is pending and must be recorded before implementation. The 4 November refinement narrows the proposal to standard roles and literal colours; it also adopts the parent review finding that iPad pill corners need node-local painted-part selectors. No implementation or measured acceptance result is implied.

### Cross-provider review decisions — 4 November 2026

Claude Sonnet 5.5 (firstParty) completed a read-only review of the narrowed design at ae616a3. Raw result: D:\Temp\wireframe-interactive-01a1a66a\claude-skins-review.json. The implementation agent read the result and assessed each finding before code.

| Finding | Decision |
| --- | --- |
| H1 colour/style merge | Adopt: separate SkinAppearance with colors plus existing partial border/corner fields. Do not extend existing WireframeStyle with colours. Pill evidence was from an earlier source; reuse the parent implementation. |
| H2 validation | Adopt: explicit JSON schema plus semantic skin-ID/reserved-ID/role-key/activeSkin checks. The custom validator does not enforce propertyNames. Reject invalid future fields rather than promising editable support. |
| H3 explicit overrides | Adopt: compute a complete effective style for each skinned node before applying its explicit local leaves. Do not compare local values only against the page. |
| H4 entry-point parity | Adopt: one effective-page helper shared by pure build, disk build, serve, screenshots and why. Preserve legacy replace behavior for projects without an active named skin. |
| H5 parent leakage | Reject the suggested restriction to leaf controls: the user requires every component. Adopt isolation at node painted parts; separately rendered child nodes resolve their own appearance. No broad legacy numeric-radius repair. |
| H6 state/severity | Adopt: generic defaults never replace error/danger/status signals. Explicit severity-role overrides are deliberate. Preserve invalid-field error borders regardless of generic role colour. |
| M1 variant mismatch | Reject broad class renaming: actual primitive dispatch supports button.link. Verify emitted variants/defaults from the active renderer; keep standard roles registry-derived. |
| M2 composite actions | Adopt: apply the same button-role resolver to action markup in headers, forms, empty states and overlays. |
| M3 accent | Adopt: define consumers and catalogue capabilities for focus, checked/toggled controls, selected navigation/segments, progress/rating. Unsupported parts are exposed as unavailable. |
| M4 platform/mode | Adopt: explicit skin/local corners and colours beat platform/mode on painted parts, with the parent's node-local pill marker. Test numeric/pill in iOS card/line. |
| M5 catalogue | Adopt: documentMap/sample options with common resolver; no-options/no-skin generated output remains identical. |
| M6 compatibility | Adopt the problem, reject the suggested new-only marker as sufficient. Manifest spec/schema 1.2 uses the existing older-loader version gate. Existing render-only clients cannot be forced to validate; explicitly unsupported, not claimed to warn. |
| Low: frozen input, reserved ID | Adopt focused nonmutation and reserved-ID tests. |
| Low: transparent contrast | Native inspector must calculate contrast against the actual composited backdrop, or report unavailable rather than invent a ratio. Mobile implementation remains with the parent. |

Implementation is now authorized for the engine tranche only. The iPad flow, screenshots and performance targets remain unmeasured until the parent exercises them.


## Verified implementation

- Maxis passed 243 engine/CLI checks, including schema/catalogue drift, icon lookup, pure renderer overlay parity, styled samples and browser journeys. The runtime revision is 093731b; later changes add review evidence and repair four unavailable admin fixture icon references.
- Actual CLI burger-menu/search requests returned bars and magnifying-glass first. Both the interactive example and admin wireframes validated and built.
- Browser checks exercised three linked pages, typed and cleared fields, Free solid/regular/brands glyphs, pill geometry, persistent image captions and a menu after 1000 px of scrolling (sticky offset within 1 px). Captions meet 4.5:1 in the exercised default/company palettes.
- The native consumer was used directly in a Release iPad Air 13 M3 simulator on iOS 26.5: navigation, typing, sticky menu, a real model edit, colour picking, skin save/restart, copying into a blank project, switching and invalid-colour recovery. All 54 registry samples also loaded through native UI automation. Physical-device signing remained blocked by the Mac keychain; no physical iPad pass or pairing verification is claimed.
- Matching base/final captures are in docs/images/interactive-designs-review; only changed states are included in the pull request.
