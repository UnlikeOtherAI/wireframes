# State attributes and ARIA

How a rendered element shows state: disabled, read-only, required, invalid,
loading, pressed, checked, selected, current and expanded. The props that set
these states are in [schema-systems.md §15.4–15.5](schema-systems.md).

## One serializer

`stateAttrs(state, { owner })` in `engine/renderer/render-attrs.js` (also
`lib.stateAttrs`) writes every state attribute. Renderers do not write these
attributes by hand. It returns a string with a leading space, or `''`, ready to
drop into a tag:

```js
`<button class="wf-act"${lib.stateAttrs({ pressed: true }, { owner: lib.STATE_OWNERS.toggle })}>Bold</button>`
// <button class="wf-act" aria-pressed="true" data-wf-pressed>Bold</button>
```

A state is on only when it is `true`; `checked` and `pressed` may also be
`'mixed'`. Any other value, absent included, is off. Attributes come out in a
fixed order (native, then ARIA, then data, each in the state order above), so
the same input always gives the same markup.

## Data attributes

Every state that is on gets a presence-only `data-wf-<state>` attribute on the
owning element, whatever the owner:

| State | Attribute |
|---|---|
| disabled | `data-wf-disabled` |
| readonly | `data-wf-readonly` |
| required | `data-wf-required` |
| invalid | `data-wf-invalid` |
| loading | `data-wf-loading` |
| pressed | `data-wf-pressed`, or `data-wf-pressed="mixed"` |
| checked | `data-wf-checked`, or `data-wf-checked="mixed"` (indeterminate) |
| selected | `data-wf-selected` |
| current | `data-wf-current` |
| expanded | `data-wf-expanded` |

A state that is off writes no data attribute. CSS and tests select on these
attributes, never on ARIA.

## Owners: native and ARIA attributes

Each renderer picks the element that owns the state, usually the focusable
control rather than the node shell around it, and passes an owner describing
what that element supports:

- `native`: states written as bare HTML attributes. Only `disabled`,
  `readonly` and `required` can be native. A native state is never repeated as
  ARIA.
- `aria`: a map from state to the ARIA attribute the owner's role supports.
- `current`: the `aria-current` token (`page`, `step`, `true`).

States the owner does not list get the data attribute only.

Toggleable states (`pressed`, `checked`, `selected`, `expanded`) keep explicit
false ARIA: an owner that supports one writes `aria-pressed="false"` when the
state is off or absent. Supporting it is what makes the element a toggle. The
other states write ARIA only when on. If two states map to one ARIA attribute,
the first in state order wins.

`STATE_OWNERS` holds the shared presets:

| Owner | Element | Native | ARIA |
|---|---|---|---|
| `button` | a `<button>` that does not toggle | `disabled` | `loading` → `aria-busy` |
| `toggle` | a `<button>` that toggles | `disabled` | `pressed` → `aria-pressed`, `loading` → `aria-busy` |
| `tab` | tab and segment buttons | `disabled` | `selected` → `aria-pressed` |
| `field` | `<input>`, `<textarea>` | `disabled`, `readonly`, `required` | `invalid` → `aria-invalid` |
| `select` | `<select>` | `disabled`, `required` | `readonly` → `aria-readonly`, `invalid` → `aria-invalid` |
| `check` | role `checkbox`, `radio` or `switch` | none | `checked`, `disabled`, `readonly`, `required`, `invalid` |
| `link` | a navigation link | none | `current` → `aria-current="page"`, `disabled` → `aria-disabled` |
| `item` | a display-only row | none | `current` → `aria-current="true"`, `disabled` → `aria-disabled` |
| `disclosure` | a tree row or accordion head | none | `expanded` → `aria-expanded`, `disabled` → `aria-disabled` |

Spread a preset to change its token, for example
`{ ...STATE_OWNERS.item, current: 'step' }` for stepper steps.

## Rules

- Existing tab and segment buttons keep their `<button>` and `aria-pressed`
  semantics.
- Display-only `menu`, `command` and `menubar` render plain lists with
  `aria-current` and `aria-disabled` only. They get no `menu` or `listbox`
  roles, because no keyboard behaviour ships.
- `readonly` with `disabled`: both are written; `disabled` wins visually.
- An element with both `indeterminate` and `checked: true` passes
  `checked: 'mixed'`: indeterminate wins.
- Runtime code that changes a state (segmented, toggles, toolbar pressed, tabs)
  updates the data attribute and the ARIA attribute together.

## Actions

`lib.actionButtons` renders every action row: `page_header.actions`, and the
`actions` in the head block of `card`, `section` and `form`:

| Action | Markup |
|---|---|
| Plain | `<button class="wf-act wf-button-<variant>">` |
| Routed to a known route | `<a class="wf-act …" href="…" data-wf-route-target="…">` |
| Routed to an unknown route | a plain `<button>` |
| `disabled: true` | a `<button>` with `aria-disabled="true" data-wf-disabled`, never a link |
| `pressed: true` or `false` | a toggle `<button>` with `aria-pressed`; on a link, `data-wf-pressed` only |
| `tone: info`, `success`, `warning` or `danger` | adds `wf-tone-<tone>`, which colours the label (and the edge in line mode) |

A disabled action is drawn at half opacity, and a pressed one with a sunken
fill. An action that uses none of these keys renders exactly as before.
