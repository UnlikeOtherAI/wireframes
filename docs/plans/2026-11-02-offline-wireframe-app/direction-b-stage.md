# B · Stage

**Choose this if the live prototype should dominate.** A compact director's desk: the page is the workspace, chat is the left-side command surface, and a deliberate play action turns the phone into a test device.

[Open the visual board](mockups/direction-b.html) · [Shared technical decisions](README.md#shared-decisions-all-three-directions-inherit-these-contracts)

## Problem Statement

A chat transcript can make a visual design tool feel like a messaging app. People reviewing a design want the page, the current viewport and a clear way to try it. Stage spends more of its identity and navigation on that visual review. The cost is a less obvious starting point for people who have never used a design tool.

## Current Behavior

- [renderer/src/mount.ts](../../../renderer/src/mount.ts) provides the live iframe and page navigation but no native stage, selection bridge, viewport setter or interaction-mode switch.
- [engine/build/index.js](../../../engine/build/index.js) resolves template/page trees and fixed device presets. Desktop fitting is a host adaptation, not `setPlatform('web')`.
- [render-attrs.js](../../../engine/renderer/render-attrs.js) and [node-shell.js](../../../engine/renderer/node-shell.js) expose IDs/frame metadata; [resolver/index.js](../../../engine/resolver/index.js) expands/namespaces reusable components, without the sidecar provenance Stage needs.
- [wf-format.md](../../cli/wf-format.md) supports multiple linked logical documents in one project; [architecture.md](../../architecture.md) describes the existing online editor. Neither is a native canvas-first app.
- [validate/index.js](../../../engine/validate/index.js) remains JS; S3/S10 specify its reuse and missing semantic guards. Mockups do not imply new renderer features already exist.

## Desired Behavior

Resume into the last page. Tap a component in phone edit preview, then open the left chat to give an instruction. The page returns after the validated edit with a small result shelf. On tablet, keep the page interactive at all times and discuss a component with a deliberate context gesture or list. Chat can disappear entirely for review.

## Design

### Identity and exact visual values

Dark, precise studio chrome surrounding a bright neutral prototype. App background `#11171E`, panel `#1C2631`, elevated surface `#263341`, text `#F0F4F8`, muted text `#AFBDCC`, border `#425164`, accent `#9BCBFF`, accent ink `#132B43`, selected bracket `#9BCBFF`, alert `#FFBC9F`. “Interactive” is a pale blue native bar with dark ink, not a green traffic light. The preview remains greyscale white/black; never darken generated wireframe content merely because app chrome is dark.

Native type: bundled Noto Sans (16 sp body, 14 sp control, 12 sp metadata), Noto Sans Mono 12 sp for route/view dimensions; 32/36 sp bold welcome. Mockups use local Segoe UI + Consolas. Squared 6 dp surface radii, 10 dp chat bubbles, 16/24 dp rhythm, 1 dp borders. Icons: 2 dp squared line strokes for panels, crosshair/locator, device, play, stop and exit; all critical actions have labels. No neon gradients or glow behind body text.

Motion: chat slides from the left in 180 ms (`cubic-bezier(.2,.7,.2,1)`); selection brackets appear in 100 ms; validated change shelf slides 8 dp in 140 ms. Reduced motion removes transforms. Download progress is actual bytes; generation has phase text and Stop, never a fake loading canvas.

### Screen flow and control inventory

| State / board label | Visible design and control behaviour |
|---|---|
| 01 · Setup | Large geometric stage mark, “Your ideas. On this device.” Automatic download card with 1.2 of 3.35 GB, progress and **Pause**. **Open project** supports view/export before inference. Conditional **Use mobile data** requires explicit consent. Text explains background continuation/resume; no “keep open” requirement. After integrity/load checks, **Create a project** opens a name+first-request sheet. |
| 02 · Phone chat | Top **Projects**, title Weekend away, **More**. Under it **Chat / Preview**. Left-command styling uses numbered local receipts, not an agent avatar. Composer target chip if selected, multiline request and **Send/Stop**. **View** jumps right to changed page; **Undo** rolls back transaction. **More** contains New chat, New project, Undo/Redo, Export `.wf`, Rename/Delete and Offline setup. No settings drawer full of backend options. |
| 03 · Phone preview | Phone reopens here once a project has a page. Header **Chat** opens left pane; **Home ▾** opens page thumbnails; **More** contains project actions. Top **Desktop** toggle and **Enable interactive mode**. Small viewport/ruler label “390 × 844 · Phone” or “1280 × 900 · Fitted”. Bottom native shelf shows last applied result + **Undo**, with “Slide to chat” strip. It never overlays a prototype primary action. |
| 04 · Component focus | Four blue corner brackets and a dark label identify Trip card; no full-screen dimming. **Parent** promotes target. **Ask about this** slides to chat with a locator chip; **×** on chip clears it. Example draft: “Give this card a shorter description.” Tapping preview selects rather than activates Book trip. Source path is in chip details; normal UI uses human labels. |
| 05 · Interactive phone | A conspicuous native “INTERACTIVE” bar with **Exit interactive** sits above the page; selected brackets and status shelf disappear. **Chat** exits play and opens left pane. The page gets all interior touches. Exit remains in landscape, above keyboard/safe area. Android Back exits first. Play is never an unlabelled floating triangle the user must rediscover. |
| 06 · Multi-page sheet | **Close** returns to preview. Thumbnail rows Home, Trip, Booking, each with route and current-page marker. **Add page** drafts a chat request. **Shared ▾** lists Main layout / Trip card and use counts; selecting one opens a discussion with scope label. **New chat** and **New project** are separate actions; **Export** creates a local `.wf`. Thumbnails are static render images, not resident WebViews. |
| 07 · Landscape phone | One compact native toolbar: **Chat**, page selector, **Desktop**, **Enable interactive mode**, overflow. Canvas sits edge-to-edge below it. If interactive, explicit full-width exit bar replaces edit shelf. Same two panes rather than tablet split; desktop fit can be zoomed/panned, so no fictional readable desktop text at 0.6 scale. |
| 08 · Tablet split | A 300 dp command rail, preview dominant. Top **Projects**, project, **Pages ▾**, Undo/Redo, **Hide chat**, More. Device buttons **Phone / Tablet / Desktop**, orientation **Portrait / Landscape**; same changes possible by chat. Ordinary page input is always active. Long-press or secondary click opens **Ask about this**, **Cancel**; keyboard context-menu action and chat **Refer to…** list provide accessible alternatives. No Play/Edit/Inspect mode. |
| 09 · Tablet full stage | **Show chat** restores command rail. Page/viewport/orientation controls persist in a compact top shelf with labels, not hover-only icons. Page links work immediately. Context gesture can bring chat back with a component reference. No phone interactive exit bar because tablet has no mode to exit. |
| Empty, failure and recovery | Empty project stage says “Describe your first page”, **Open chat**; initial generation stays in chat until valid. Unsupported device offers Open project, Export and Check again. Heating replaces status with cooldown notice; invalid generation says design unchanged with Retry/Edit request. A paused download can resume from setup, no implicit cloud route. |

On narrow text-scaled screens the shelf wraps into two native rows; controls retain ≥44 dp targets and ≥8 dp separation. Focus outline is 2 dp light blue with a dark separator on bright surfaces. TalkBack reads the targeted element's page and label, and the accepted result. English prototype strings become localization resources. No freehand selection or annotation tools.

### Canvas-first mechanics and multi-document editing

The first project still begins through chat. Subsequent launches privilege the last viewed page, with Chat always visible at upper left. This is a default-tab decision, not a third phone screen: chat remains the pane to the left. The page sheet is a transient overlay, not another horizontal pane.

Selection makes the object the temporary subject. The chip includes “Home / Trip card / this instance”. A change shelf says “Trip card updated · Undo”; tapping it shows the matching conversation receipt. Multi-file requests name their scope in the shelf, e.g. “Trip + Booking updated”. Cross-page shared changes are staged and committed together under S3. Open/recent project list is reached through Projects; project creation is never confused with New chat. New chat keeps the same preview and accepted decisions but clears the conversation context.

Tablet context pointing is not an inspector mode: the app consumes a secondary click/long-press once and sends normal page events otherwise. It may conflict with browser text selection; prefer an explicit context action for source-backed nodes and keep copy text in the menu. The owner must accept that tradeoff. If not, use the external Refer to… list; don't add an Inspect toggle.

### Hard-problem choices

Inherit **S1–S11** from README in full.

| Problem | Stage's choice |
|---|---|
| Tablet conflict (1) | Deliberate secondary click or long-press opens one reference action. Ordinary taps always play. Refer to… list fallback requires no intercepted page gesture. Owner decides. |
| Mapping and image value (2) | Same revision-scoped provenance/nonce bridge. Brackets come from the mapped element rect after scaling. Vision is deferred: a future “Use visible image” action might help spatial critique, but it requires explicit model/projector/device qualification and isn't a launch control. Known node IDs need no image. |
| Small model and live regen (3–4) | Same bounded YAML operations/validators; page remains visible while status shelf advances. No speculative canvas. Stop cancels draft; success shelf appears only after durable commit and frame readiness; Undo works across linked docs. |
| Compaction (5) | Ledger and source revisions are durable. Command rail only shows verified summaries; old turns stay on disk, not in the next prompt by default. |
| Tiering/download/memory (6–8) | Same exact S6 rule and S7/S8 service/worker rules. Dark studio is not a claim the device has GPU inference; CPU baseline up to four threads is the starting point. Only one resident WebView even in page sheet. |
| Gestures (9) | Swipe native rails/header to left chat, scroll within page. Explicit Play entry and native Exit bar. “All touches” applies within the page, not app-owned escape controls. |
| C++ (10) | S10 modules and `OfflineCore` JNI. Canvas controls call trusted JS transient viewport adapter. Existing JS rendering and schema validation stay JS in WebView/worker; no Node or C++ port. |
| Runtime (11) | llama.cpp + GGUF for first feasibility pass, not LiteRT-LM merely for a canvas-first identity. Existing JNI path and mirrored file contract favour that start. Current [Google LiteRT-LM Gemma docs](https://developers.google.com/edge/litert-lm/models/gemma-4) make an early comparison worthwhile if latency fails. [Google llama.cpp guide](https://github.com/google-gemma/docs/blob/main/docs/deployment/llamacpp.md) supports the GGUF/mtmd route, but an earlier project's bridge remains text-only. Pin/test exact runtime before any future vision action. |

### Explicit bends and costs

Returning to preview rather than chat makes requesting a change one extra action away. Native exit chrome must keep some screen area even in immersive phone play; hiding every control would trap the user. Context-menu pointing on tablet is a proposed resolution of the conflicting selection requirements. Token output becomes coherent transaction updates. Voice and visual critique are not v1 promises. Compared with A, the team builds page thumbnail capture/caching and a selection bracket overlay; both are manageable but additional work.

## Implementation Order

1. Complete the common physical-phone inference/memory gate on Windows before visual polish. Use the same task corpus if comparing llama.cpp and LiteRT-LM.
2. Prove provenance, schema/reference guards and revision transactions; build viewport override and atomic remount prototype without changing durable YAML.
3. After owner selection, build Android native two-pane navigation and persistent play exit; validate scrolling/selection and landscape with real users.
4. Add static page thumbnails, command rail, change shelf and automatic resumable setup. Measure thumbnail/candidate-frame memory and release them under pressure.
5. Finish Android offline/lifecycle acceptance on real phone and tablet. Only after Android works, port native shell to iOS and reuse C++ + local JS with separately measured limits.

## Edge Cases

- Prototype carousel drag in edit preview must not slide chat; horizontal dragging belongs to that scrollable region. Pager uses the native strip.
- Deep child text selected: Parent changes reference to its containing card; it never rewrites an arbitrary ancestor silently.
- Bracket rect stale after accepted edit or scrolling: hide until recomputed; a wrong bracket is worse than no bracket.
- Thumbnail captures lag behind current revision: show stale marker or neutral placeholder, never use a thumbnail as edit context.
- Large desktop at phone scale: fit is overview, pinch/pan is inspection. No assertion it is readable without zoom.
- Device becomes hot while in play: interactive site remains usable; inference pauses, no needless model reload or tier download.
- Pointer context menu on tablet inside a form: ordinary focus/input still works; consuming long-press is the explicit unresolved tradeoff.
- Model killed while page remains alive: shelf offers Retry with committed page intact. WebView killed: recreate it and clear transient form state safely.

## Non-Goals

Figma-style freeform canvas, manual property inspector, drag/resize design tools, custom scripting, live collaboration, screen recording, a gallery of model settings, screenshot critique at launch, cloud inference, or a rewritten renderer. Stage is still chat-generated wireframes, not a general design suite.
