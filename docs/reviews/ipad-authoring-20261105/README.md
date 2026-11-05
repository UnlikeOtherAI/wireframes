# Interactive previews and company assets

The shared renderer now supports company-logo slots, state-bound appearance controls, routed table cells, bounded scrolling and full-bleed pages. Navigation preserves readable selected colours, app bars render authored children, and coarse-pointer menu/icon/dialog controls use the chosen 44px target.

## Acceptance and source

Actual base: bce1df422bcc9562deb734a9b73bcbbe0ee00846. Tested implementation:56e4a3385c255af25a66709f02208e4f47272608. Later evidence-only commits do not change runtime code.

Windows Maxis: supported CLI command (`cd cli && node --test`)283/283; renderer 140/140. Mobile adapter integration 4862b9e: 215/215. The initial glob-limited CLI command covered 280 cases; the supported command also covered the remaining 3. Native builds and manual iPad-simulator checks are reported in the private mobile repository; no physical-device pass is claimed here.

| Capability | Chosen target and observed result |
| --- | --- |
| Selected dark navigation | Default, sidebar and rail card-mode contrast1.1005:1→14.6123:1; labelled selection cue retained. Explicit accent remains authoritative. |
| Touch actions | Coarse menu/icon36×36→44×44 CSSpx; compact Save32→44px high; modal Close14.52×18→44×44 and now dismisses. Desktop remains compact. |
| Appearance preview | Actual segmented selection, different local tab panels, text binding and validhex→picker synchronisation pass; invalid partialhex keeps last valid colour. |
| Layout | Explicit120px column retained; inset0 moves headerx16→0; record region scrolls240px while footer stays fixed. No horizontal overflow in 32 scene checks. |
| Routed records | Real table cell link opens details; list title/text/meta remain visible. |
| Company logos | Three slots, two skins and wide/portrait PNGs render with contain in300×120 containers; copied skins keep asset bytes. Native upload/switch/copy/restart is separately tested. |

All screenshots use neutral data on Maxis Chromium, matching fixtures and 1280×900 desktop or 390×900 coarse CSS viewports. A coarse viewport is not a physical iPad claim. New contracts have no supported base equivalent; their Before images show the actual legacy rendering of the same input. Icons, pill corners and crossed image placeholders already exist in this PR base, so their unchanged screens are omitted.

## Review and boundaries

The scoped source review found no new actionable security or architecture issue. Asset validation is bounded to three static PNG slots; native import normalises supported local images. Existing route/state contracts are reused; source annotations and rendered attributes remain escaped. This is not a whole-product security assessment.

The ordinary [apple-hig skill](https://github.com/justinwetch/HIGAgentSkills/blob/main/SKILL.md) review loaded all 16 foundations and the matched topics (32 files total), plus Buttons. Its colour guidance says “prefer system-provided color controls where available”; the native editor pairs the system picker with exacthex. The 44px web target is our measured design choice, distinguished from nativept and the source's qualified platform guidance. No enforcement mode was used.

Arbitrary authored skins can still have poor contrast; these measurements cover the named fixtures. The prototype contracts support selection state, text and visibility bindings; they do not implement a general runtime style-binding or business-data framework. Pairing is outside scope.

## Changed rendered states

Only materially changed states are paired. The final-only logo examples have no earlier supported state.

| Before | After |
| --- | --- |
| **nav-card · selected · 1280 desktop**<br>![Before](evidence/nav-card-selected-1280-before.png) | ![After](evidence/nav-card-selected-1280-after.png) |
| **nav-card · selected · 390 coarse**<br>![Before](evidence/nav-card-selected-390-before.png) | ![After](evidence/nav-card-selected-390-after.png) |
| **nav-line · selected · 1280 desktop**<br>![Before](evidence/nav-line-selected-1280-before.png) | ![After](evidence/nav-line-selected-1280-after.png) |
| **nav-line · selected · 390 coarse**<br>![Before](evidence/nav-line-selected-390-before.png) | ![After](evidence/nav-line-selected-390-after.png) |
| **nav-light · selected · 1280 desktop**<br>![Before](evidence/nav-light-selected-1280-before.png) | ![After](evidence/nav-light-selected-1280-after.png) |
| **nav-light · selected · 390 coarse**<br>![Before](evidence/nav-light-selected-390-before.png) | ![After](evidence/nav-light-selected-390-after.png) |
| **controls-card · closed · 1280 desktop**<br>![Before](evidence/controls-card-closed-1280-before.png) | ![After](evidence/controls-card-closed-1280-after.png) |
| **controls-card · dialog · 1280 desktop**<br>![Before](evidence/controls-card-dialog-1280-before.png) | ![After](evidence/controls-card-dialog-1280-after.png) |
| **controls-card · closed · 390 coarse**<br>![Before](evidence/controls-card-closed-390-before.png) | ![After](evidence/controls-card-closed-390-after.png) |
| **controls-card · dialog · 390 coarse**<br>![Before](evidence/controls-card-dialog-390-before.png) | ![After](evidence/controls-card-dialog-390-after.png) |
| **controls-line · closed · 1280 desktop**<br>![Before](evidence/controls-line-closed-1280-before.png) | ![After](evidence/controls-line-closed-1280-after.png) |
| **controls-line · dialog · 1280 desktop**<br>![Before](evidence/controls-line-dialog-1280-before.png) | ![After](evidence/controls-line-dialog-1280-after.png) |
| **controls-line · closed · 390 coarse**<br>![Before](evidence/controls-line-closed-390-before.png) | ![After](evidence/controls-line-closed-390-after.png) |
| **controls-line · dialog · 390 coarse**<br>![Before](evidence/controls-line-dialog-390-before.png) | ![After](evidence/controls-line-dialog-390-after.png) |
| **appearance · initial · 1280 desktop**<br>![Before](evidence/appearance-initial-1280-before.png) | ![After](evidence/appearance-initial-1280-after.png) |
| **appearance · changed · 1280 desktop**<br>![Before](evidence/appearance-changed-1280-before.png) | ![After](evidence/appearance-changed-1280-after.png) |
| **appearance · initial · 390 coarse**<br>![Before](evidence/appearance-initial-390-before.png) | ![After](evidence/appearance-initial-390-after.png) |
| **appearance · changed · 390 coarse**<br>![Before](evidence/appearance-changed-390-before.png) | ![After](evidence/appearance-changed-390-after.png) |
| **geometry · initial · 1280 desktop**<br>![Before](evidence/geometry-initial-1280-before.png) | ![After](evidence/geometry-initial-1280-after.png) |
| **geometry · scrolled · 1280 desktop**<br>![Before](evidence/geometry-scrolled-1280-before.png) | ![After](evidence/geometry-scrolled-1280-after.png) |
| **geometry · initial · 390 coarse**<br>![Before](evidence/geometry-initial-390-before.png) | ![After](evidence/geometry-initial-390-after.png) |
| **geometry · scrolled · 390 coarse**<br>![Before](evidence/geometry-scrolled-390-before.png) | ![After](evidence/geometry-scrolled-390-after.png) |
| **data · labels-links · 1280 desktop**<br>![Before](evidence/data-labels-links-1280-before.png) | ![After](evidence/data-labels-links-1280-after.png) |
| **data · labels-links · 390 coarse**<br>![Before](evidence/data-labels-links-390-before.png) | ![After](evidence/data-labels-links-390-after.png) |
| **logos-blue-1280-after**<br>No prior equivalent for company-logo slots. | ![After](evidence/logos-blue-1280-after.png) |
| **logos-blue-390-after**<br>No prior equivalent for company-logo slots. | ![After](evidence/logos-blue-390-after.png) |
| **logos-purple-1280-after**<br>No prior equivalent for company-logo slots. | ![After](evidence/logos-purple-1280-after.png) |
| **logos-purple-390-after**<br>No prior equivalent for company-logo slots. | ![After](evidence/logos-purple-390-after.png) |
