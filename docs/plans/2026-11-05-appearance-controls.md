# Interactive appearance controls
Status: proposed; no implementation or browser acceptance claimed.

## Problem Statement
Segmented controls, local tabs and colour fields look editable but do not change the preview. Chromium on cdf7819 confirmed unchanged active segments/tabs, an empty colour value and no native picker.

## Current Behavior
- engine/renderer/primitives/controls.js renders segments as plain buttons and colour as text plus a static swatch; ordinary input values work.
- primitives/navigation.js renders non-routed tabs as spans; routed tabs navigate.
- interactions.js owns page/app state, selection, visibility, text bindings and click interactions. stateBindings.value currently sets a wrapper property rather than the real input. Text bindings in props.label already emit safe data-bind spans.
- node.selection {scope,stateKey} and node.stateBindings {value: expression} are existing schema fields.
- overlay-renderer.js emits an unnamed close button.

## Desired Behavior
Segments and local tabs change active appearance/aria-pressed by mouse, touch and keyboard. Existing selection state can show the corresponding real panel. Colour has a native picker and exact six-digit hex input; valid edits synchronize, incomplete drafts remain editable. A state-bound text input updates an existing bound button label. Route tabs still navigate. Coarse targets are at least 44px.

## Design
No schema/new props. Segmented option labels and local tab labels are their string selection values. props.value sets the initial segment; tab.active sets the initial local tab. Existing selection.scope/stateKey links the group to page/app state. Existing state defaults win; if missing, initialize from the authored active option. Groups without selection have local ephemeral selection only. Route tabs remain links and do not participate in local selection.

Emit escaped private data attributes on groups/options; button type=button and aria-pressed. Use small interactions-controls.js runtime fragment for control binding plus existing refresh function, keeping interactions.js below 500 lines. Existing generic selection must skip a control group so it cannot overwrite option state with the wrapper id. State changes must refresh every group bound to that key.

Colour uses input[type=color] beside input[type=text], visible labels, bounded #RRGGBB validation and aria-invalid for incomplete/invalid text; no arbitrary CSS or HTML. Authored hex is preserved exactly. The picker only receives valid values; text drafts do not write state or get coerced by unrelated refresh. Disabled inputs remain disabled.
Ordinary input props.value expressions register existing value bindings. Exact state/appState expressions in stateBindings.value are writable on input events; other expressions remain read-only. Refresh writes the actual input value. Bound preview labels use existing props.label expressions/data-bind, preserving button markup/icons. No new expression evaluator or event schema.
Give modal close button the accessible name Close.

## Implementation Order
1. Adversarial different-provider review; record adopt/defer/reject.
2. Capture neutral base desktop/touch screenshots and durable fixture.
3. Renderer/runtime/CSS changes plus focused real browser tests.
4. Regenerate catalogue and affected approved screenshot baselines; full pnpm test on Maxis.
5. Inspect matching before/after renders, report native picker OS-dialog limitation. Commit and push.

## Edge Cases
Missing/invalid initial selection, duplicate labels (first matching option; recommend unique labels), empty options, mixed route/local tabs, app state restored from session, multiple groups sharing one key, nested selection ancestors, disabled fields, partial hex and recovery, escaped hostile labels/values, unrelated state refresh while typing. No state mutation from render-time code.

## Non-Goals
No custom state framework, persistent design edits from prototype clicks, page authoring UI, backend, arbitrary colour formats, sliders, automatic launcher geometry/style binding, native app work or private reference fixtures. Mobile authoring adapters may need separately reviewed permission to set existing selection/stateBindings fields.

## Acceptance targets
Neutral desktop and touch Chromium: select all options with mouse/touch/keyboard, state-linked panels change, routed links still navigate; colour initializes, picker/change and hex/input synchronize, invalid drafts preserve last state and recover; text changes label without losing icon/action; Close has accessible name; coarse targets >=44px. Exact source/state assertions and full engine tests, with measured outcomes recorded separately.

## Review decisions (Claude Sonnet, before implementation)
Adopt all four blockers: skip generic group selection in bind and refresh; stop group/field clicks at their control boundary; restore app-scope group state from existing session storage before authored defaults; preserve invalid colour drafts with a flag and avoid redundant/undefined value writes; update both colour inputs for disabled state; label/id the hex field and name the picker, excluding its duplicate submission value.
Adopt unresolved-route preservation (only absent routes are local), typed JSON option values with unique-label guidance, six-digit hex and case preservation, and registry/rendering docs sync. Empty-label options are disabled; duplicate labels activate only the first match. Existing incompatible state values show no selected option.
Local tabs remain native toggle buttons with aria-pressed, not an incomplete ARIA tab widget; they support native Tab/Space/Enter. Routed tabs remain links. Page-header tab duplication is deferred: this tranche targets the requested tab_bar primitive.
Adopt narrow unsafe-path rejection for the new writable binding path. Defer broad state-runtime hardening and the pre-existing numeric-zero text binding issue unless exercised by the new field path.
Keep the one-line Close label in this scoped accessibility change; no additional UI.
Review artifact: owned Maxis build/appearance-controls/claude-review.json (plain text despite suffix; provider CLI returned a successful review).
