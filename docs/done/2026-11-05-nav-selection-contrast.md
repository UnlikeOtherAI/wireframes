# Selected navigation background fallback

Status: implemented and verified in Chromium on Maxis. Native app verification is separate.

## Problem Statement
A skin with white navigation text and a dark background but no accent produces a selected sidebar item with white text on the renderer's default light fill. The selected label becomes unreadable.

## Current Behavior
`engine/design-system/paint.js` applies authored text to nav descendants, but paints selected backgrounds only when colors.accent exists. `engine/renderer/styles/navigation.js` supplies a light .wf-nav-on fill. The private Computers prototype reproduces this with text #FFFFFF and background #232646.

## Desired Behavior
Selected sidebar links and rail icon areas retain readable authored colours when no accent is specified. Explicit accent remains first priority. Unskinned output stays unchanged.

## Design
For nav sidebar/rail only, identify the existing selected painted area. Paint its background from colors.accent when present, otherwise from the resolved authored background. Keep the authored text, selected class, weight and navigation behavior. The no-accent fallback adds a one-pixel inset currentColor outline so selection remains visible. Add no schema, colour derivation or state API. The fallback preserves authored contrast; it cannot repair an intrinsically low-contrast chosen palette.

## Implementation Order
1. Adversarial provider review and decisions.
2. Small paint change, focused real-browser coverage for dark/light sidebar and rail, with/without accent.
3. Matching before/after screenshots, actual computed contrast, full tests and private prototype click-through.

## Edge Cases
Explicit accent wins. Missing background leaves legacy CSS intact. No skin remains byte-identical. Transparent backgrounds remain authored transparency, not a promised contrast ratio. Rail only paints its selected icon area, preserving its caption and shape.

## Non-Goals
No new colour controls, automatic palette adjustment, layout changes or dataset behavior.

## Review decisions
Claude Sonnet reviewed the plan and existing renderer before implementation. Raw output is retained under ignored build/nav-review.json on Maxis.

- Adopt: preserve a distinct no-accent selection cue using a one-pixel inset currentColor outline, in addition to the existing selected weight/classes. Explicit accent styling remains unchanged.
- Reject: a shellBackground-only resolved colour needs a second fallback. The resolver derives shellBackground from the same role/local layers already merged into colors.background.
- Adopt: verify rail as well as sidebar, glyph colour, light palettes and line/card modes.
- Defer: automatic correction of intrinsically low-contrast authored accent/text pairs and unrelated badge palettes. This change preserves authored colours, not arbitrary palette validity.
- Reject: a new colour sanitizer. safeAppearance already limits colours to six-digit hex or background transparent; appendStyle escapes attributes.
- Adopt: state explicitly that transparent backgrounds carry no guaranteed contrast; missing authored background preserves legacy styling.

## Measured verification
At a385485 before and 2d9ab8a after, matching 1280×500 and 390×500 Chromium captures cover dark, light and explicit-accent palettes in line/card modes. Mouse and touch navigation work. Dark sidebar contrast improved from 1.10:1 to 14.61:1; light rail contrast improved from 1.09:1 to 14.91:1. Explicit accent stayed 6.19:1. Selected classes/weight remain, and the fallback outline is present.

All 275 engine tests passed on Maxis. Catalogue regeneration produced no tracked difference. Raw review, captures and computed styles remain in the task's ignored/external evidence directories. No native build was run for this renderer tranche.
