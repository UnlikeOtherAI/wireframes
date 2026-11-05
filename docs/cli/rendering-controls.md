# Presentation and interactive controls

See [icons and control decoration](rendering-presentation.md) and [named company skins](design-system.md).

Navigation rails and panel colours: [rendering-navigation.md](rendering-navigation.md). Company logo boxes and skin switching: [rendering-logos.md](rendering-logos.md).

An app_bar with children and no title/leading/actions uses those children as its complete bar content; use real button children for working controls.

### Interactive appearance fields
Segmented controls and local `tab_bar` items are native toggle buttons.
Clicking, tapping, Space or Enter changes the active option and `aria-pressed`.
Their unique labels are selection values. With
`selection: {scope: page, stateKey: preview}`, choices write existing page
state; `scope: app` uses session-backed app state. Existing state wins over
`segmented.props.value` or `tab.active`. Use `visibility.condition` with
`state_equals` to show the matching preview panel. Routed tabs keep navigation;
unresolved routes do not become local choices. Unbound groups keep local
selection for the rendered page only.

An `input` with `inputType: color` renders a native colour picker and a labelled
hex field. It accepts exactly `#RRGGBB`; incomplete text remains editable and
does not update a linked state value. Valid hex preserves its authored case.
The picker, hex field and segments have at least 44px coarse-pointer targets.

For editable preview text, use `props.value: "{{state.launcherText}}"` on the
input and `props.label: "{{state.launcherText}}"` on the preview button.
The equivalent explicit `stateBindings.value` is supported. Exact
`state.key` / `appState.key` value bindings are writable on input changes;
other expressions remain read-only. This is ephemeral prototype state, never
an edit to the source design. Native picker dialog appearance depends on the
browser and operating system.


### Table link cells

A table column with `kind: link` accepts a cell `{text: "Device A", route: device_a}`.
Use it in either keyed rows or positional arrays. The route is an existing sitemap route id;
the renderer uses the route table and emits the normal navigation attributes. A nonempty
string text becomes the accessible link name. Scalar cells keep their existing inert
appearance. Unknown routes, malformed cells and unsafe route-table URLs remain inert
text. This adds no row-click or pagination behavior; table pagination remains illustrative.
Link cells do not accept raw HTML or href values. Relative internal paths and fragments
are supported; schemes, protocol-relative URLs, backslashes and whitespace are rejected.
