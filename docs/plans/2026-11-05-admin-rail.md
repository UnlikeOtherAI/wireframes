# Admin navigation rail

## Problem statement
The Nessie reference has a 64px primary rail with five icon-and-label targets.
A normal nav lays its icon and label horizontally; collapsed hides the label.
The screenshot reproduction cannot match that region with either mode. Composing
separate icons, captions and click handlers would add many nodes for the tiny model.

## Current behavior
See engine/renderer/primitives/navigation.js and styles/navigation.js.
nav has items/collapsed/groups and no variant. navItem ignores item.iconStyle.
The design-system catalogue exposes nav text/accent, but no background control.
Frameless nodes do not paint their own background in skinShellStyle.

## Desired behavior
Keep existing nav output and geometry unless a new variant or explicit nav colour
is used. Support optional props.variant: rail|sidebar, leaving the default unset.
Rail stacks a Free icon above its visible label in a 64px-wide navigation, with
targets at least 44x44px, working route links, active state and accessible names.
Sidebar remains the usual horizontal rows, with explicit company colours.
Both new variants are standard design-system roles. Existing nav base roles still
apply before a variant role. No new primitive or native editor view is needed.

## Design
Use the existing nav markup, route/active handling and variant registry.
Add rail CSS; set its default width only when the author has not set size.width.
Preserve collapsed behaviour and explicit widths. Forward item.iconStyle.
Expose nav background in catalogue capabilities. Paint a nav background only
when explicitly supplied locally or by its base/variant role; inherited page
background alone must preserve transparent legacy nav output.
For explicit new variants, a selected row can use accent as its background and
text as its foreground; keep legacy no-variant selected painting unchanged.
Use existing pane metadata for flexible main panels; do not invent another
layout system. The mobile edit bridge needs to allow setting the existing pane.

## Implementation order
Review this contract, then registry/rendering/paint/CSS, schema/docs regeneration,
browser fixtures, engine checks, mobile pin and real simulator/iPad click-through.

## Edge cases
No icon must still leave a readable label. Long labels may truncate visually but
keep the full accessible link name. Regular/brands icons must use their own style.
Explicit sizes win. Group/nested rows keep working. A missing route stays a
placeholder; a valid route must navigate. Background defaults must not change
legacy company-skin navs without an authored nav background.

## Non-goals
No pairing, new identity flow, general style editor, new primitive, dynamic
component registry, or CSS framework. No arbitrary icon SVG enters model context.

## Review decisions
Claude reviewed the contract and refinement read-only on Maxis before implementation.
- Adopt: no default variant; preserve nav base-role inheritance and normal output.
- Adopt: explicit background provenance excludes skin defaults and page style.
  Restrict shell painting to nav/app_bar; broader painting would box inner controls.
  Store this capability in the existing primitive registry, shared by catalogue
  and resolver, rather than duplicate allowlists or add another registry.
- Adopt: suppress accent-text propagation for selected new variants; rail fills
  the icon box, sidebar fills the row. Legacy selected painting stays unchanged.
- Adopt: collapsed-width token, authored sizes, 44pt targets, Free styles and routes.
- Adjust: compare legacy node markup/computed geometry, since adding stylesheet
  rules necessarily changes full inline-HTML bytes.
- Adopt: explicit nav/app_bar backgrounds become visible; default-only skins
  remain transparent. Expose those backgrounds without adding a nav border field.
- No-icon rail entries retain a visible, bold label without an icon selection box.
- Native touching/Files/colour checks remain required and are not provider-tested.

The refinement review rejected painting all frameless wrappers: inner controls
already paint their own boxes. Adopt the two registry shell-background
capabilities only. Rail selection fills its 40px icon box; the 64px link remains
the target. Use existing row/pane metadata for the main panel.
