# Browser component imports

## Problem statement

The browser renderer selects a single components document and ignores imports.
A virtual package cannot share component modules using the filesystem engine's format.

## Current behavior

`engine/component-registry/index.js` resolves filesystem imports and namespaces.
`renderer/src/document-map.ts` replaces the component map for every components file.

## Desired behavior

Browser projects resolve relative component imports with the same namespaces,
conflicts and cycles as filesystem projects. Page-local imports remain page-local.

## Design

Extract the existing registry traversal into an I/O-free core. Keep its filesystem
adapter and add a virtual-file adapter for the browser. Build a component registry
for each page from the project registry, template imports and that page's imports.
The engine selects that registry while rendering the page. Virtual paths cannot
escape their package or load network/filesystem resources; traversal is bounded.

## Implementation order

1. Extract the shared resolver while preserving the filesystem interface.
2. Resolve virtual modules and pass per-page registries to the engine.
3. Exercise imported rendering, cycles, conflicts, path refusal and shared updates.
4. Verify browser rendering and existing CLI/renderer checks on Maxis.

## Edge cases

Missing modules, cyclic imports, invalid aliases and conflicting qualified IDs
refuse rendering. Two pages may use the same alias for different modules.

## Non-goals

No network imports, schema changes, new renderer or filesystem access in browsers.

## Verification

On Windows Maxis, renderer tests passed 140/140 and the complete CLI suite passed
243/243 at `e47bc449dc220b088a00985b3faf7d446e3255bb`, with no skips. CLI text
fixtures used LF line endings. Nessie's browser journeys also rendered nested
imports and live module changes at desktop and phone widths using this engine.

Four adversarial review/fix rounds ended with a clean fourth review. The browser
adapter keeps shared, page and module reference contexts separate; module
previews use qualified IDs and check the actual synthetic page graph before
rendering. Traversal, shared-map copying and expansion are bounded. Tests cover
legacy singleton component files, namespace conflicts, cycles, path refusal,
page alias isolation, and the expansion bypasses found during review.
