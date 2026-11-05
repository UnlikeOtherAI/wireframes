# Touch targets and disabled navigation buttons

## Problem statement
The real Nessie replica renders sidebar links at 36px and a modal close control below 44px. A routed button with props.disabled: true still navigates when clicked. These fail the measured iPad acceptance targets.

## Current behavior
- engine/renderer/primitives/controls.js renders every routed button as an anchor, losing native disabled semantics.
- engine/renderer/styles/navigation.js gives sidebar rows min-height: 36px.
- engine/renderer/styles/overlays.js gives the close button no minimum hit area.
- Browser click on disabled Back in the exported revision61 navigates from home.html to back.html. Source confirms disabled: true.

## Desired behavior
Disabled routed buttons cannot activate by pointer or keyboard and expose native disabled semantics. Touch-capable devices provide at least44px sidebar/menu rows and44x44px modal close hit areas. Desktop density and rail64px tiles remain intact.

## Design
Render a disabled routed button as the existing disabled native button rather than an anchor. Enabled routed buttons remain anchors. Add a small any-pointer:coarse CSS rule for sidebar/menu row minimum heights and overlay close width/height. Do not change schema, navigation targets or runtime architecture.

## Implementation order
1. Review this proposal with a different provider.
2. Preserve matching desktop/touch baseline screenshots and measured control rectangles.
3. Change button rendering and touch CSS. Add focused disabled-markup coverage.
4. Run all CLI tests on Maxis, render real browser fixtures, click the disabled control and touch link/close edges, capture matching screenshots.
5. Pin the verified engine revision in the native consumer and repeat the iPad flow.

## Edge cases
An iPad with a mouse still has a coarse pointer available; any-pointer covers it. A disabled icon-only button keeps its accessible label. A disabled action wrapper must not navigate via a user click; browser flow verifies this, not markup alone.

## Non-goals
No automatic colour changes, new props, new widgets, pairing work or admin content changes. Primary-button contrast is a company-skin role correction through the app.

## Review decisions
Claude reviewed the proposal on Maxis (output retained in build evidence). Adopted native disabled button semantics, wrapper click guarding, real close-button dimensions, fine/coarse comparisons and overflow checks. Kept wrapper interaction metadata behind the disabled guard so state-bound re-enabling remains possible; stripping it would break that path. Corrected the existing disabled binding to target the native button rather than its wrapper. Touchscreen hybrid computers intentionally receive larger rows too; fine-pointer desktop density is unchanged. Broad catalogue touch sizing is not claimed from this focused fixture.

## Close-control follow-up
Real browser testing found the visible X had no click handler, and outside-dismiss tested containment in the full-screen modal root, so its backdrop never counted as outside. Claude reviewed the correction before implementation. Adopted direct-child selectors to avoid nested-overlay selector leakage, binding/unbinding the one close handler, and content containment for outside-dismiss. Kept existing idempotent close and handler guards; no new overlay manager or nested portal policy. No stopPropagation is needed for the dedicated close control.

## Overlay-selection follow-up
Native long-press on modal padding selected nothing. Overlay roots lacked source annotations because canonical overlays use content rather than component/kind/children, and the overlay resolver dropped the stamp. Claude reviewed source propagation before implementation. Adopted explicit stamping of the overlays collection rather than treating every content array as a node, and copied only string stamps through resolution. Added page/template owner and spoof-overwrite coverage; other content arrays remain unstamped.
