# Company logo rendering

Company logos are optional on each named skin: `logos` maps only `logo_1`, `logo_2` and `logo_3` to `{name, src}`. Names are nonempty and at most 80 characters. Sources are static PNG data URLs, at most 256 KiB decoded and 1024 pixels per side. An image uses `props: {kind: logo, slot: logo_1, width: 160, height: 64}`. Width and height size the container in points (positive, at most 4096); the logo preserves its aspect ratio inside it. Switching skin resolves the same slot from that skin. Missing slots keep a labelled placeholder and the same box. Asset bytes belong in the skin, never in node props or model context.

Native imports accept PNG, JPEG and HEIC, downsample and normalize orientation/alpha, then persist PNG. A skin carries up to three independent labelled slots. Uploading or replacing a draft does not save until the existing skin Save action; Cancel discards it. Copying a skin copies its assets.

The pure renderer checks the PNG source again at its boundary. It rejects remote URLs, SVG, animated PNG, invalid PNG framing, oversized dimensions and oversized payloads. Invalid assets cannot become an image source. Diagnostic messages describe the contract without echoing data URLs.

Logo containers use explicit outer width/height and an inner image with `object-fit: contain`. The box is capped by the available parent width. The missing-slot placeholder has the same dimensions, so switching to Wireframe or a skin missing that slot does not shift surrounding content. Ordinary unbound `src` images retain their previous behavior.

Annotated rendering adds canonical component/variant metadata to nodes so a native preview can open the matching role inspector. These attributes are absent unless `annotateSource: true`.
