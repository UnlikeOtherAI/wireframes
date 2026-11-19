# Component library expansion: review evidence

This adds new elements, a shared item and field contract, component slots, eight
built-in `std.*` patterns, `repeat` (one cell per keyed item) and a measurement overlay. Existing YAML keeps its markup;
the only additions are state and ARIA attributes. Existing pixels are unchanged
except for the fixes listed below. The design and every decision made while
building it are in
[2026-11-18-component-library-expansion.md](../../done/2026-11-18-component-library-expansion.md).

## Revisions and hosts

- Before: `origin/main` at `eeebd2b`.
- After: `claude/component-library`, captured at `5b4beea`. The two navigation pages
  were recaptured at `172100b` to show `repeat`. Other later commits change runtime
  behaviour, validation and docs only; both gallery baseline sets regenerate unchanged.
- Screenshots: Maxis (Windows 11) with Playwright Chromium. Gallery and pattern pages
  are captured at 1280×900, full page. The admin editor is captured at 1600×1000, with
  both revisions' Vite servers and a Playwright-mocked API serving the same two-page
  demo project. No real account or data was used.
- Final suites on Maxis at `172100b`:
  - CLI 714/714.
  - Renderer 152/152; the bundle is 445 KB against a 460 KB budget.
  - Admin: everything passes except the two `projectSettingsPage.test.tsx` failures
    that also fail on `main`.
- macOS gallery tests: 8/8 on the Mac mini.
- The user's iPad (iPad Air 13 M3, real on-device E2B model, engine `7c14f6f`, app
  branch `claude/component-library-mobile`):
  - 27-turn suite: 26/27 correct, against 15/27 for the installed app.
  - Mean time per turn: 6.8 s, against 15.1 s.
  - Peak memory: 496 MB, against 547 MB.
  - `repeat` requests: 8/8 correct.

## Visible changes on existing elements

These changes are deliberate:

- A `choice_group` row selected by `value` now draws its dot. It was selected, but the
  dot was never drawn.
- A stepper shows its `help` text. It was silently dropped.
- Disabled toolbar items use 0.5 opacity, which is 0.45 on `main`.

Everything else on existing gallery pages renders as before. Pages only grow, because
new examples are appended below the existing ones.

## Before and after

| Before | After |
| --- | --- |
| **Admin editor, preview toolbar** (desktop)<br>![Before](evidence/admin-editor-base.png) | Measure toggle on: pinned card and distance<br>![After](evidence/admin-editor-head.png) |
| **Controls** (card mode)<br>![Before](evidence/gallery-forms-base.png) | Field states, help and error, read-only, indeterminate, two-thumb range, pressed buttons, toolbar<br>![After](evidence/gallery-forms-head.png) |
| **Navigation**<br>![Before](evidence/gallery-navigation_elements-base.png) | Item states, `command`, `menubar`, `nav variant: top`<br>![After](evidence/gallery-navigation_elements-head.png) |
| **Charts and structures**<br>![Before](evidence/gallery-charts-base.png) | `chart gantt` with ticks, tones, a milestone, placeholders and the empty state<br>![After](evidence/gallery-charts-head.png) |
| **Containers**<br>![Before](evidence/gallery-containers-base.png) | Card actions: routed, disabled and danger-toned<br>![After](evidence/gallery-containers-head.png) |
| **Data**<br>![Before](evidence/gallery-data-base.png) | List, tree and accordion item states<br>![After](evidence/gallery-data-head.png) |
| New page; no earlier equivalent | **App navigation** (card mode), everything inside the 1280×900 screenshot, including `repeat` rows<br>![After](evidence/gallery-app_navigation-head.png) |
| New page; no earlier equivalent | **Line navigation** (line mode)<br>![After](evidence/gallery-line_navigation-head.png) |
| New feature; no earlier equivalent | **Measurement overlay** in a standalone page (`m` key): width, height, padding and gap bands<br>![After](evidence/measure-hover.png) |
| New feature; no earlier equivalent | **`std.site_header`, `std.hero`, `std.site_footer`** in a scratch project, line mode<br>![After](evidence/std-landing.png) |
| New feature; no earlier equivalent | **`std.data_page`** with a filled `filters` slot<br>![After](evidence/std-customers.png) |
| New feature; no earlier equivalent | **`std.login`** with an extra field in its `fields` slot<br>![After](evidence/std-login.png) |

## Also checked by hand, without screenshots

- Through `wf serve` in Chromium:
  - Submit payloads of every drawn control, including read-only and disabled ones.
  - Disabled routed actions do not navigate.
  - A form never submits natively.
- Slot forwarding through two layers. Two instances of a component keep their own
  form targets.
- `wf component copy` keeps comments and refuses paths outside the project.
- Measurement on a disabled control, an open modal and a timed overlay, plus drag
  cancellation.
- In the admin preview, the Measure toggle survives device, mode and page changes and
  reloads.
