# A · Fieldbook

**Recommendation: this is the default.** A portable notebook where a conversation becomes a clickable wireframe. The project feels like an idea you are developing, not a file tree or a developer tool.

[Open the visual board](mockups/direction-a.html) · [Shared technical decisions](README.md#shared-decisions-all-three-directions-inherit-these-contracts)

## Problem Statement

On a plane, the owner wants to describe an idea and refine it without a service, setup vocabulary or model picker. A small phone cannot comfortably show a conversation, page list, inspector and live site together. Local inference may be slow enough that a blank canvas looks broken. Fieldbook gives the conversation one clear job: request changes and explain which changes actually landed.

## Current Behavior

- [renderer/src/mount.ts](../../../renderer/src/mount.ts) already mounts an offline interactive iframe, navigates pages and changes platform chrome. It has no chat drawer, node selection callback, update API or native lifecycle.
- [docs/cli/wf-format.md](../../cli/wf-format.md) defines the multi-document project; [agent-guide.md](../../cli/agent-guide.md) defines grey wireframes and reusable primitives. Neither defines a native app shell.
- [engine/renderer/render-attrs.js](../../../engine/renderer/render-attrs.js) emits HTML node IDs; [engine/resolver/index.js](../../../engine/resolver/index.js) expands shared components and namespaces their children. The source map needed for taps does not exist; shared S2 specifies it.
- [engine/validate/index.js](../../../engine/validate/index.js) and [schema/validator.js](../../../engine/schema/validator.js) supply JS validation. They must be browser-bundled and supplemented with reference guards, not assumed to run in C++.
- [docs/architecture.md](../../architecture.md) describes online chat and changed-file transactions; this proposal retains the document model but uses local inference and storage.

## Desired Behavior

Open an existing project and continue the conversation. Slide right to see the design. Tap a card, slide left and say “make this less crowded.” The selected card travels with the request as an understandable quotation. Every accepted change leaves a short receipt and Undo. Files stay behind page names and the occasional shared-scope label.

## Design

### Identity and exact visual values

Warm, quiet and editorial. Paper `#F6F2EA`, white surfaces `#FFFDFA`, ink `#242C28`, muted text `#57635A`, rules `#D7D9CE`, deep green `#255B45`, pale green `#E2EBDD`, selected outline `#255B45`, error `#9D302B`. Use green text on pale green or white; never white text on the pale fill. Greyscale prototype content uses `#202020`, `#606060`, `#D6D6D6`, `#F4F4F4` regardless of app theme.

Native type: bundled Noto Sans for labels/chat (16 sp body, 14 sp secondary, 12 sp metadata, 20 sp page title); bundled Noto Serif at 30/36 sp for welcome and empty-chat headings. Mockups use local Georgia + Segoe UI fallbacks with no network request. Font licenses/package choices must be checked at implementation; no remote font fetch. Cards 16 dp radius, controls 12 dp, 1 dp rules, 16/24 dp spacing, 8 dp gaps between 44+ dp targets. Use 2 dp rounded line icons: book, page, left/right arrow, undo, rectangle/device and play; always pair unusual actions with words. No magic-wand mascot or animated “AI thinking” avatar.

Page slide: 220 ms ease-out (`cubic-bezier(.2,.8,.2,1)`); selection border 120 ms; accepted receipt fade 160 ms. Reduced motion uses immediate state changes with focus announcement. No pulsing progress percentage. Use a thin progress rule only for measured download bytes.

### Screen flow and every control

| State / board label | Visible design and control behaviour |
|---|---|
| 01 · First run / download | Large “A studio for your next idea.” Small automatic setup card: “Downloading your offline designer”, 1.2 of 3.35 GB, byte progress. **Pause** persists progress; **Open a project** opens local `.wf` in view/export mode. **Use mobile data** appears only while waiting for metered consent. No model name/picker. After verification/preparation, **Start designing** appears. Failure replaces status with Retry and a concrete storage/network message. A small note explains leaving the app is safe and interruption can resume. |
| 02 · Phone chat | Top **Projects** book icon opens local project list; title **Weekend away** opens project details/page list. **More** opens New chat, New project, Undo, Redo, Export `.wf`, Offline setup and project Rename/Delete (deletion confirmed). Segmented **Chat / Preview** matches the two sliding panes. Intro prompt becomes ordinary conversation; user message on pale green, applied receipt as a white page card. **View change** slides to affected page; **Undo** restores full transaction. Bottom multiline composer, **Send** (becomes **Stop** during generation); no microphone promise. Keyboard reduces chat height, does not cover composer. |
| 03 · Phone preview | Same project header and **Chat / Preview**. Top viewport row: **Home ▾** page sheet, **Desktop** toggle and **Enable interactive mode**. Desktop visibly changes the fitted canvas to 1280×900; it does not change source YAML. Small “Desktop · fitted” label explains tiny text. Native bottom page-switch strip says “Slide to chat”; vertical document scroll remains available. **Undo** is available in the small applied-change strip. |
| 04 · Selected component | Phone in edit preview: border on Trip card with a small “Trip card” label. Tapping a child initially selects the deepest editable node; a small **Parent** action promotes to the card. Inline **Discuss in chat** moves left, carrying “Home › Trip card” quotation chip. Chip **×** clears selection; tapping the chip returns to the highlighted object. Composer says “Make this card more compact.” Selection does not trigger Book trip. |
| 05 · Interactive phone | Persistent native green **Interactive mode / Exit interactive** bar replaces selection guidance. Page inside is fully usable: menu, form and links work. Bottom **Chat** exits and slides left. Desktop and page controls stay in native chrome, outside page input. Android Back exits play first; accessible exit remains visible over keyboard and rotation. |
| 06 · Phone project view | **Back** returns to prior pane. Title Weekend away, “3 pages · saved on this device”. Named rows Home `/`, Trip `/trip`, Booking `/book`; each opens its preview. **Shared parts ▾** discloses Main layout and Trip card, including number of uses; does not expose the full file tree by default. **Add page** opens chat with “Add a page…” draft; **New chat** and **New project** are separate full-width actions. **Export** uses native share/save, not a hosted link. |
| 07 · Landscape | Same two panes, no automatic split. Native toolbar is one row; page fills the remaining space. **Chat**, **Home ▾**, **Desktop**, **Enable interactive mode** and overflow remain 44 dp tall. Tablet split must not leak onto a rotated phone. Design orientation follows the selected mobile view default on rotation; explicit viewport requests override it for the session. |
| 08 · Tablet split | 1180×820 reference viewport; 340 dp left chat with composer, divider, remaining preview. Header **Projects**, project title, **Pages ▾**, **Hide chat**, Undo/Redo and overflow. Preview controls **Phone / Tablet / Desktop** and **Portrait / Landscape**, acting on transient render view. Chat also understands these commands, intercepted deterministically by native intent routing where unambiguous. No Play/Edit switch. Long-press a card opens **Discuss this** and **Cancel** context menu; only that gesture is consumed. Keyboard shortcut/focus context menu does the same. |
| 09 · Tablet chat hidden | Same native header; **Show chat** burger+label restores exact conversation/scroll. Full preview stays interactive. Device and orientation controls remain visible; prototype back arrow changes route, native **Pages** sheet changes inspected page. There is no “Exit interactive”: tablets are always interactive. A long-press can open discussion and restore split with the target attached. |
| Empty / unsupported / cooling | Empty chat: “What are you making?” with example “A weekend booking app” that fills composer, not auto-sends. Unsupported device: Open project, Export and Check again; no pretend working Send. Heat pause: “Device is warm. Let it cool, then retry.” with last design visible. Invalid generation: unchanged design, Retry and Edit request. |

All shell strings are localization resources in implementation; English mockup copy is illustrative. Larger text wraps labels, moves secondary actions to More and preserves 44 dp hit areas. VoiceOver/TalkBack announces page name, selection source and validated completion rather than token updates. Colour is never the only selected/disabled cue.

### Pages, shared parts and changes

The page sheet is intentionally the main project navigation. It groups user-facing pages first and shared layouts/components second. A row names its route and source document in a secondary details disclosure, e.g. “Home · pages/home.yaml”; the normal designer need not read YAML. Selecting Shared header makes a scope prompt explicit: “Change header on all 3 pages?” A normal page node defaults to this instance. The current page badge follows validated `wf:navigate`, so a link into Booking updates scope before the next chat request.

For “Add booking and link it from the trip”, a single receipt reads “Added Booking · linked from Trip · 2 pages changed” only after the whole transaction passes. While waiting, it says “Updating Trip and Booking”, with Stop. A failed draft gets no success receipt. “New chat” retains the source and accepted decisions; the opening line says “Continuing Weekend away. Your pages are here.” “New project” gets a naming sheet and fresh empty chat, never wipes the old project.

### Hard-problem choices

Inherit **S1–S11** from README. No direction-specific storage, model picker, validation shortcut or device claims.

| Problem | Fieldbook's concrete choice |
|---|---|
| Tablet pointing conflict (1) | Long-press → Discuss this; ordinary taps always interact. Keyboard accessible Refer to component list in More is the fallback. Requires owner acceptance of the context gesture. |
| Tap/YAML and vision (2) | Exact sidecar handle → source subtree → quotation chip; no image attached. No vision download at launch. Without it reference-image redesign and screenshot-only diagnosis are unavailable. |
| Small model, live output, undo (3–4) | YAML operation envelope and atomic commits from S3. Status lives in the conversation; preview keeps last good design. Receipts and Undo are native templates, not extra model prose. Each independent validated transaction can update; partial tokens cannot. |
| Compaction (5) | Invisible decision ledger; chat remains readable. The receipt's revision reference connects old conversation to project history after compaction. |
| Tiering/download/memory (6–8) | S6 exact provisional rule, S7 resumable transfer, S8 worker lifecycle. First-run mockup uses text-only E2B bytes, not a made-up vision-inclusive download. A smaller-model recovery appears as a plain setup card in chat, requiring network if absent. |
| Gestures (9) | Native switch strip/header swipes plus Chat/Preview buttons, stationary tap selection, vertical scrolling. Persistent green exit bar outside WebView; never rely on swiping out of interactive mode. |
| C++ (10) | Same portable policy/store/inference and JNI `OfflineCore` contract in S10; JS validator+renderer in WebView/worker, no Node on phone and no C++ renderer port. |
| Runtime (11) | llama.cpp Q4 GGUF text path first because known C++/JNI patterns and the pinned GGUF contract reduce integration work. mtmd only after measured vision benefit. LiteRT-LM is the phase-zero challenger, requiring new mirrored files ([Android build evidence](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md), [current LiteRT-LM Gemma support](https://developers.google.com/edge/litert-lm/models/gemma-4)). Recommendation is integration cost, not an unmeasured speed claim. |

### Where this bends the brief

Preview changes at valid transaction boundaries, not per token. Preview swiping uses native rails/header rather than every horizontal drag. On tablets a context gesture replaces direct tap selection. Launch omits screenshot vision and microphone input pending owner decision. These are explicit constraints shared by all three concepts; none is disguised as working today.

## Implementation Order

1. Run README experiment #1 with real E2B, visible WebView and Release Android build on Windows. If YAML quality/latency fails, stop the shell work and compare LiteRT-LM.
2. Prove exact source mapping, browser-bundled validators, bounded edit protocol and crash-safe undo on multi-page fixtures. Preserve `.wf` config/assets independently of render map.
3. After owner chooses Fieldbook, prototype two-pane gesture/selection/exit interactions natively; test rotated phone and accessibility. No app implementation is part of this decision deliverable.
4. Build automatic setup/download/recovery and the minimal conversation + page sheet + receipts. Verify phone/tablet states, invalid generations and low-memory interruption on Android before polishing.
5. Verify sustained offline use on physical Android hardware, including full source export/reopen. Only then reuse C++ and packaged JS in an iOS shell; qualify its devices separately.

## Edge Cases

- Shared component descendant selected: quotation says instance and definition; ask all-uses scope only when unavoidable. Never silently edit every page.
- Selection removed by the last accepted edit: clear it and announce “That component was removed”; old chip cannot target a new node with a reused name.
- Deep link changes page while a request runs: keep request pinned to its base/target; receipt offers View change rather than moving the user's current page unasked.
- Model is unloaded while reading chat: next Send shows Preparing; history and preview remain usable.
- Keyboard open in landscape: composer may occupy most chat space, but Stop and Exit remain reachable; no 44 dp control is reduced to an icon sliver.
- Bad YAML, killed worker or interrupted coupled change: no partial receipt; last good design and Undo history survive.
- Mobile data interrupted: paused bytes survive, setup never claims offline readiness until hash and load checks pass.
- Native document scroll at top/bottom does not become an accidental horizontal pane switch. Pinch in fitted desktop is preview zoom, not selection.

## Non-Goals

Manual YAML editor, drawing tools, drag-and-drop component library, cloud sync, sign-in, collaboration, hosted publishing, image generation, offline speech recognition, visual screenshot critique, continuous every-token rendering, or native renderer rewrite. None is needed to choose or validate this direction.
