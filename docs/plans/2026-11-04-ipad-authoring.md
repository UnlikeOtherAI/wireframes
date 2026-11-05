# iPad authoring: short edits, preview actions and company logos

## Problem Statement

Physical iPad chat exposed failures hidden by valid YAML alone. A two-column dashboard worked, but “Add a header with a user menu” exhausted four attempts. “Add a left burger menu drawer and a footer” saved a static menu-shaped element without a working drawer. The small E2B model needs less instruction and reliable core plumbing. People also need to tap a preview element to style its role or comment, and upload up to three company logos whose images switch with the skin.

## Current Behavior

Engine main 3954662 renders 54 registry components and named manifest 1.2 skins. Images accept src/alt/width/height. Skins have name/defaults/roles. Mobile main c0d8334 uses an offline WKWebView renderer and transactional edit operations. addOverlay validates anchored triggers but does not wire their opening interaction. insertAfter with node: main already inserts at the top. Source annotations omit the canonical component/variant. The editing skill is always supplied in full; the observed prompts were 5,071–6,244 tokens and dropped older conversation. Failed-batch diagnostics can list transient IDs created earlier in that rejected batch.

Preview action implementation af3bf36 adds a native selection strip and direct role/comment entry, pending engine annotations and physical checks. The native skin editor already provides both hex input and a native ColorPicker.

## Desired Behavior

Short ordinary requests create a usable admin prototype. The leading burger button is inside a top nav bar, has a ≥44×44 point target, opens a left drawer, and its links/dismissal work. A footer follows the page content. Shared components can be created/used/edited without duplicated instances. A selected preview element opens its canonical global skin role or a contextual chat comment.

Each named skin can hold up to three labelled logo slots. A wireframe image chooses a stable slot, has editable container width/height, preserves the logo aspect ratio, and changes image when the active company skin changes. Save/restart/copy preserve the assets offline.

## Design

1. Add annotated-only escaped data-wf-component/data-wf-variant using standardRole(node). Unannotated exports remain identical.
2. Add optional skin.logos keyed only by logo_1, logo_2, logo_3; values contain name and src. Native uploads normalize PNG/JPEG/HEIC to upright PNG, maximum 256 KiB per asset and 1024 px per dimension. The engine accepts bounded PNG data URLs only for this contract. Reject SVG/script/remote logo sources. This is offline client project content; no API database/GCS adapter or identity store changes are included.
3. Add image.props.slot enum logo_1|logo_2|logo_3. It resolves from the active skin at render time. Existing src images keep their behavior. A missing slot produces a labelled placeholder, never a prior skin's asset. For logo images, existing numeric width/height describe the outer container; inner image uses object-fit:contain. Never stretch the logo.
4. Reuse the manifest skin update/save path for uploads. Add three fixed slot editors under skin defaults. Each can upload/replace and edit a display label; no asset library or role/token language. Keep native draft/cancel/error behavior. Add a Logo and size action for selected images; JS applyLogoImage(wf,page,source,{logo,width,height}) validates and returns an ordinary EditResult for the existing revision/commit gate. Width/height are finite positive points, bounded to 4,096.
5. Keep image bytes out of model context. The current context contains page nodes, not the manifest; append only up to three slot IDs and escaped short labels to the outline. The model writes image.slot and dimensions, never base64.
6. Fix actual small-model friction: list the already-supported set operation in the core instructions; remove the misleading restricted popup-type list that excludes drawers. Supply compact request-relevant examples rather than all skill examples. Preserve a small stable contract. Make addOverlay with a valid trigger reliably attach its open_overlay action without duplicate interactions, and reject conflicting existing trigger behavior rather than silently replacing it. Refused batches explicitly state that all changes rolled back and retry IDs come from the unchanged input, not transient edits.
7. Reusable components: first exercise the real existing contract. Add only a missing supported operation if the actual chat test proves it necessary; reuse the engine's existing component documents/use resolution. Do not invent an alternate component system.

## Implementation Order

Adversarial different-provider review of this design; annotated renderer and bounded logo contract; schema and generated catalogue/docs sync; portable checks and renderer/actual CLI flows on Maxis; native integration; short real-model conversations on the physical iPad; fix/repeat the same failures; preview action/hex/picker/upload/resize/switch/copy/reusable checks on device; matching changed-state evidence; one PR per affected repo; merge when required checks pass.

## Edge Cases

Three-slot limit, corrupt/oversized files, upload cancel/replace, blank names, missing slots across skins, transparent logos, orientation, aspect ratio, narrow containers, save/restart/copy, stale revision guard, no embedded image bytes in prompts, shared vs per-instance selection, popup trigger conflicts, repeated open/close and route return, atomic rollback feedback.

## Non-Goals

No Pro assets, SVG parser, remote asset service, GCS/API migration, pairing changes, broad inspector/token framework or speculative model planner.

## Acceptance

- Repeat the short header/menu and burger/drawer/footer requests on real E2B, inspect and tap the results, recording attempt counts/timing/failures.
- Burger button is leading inside nav bar, ≥44×44 pt, opens/dismisses a left drawer and navigates actual pages. Footer stays after content.
- Create two reusable instances, edit shared definition, inspect both and verify a local override stays local.
- Tap → global role; exact hex and visual picker agree. Tap → comment sends exact selected source.
- Upload three distinct logos through native picker; no fourth slot; resize a selected logo container to measured dimensions; image remains contained; company skin switch changes matching slots. Save/restart/copy retain logos and source content.
- Model context includes only slot IDs/labels, no data URL. Validate invalid payloads and hostile input through pure APIs and actual CLI.

## Review decisions and core proof

Claude Sonnet reviewed this design read-only on Maxis before implementation (13 turns; saved outside Git).

- Adopt typed native CompanySkin.logos and save/copy/colour-edit preservation tests. Reject implicit engine merge-on-replacement: the API intentionally replaces a complete skin, and a missing logos field may mean removal. The typed client must preserve its data.
- Adopt one browser-safe PNG validator at validation and rendering boundaries. Persist PNG only after native normalization; reject SVG, remote sources, corrupt headers and animation. Cap each asset at 256 KiB and 1024 px per dimension (1024 keeps a wordmark useful at tablet scale while retaining the smaller byte bound).
- Adopt explicit kind: logo plus slot: logo_1|logo_2|logo_3. Keep outer-box sizing inside that branch. Missing slots retain the same box and a label.
- Adopt bounded labels and diagnostics without image payloads. No asset bytes enter the model context.
- Adopt existing applyEdit for native logo assignment/size; reject a second JS mutation API.
- Adopt optional trigger wiring for every overlay type, requiring a trigger only for the existing anchored types; preserve identical open actions and reject conflicting click behavior.
- Adopt short request-keyword guidance and remove duplicate examples. No planner or instruction catalogue. Target a net token reduction.
- Adopt explicit whole-batch rollback feedback and original-input IDs in errors.
- Shared renderer reuse was verified directly at shipped runtime093731b: one components definition, two use references, one shared child-title edit via the supported core API updated both, and the second instance's prop override remained local. The first root-address mutation probe was rejected because that CLI address denotes a container; it is not claimed as passed. Actual core evidence is outside Git.
- Physical chat did not create reuse: it appended a separate card. The mobile edit-operation list has no definition-creation/extraction operation. Add one makeReusable operation that extracts an existing node into the engine's existing components document and replaces it with a use, so E2B need not copy or coordinate a definition manually. Instances continue to use the existing append operation.
- API/GCS adapters remain outside this native/offline scope. Client SQLite may hold project image content; this does not introduce an API asset table or identity authority.
