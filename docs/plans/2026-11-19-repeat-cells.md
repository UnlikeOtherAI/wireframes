# Repeat: one cell, an array of items

Status: designed and awaiting a different-provider review. Builds on
[2026-11-18-component-library-expansion.md](../done/2026-11-18-component-library-expansion.md),
including slots, `std.*` patterns and the item model.

## 1. Problem Statement

Repeated content (team members, pricing plans, stat tiles, cards in a grid) is
written today as N near-identical nodes. Every copy needs a unique id, the same props
and the same nesting.

A small model such as the iPad app's E2B fails and retries on exactly this:
- duplicate ids;
- one copy with a missing or misspelt prop;
- a copy nested one level off.

Editing one entry means finding and rewriting the right node.

The user asked for a list-view-like construct instead: bind an array to a single cell,
which can be a separate component, and render the cell once per item.

## 2. Current Behavior

- **Collection binding exists but is hard to use.** `binding: { source, itemVar }`
  (`engine/schema/schema.json` `Binding`, documented in `docs/cli/schema-systems.md` §14):
  - `source` names a page `dataSources` entry, which points at a dataset document in
    `data/<id>.yaml`.
  - At render time, `renderCollectionNode` (`engine/renderer/render-utils.js:52-110`)
    clones the bound node once per dataset item, and the renderer gives clones indexed
    ids (`engine/renderer/primitives.js:110-125`).
  - Props reach item fields through `{{item.field}}` tokens.
  - An author or model must therefore coordinate three places: a dataset file, a page
    `dataSources` entry and the bound node with its tokens.
- **Nothing uses it.** No authored YAML in `admin_wireframes`, `web_wireframes`,
  `wireframe_studio` or the gallery fixture uses `binding:`.
- **Validation and tooling never see the clones.** Validators, lint and source
  annotation see one bound node, never the rendered clones.
- **Fixed row shapes cover other cases.** `list`, `kanban`, `table` and similar elements
  take item arrays, but each has a fixed row shape and cannot use an arbitrary cell.

## 3. Desired Behavior

Any container node can declare a `repeat` with one `cell` and an inline array of
`items`. Each item is the props object of one cell. The repeated cells render in the
container's layout (stack, row or grid) exactly as if they had been written out by hand.
Validation, lint, `wf node`, `wf inspect`, the admin tree and selection, and the
measurement overlay all see the real cells. Adding an entry means appending an item, and
changing one means editing its fields.

```yaml
- id: team
  component: grid
  props: { columns: 3 }
  repeat:
    cell: person_card          # a registry element (card, stat, …) or a component id, including std.*
    items:
      - { name: Ada Lovelace, role: Admin }
      - { name: Grace Hopper, role: Editor, avatar: assets/grace.png }
      - { id: alan, name: Alan Turing, role: Viewer }
```

```yaml
- id: kpis
  component: row
  repeat:
    cell: stat                 # element cell: item keys are the element's props
    items:
      - { label: Revenue, value: $12.4k, delta: +8%, trend: up }
      - { label: Users, value: "1,204" }
```

## 4. Design

### 4.1 Grammar

- `repeat` is a node-level key, allowed on any node that has children: containers,
  elements whose frame renders children, template regions, overlay content roots, and
  nodes inside component definitions. It is `{ cell, items }`. Both are required, and
  no other keys are allowed.
- `cell` is a string. It is either a registry element name (or an element alias) or a
  component reference resolvable at that point, through local, imported or `std.*`
  lookup with the same rule as `use:`.
- `items` is an array of plain objects, at most 200 entries. Each object is the cell's
  props, with these keys reserved:
  - `id`: an optional authored id for that cell, matching the `Id` pattern.
  - `slots`, only when `cell` is a component: fills for that cell's slots, written as
    in §4.3 of the component library design.
- A node with `repeat` may also have authored `children`. Those render first and the
  repeated cells follow, so a header row can precede the cells.
- `repeat` and `binding` on the same node is an error, `REPEAT_WITH_BINDING`. They are
  two ways of repeating.

### 4.2 Expansion

The resolver expands `repeat` into children before validation, lint, addressing and
rendering. The pass is pure and deterministic:

```
for item i (0-based) in items:
  child.id = item.id ?? `${node.id}_${cellSlug}_${i + 1}`   # cellSlug: the cell's id with "." → "_"
  element cell:   { id, component: cell, props: item minus reserved keys }
  component cell: { id, use: cell, props: item minus reserved keys, slots: item.slots }
```

Rules:

- The expanded children are appended after any authored `children`.
- Component cells then go through normal component expansion, so their internal ids are
  namespaced under each cell's id and slots resolve with author scope, as for a
  hand-written `use:`.
- Expansion runs in the author scope of the node that carries `repeat`. A `repeat`
  inside a component definition expands with that definition's props substitution, so
  `items` may contain `{{props.x}}` tokens there. A page-level `repeat` gets no
  substitution.
- Generated ids are checked like authored ids, on the final page tree. A clash with an
  authored id, or between an item `id` and a generated one, is the existing
  `DUPLICATE_NODE_ID`, located at the item.
- `repeat` is removed from the expanded node, and each cell is stamped with its source
  path `…repeat.items[i]` (§4.4).

### 4.3 Validation and lint

Every rule runs on the expanded cells, so element cells get the existing prop contracts
(`UNKNOWN_PROP`, `UNKNOWN_PROP_VALUE`, the field and item rules) and component cells get
the slot rules. New codes, in a new `engine/doctor/repeat.js`:

| Code | Severity | When |
|---|---|---|
| `UNKNOWN_REPEAT_CELL` | error | `cell` is neither an element nor a resolvable component. The message suggests the nearest element or component. |
| `INVALID_REPEAT_ITEM` | error | An entry in `items` is not a plain object, or has an invalid `id`. |
| `REPEAT_ITEMS_LIMIT` | error | More than 200 items. |
| `REPEAT_WITH_BINDING` | error | Both `repeat` and `binding` on one node. |
| `REPEAT_SLOTS_ON_ELEMENT` | error | An item has `slots` but `cell` is an element. |
| `EMPTY_REPEAT` | info | `items: []`. The node renders its authored children only. |

The source linter (`engine/lint/source/*`) reports cell findings at the item's YAML
range (`…repeat.items[i].<prop>`), not at the generated node.

### 4.4 Editing, addressing and selection

- Source stamps on expanded cells name the authoring document and the path
  `…repeat.items[i]`. The `data-wf-source` id is the cell id.
- `wf node` and engine addressing treat an expanded cell as an addressable node whose
  props live in `items[i]`. `wf node update <cell address> --props …` edits that item
  object. `wf node remove` on a cell removes the item. `wf node add` inside a `repeat`
  node is refused, with a message to append to `items` instead.
- In the admin, the YAML tree walker shows the cells under the repeat node, labelled
  from the item. Clicking a cell selects it, and editing it edits the item.

### 4.5 Docs and agent guidance

- `docs/cli/schema.md` covers the node model (`repeat`) and `docs/cli/schema-systems.md`
  covers the grammar, expansion and codes. Update `schema-canonical.yaml` too, and the
  hand-written `Repeat` definition on `Node` in `schema.json`.
- `wf llm` and `--short` get one short section: when to use `repeat` (three or more
  similar siblings), its syntax and one example. The `--short` growth must stay within
  four lines; the iPad prompt budget depends on it.
- A gallery example on an existing page, in both modes: a grid of `stat` cells and a
  row of a small local component.

### 4.6 The iPad app

After the engine lands, the app's editing guide teaches `repeat` for repeated content.
The transactional edit operations need to append, update and remove an item in
`repeat.items`; any missing operation is added only if a real test needs it.

Conversations on the physical iPad must show that requests like these produce correct
results first time, without retries:
- "Add a team section with three people"
- "Add three pricing plans"
- "Add a fourth person"
- "Change Grace's role to Owner"

## 5. Implementation Order

1. Different-provider review of this document. Findings are appended with
   adopt/defer/reject decisions.
2. Engine tranche:
   - the grammar and the hand-written schema;
   - the resolver expansion, with source stamps;
   - the doctor rules and source-lint ranges;
   - addressing and `wf node`;
   - the admin YAML tree walker;
   - docs, `wf llm`, and the gallery example with baselines on both platforms;
   - tests.
3. Integration on `claude/component-library`, with full suites on Maxis and the Mac
   gallery.
4. Mobile follow-up: the guide, operations, evals and iPad conversations.

## 6. Edge Cases

- **Items with keys the cell does not declare:** the existing `UNKNOWN_PROP` warning on
  the expanded cell, located at the item key.
- **Item values with `{{item.x}}` tokens:** not supported. They render as literal text
  and lint reports them, because `repeat` items are plain props.
- **A `repeat` cell that is a component containing its own `repeat`:** allowed. It
  expands per instance. The recursion guard and the 50,000-node expansion budget still
  apply.
- **`repeat` on an element with no children frame** (e.g. `button`): an error,
  `REPEAT_ON_LEAF`.
- **Selection state:** `selected` in an item is an ordinary prop of the cell. List-style
  selection with `selection`/`primaryKey` stays with `binding`.
- **Determinism:** generated ids depend only on the parent id, the cell id and the index.
  Expansion never reads state or time.

## 7. Non-Goals

- No runtime data binding. `repeat` is authoring-time expansion; dataset-driven,
  state-aware repetition stays with `binding`.
- No inline cell templates with `{{item.x}}` tokens. A custom cell is a component.
- No sorting, filtering, paging or conditional items.
- No migration of `binding` to `repeat`, and no deprecation of `binding` in this change.
