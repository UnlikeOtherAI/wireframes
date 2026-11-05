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
