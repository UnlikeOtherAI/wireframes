# Bounded native scrolling on ordinary nodes

Status: proposed; no implementation or acceptance claimed.

## Problem Statement
An authored records list needs an independently scrolling body with its heading and pagination remaining visible. The only existing generic overflow:auto path is tied to a visible pane resize handle.

## Current Behavior
engine/renderer/render-utils.js paneMetaToStyle enables overflow:auto only for resizable panes. node-shell.js emits size/layout and child wrappers without a scrolling contract. Common Node fields in engine/schema/schema.json include size/sticky but no scroll. Mobile web/src/edit.ts whitelists canonical set roots and must accept the new field.

## Desired Behavior
A bounded node can opt into native wheel, touch and keyboard scrolling without a resize handle. Its ordinary siblings remain outside the scroller. Existing sticky children attach to its scroll boundary. Omitted/false produces unchanged markup.

## Design
Add optional boolean scroll to common Node, beside size/layout. Only true adds wf-scroll and tabindex=0. Use existing accessibility.label, when authored, as escaped aria-label and role=region; otherwise add no unnamed landmark. CSS provides overflow:auto, overscroll-behavior:contain, min-height/min-width:0 and flex-shrink:0 for immediate child nodes (including the existing child wrapper), so records retain their authored geometry. Explicit inline min-size remains authoritative. Existing size.height or size.maxHeight bounds the region; with no bound it grows normally. No new primitive, JS scrolling implementation, axis API or visible handle.

The mobile adapter allows set path scroll and gives one short element-field hint. Existing node creation already preserves common fields. No new operation or prompt topic.

Computers uses existing button + anchored popover choices for 10/20 explicit routes. A 696px records scroller keeps the first row near y192 and pagination near y899. Sidebar may use the same contract within its available height. The original 25 pages/skins/logos remain unchanged.

## Implementation Order
1. Cross-provider adversarial review and independent decisions.
2. Schema/renderer/documentation and focused real-browser tests.
3. Minimal mobile field acceptance and preservation tests.
4. Authored replay updates, full engine/mobile checks, wheel/touch/keyboard and real route/popover flows, screenshots and geometry.

## Edge Cases
False/missing leaves existing output. Constrained flex children must not compress. Sticky children stay within the opted-in scroller. Nested scroll regions contain overscroll. Malformed labels are escaped. Existing overlays remain outside clipped content and can anchor to a footer button. Horizontal overflow uses native auto behavior. Scroll is an opt-in layout instruction, not automatic virtualization or viewport sizing.

## Non-Goals
No dataset/pagination API, resize handles, custom scrollbar, automatic scroll heights, UI editor, native app work, request inference or copied page shells.

## Adversarial review decisions
Claude Sonnet reviewed the plan and shell/CSS before implementation. Raw output is retained in ignored build/scroll-review.json.

- Adopt: clarify that the whole opted-in node scrolls, including a titled card/section head. The fixed-heading example puts its heading outside; no hidden body-only behavior.
- Adopt: use explicit immediate-child selectors and flex-shrink:0!important to override structural/inline flex shorthands only inside opted-in scrolling nodes. Test horizontal input sizing and titled sections.
- Adopt: name/role only generic stack/row/grid/split wrappers, preserving semantic roles of controls and specialized components. Escape labels.
- Reject dynamic focus detection: explicit tabindex=0 gives Safari and Chromium keyboard access even with interactive descendants. Provide an inset focus-visible outline; do not add runtime overflow measurement.
- Adopt: document the bound requirement and full-node clipping; overlays are rendered by the existing root overlay system. Test the actual footer-triggered popup outside the scroller.
- Adopt: preserve inline pane overflow and more-specific collapsed-pane styling; native horizontal overflow remains supported. Verify no unintended horizontal scrollbar in the records fixture.
- Reject moving scroll under size: this is behavior rather than a dimension and belongs beside sticky/layout. No existing common-node scroll field conflicts.
- Adopt: sync all required schema/rendering docs and pin geometry to 1440×950.
