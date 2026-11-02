# C · Routebook

**Choose this if linked journeys are the product.** A small atlas for an idea: pages are named stops, links are routes, and the agent helps fill in the journey. The identity is graphic and structured rather than conversational or cinematic.

[Open the visual board](mockups/direction-c.html) · [Shared technical decisions](README.md#shared-decisions-all-three-directions-inherit-these-contracts)

## Problem Statement

Generating one attractive screen is easy to understand; knowing which file owns a header, which button links to Booking and whether a change affected three pages is harder. Routebook makes the structure visible without requiring a YAML editor. It deliberately spends more chrome on page relationships, so it is less minimal than A.

## Current Behavior

- [wf-format.md](../../cli/wf-format.md) defines manifest/sitemap/templates/components/pages/datasets/assets in one multi-document project. This supports the atlas metaphor without a new file format.
- [renderer/src/mount.ts](../../../renderer/src/mount.ts) maps route IDs to page IDs and supports in-memory navigation. It does not provide a journey editor, source-map callback or viewport/orientation controls.
- [engine/addressing/index.js](../../../engine/addressing/index.js) has `wf://` source references; [resolver/index.js](../../../engine/resolver/index.js) changes component descendant IDs during expansion. Source references are useful, but do not yet solve rendered-instance selection.
- [agent-guide.md](../../cli/agent-guide.md) defines greyscale primitives and linked interactions. Routebook's coloured route markers belong to native chrome, not generated YAML wireframe branding.
- [validate/index.js](../../../engine/validate/index.js), [schema/validator.js](../../../engine/schema/validator.js) and [architecture.md](../../architecture.md) anchor the shared validation/transaction approach. No native model/download/store UI exists here today.

## Desired Behavior

Ask for a booking flow; see Home → Trip → Booking listed as a small readable itinerary. Open any page, point at one part and request a change. Ask “link this to Booking” with clear source/destination scope. On a tablet, reference a component through the chat's searchable list while the preview stays fully interactive. This is the clearest answer to the tablet selection contradiction, at the cost of an extra list action.

## Design

### Identity and exact visual values

Graphic navigation language: white `#FFFFFF`, page background `#F0F3F7`, navy ink `#172D4B`, muted text `#52647A`, rules `#CBD5E1`, accent orange `#A94318`, pale orange `#FFF0E7`, selected navy `#172D4B`. Orange carries labels/route numbers on white or pale orange, never low-contrast orange text on dark navy. White text on navy for primary actions. Prototype content is strictly greyscale; selected perimeter and numbered native route markers sit outside the prototype frame.

Native type: bundled Noto Sans at 16 sp body, 14 sp controls, 12 sp metadata; 28/32 sp bold headings; Noto Sans Mono at 12 sp for route paths and revision labels. Mockups use Segoe UI + Consolas locally. Surfaces 2 dp corners, controls 4 dp corners, 2 dp title rules, 16 dp grid, 8 dp control gaps. Icons are simple 2 dp route arrow, list, chevron, plus and folder; numbered boxes are more prominent than decorative symbols. No node graph needing pan/zoom.

Motion: route changes slide content vertically by 8 dp over 160 ms ease-out; phone chat slides horizontally 200 ms; applied step gets a 120 ms navy border. No moving train metaphor. Reduced motion updates immediately. The route index is deterministic and user-editable; numbers are not source IDs or model-generated file names.

### Screen flow and every control

| State / board label | Visible design and control behaviour |
|---|---|
| 01 · Download | Huge “Make an idea go somewhere.” Numbered setup strip: Download → Check → Ready; only current phase highlighted. Card shows “Downloading your offline designer”, measured bytes, **Pause**. **Open project** allows view/export; conditional **Use mobile data** asks consent. State is resumable; no model choice. Only verified setup unlocks **Start your first project**. |
| 02 · Phone chat | Top **Projects**, project title, **More**; native **Chat / Preview** pair. Small breadcrumb “Weekend away / 01 Home” establishes scope. User asks for a weekend booking journey. Native receipt lists “Home → Trip → Booking” and applied revision; **View pages** opens the route sheet, **Undo** restores previous transaction. Composer includes **Refer to…**, target chip, **Send/Stop**. More: New chat, New project, Undo/Redo, Export, Offline setup, Rename/Delete. |
| 03 · Phone preview | Top **Chat**, **01 Home ▾**, **Desktop** toggle; second compact row **Enable interactive mode** plus “01 / 03”. A native route footer has **Previous page / Next page**; it previews ordered stops without inventing a link inside the prototype. Native “Slide to chat” strip supplies the pager gesture. Page content scrolls vertically and taps select in edit preview. |
| 04 · Selected component | Navy outline and label “01 Home / Trip card” outside the source-backed element. **Parent** promotes selection. **Discuss** brings left chat with breadcrumb chip and draft “Link this card to Booking.” Chip **×** clears, chip body returns to target. Request context includes destination route ID from source index, not a guessed URL. |
| 05 · Interactive phone | Native navy **Interactive mode · Exit interactive** bar above preview. Page links, not the app's route order, drive actual navigation; route badge updates from validated navigation. **Chat** exits and moves left. Native route Previous/Next stays labelled as inspection, or is collapsed into page selector in play to avoid confusing site navigation. No swipe-to-exit assumption; Android Back exits first. |
| 06 · Project itinerary | **Back**, title and “3 pages / 2 links”. Rows numbered 01 Home `/` → Trip, 02 Trip `/trip` → Booking, 03 Booking `/book`. Each **Open** previews that page; **…** offers Rename display label, Move up/down and Remove page (with affected-link confirmation). **Add page** drafts chat request; **Shared parts** reveals Main layout/Trip card and source docs. **New chat**, **New project**, **Export** remain separate actions. UI ordering is local project metadata; source sitemap/links are authoritative for actual navigation. |
| 07 · Landscape phone | Still two panes; compact toolbar **Chat**, page selector, **Desktop**, **Enable interactive mode**, More. One slim route position row, then page. Route footer can move to More to protect vertical space. Interactive landscape has full labelled exit bar. Actual screen rotation and design orientation are independently stored session settings. |
| 08 · Tablet split | Top **Projects**, Weekend away, **Hide chat**, Undo/Redo and More. A narrow 56 dp numbered route strip sits beside a 320 dp chat; remaining width shows interactive page. **Pages** expands the strip into the itinerary overlay. Native **Phone / Tablet / Desktop**, **Portrait / Landscape** remain above preview and can be requested conversationally. **Refer to…** in composer searches source-backed elements on the current page. There is no Play/Edit/Inspect switch or long-press interception. |
| 09 · Tablet chat hidden | Header **Show chat**, project, **Pages**, viewport/orientation controls; numbered route strip can remain collapsed to page badge. Full page always interactive. **Refer to…** in native More first opens split and the reference list. Page uses ordinary single taps/long presses normally; no prototype event is intercepted. |
| Reference list / failure | A native sheet from Refer to… lists Home › Trip card › Title, Main layout › Header, with search by visible label/ID. Choosing a row briefly outlines it and attaches a chip; selection is an action, not a global mode. **Cancel** returns without change. No match: “Describe the part instead.” Errors preserve current page/route; unsupported devices keep itinerary browsing and export. |

All labels are localizable resources in implementation. ≥44 dp controls with 8 dp gaps; route numbers are supplemented by page names for screen readers. Text size can expand route rows and collapse metadata into details; no text truncation conceals the active page. Neutral, success and error states include words rather than only colour. Reference list has a logical search/result/focus order and returns focus to composer.

### What the atlas adds and what it does not

The itinerary is an ordered list, not a second routing system. Order aids preview/review and lives as product-specific local project metadata; route IDs and actual links remain in sitemap/node YAML. Rename display label is not a file rename. Removing a page generates a proposed YAML transaction removing or retargeting inbound references, with confirmation; no imperative manual database surgery.

“Build a three-page flow” still begins as conversation. A YAML-only planning pass may identify bounded document targets, but a native receipt is not shown until they exist. During staging, UI says “Preparing 3 linked pages”, with individual checks only as validation completes. Commit is atomic. This avoids a misleading “done” step with a missing destination page. Scope chip can read “Trip + Booking / this link”. Shared components display “used on 3 pages”; changing one definition invokes explicit scope handling from S2/S3.

“New chat” starts an empty transcript within Weekend away; itinerary and YAML remain. “New project” creates another independent atlas. Projects menu shows local projects/recent export; no cloud sign-in. Current page follows prototype navigation automatically while playing, even if a user jumps backwards or follows a link outside the itinerary order. External URLs are blocked or offered to system browser only after explicit user action; they do not enter the trusted local bridge.

### Hard-problem choices

Inherit **S1–S11** from README in full.

| Problem | Routebook's choice |
|---|---|
| Tablet pointing conflict (1) | External Refer to… list; zero page event interception. It resolves source nodes through the same index used by phone taps. Explicit owner tradeoff: tablet users cannot single-tap-to-select; they choose a named component. This best preserves always-interactive tablet pages. |
| Tap/YAML/vision (2) | Phone tap → mapped handle → route/node breadcrumb. Tablet list uses exact source/index handles and only highlights after selection. Images are unnecessary for these references; vision deferred. Selecting a data row exposes dataset scope rather than pretending it is a unique authored card. |
| Small model/live output/undo (3–4) | Bounded YAML operations, route-aware retrieval and atomic multi-page transactions from S3. The itinerary makes staged progress legible; it never adds a page row as complete before validation. Whole change-set Undo, no half-linked pages. |
| Compaction (5) | Ledger retains accepted journey purpose and constraints; route inventory is read from current YAML every time. Numbers/order are not a model summary. New chat preserves pages. |
| Tiering/download/memory (6–8) | Same S6 automatic rule, S7 download policies and S8 lifecycle. Ordered list needs no preview thumbnail WebViews; lowest navigation memory of the alternatives. No claim this makes E2B feasible on unmeasured 6 GB phones. |
| Gestures (9) | Header/strip pager and explicit Chat/Preview; vertical page scroll and tap selection on phone only. Native Exit interactive bar always outside WebView, including landscape. Tablet has no mode. |
| C++ (10) | S10 portable inference/policy/journal/JNI `OfflineCore`; existing JS validates/renders in WebView/worker. Route list reads source index from JS, not a C++ implementation of the YAML schema. |
| Runtime (11) | llama.cpp text-only Q4 GGUF because structured edits need no projector and known JNI patterns apply. mtmd is deferred until a useful visual task justifies it. [LiteRT-LM Gemma support](https://developers.google.com/edge/litert-lm/models/gemma-4) is a tested-alternative candidate, requiring new files/pins; [llama.cpp Android](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md) supports current integration path. All runtime speed/quality claims await README experiment #1. |

### Explicit bends and costs

The atlas adds a route concept before a user has asked about files. Keep it a list of names, not a graph editor. Tablet component pointing takes a reference-list action; that is less direct than phone tap selection but preserves the owner's no-non-interactive-tablet rule. Transaction-only live updates, restricted pager swipes and text-only launch share the same brief tradeoffs as A/B. This direction needs better page/link summary UX, not more model capability.

## Implementation Order

1. Run physical E2B valid-YAML/time/memory gate on Windows, including linked-page tasks. A valid label edit alone is insufficient for this direction.
2. Prove source index/provenance, JS validator parity, route-reference guards and atomic multi-page undo; preserve `.wf` metadata/assets.
3. After owner chooses Routebook, prototype itinerary and tablet Refer to… against realistic long labels/repeated shared components. Verify people can find a component without knowing its YAML ID.
4. Build Android native shell, phone pager/play escape, automatic setup and source-backed route list. Validate new chat/project distinction and link-deletion confirmation.
5. Complete offline/lifecycle and sustained physical Android tests before iOS reuse. iOS follows with the same C++ journal/inference and local JS assets, different shell/download/lifecycle and independently measured profiles.

## Edge Cases

- A page has no route: list it under Unlinked pages, offer “Link this page” chat draft; do not invent a sitemap entry.
- Multiple routes point to one page: show aliases in details, preserve actual active route ID. Order is not route identity.
- Shared header selected through list: label Main layout / Header / all uses; do not falsely show this as a Home-only source node.
- Repeated dataset items: show row key in reference list only when available; edit dataset value or shared template explicitly.
- Link removal would strand a page: confirmation lists inbound links; validation blocks an unresolved reference.
- Stale list after a revision: refresh it, clear deleted target and return focus. Never reuse list positions as stable node identities.
- Huge project exceeds context: retrieve only current route, immediate destinations and relevant shared definitions; project storage is not limited by prompt window. Broad “change every page” is staged region-by-region.
- Background kill during staging restores previous complete itinerary, not a mixture of old pages and newly promised links.

## Non-Goals

General graph editor, manual YAML/file tree editor, journey analytics, collaboration, cloud storage, hosted publishing, model selection, automatic screenshot critique, freehand markup, offline speech stack or a separate native rendering/validation implementation. Routebook is a way to understand linked wireframes, not a diagramming suite.
