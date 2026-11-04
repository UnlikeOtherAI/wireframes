# Searchable icons and interactive iPad wireframes

## Problem Statement

The iPad can preview clickable wireframes, but authors cannot search the bundled Font Awesome catalogue through the CLI or supply bounded icon matches to the local editing model. Buttons put icons before labels, fields rely on ambiguous text affixes, image placeholders lack a wireframe cross, and pill corners have no named contract. Sticky top-level regions exist but a normal app bar cannot request sticky positioning. These gaps prevent a realistic two-column, multi-page example and the supplied rounded composer bar (without a waveform).

## Current Behavior

- `engine/schema/primitive-registry/` defines the elements and props; schema is generated.
- `engine/renderer/primitives/controls.js` renders buttons and typed fields. `prefix` and `suffix` infer icons from strings, and search fields infer a magnifier.
- `engine/renderer/primitives/text.js` renders image placeholders with a media glyph and visible alt caption.
- `engine/renderer/wireframe-styles.js` merges numeric rounded/sharp corner overrides. CSS 50% would create an ellipse for a wide control.
- `engine/renderer/styles/base.js` supports sticky template regions only.
- Mobile `web/src/context.ts` builds a compact registry reference. `web/build.mjs` already bundles Free fonts for offline rendering; the editing model has no icon search.
- Mobile `shared/skills/wireframe-editing.md` guides the local editing model. It needs examples of real layout, routes, menus and these properties, not an icon catalogue.

## Desired Behavior

Use the complete installed Font Awesome Free solid, regular and brands catalogue. Search returns a small ranked set of valid names and supported styles. Burger menu returns bars; search returns magnifying-glass. The model receives at most eight matches relevant to the request, never the catalogue.

Buttons support leading/trailing icons and centred icon-only actions with accessible labels. Text fields support explicit leading/trailing icons and an empty centred search treatment that moves to the leading edge on focus/value, so typed text is not obscured.

Pill corners use a radius capped by half the shortest side, so a wide input is a capsule. Empty image placeholders have a diagonal cross and a persistent descriptive caption; hover/focus provides the same description, without inventing image URLs. Normal nodes can request sticky top/bottom placement using the same vocabulary as template regions.

Verify these features through an iPad app user journey: open/import a project, navigate pages, open and dismiss a user menu, use fields and icon buttons, scroll a long two-column page with a sticky bar, inspect image captions, edit through the app and inspect the output.

## Design

1. Add a pure engine icon-search module that normalizes the package metadata to names, labels, available styles, aliases and search terms. No filesystem or framework coupling. Keep catalogue loading separate from the pure search function.
2. Add thin `wf icons search <query> [--style solid|regular|brands] [--limit 8] [--json]`. Bound limits, rank exact names/aliases and phrase matches before broad terms, and add only specific navigation-menu synonyms missing from upstream metadata.
3. The mobile build emits a compact deterministic search index from that same loader. Browser context generation uses the same engine search and appends bounded matches for the current request. It does not add the index to model instructions. Keep model context tests focused on relevant names and size.
4. Add explicit `icon`, `iconStyle`, `iconPosition` to inputs and `iconPosition` to buttons. Preserve existing prefix/suffix and leading-button behaviour. Logical start/end positions follow writing direction. Centred button uses existing iconOnly semantics, preserving its label as its accessible name. Centred input appearance must not interfere with focus, text or keyboard input.
5. Add `wireframeStyle.corner.style: pill`, rendered as a large CSS radius with native radius clamping. Pill overrides a numeric radius and is not reduced by line-mode scaling. Inherited defaults remain sharp/rounded as before.
6. Reuse existing placeholder/caption markup and add the crossed-image treatment. No hover-only information on iPad. Keep image and non-image media kinds distinct.
7. Add optional `sticky: top|bottom` on ordinary nodes. Reuse sticky data attributes/CSS; do not implement scrolling JavaScript or duplicate sticky bars. Sticky elements remain in flow and within the containing scroll area. Examples put the bar in a full-height region and provide an opaque background.
8. Add one coherent multi-page example with two columns, a sticky top bar, anchored user popover with route actions, icon positions/styles, labelled image placeholders and a pill composer without the waveform. Generate gallery/reference updates through existing commands.
9. Update only the application editing guide and bounded request examples needed to choose these contracts. Measure actual model responses and inspect the designs rather than grading only canned YAML.

## Implementation Order

Baseline CLI and mobile checks on Maxis; different-provider review of this design; engine search/contracts/rendering and focused browser flows; schema and generated reference sync; mobile dependency/context/guide integration; portable builds and model evaluations on Maxis; native Apple build and iPad app interaction on the Mac; matching before/after evidence for changed states; review and merge engine PR, then mobile integration PR pinned to its tested revision.

The independently requested skin/design-system design is owned by Astra. Integrate it after review without a second element list or a separate renderer.

## Edge Cases

- Empty, unknown, repeated and overly broad icon queries; exact aliases; style-specific absence; fixed result bounds; stable tie ordering.
- Icon-only labels, disabled buttons, routed buttons, both field affixes, value clearing, focus and right-to-left layout.
- Pill geometry across width/height, line/card mode and nested override inheritance.
- Captions with long text, escaping and no image URL; pointer hover and iPad touch.
- Sticky header before, during and after scrolling; nested containers, overlays, routes and viewport changes.
- A saved project must reopen identically offline; changing the view must not mutate design data.

## Non-Goals

No Pro assets, remote icon service, catalogue in prompts, waveform renderer, account/profile store, pairing changes or unrelated identity refactor. Physical iPad availability and model execution must be reported separately from simulator and fixture coverage.

## Acceptance

- CLI burger-menu and search queries return bars and magnifying-glass first, including supported styles; unknown queries return no matches. JSON is valid and bounded.
- Model icon context has at most eight records and a fixed character budget; metadata/SVG paths never enter prompts.
- Browser and iPad control actions work; no missing-font fallback for valid free styles, no typed-text/icon overlap or clipped labels in the exercised layouts.
- Pill computed corner caps are half the shortest control dimension; image captions stay visible without hover.
- Sticky bar stays within 1 CSS px of its top offset after at least 800 CSS px of scrolling; the next content is still reachable and user menu actions navigate.
- Complex example has at least three working pages; menu open/dismiss, route/back, field typing/clearing, sticky scroll and save/reopen are manually exercised in the iPad app.
- Preserve passing existing CLI/mobile checks and record actual model success/failure against short realistic requests. No pairing exercised.

## Adversarial review and decisions

Claude Opus 5.5 (different provider, read-only engine inspection at 47aaeee) reviewed this plan before implementation. Raw review is preserved outside Git in the task evidence.

- Adopt: iOS/platform and line-mode CSS override ordinary radius variables. Emit node-local pill metadata and apply it to that node's painted parts after platform rules; do not inherit pill into all descendants. Keep existing numeric-radius behaviour outside this change.
- Adopt: define request matching explicitly. Match exact names, aliases and useful phrases in normalized request tokens, remove grammatical noise, rank specific hits first, cap eight results and the serialized context size, and emit no icon section for unrelated prose. CLI search may use broader metadata terms.
- Adopt: validate unknown icon names and unavailable Free styles using the shared catalogue; warn with usable replacements rather than silently drawing an empty icon. Keep validation portable and catalogue loading separate.
- Adopt: icon-only button labels currently disappear. Set the accessible name on the real button/link and hide decorative glyphs from accessibility.
- Adopt: keep centred input hit area full width. Use a pointer-transparent centred icon/placeholder decoration only while empty and unfocused; move the icon to the leading edge when focused or filled. Explicit icons replace inferred type icons. Reject conflicting authored affixes on the same side.
- Adopt: sticky depends on ancestor scrolling and height. Warn for clearly ineffective sole/last-child or clipped-container usage; guide authors to put the bar before its scrolling content. Exercise sticky menus after scrolling in the actual iPad host.
- Adopt in part: keep image descriptions always visible, add an accessible image name and wrap long captions. No focusable placeholder or hover-only information. A native title may repeat the description on pointer hover without adding a tooltip subsystem.
- Defer: a full RTL feature. Use logical CSS properties in changed controls; do not extend unrelated direction handling.
- Verify before claiming success: installed Font Awesome metadata availability, iPad iframe document scrolling, anchored overlay positioning while scrolled, and actual Free font loading.

Maxis baseline: 219 of 220 CLI tests pass after LF checkout and browser installation. The remaining committed gallery golden differs on Windows before any implementation (containers: 10.13%); preserve this baseline and fix the platform-specific screenshot harness without weakening the pixel threshold. Mobile baseline setup initially stopped because PowerShell treated an npm warning as a terminating error; rerun with native exit-code handling.


## Verified implementation

- Maxis passed 243 engine/CLI checks, including schema/catalogue drift, icon lookup, pure renderer overlay parity, styled samples and browser journeys. The runtime revision is 093731b; later changes add review evidence and repair four unavailable admin fixture icon references.
- Actual CLI burger-menu/search requests returned bars and magnifying-glass first. Both the interactive example and admin wireframes validated and built.
- Browser checks exercised three linked pages, typed and cleared fields, Free solid/regular/brands glyphs, pill geometry, persistent image captions and a menu after 1000 px of scrolling (sticky offset within 1 px). Captions meet 4.5:1 in the exercised default/company palettes.
- The native consumer was used directly in a Release iPad Air 13 M3 simulator on iOS 26.5: navigation, typing, sticky menu, a real model edit, colour picking, skin save/restart, copying into a blank project, switching and invalid-colour recovery. All 54 registry samples also loaded through native UI automation. Physical-device signing remained blocked by the Mac keychain; no physical iPad pass or pairing verification is claimed.
- Matching base/final captures are in docs/images/interactive-designs-review; only changed states are included in the pull request.
