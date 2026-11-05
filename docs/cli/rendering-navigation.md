# Navigation rails and panel colours

Use nav.props.variant: rail for a compact primary rail, or sidebar for coloured
side navigation. Omitting variant preserves the existing navigation treatment.
Rail uses sidebar.collapsedWidth (64px by default); size.width overrides it.
Its whole icon-and-label tile is clickable and at least 44×44px. iconStyle on
items supports solid, regular and brands. Long labels retain their accessible name.
collapsed hides the rail caption visually while preserving its accessible name.

Company skins can use nav.rail and nav.sidebar roles. Explicit nav/app_bar
backgrounds paint the panel, including background set on the node itself.
Inherited page/skin defaults alone preserve transparent legacy panels. A selected
rail icon box or sidebar row uses accent for its fill and text for its foreground;
choose a pair with at least 4.5:1 contrast. The no-variant selected style is unchanged.
