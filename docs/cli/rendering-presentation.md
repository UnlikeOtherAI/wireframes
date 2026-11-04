# Icons and control decoration


wf icons search queries the installed Font Awesome Free catalogue without printing the catalogue.
Standalone icons and button/input decorations support solid, regular and brands when the chosen name offers that style.
UNKNOWN_ICON and ICON_STYLE_UNAVAILABLE report bad names/styles; use search results rather than guessing.
Button iconPosition: end puts its icon after the label; center uses an icon-only action with an accessible label.
A centred empty input decoration is pointer-transparent; the native input retains its full hit area.
Explicit node-local corner.style: pill applies after platform/mode rules to that node's painted parts, without making all descendants pills.
Sticky nodes remain in flow, stick within their scroll container and do not need JavaScript.
Image descriptions stay visible without hovering, and are exposed as accessible image names.

App-bar child nodes render in the same row after built-in title/actions, preserving their IDs and interactions. Sticky app bars have an opaque fill. Button glyphs inherit the painted button text colour. Routed buttons use actual anchors in CLI/browser output as well as the native host.

Without an explicit style, the Free font stack falls back to the bundled Brands face for brand-only glyphs. Explicit unavailable styles still produce ICON_STYLE_UNAVAILABLE. Template-bound names are checked after resolution, not rejected as literal icon names.
