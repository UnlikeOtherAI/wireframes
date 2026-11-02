# Offline wireframes: three directions

**Choose A, Fieldbook.** It makes the owner's central action—describe an idea, see it become a wireframe—obvious. Its persistent change receipts explain slow local generation without exposing YAML. It has the smallest navigation burden and the least new UI to build. Choose B if uninterrupted prototype review matters most; choose C if multi-page journeys are the defining use case. None should proceed to a full native app until E2B passes the real-phone experiment below.

This is a decision document, dated 2 November 2026. Mockups are hand-authored HTML concept boards, not an app or output from the wireframe renderer. All required states are visible by scrolling; no click is needed. Amounts/progress shown in mockups are illustrative, not measurements. Work stays in this directory; no application source changed, no commits or other repository writes.

| | A · [Fieldbook](direction-a-fieldbook.md) | B · [Stage](direction-b-stage.md) | C · [Routebook](direction-c-routebook.md) |
|---|---|---|---|
| [Visual boards](mockups/direction-a.html) | Warm paper, editorial type, a conversation notebook | [Dark control room](mockups/direction-b.html), luminous blue, large canvas | [Swiss travel atlas](mockups/direction-c.html), white/navy, numbered routes, orange markers |
| Product concept | Describe → watch → refine | Preview → point → ask → play | Outline a journey → build linked pages → rehearse |
| Returning phone user lands on | Last chat, preview one slide right | Preview, chat one slide left | Last preview with its route position; chat one slide left |
| Multi-page navigation | Named page list and shared-parts disclosure | Page thumbnails in a bottom sheet | Ordered route list and explicit destination links |
| Selection feedback | Quoted component attached to composer | Locator bracket and compact target chip | Page/node breadcrumb attached to an edit request |
| Tablet pointing proposal | Long-press → “Discuss this” | Secondary click or long-press → “Ask about this” | “Refer to…” search in chat; no touch interception |
| Tablet split | Quiet conversation + generous paper preview | Narrow command rail + dominant canvas | Journey strip + conversation + current page |
| Change presentation | A receipt in the conversation | Small canvas status shelf | Completed steps in a journey change set |
| Main drawback | Repeated chat/preview travel | Hidden chat is less discoverable; extra canvas chrome | More structure to learn before a first design |
| Runtime recommendation | llama.cpp; text first, mtmd deferred | llama.cpp; text first, mtmd gated | llama.cpp; text first, mtmd deferred |

## Shared decisions: all three directions inherit these contracts

These decisions are proposals, not capabilities already present. Each direction describes its UI differences and explicitly inherits S1–S11 here.

### S1. Scope, existing foundations and gaps

The shared engine is JavaScript, the browser bundle TypeScript. `.wf` stores a whole project as a multi-document YAML stream: manifest, config, sitemap, templates, components, page, dataset, asset. “Multi-file” in the UI means logical source documents, even when export is one `.wf`. Keep exact imported source bytes, IDs and file associations; do not rebuild the durable project by serializing only the render map.

Evidence at wireframes revision `1ce5eae4e27e86c38b1f04f73885f483f2aed073`:

| Source | What exists; what does not |
|---|---|
| [wf-format.md](../../cli/wf-format.md), [agent-guide.md](../../cli/agent-guide.md) | Project format, primitives, monochrome wireframes, box rules. App chrome may have brand colour; generated wireframes stay greyscale. |
| [architecture.md](../../architecture.md) | Existing online architecture, document maps, complete changed-document editing and copy/validate/persist pattern. This proposal moves orchestration/storage offline; it does not reuse the server chat path. |
| [mount.ts](../../../renderer/src/mount.ts) | `createWireframe`, `setPage`, `navigate`, `setMode`, `setPlatform`, `explain`, sandboxed iframe and `wf:navigate`. No selection API, viewport/orientation setter, source map or project-update method. `setPlatform` changes platform chrome, not desktop dimensions. Changes require a new mount today. |
| [render-attrs.js](../../../engine/renderer/render-attrs.js), [node-shell.js](../../../engine/renderer/node-shell.js) | Source node `id` becomes HTML `id`; `data-wf-frame`, optional `data-wf-why`, roles and interaction attributes exist. No `data-source-document` or stable resolved-instance handle. Not every inner rendered fragment is a source node. |
| [resolver/index.js](../../../engine/resolver/index.js), [addressing/index.js](../../../engine/addressing/index.js) | Component children are namespaced as `instance__child`; addressing can return `sourceRef` for source trees. Neither supplies a complete rendered-DOM-to-source map. Splitting an ID on `__` is not a valid reverse mapper. |
| [wf.ts](../../../renderer/src/wf.ts), [document-map.ts](../../../renderer/src/document-map.ts) | Browser parse/serialize and render maps exist. Config is skipped by `parseWf`; the render map has no asset collection. Preserve config/assets in canonical project storage independently. |
| [validate/index.js](../../../engine/validate/index.js), [schema/validator.js](../../../engine/schema/validator.js) | Existing schema/project validation is JS; `validateProject` checks document schemas and missing templates, not every cross-document semantic defect. Parsing/rendering alone is not full validation. |
| [build/index.js](../../../engine/build/index.js), [renderer/build.mjs](../../../renderer/build.mjs) | Pure in-memory rendering is already browser-bundled; viewport presets include 1280×900 desktop, 390×844 phone and 844×390 landscape. Build tooling uses Node; the shipped bundle does not need Node. |

This native product has no sign-in requirement, server dependency, local password system or copied SSO identity store. Local project export is available before inference setup. No cloud fallback. “Talking” means typed conversational requests in v1; offline voice dictation is an owner question, not an assumed OS capability.

### S2. Tap → exact YAML → context; tablet conflict

Proposed resolver instrumentation creates a revision-scoped sidecar map **during** template resolution, slot injection, component expansion and dataset repetition. Each rendered occurrence gets an opaque handle. Map entry: project revision, page ID, resolved node ID, source document ID/type/file, source node ID and JSON Pointer, template/slot chain, component definition + instance path, and dataset row key where relevant. Keep authored YAML free of this metadata. Add `data-wf-handle` to source-backed DOM wrappers; decorative inner spans map to their nearest mapped ancestor. Repeated occurrences must have different handles even if today's HTML IDs collide.

On a phone outside interactive mode, a short stationary tap is captured **inside the iframe before its interaction runtime**. `closest('[data-wf-handle]')` yields a handle; the trusted renderer posts a new proposed `wf:select` message with revision, page, handle and rect. The trusted host checks `event.source === frame.contentWindow`, a per-mount nonce, revision and handle membership. Rects account for CSS scaling and scroll offsets. Only the trusted outer WebView document can send a bounded native selection message. Never expose a broad JNI/JavaScript bridge to prototype content. Existing `wf:navigate` listener lacks a sender check; add it when implementing this boundary. Use CSP, block external navigation/network/resources and use packaged fonts/icons, not `icons: 'fontawesome'` CDN. The current same-origin, scripts-enabled iframe is a style/runtime boundary, not adequate security isolation for arbitrary imported active HTML; v1 accepts schema-owned primitives, no custom scripts or executable assets.

Native resolves the handle against that revision's map, not against text sent by the page. Prompt context contains the user's request, selected source subtree, parent layout and slot, minimal ancestor IDs, relevant component props/definition, route summary, current viewport and bounded project decisions. Example: “Home / trip_card / title; source pages/home.yaml; change only this card's title; base r17.” Shared-definition edits require explicit “all uses” scope; otherwise override the instance when the schema permits. If it does not, explain the shared scope before applying. Stale/ambiguous selections are cleared, never guessed. A generated table cell may map only to a table plus dataset row; show that limitation.

**No image is needed to identify a known node.** Text context is smaller and exact. Without vision the model cannot inspect an imported reference image, diagnose unseen visual overflow or reason from a screenshot alone. It can still change labels, structure, layout props and links from YAML. Do not advertise visual inspection. Screenshot vision earns its ~1 GB projector only if a paired test demonstrates materially better layout correction, within measured memory and latency budgets. A, B and C all launch text-only. B reserves a future “Use visible image” action, but it does not ship at launch.

Tablets always deliver ordinary taps, scrolling and links to the page. There is no global non-interactive tablet mode, no “Play” toggle, and no phone pager gestures. A/B propose a deliberate context gesture that consumes only the long-press, leaving ordinary use intact; C uses an external searchable element list. **Owner decision:** is long-press pointing acceptable, or must tablets use a list? This resolves rather than silently ignores the tap-to-select conflict; direct single-tap selection on tablet would contradict the brief.

### S3. Small-model editing: YAML transactions, never whole-project regeneration

The model emits only a bounded YAML edit envelope, not HTML, JavaScript, executable tool calls, a prose stream or a full project. This is a **new internal protocol**, not an existing `.wf` extension. Native text around it comes from localized templates derived from verified outcomes; optional reasoning tokens are not displayed. Keep the owner's “model only generates YAML” rule literal.

Illustrative protocol (not currently accepted by `wf validate`):

```yaml
editVersion: 1
baseRevision: r17
changes:
  - op: set
    document: page:home
    node: trip_title
    path: /props/text
    value: Your next escape
```

Allow only `set`, `insertAfter`, `remove`, `addDocument` and `removeDocument`; all target typed source IDs with an optional allowlisted property pointer relative to that node. No raw line diff, arbitrary filesystem path, rename-by-overwrite, YAML tags, scripts or general JSON Patch. Shared definitions target their real definition/instance IDs. Deleting a page or document requires native confirmation naming affected links. A request to add a page uses an app-supplied valid page/template skeleton plus generated YAML node inserts and a sitemap edit in one transaction. Complete document output is allowed only for a new bounded document (≤1,024 output tokens); larger documents are constructed in chunks in an invisible draft. Arbitrary large selected subtrees are retrieved as relevant leaves + ancestry, then edited one bounded region at a time. A large request stages multiple chunks and commits them together so no dangling navigation is exposed.

Proposal: 4,096-token context initially; target 2,560 input tokens + 1,024 output + 512 safety. Count with the actual model tokenizer, including chat template and any reasoning. Reserve roughly 768 input for schema/rules + protocol example, 384 for project decisions/routes, 1,024 for target/ancestors and 384 for request/recent turns. Retrieve only used primitive contracts from the registry-derived cheat sheet, not the entire catalogue. If retrieval cannot fit, reduce scope or ask a short scope question. Do not silently cut the selected YAML in half. Caps are experimental settings, not a measured capability claim.

Pipeline: C++ buffers a complete candidate envelope → JS parses and validates envelope limits/schema → applies operations to a deep copy of the current file map using source IDs → validates every affected complete document with existing `validateDocument` and whole map with `validateProject` → resolves/renders affected pages and all shared dependants → checks duplicate IDs, missing component/dataset/route targets, broken refs and unauthorized scope with explicit additional guards. Existing validators do not implement all these guards; they must be added, not claimed. Assets/config receive format-specific validation; unsupported imported material stays unchanged.

Only a fully valid transaction, based on the current hash/revision, may enter the append-only revision store. Render candidate offscreen, wait for iframe load/ready and layout sanity checks, then durably commit and promote the preview. Journal recovery finishes that promotion after a crash. Old files are not modified in place. Source revision checks reject a stale candidate; retries use a request ID to prevent duplicate application. One generation at a time per project. Queueing another message shows “Next” and allows removal; undo first cancels an active candidate.

One automatic repair pass receives compact diagnostic code/path, the rejected operations and the original target context. Total repair output stays capped. If repair fails, discard the entire draft: “I couldn't apply that change. Your design is unchanged. Try a smaller change.” Retry and Edit request are explicit actions. Undo restores the complete previous transaction across all affected documents; Redo restores its successor until a new edit branches. Keep a durable revision history with at least 50 transactions, then explicit storage cleanup that retains the current state. Multi-page changes never half-apply.

### S4. Slow tokens and live regeneration

Keep the last valid design fully visible while tokens arrive. Show honest phases: “Preparing on this device”, “Updating Home”, “Checking 2 pages”, “Applied · Undo”. Stop remains available from chat and preview. No fake percentage, typing prose, invented ETA or token-by-token broken page. If preparing is still running after one second, show its status; after 15 seconds show elapsed time, no completion estimate. These are UI timings, not predicted model timings.

Partial/invalid YAML never reaches the live mount. A completed validated independent chunk may update a single page if it is explicitly a complete transaction; coupled multi-page edits wait for the entire set. This is the closest safe version of “everything changes as the model generates.” Literal every-token regeneration is a bad idea: indentation and incomplete references will flicker or destroy the live page. The user sees a coherent new design per accepted transaction, with a 120 ms outline pulse; no full-page shimmer. Cancellation discards uncommitted drafts and retains completed transactions, clearly stated in the receipt.

### S5. Compaction without losing the project

The canonical document store and revision journal are durable design memory; chat is a separate local log with project ID, chat ID, user messages and request/revision references. Never reconstruct source from a model summary. “New chat” creates a fresh conversation **in the same project** and preserves decisions/YAML; “New project” creates an independent document set. Deleting either is confirmed; a new chat is not deletion.

Before a request would exceed 70% of the available input budget, retain the last two relevant turns and replace older prompt history with a ≤256-token structured decision ledger: purpose/audience, constraints, accepted naming and unresolved questions, each tied to a source revision or explicit owner request. The ledger is updated from accepted transactions and explicit preferences; no extra unbounded summarization call. Old chat remains scrollable on disk. Exclude rejected edits and any preferences later superseded. If the ledger + target still does not fit, retrieve fewer turns/regions, never drop project state. No “compacting” UI or permission prompt. Explicitly deictic requests (“make it like the first version”) retrieve the named old revision or ask which one.

### S6. Exact provisional device rule; no model picker

All numeric thresholds here are conservative **product hypotheses to be replaced by measured profiles**, not phone benchmarks or proven minimum RAM. Default runtime is arm64 Android, API 28+ and a tested OS/WebView version; x86_64 is a development smoke target only. Check ABI, low-RAM flag, physical RAM, currently available memory, storage and thermal state. An unknown hardware/OS profile starts as E2B trial-eligible, never E4B solely because its spec sheet is large.

1. Unsupported ABI/OS, low-RAM flag or total RAM <8 GiB: no model download. “This device can't run the offline designer. You can open and export projects here.” Offer Open project and Check again; do not imply chat works.
2. Select E4B Q4 only for an allowlisted measured device/OS/backend profile with ≥12 GiB physical RAM, available RAM ≥measured peak incremental model+KV+WebView allocation +1.5 GiB, sufficient storage, and normal/light thermal state. No measured profiles exist in this work, so **no device currently qualifies for automatic E4B**. This is deliberately more honest than promising a 12 GB phone will work.
3. Otherwise select E2B Q4 trial for ≥8 GiB physical RAM, available RAM ≥5 GiB (provisional until profiled), sufficient storage and normal/light thermal state. Show “Setting up your offline designer”, never a model chooser. Less available RAM: “Close other apps, then try again”; no unsupported verdict based only on transient pressure.
4. Storage requirement is remaining pinned weights bytes + optional projector bytes +1 GiB working/project reserve, with rename rather than double-copy installation. Check continuously. Current proposal downloads **weights only**: E2B 3.35 GB, E4B 5.15 GB. If vision is approved, E2B total 4.34 GB, E4B 6.15 GB, and device qualification must be rerun with its measured vision peak. Do not silently reserve or download the projector.
5. After download, run a bounded load+schema-edit smoke with the WebView visible. For release qualification require no allocation failure/LMK, ≥1.5 GiB system headroom, first useful valid small edit within 30 s and no thermal severity above moderate over repeated edits. These are proposed acceptance targets. Persist a successful device/runtime/model-hash profile; an updated OS/runtime invalidates it.
6. E4B failure cancels/unloads before trying E2B. E2B may require a new download: “This device needs a smaller offline download (3.35 GB). Continue on Wi-Fi.” It cannot recover offline if those bytes are absent; preserve view/export and pending request. Keep old weights until replacement is verified if storage allows; otherwise explicitly explain replacement storage. Do not auto-upgrade later or repeatedly bounce tiers. E2B failure after one smaller-context retry marks chat unavailable on that profile; preserve projects. A misleading RAM report, memory contention or bad backend can make the automatic choice wrong; persist failure and offer Check again after environment/runtime changes.
7. Moderate heat: reduce up to four CPU workers to two and shorten batches; severe: stop the draft and show “Device is warm. Let it cool, then retry.” Resume only below moderate with a stable cool interval (proposed 30 s). Heat alone never triggers a multi-GB redownload. No cloud substitution.

Existing desktop planning figures of 8 to 16 GB are not phone measurements and do not prove the rules above. RAM plus a WebView, KV cache, tokenization, scratch buffers and projector is the real budget.

### S7. Download once, safely, with accurate copy

The table below is the pinned contract for each model file.

| File | Bytes | Pinned SHA-256 |
|---|---:|---|
| E2B Q4 weights | 3,349,516,256 | `fa401b55b07ee70a54c6dae3903c783a6e65064312529ea57175cb5f8dec6634` |
| E2B projector | 986,833,664 | `021059cce659fe7f9170d5599761d7bbaf644b798dab9503aca30dc43e6beb14` |
| E4B Q4 weights | 5,154,941,280 | `676c35070db6dbe52f93e9c864ee0fba4eddea94b9c875d9cb10daff453fbaee` |
| E4B projector | 991,552,256 | `7498a37cb619e55f2fcf87eb931f56e99389ed6d432e4c5c66110694c0d65578` |

The base URL is configuration; key `gemma4/<size>/<quant>/<sha256>/<file>`. Q4 quant path is `q4_0`; filenames are `gemma-4-E2B_q4_0-it.gguf`, `gemma-4-E2B-it-mmproj.gguf`, and corresponding E4B names. Q8 catalogue entries have no projector and are not the vision path. No live Hugging Face fallback is implied by provenance fields.

**Blocking delivery fact:** on 2 November the mirror host did not serve these files, because its TLS handshake failed. Whether the objects exist is unverified. Before shipping, verify TLS, exact object lengths, Range and digests from the chosen public origin.

Wi-Fi/unmetered starts automatically after the user opens setup; show size, progress, Pause and “Use mobile data · 3.35 GB” only when needed, with explicit cellular consent. Switching to metered pauses rather than silently spending data. Copy: **“Downloading your offline designer · 1.2 of 3.35 GB. You can leave the app; we'll keep your progress. Connect to Wi-Fi to continue.”** The Wi-Fi sentence appears only while waiting. Do not say the user must keep the app open. A foreground service improves continuity; it cannot promise immunity from force-stop, system termination or timeouts.

On Android start a user-visible `dataSync` foreground service while setup is in foreground, with notification progress/Pause and stop on completion or timeout. For Android 14+ prefer a UIDT job for long user-started downloads; do not run both for the same transfer. Android documents a six-hour background budget for dataSync on target 35+, and recommends UIDT for this class of transfer ([timeout rules](https://developer.android.com/develop/background-work/services/fgs/timeout), [UIDT contract](https://developer.android.com/develop/background-work/background-tasks/uidt)). On iOS later use background URLSession; do not transplant Android service assumptions.

Write app-private `.part` plus durable manifest {catalogue revision, key, digest, length, flushed offset, validator}. Resume with Range and validate `206`/Content-Range total and start against the pin; `200` means restart that file safely, not append. `416` triggers local length/hash recheck. Verify **whole-file** SHA-256 and length, fsync and atomically rename; never load partial files. Resume rehashes local bytes; no trusted serialized hash state needed. Killed mid-write truncates to last durable offset; reopen offers Resume. Force-stop requires reopening. Pause retains partial bytes; Remove download confirms their deletion. Hash mismatch discards/quarantines that file and retries once from zero, then reports source error; never installs mismatched bytes. Low disk pauses with required free space and Retry. Setup distinguishes Downloading, Checking download and Preparing; it never labels a partially verified model “offline ready.”

### S8. Memory, lifecycle, load time and cancellation

One resident inference model; one active preview WebView and one temporary candidate frame, destroyed after promotion. No live WebView per thumbnail. Run inference off the UI thread in an Android bound worker process using a plain bound service, not a forever foreground inference service. The Kotlin service owns the C++ handle; the UI talks over bounded Binder messages, allowing worker death to be recovered. Streaming callbacks are buffered/batched, not one UI invalidation per token. Persist accepted revisions and submitted request IDs **before** expensive work. Do not put model state or project bytes in Activity bundles.

Keep the model warm only while foreground with available measured headroom; unload after a proposed 60 s idle interval, immediately on UI hidden/memory pressure, and after cancellation if pressured. Fast return may need another load: “Preparing on this device…” with Stop, last preview visible. No promised load time until measured. Orientation change retains worker ownership and current request ID, so rotation never starts a second generation.

Stop sets an atomic cancellation flag checked between decode batches/prefill chunks; reject late results with request ID/revision and drain the callback queue. Target <500 ms acknowledgement, measure actual stop latency. If a native worker stops responding, isolate/recreate that worker after a bounded timeout; never crash or overwrite the project to cancel. Kill during generation discards draft; reopen restores the last committed revision with “Last change wasn't finished. Retry.” Android exit-reason data distinguishes LMK where available; repeated unexplained deaths disable the problematic profile rather than guessing.

On WebView renderer death, destroy that instance, rebuild from committed YAML and restore page, viewport and scroll best-effort; interactions/form state is disposable and a small native snapshot can preserve allowed app-state keys. A recurring crash on the same revision falls back to last renderable revision with export of current YAML. Android explicitly requires recreating a terminated WebView ([WebView lifecycle](https://developer.android.com/develop/ui/views/layout/webapps/managing-webview)); measure app + inference worker + renderer, rather than reporting only Java heap ([memory guidance](https://developer.android.com/develop/ui/views/layout/webapps/manage-webview-memory)).

### S9. Phone gestures, desktop fit and the escape route

Two horizontal panes, chat on the left and page on the right; equivalent labelled Chat/Preview controls for discoverability and accessibility. In edit/non-interactive preview, vertical drags scroll the document; a stationary tap selects a component, not draws. A horizontal pager starts only on the native pane header or its dedicated 24 dp page-switch strip, or an inner left/right edge rail away from Android's system-back edge. Lock intent after 12 dp: vertical wins when `abs(dy)>abs(dx)`; horizontal requires `abs(dx)>1.5*abs(dy)`, and settles at 25% width or velocity threshold (proposed 600 dp/s). Never steal horizontal carousel/table drags from the document. **Brief tradeoff:** swipe anywhere inside preview is intentionally restricted; otherwise horizontally scrolling wireframes cannot be explored reliably. Chat/Preview buttons always work. Native scroll forwarding handles vertical scroll without activating page buttons. System back uses the app's normal hierarchy; it does not accidentally discard an edit.

Top “Desktop” toggle on every phone preview switches a **transient cloned render viewport** to 1280×900 and fits it to available width. Phone uses 390×844, landscape 844×390; desktop scale is availableWidth/1280, with pan/pinch zoom where needed. The source page viewport is not mutated by inspection. New host adapter must clone the map and override `viewport.device/orientation`, then remount; `setPlatform('web')` alone is insufficient. Restore selected rect and scroll after remount where possible. Native screen rotation and design orientation are separate.

“Enable interactive mode” is explicit on phone; native chrome becomes a persistent **“Exit interactive”** bar **outside** the WebView (44 dp minimum hit target), including landscape safe insets. All touches **inside** the page now reach it; no pager or tap-to-select interception there. The owner’s “all touches” cannot include this exit chrome or the user is trapped. Exit interactive restores editing, the prior target and pager controls; Chat exits interactive and opens chat. Android Back exits interactive before navigating within the app, with predictive-back handling. Accessibility action and external keyboard Escape do the same. Rotation never hides exit chrome. Tablets have none of these mode controls.

### S10. Exact C++/native/JavaScript boundary

“Everything in C++” would force a renderer/validator rewrite and delay a small team. Put portable new policy and state machinery there; preserve the existing JS as the single rendering/schema authority.

| C++ reused on iOS via a stable C ABI | Native Android → native iOS | Existing JS + proposed JS adapter |
|---|---|---|
| llama.cpp model/tokenizer/context lifecycle; bounded inference requests; atomic cancellation; runtime backend adapter; optional mtmd later | Kotlin/Compose shell → SwiftUI; WebView → WKWebView; accessibility, IME, pointer/gesture arbitration, orientation, localization | Existing parser, registry, schema validator, resolver, renderer, interaction runtime run locally in WebView JavaScriptCore/V8, not Node |
| Device-tier policy on native supplied metrics; prompt budgets/retrieval plan and compaction ledger; revision/request IDs; transaction journal and undo/redo (SQLite C API); hash verification/catalogue policy | Android HTTP client/FGS or UIDT → URLSession; file permissions/storage location; thermal/memory callbacks; worker process/service → platform lifecycle; microphone only if later approved | New trusted outer adapter parses envelope, applies typed source operations, emits normalized source index/provenance and validation result; dedicated Web Worker runs browser-bundled validation/resolution where possible |
| Canonical raw document bytes, file IDs, snapshot history, atomic commit gate; bounded message protocol | Kotlin service calls JNI on a worker thread; Binder sends bounded requests to that process; native receives validation callback and authorizes commit | `validateDocument`, `validateProject`, schema JSON and format constants are bundled with esbuild. No `fs`, CLI adapter, `process`, API or screenshots module at runtime. Existing validator statically requires JSON, suitable for bundling. Browser build/worker packaging and parity tests are required work, not currently exported APIs. |

Proposed JNI class `OfflineCore`: `nativeOpen(storePath): handle`, `nativePlan(handle, requestYaml, selectionContextJson, metricsJson): requestId`, `nativeLoad(handle, modelPath, paramsJson)`, `nativeGenerate(handle, requestId, promptUtf8, limitsJson, callback)`, `nativeCancel(handle, requestId)`, `nativeUnload(handle)`, `nativeAcceptValidation(handle, requestId, baseRevision, candidateFiles, diagnosticsJson, previewReady)`, `nativeUndo/Redo(handle)`, `nativeClose(handle)`. Callbacks are bounded `onPhase`, `onYamlChunk`, `onFinished`, `onFailure` with request ID. Selection/context JSON and validator responses are transport, not model output. iOS calls equivalent C functions. Native does not reimplement YAML parsing; JS returns candidate complete YAML bytes and normalized indexes, while C++ enforces IDs, hash, length and revision constraints on persistence. Restore indexes by reparsing durable YAML in the trusted JS worker. No dependence on a network server or embedded Node interpreter.

### S11. Runtime recommendation and current evidence

**All three: start with pinned llama.cpp, Q4 GGUF, text-only.** An earlier internal project shows that a shared C++/JNI path works on the CPU for text.

Current upstream [llama.cpp Android documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md) describes NDK/CMake and CPU acceleration. [Google's Gemma llama.cpp guide](https://github.com/google-gemma/docs/blob/main/docs/deployment/llamacpp.md) documents Gemma 4 GGUF and multimodal projector input. [mtmd](https://github.com/ggml-org/llama.cpp/blob/master/tools/mtmd/README.md) is the multimodal library route, not something that earlier path implements. Pin a tested revision containing the E2B/E4B image-attention fix: [issue 28318](https://github.com/ggml-org/llama.cpp/issues/28318) was closed through 28335 on 4 September 2026. “Supported upstream” still requires exact-model-on-device verification. No vision promise based on the model's marketing alone.

[LiteRT-LM's Gemma 4 page](https://developers.google.com/edge/litert-lm/models/gemma-4) currently lists E2B/E4B, Android/iOS deployment and `.litertlm` files. Its published device results are vendor tests, not this app's GGUF, context or mid-range-phone results. [Its repository](https://github.com/google-ai-edge/LiteRT-LM) includes C++/Kotlin/Swift surfaces. It is a serious phase-zero challenger, not an imaginary future option. Switching means new mirrored `.litertlm` files, pinned digests/lengths, download sizes, runtime packaging and device profiles; current R2 contract contains GGUF only. C++ orchestration remains, inference adapter changes. Choose it if measured valid-edit latency/memory is materially better on the target phones without harming output quality or iOS reuse. No unsupported “llama.cpp is faster” claim. We report no benchmark in this document. Web sources checked 2 November 2026.

## Questions the owner must answer

1. **Where do the weights actually live?** Who restores/verifies the public mirror, and may we mirror `.litertlm` if the phone comparison justifies it? Current URL is configuration only.
2. Is text-only launch acceptable, with 3.35/5.15 GB weights downloads and no screenshot reasoning? If vision is mandatory, accept 4.34/6.15 GB plus requalification and integration work.
3. For tablets, accept A/B's long-press context gesture, or C's external “Refer to…” list? Single-tap-to-select plus always-interactive tablets is contradictory.
4. Which real mid-range Android phone is the minimum target, and can we exclude low-memory phones? Proposed 8 GiB E2B entry rule is not a measurement. Agree the latency/quality stop criteria below.
5. Does “talking” require offline speech input, or is a chat composer sufficient first? No microphone mockup or offline dictation promise until this is answered.
6. Accept update-on-valid-transaction rather than every token, and multi-page edits staged atomically? Accept automatic E4B only after a device is measured?
7. Confirm the phone preview swipe restriction to native rails/header, preserving page scroll and Android Back. Choose one visual direction before refining gestures in native prototypes.

## Risks that could kill the product, cheapest tests first

All thresholds are proposed go/no-go criteria. No experiments below have been run in this documentation task.

| Priority / risk | Cheapest decisive experiment | Proposed decision rule |
|---|---|---|
| **1 · E2B cannot make useful YAML quickly enough** | On one physical mid-range 8 GiB arm64 Android phone, Release NDK build on a Windows host. Exact pinned E2B Q4, 4K context, text-only, visible WebView. Run 30 authored tasks: 10 labels/layout, 10 node/selection edits, 10 linked-page/shared-component changes, across 3 runs. Include cold/warm and a 20-minute repeated-edit session. Store raw YAML, validation failures, repair counts and human intent scores. | Proposed ≥90% correct+valid within one repair, p50 ≤15 s and p95 ≤30 s for small edits; larger task timings reported separately. No corruption; sustained p95 degradation ≤2×. Fail → test LiteRT-LM on the same phone/tasks, then reduce supported devices/scope or stop. Do not build a polished shell around failing inference. |
| **2 · Model + WebView exceeds memory/thermal budget** | During #1 measure `dumpsys meminfo`/Perfetto across UI, inference and renderer processes, system available memory, KV settings, cold-load time, prefill, decode, time-to-first-valid-edit, temperature/thermal status, energy and stop latency. Background/reopen, rotate and inject memory pressure. Later compare one 12/16 GiB phone with E4B; projectors as separate runs only. | ≥1.5 GiB headroom, no LMK across trial, usable after warm session; severe heat or repeated death rejects that profile. Report PSS/RSS and GPU memory separately; no claims based on emulator or Java heap alone. |
| **3 · Download cannot reach users** | Once the mirror owner repairs the origin, test TLS/Range with a small bounded request; then one full pinned file + kill/resume + tampered digest + metered switch. | Exact length/SHA, no duplicate appended bytes, resume after reopen. A broken origin blocks release, even if local import works in development. |
| **4 · Small context loses project intent** | Replay 50 edits over a 12-page project including shared components; force compaction after a handful of turns and issue “undo that”/“like before”. | Source remains authoritative, precise scopes, no collateral edits; ≥90% human intent accuracy target. Large tasks may need several bounded passes; measure their time. |
| **5 · Selection and gestures confuse people** | Use these boards for five short walkthroughs, then a thin native interaction prototype only after direction choice. Tasks: select card, edit shared header, swipe chat, scroll table, exit play in landscape; tablet ordinary tap must still navigate. | All five escape play unaided; no accidental navigation from edit taps, no tablet mode confusion. If long-press is undiscoverable, adopt external element list. |
| **6 · Existing JS cannot validate safely offline** | Browser-bundle validator+schema in a Web Worker and compare diagnostics with CLI on malformed and valid `.wf` fixtures. Round-trip config/assets unchanged. Include broken route/use/dataset references. | Same existing diagnostics plus explicit missing guards; no Node built-ins/network. Failure calls for targeted module extraction, not a parallel C++ schema implementation. |
| **7 · “Only YAML” still permits destructive edits** | Crash/fault inject before/after validation, commit and render readiness; test stale revision, duplicate request, invalid operation, interrupted multi-page transaction and undo after restart. | Current project always one complete valid revision; rejected output never visible. Durable history restores linked docs together. |

## Build order and review status

First: the bounded inference experiment, not UI implementation. Then validator/source mapping/transaction proof. Then the selected Android shell, built and verified on a Windows host with Android SDK/NDK; x86_64 emulator for lifecycle/layout only, real arm64 phone for model/heat/memory. No app build was needed or run for these documents. After Android acceptance, reuse C++ and JS assets in iOS; verify its separate lifecycle and physical memory limits on Apple hardware. No Android-to-iOS performance inference.

No delegation or cross-provider review was performed. This run is doc-only, using the repository's stated doc-only review exception; obtain the adversarial review before implementing the multi-file native feature. The audit below is the author's check, not an independent review.

| Self-review finding | Decision |
|---|---|
| Whole-project generation would exceed useful phone context | Adopt bounded YAML operations and transactional staging; do not ask E2B to rewrite everything. |
| “Keep open” copy overstates background restrictions | Adopt resumable setup with notification and accurate interruption copy. |
| Desktop toggle could be mistaken for `setPlatform` | Adopt transient viewport adapter; call out missing API. |
| Tablets cannot use phone edit/play split | Adopt deliberate reference gestures/list; owner chooses. |
| Screenshot reasoning is expensive and not wired up | Defer mtmd/projector until paired tests prove value. |
| Native C++ validation would create a second contract | Reject; reuse browser-bundled JS validator and schema. |
| Existing source maps and semantic validation are insufficient | Adopt explicit provenance and reference guards as new work. |

The three boards cover download, phone chat, phone preview/desktop, landscape, interactive/exit, selection with contextual prompt, multi-page navigation, tablet split and tablet hidden-chat with viewport/orientation controls. Their differences are interaction and information architecture choices, not three skins of one app.

Delivery checks: all seven requested files are present; each board contains six 390×844 phone frames, one 844×390 landscape frame and two 1180×820 tablet frames. HTML tag nesting and inline script syntax checks pass; no remote assets, fonts, imports or runtime network dependencies are referenced. Local document links resolve. Markdown files are below 1,000 lines and HTML files below the 500-line source limit. These are structural checks, not rendered layout tests.

**Visual QA limitation:** the browser access host was unavailable, and Windows Computer Use returned “Computer Use was not approved to use Google Chrome.” Rendered inspection could not be completed. Phone content budgets were reviewed and tightened from source, but browser clipping, actual font metrics and accessibility behaviour remain unverified. No native builds, inference tests, full repository test suite or Playwright flows were run for this documentation-only deliverable. There are no app-code changes or commits.

**Later rendered check:** all three boards were opened in a browser after this run and sampled by scrolling, and an overflow scan ran on each. They render without network requests. Each board has two or three chat panels whose lower content clips under the composer, for example the action buttons on Direction A's selected-card state. Tablet boards scroll sideways at narrow widths. The native app's real layout remains untested.
