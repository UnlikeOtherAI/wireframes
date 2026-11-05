# Page inset
## Problem Statement
Card-mode pages have fixed 16px outer padding. A shared template with layout.padding:0 still starts 16px from the browser edge, losing 32px of width.
## Current Behavior
engine/renderer/styles/base.js sets .wf-mode-card .wf-page padding:16px. engine/screenshots/renderer.js owns the common outer shell. Template body layout is inside it.
## Desired Behavior
Optional page.inset is a finite nonnegative number of CSS pixels. Authored 0 makes the page full bleed; omission preserves exact existing markup/default mode/platform behavior.
## Design
Add page.inset to canonical schema/docs. Propagate pageInset through all pure/fs/screenshot/serve/introspection descriptors into the shared renderer. Append inline padding only for a finite nonnegative number; invalid direct renderer input never becomes CSS. Keep gap/body padding unchanged. No new primitive, runtime, theme, mode workaround or negative margins.
Mobile existing set can address document:page:home,node:home,path:inset,value:0; null removes it. A small page-inset module rejects wrong scope/node/type, negative/nonfinite values, nested paths and root remove/replace. No arbitrary node inset. Request-only guide and active-page target context prevent using a heading id.
## Implementation Order
Provider review; engine schema+all render paths+geometry/schema/parity checks; mobile scoped set+rollback/guidance tests; replay private reference fixtures. Commit/push scoped source separately from private evidence.
## Edge Cases
Omitted byte-identical output. Zero and positive values; line/mobile modes keep defaults unless explicitly authored. Direct malformed input ignored, schema rejects it. Template gap/padding and sticky behavior stay independent. Page scope explicit or current page only. No document-root replacement.
## Non-Goals
Responsive viewport arithmetic, CSS injection, automatic screenshot matching, inset inheritance, UI, node margin API.

## Review decisions
Claude Sonnet reviewed the plan before implementation. Adopt finite 0..4096 bounds shared with the adapter, six-decimal CSS formatting, explicit all-mode semantics, page-scope/collision/rollback tests and actual edge/overflow measurements. Retain inline padding: inspection found only whole-padding declarations on .wf-page (card default and iOS/Android zero), no safe-area or per-side reservations to overwrite. Explicit page inset deliberately wins over those defaults. No template inheritance: every page opts in. Browser WF rendering and API use the same pure renderPage path; filesystem, serve, screenshots and why descriptors carry the same field. Existing unsupported clients require an engine update; no invented compatibility promise. No global CSS change means no unrelated catalogue regeneration.

Focused checks found the custom schema validator does not implement maximum. Page document validation therefore also calls the same bounded helper; unrelated validator semantics are unchanged.

## Verified result
Implemented and checked on Windows Maxis: full CLI suite 283/283, scoped inset checks 3/3, mobile web suite 215/215 and scoped adapter checks 3/3. Real Chromium geometry covers web card/line and iOS at 390/1280 widths, default/zero/12.5px padding, no horizontal overflow, scroll and footer popup behavior. Private combined reference fixtures also exercise Channels-to-Website routing, live text, three preview panels, valid/partial hex recovery and Computers footer navigation. Native integration remains the coordinator task.
