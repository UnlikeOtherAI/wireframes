# Routed table link cells

Status: implemented and verified in portable Chromium and CLI interfaces; native host selection remains an integration check.

## Problem Statement
A table column with kind: link paints a link-like span. A prototype cannot open a detail from its named cell.

## Current Behavior
engine/renderer/primitives/table.js converts every cell to a string and returns a span for link columns. table-columns.js already preserves kind: link. The registry allows arbitrary rows arrays, but defines no routed cell representation. Existing routeTable and navigationAttrs drive normal prototype navigation. No working table pagination or row-action API exists.

## Desired Behavior
In a link column, a cell {text: "Device A", route: device_a} renders a real named anchor when the route exists. It works with both keyed and positional rows. Existing scalar cells and unknown routes stay inert and preserve current appearance.

## Design
Interpret objects only for kind: link. Require string text and route; trim the route id. Look it up as an own routeTable property. Use navigationAttrs with the escaped label. Never accept raw cell href/HTML, infer a row action, or evaluate route expressions.
Allow only local route-table URLs: relative paths, root paths and fragments; reject protocol-relative URLs, backslashes, whitespace/control characters and schemes. This check is local to new table links and does not refactor unrelated navigation.
Keep scalar link cells exactly as today. Invalid route objects show escaped text when it is a string; malformed objects have empty text. The standard runtime/navigation data attribute remains authoritative.
Document the optional cell shape within existing untyped rows; no new top-level props or schema version. Update registry summary/generated schema description and canonical/reference/rendering docs together.
Add a narrow table-link class with a 44px minimum touch target on coarse pointers while keeping desktop cell sizing unchanged.

## Implementation Order
1. Different-provider adversarial review; record adopt/defer/reject decisions.
2. Add cell navigation, neutral schema/render tests and mouse/touch browser journeys.
3. Test missing/hostile routes and inert scalar compatibility. Capture matching base/final desktop and touch fixtures.
4. Run full pnpm test on Maxis; regenerate catalogue if CSS changes; commit and push.

## Edge Cases
Unknown route, inherited route property, unsafe route-table URL, quote/markup labels, positional/keyed rows, missing text, empty text, mixed text/link columns, unchanged scalar tables. Test keyboard Enter and actual destination/return; ensure no duplicate node identity or nested anchors.

## Non-Goals
No row clicks, dataset/pagination framework, real pairing, global link sanitizer refactor, native UI, template cloning, or private reference data in public tests.

## Provider review decisions
Claude Sonnet reviewed this plan in a no-tools read-only request on Maxis; raw output is preserved in the owned ignored build/table-link-review.json.
- Adopt URL defence in depth for this new cell contract, including control/whitespace/backslash/scheme rejection and explicit percent-encoded relative-path tests. Existing navigation stays unchanged.
- Adopt own-property lookup and trimmed emitted route ids. Reject Map support: the existing renderer contract is a plain routeTable object.
- Clarify object cells intentionally replace prior [object Object] output. Numeric text is inert readable text; only a nonempty string text can become a link.
- Defer new route lint/graph infrastructure. Existing semantic navigation checks inspect interaction.targetRoute, while ORPHAN_ROUTE checks sitemap routes against pages (not reachability); this bounded change does not alter those. Unknown cell routes are visibly inert and documented.
- Adopt visible accessible names, keyboard/mouse/touch, focus, no nested anchors and no introduced cell ids. Reject new per-cell ids: none are needed, so there is no new identity collision surface.
- Adopt inline-flex 44px coarse targets and assertions for hit geometry and surrounding padding. Keep desktop sizing unchanged.
- Adopt static/browser render parity, line/card and overlay fixtures, hostile labels/routes and scalar compatibility. Native selection mode remains root's integration verification; the same route-target attribute supports its existing interception.
- Adopt complete schema/reference/brief/rendering documentation and generated guide/catalogue synchronization.
- Reject splitting table.js solely on speculation: it is under 200 lines before this small addition and remains well below the 500-line limit.
- Capture only the new routed-cell state before/after at matching viewports; private project data stays out of the public fixture.

## Measured verification
- Maxis engine source 567906e: full pnpm test 270/270; three durable browser tests cover keyed/positional cells, line/card mouse/keyboard/touch navigation/return, 44px coarse targets, hostile/missing routes and labels, and overlay open/dismiss.
- Actual CLI quickstart-copy fixture: wf validate and wf build passed; clicking Device A in built overview.html opened team.html, then Overview returned to overview.html. No server or private input was used.
- Matching neutral screenshots at desktop 1280×800 and touch 768×1024 were captured from actual base 4eda010 and implemented code; desktop before/after inspected. Artifacts remain in the assigned external table-links directory.
- Catalogue regenerated. The first full test found only a Windows output-encoding error in a regenerated guide; regenerating through Node byte output restored exact UTF-8 and the complete rerun passed.
- New object cells intentionally replace [object Object] with their text. Scalar link cells remain inert and unchanged. No native/iPad, row-click, runtime pagination or unknown-route warning claim.
