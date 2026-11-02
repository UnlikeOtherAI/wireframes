# Offline wireframe app: iPhone and iPad implementation

This is the build plan. It replaces the three directions in [README.md](README.md) wherever they differ. The technical contracts S1 to S11 in that README still apply, except that Android is second rather than first.

Agreed with the owner on 2 November 2026:

- iPhone and iPad first, Android after.
- Light mode is the warm neutral design ([chat](images/a-chat.png), [preview](images/a-preview.png)). Dark mode is graphite with the same clay accent. No native iOS styling.
- The chat contains a live preview: the real page in a scaled-down web view. Tapping it opens the full-screen preview on the next screen.
- The wireframe is always the engine's greyscale output. The app is never themed to match it.

## Problem Statement

The wireframe engine needs a server or a laptop. The owner wants to design by chatting with a model that runs on the device, with no connection, and see the result live.

## Current Behavior

- [renderer/src/mount.ts](../../../renderer/src/mount.ts) renders a `.wf` project into an iframe. It has no selection, no viewport override and no way to update a mounted project. It does not check the sender of `wf:navigate`.
- [engine/resolver/index.js](../../../engine/resolver/index.js) expands components and namespaces their ids as `instance__child`, so a rendered id does not always map back to source.
- [engine/validate/index.js](../../../engine/validate/index.js) and [engine/schema/validator.js](../../../engine/schema/validator.js) validate in JavaScript, with no Node dependency beyond `require` of JSON.
- An earlier internal project runs GGUF through llama.cpp on iOS, on the CPU, verified for text only.
- The Gemma 4 files are pinned by size and digest. The planned mirror does not serve them today, so the catalogue falls back to their upstream source.

## Desired Behavior

**First run.** The app picks the model and downloads it. It says "Downloading your offline designer", shows progress, and resumes after interruption.

**iPhone.** Two screens, chat and preview, slide sideways.

- Chat: projects menu, project name, new chat, Chat/Preview control, messages, live preview card, message field.
- Preview: back to Chat, page picker, overflow, Phone/Desktop, rotate, Interactive switch.
- Interactive off: vertical drags scroll the page, a tap selects a component, and the sideways slide stays available from the top bars and the screen's outer edge.
- Interactive on: every touch in the page reaches the page, sliding is off, and the Interactive switch stays outside the page so the user can always leave.

**iPad.** Chat on the left and the page on the right, always live. A burger hides the chat. One top row holds everything, on the same level as the page title: page picker, Fill, Phone, Tablet and Desktop, rotate, version and overflow. There is no second toolbar row. Fill is the default: the web view takes the whole area and the page lays out to that size. A long press on a component offers "Discuss this". This gesture is provisional and needs the owner's sign-off.

**Viewer scaling, on every device.** Phone, Tablet and Desktop set a fixed viewport size. If that size does not fit the available area, the whole viewer shrinks to fit, as one scaled surface. The page inside still lays out at the viewport's real size, and its CSS is not touched. A viewer that already fits stays at 100% and is centred.

**Editing.** The user asks for a change. The model writes YAML edit operations only. The app validates them, keeps the last good design on screen until they pass, then swaps the page and offers Undo. A tapped component is sent with the request by its source id, so no image is needed. Vision is deferred, as S2 recommends.

**Projects.** New project, new chat within a project, and chat compaction that the user never sees. The project's YAML is the durable memory, not the chat.

## Design

```
mobile/
  core/       C++ library with a C ABI, reused by Android
  web/        TypeScript host page, bundled as an app resource
  ios/        SwiftUI app, generated with XcodeGen
```

### C++ core (`mobile/core`)

| Module | Job |
|---|---|
| `catalog` | Pinned files: key, bytes, sha256. The base URL is configuration |
| `device_policy` | Device metrics in, E2B, E4B or unsupported out |
| `sha256` | Whole-file verification before a model is installed |
| `inference` | llama.cpp load, generate, cancel, token streaming. Metal on device |
| `prompt` | Token budgets, retrieval of the target subtree, assembling the prompt |
| `ledger` | Compaction: a bounded decision ledger from accepted changes |
| `store` | SQLite: projects, chats, messages, append-only revisions, undo and redo |

The ABI is plain C with opaque handles and UTF-8 strings. Generation is a callback on a worker thread. Parsing YAML stays out of C++, so there is one parser and one schema.

### JavaScript (`mobile/web`)

One page runs in a `WKWebView`, built by esbuild from the existing renderer and engine. It has no network access: a content security policy blocks everything except the bundled resources.

- `applyEdit(project, envelope)`: parse the envelope, apply it to a copy, validate with `validateDocument` and `validateProject`, then check references. Returns new document bytes or diagnostics.
- `render(project, page, viewport)`: mount or swap without flicker.
- Selection: a capture-phase tap handler inside the frame, which posts node identity to the host page. Only the host page can post to native, through one `WKScriptMessageHandler`.

Two engine changes are needed:

1. An opt-in `annotateSource` render option that adds `data-wf-source` to each node shell. The resolver records the source document and node id while it expands, so `instance__child` is never split to reverse it.
2. A viewport override at render time, without changing the source document.

Both are off by default, so CLI output stays byte-identical and the determinism rule holds.

### Edit protocol

As S3 in the README: an envelope with `baseRevision` and `changes` of `set`, `insertAfter`, `remove`, `addDocument` and `removeDocument`, addressed by typed source ids. The prompt includes only the elements a request needs, from `wf llm --short`. Anything invalid gets one repair attempt, then the design stays unchanged and the user is told so.

Native holds the commit: it writes a revision only after JavaScript returns valid bytes and the new page has rendered.

### iOS app (`mobile/ios`)

SwiftUI, deployment target iOS 17, with UIKit only for the `WKWebView` wrapper.

- `Theme`: the colour, type, radius and hairline tokens for light and dark, and nothing else defines a colour.
- `ChatScreen`, `PreviewScreen`, `TabletScreen`, `SetupScreen`, `ProjectsSheet`.
- `LiveCard`: a scaled, non-interactive view of the one live web view. Older cards are snapshots. There is one web view in the app, reparented between the card and the preview, because memory is the constraint.
- `Viewer`: the single sizing path. The web view's frame is set to the viewport size, 390x844, 820x1180 or 1280x900, swapped by rotate. Then one native transform applies `min(1, availableWidth / width, availableHeight / height)`. Fill sets the frame to the available area at scale 1. The live card uses the same path with a smaller scale. Nothing is injected into the page to scale it.
- `Pager`: a custom two-pane pager driven by the top bars and outer edge, so it never fights the page's own scrolling.
- Download: a background `URLSession`, then `sha256` verification, then an atomic rename.
- Memory: the increased-memory-limit entitlement. `os_proc_available_memory` is checked before load, and the model is unloaded on memory warnings. It reloads on the next request.
- All interface text goes through a String Catalog, per the repo's localisation rules. Touch targets are at least 44 points.

Device policy, provisional until measured on real devices:

| Device | Model |
|---|---|
| Under 8 GB RAM | Unsupported: view and export existing projects only |
| 8 GB to under 12 GB | E2B Q4 |
| 12 GB or more, with enough available memory and storage | E4B Q4 |

If a load fails or the process is killed during load, E4B falls back to E2B, and that is remembered. No model picker.

## Implementation Order

1. Engine and renderer: source annotation, viewport override, sender check, with tests.
2. `mobile/web`: bundle, `applyEdit`, selection, CSP, with tests in Node and Playwright.
3. `mobile/core`: catalog, policy, sha256, store, then inference and prompt, with tests under CMake.
4. `mobile/ios`: theme, shell, pager, web view, card, selection. Run it in the simulator with a project already on disk and no model.
5. Connect inference, the edit loop, undo and compaction. Run it in the simulator with a real GGUF.
6. Download and first run, tested against a local file server, since the mirror is down.
7. iPad layout, then a pass over gestures, accessibility and dark mode.
8. Real iPhone: the go or no-go test from the README, 30 edit tasks on a physical device.

## Edge Cases

- Model output is invalid or partial: nothing reaches the live page and the design is unchanged.
- App killed during generation: the draft is discarded and the last committed revision opens. The message is kept, with Retry.
- Web content process killed: rebuild the web view from the committed revision.
- Selected node removed by an edit: the selection clears, it is never guessed.
- A tap on a generated table cell maps to the table.
- Mirror unreachable or a digest mismatch: the file is not installed, and the setup screen shows Retry. Existing projects still open.
- Low storage: pause and state how much space is needed.
- Thermal state serious or critical: finish or stop the batch and ask the user to retry once the device has cooled.

## Completion Goal

Set by the owner: the app is done when it runs on the owner's physical iPad, the iPad Air 13-inch M3 paired to the Mac, and every control has been exercised there. Simulators are a development step and do not count. XCUITest on the device drives every control and captures screenshots.

## Measured on the iPad

iPad Air 13-inch M3, 8 GB, on 2 November 2026. Gemma 4 E2B Q4, 8,192 token context, GPU layers requested, no increased-memory entitlement. Debug build. One run of three requests, so these are first readings and not a benchmark.

| Request | Prompt tokens | Output tokens | First token | Total |
|---|---|---|---|---|
| Landing page | 1,805 | 427 | 3.5 s | 12.3 s |
| Pricing page and link | 2,635 | 524 | 5.3 s | 16.0 s |
| Table of walks | 2,122 | 179 | 4.6 s | 9.0 s |

The second request needed its one repair attempt, and the timings above are for that attempt. The download, digest check and all three edits took about seven and a half minutes. Not measured yet: peak memory, whether every layer ran on the GPU, sustained heat, or any iPhone.

The same model on a desktop GPU wrote valid edits for 12 of 12 scripted requests on the first try. Valid is not the same as right: on the iPad, the "link to it from a button on this page" request placed its button on the new page.

## Automatic Layout

Set the size and the layout follows. A page shown smaller than its own `viewport.device` is rearranged by the renderer's opt-in `adaptive` option, and a page at or above that size is left alone. Size classes come from the viewer: Phone, or Fill under 600 points, is mobile. Tablet, or Fill from 600 to under 1,000 points, is tablet. Anything larger is desktop. It updates whenever the viewer changes size. Page style has an Adapt switch per project, on by default, and the result is never saved into the design.

## What Changed From This Plan

- The model downloads from a banner in the chat, not a setup screen. The app opens straight in, and projects can be opened and edited by hand before the download.
- The page switcher is a custom dropdown holding a tree of pages by path. Pages can be added and removed without the model.
- Versions can be saved by name.
- On iPad, projects share the left column with the chat.
- Corners and boxes are a per-project view setting, rounded and cards by default, and are never written into the project.
- The increased-memory entitlement is not used. The team's wildcard profile cannot carry it, and E2B has run without it so far.

## Review Findings

Codex reviewed this plan adversarially on 2 November 2026.

| Finding | Decision |
|---|---|
| Source annotation misses dataset rows, region wrappers and overlays, and merges definition with instance | **Adopt the coverage, reject the sidecar map for now.** Attributes record the owning source, the occurrence's rendered id and the row. Region and overlay wrappers are annotated. Disabled output is tested byte-identical. A sidecar returns only if attributes prove insufficient |
| RAM table does not establish a safe iOS memory budget | **Adopt.** Automatic E4B stays off until a device profile is measured. Load and generate on the iPad before the app shell depends on it |
| A fatal load cannot record its own failure | **Adopt.** Persist a "load in progress" marker with the model hash before loading, and clear it after a short probe. An uncleared marker on relaunch downgrades or stops |
| Metal path is unspecified, and the earlier code forces CPU | **Adopt.** This project builds llama.cpp with Metal and an embedded shader library, sets GPU layers explicitly and verifies offload on the iPad |
| Reparenting one web view needs a single owner | **Adopt.** One stable UIKit host owns the web view. The outgoing location shows a snapshot during transitions |
| Background download completion is not verification | **Adopt.** Move the file to staging immediately, persist "downloaded, unverified", hash in the foreground, and rehash after relaunch |
| Tap capture alone does not stop prototype gestures | **Adopt.** Selection mode disables prototype interaction dispatch and keeps scrolling. The pager uses an inset rail and the header, not the screen edge |

## Next

Accounts and online models are [phase two](phase-two-online-models.md).

## Non-Goals

- Android in this phase, beyond keeping the core portable.
- Vision, voice input, cloud fallback, accounts and sync.
- Local import of arbitrary models.
- Rewriting the renderer or validator in C++.
