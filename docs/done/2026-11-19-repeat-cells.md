# Repeat: one cell, an array of keyed items

Status: implemented on 19 November 2026 (branch `claude/component-library`); §8 is the design review and §9 the implementation decisions. Builds on
[2026-11-18-component-library-expansion.md](2026-11-18-component-library-expansion.md),
including slots with author scope, the definition lookup, `std.*` patterns and the item
model.

## 1. Problem Statement

Repeated content, such as team members, pricing plans, stat tiles and cards in a grid,
is written today as N near-identical nodes. Every copy needs a unique id, the same props
and the same nesting.

A small model such as the iPad app's E2B fails and retries on exactly this. It produces
duplicate ids, a copy with a missing or misspelt prop, or a copy nested one level off.
Editing one entry means finding and rewriting the right node.

The user asked for a list-view-like construct: bind an array to a single cell, which can
be a separate component, and render the cell once per item.

## 2. Current Behavior

`binding: { source, itemVar }` (schema `Binding`; `docs/cli/schema-systems.md` §14) is
a runtime collection:
- `source` names a page `dataSources` entry, which points at a dataset document in
  `data/<id>.yaml`.
- At render time, `renderCollectionNode` (`engine/renderer/render-utils.js:52-110`)
  clones the bound node once per dataset item, with index-suffixed ids
  (`engine/renderer/primitives.js:109-129`). A table consumes the rows directly.
- `{{item.field}}` tokens reach the item's fields. `itemVar` defaults to `item`.
- Validators, lint and source annotation see the one bound node, not its clones.

To use it, an author or model must coordinate three places: a dataset file, a page
`dataSources` entry, and the bound node with its tokens. The three wireframe projects
(`admin_wireframes`, `web_wireframes`, `wireframe_studio`) and the gallery fixture never
use it. Only the CLI showcase test fixture does
(`cli/test/fixtures/showcase-project/pages/admin_dashboard.yaml:383`).

`list`, `kanban`, `table` and the other item-array elements have fixed row shapes. None
of them can render an arbitrary cell.

## 3. Desired Behavior

A concrete container node can declare `repeat` with one `cell` and an array of keyed
`items`. Each item is one cell's props plus a short `id` that stays stable when items are
inserted, reordered or removed.

The cells behave exactly as if their children had been written out by hand, in the
container's layout. They have the same ids, author scope, form references, validation,
lint ranges, `wf node` edits and admin selection. Adding an entry means appending an
item, and changing one means editing its fields, addressed by its id.

```yaml
- id: team
  component: grid
  props: { columns: 3 }
  repeat:
    cell: person_card            # a registry element or a component reference, including std.*
    items:
      - { id: ada, name: Ada Lovelace, role: Admin }
      - { id: grace, name: Grace Hopper, role: Editor }
      - { id: alan, name: Alan Turing, role: Viewer }
```

```yaml
- id: kpis
  component: row
  repeat:
    cell: stat
    items:
      - { id: revenue, label: Revenue, value: $12.4k, delta: +8%, trend: up }
      - { id: users, label: Users, value: "1,204" }
```

These render as children `team__ada`, `team__grace`, `team__alan` and `kpis__revenue`,
`kpis__users`.

## 4. Design

### 4.1 Grammar

- **Shape.** `repeat: { cell, items }`. Both keys are required, and no other keys are
  allowed. The schema enforces the shape:
  - `cell` is a non-empty string.
  - `items` is an array of 0–200 objects.
  - Each object has a required `id` and then any props.
- **Item ids.** `id` matches the `Id` pattern. It is unique within one `repeat` and is
  the item's stable key.
- **No other reserved keys.** Items are keyed maps only: no scalar shorthand and no
  per-item `slots` in v1.
- **Where `repeat` may appear.** On a concrete `component:` node that renders its
  children:
  - in template region children, page slot content, injection content and overlay
    `content` arrays;
  - in component definitions, including slot fallback children and slot fill arrays.
- **Where `repeat` may not appear.** The doctor rejects it (`REPEAT_INVALID_HOST`) on:
  - `use:` nodes, injectable markers and slot placeholders;
  - template region records and overlay wrapper records;
  - elements whose renderer does not render authored children. Examples are `button`,
    `input` and a `tab_bar` that has authored `tabs`. The list of child-rendering
    elements comes from the renderer's own behaviour, and a test asserts it.
- **Cell classification.** `cell` is classified once, at authoring time.
  - A registry element name or element alias wins.
  - Otherwise it is a component reference, resolved by the same rule and at the same
    qualification stage as `use:`. That covers a local id, an `alias.id` import,
    `std.*`, a module-local `std` alias and its built-in fallback.
  - A component that shares a name with an element is reached with a qualified
    reference.
  - An authored `builtin:` prefix is rejected.
- **Existing children.** Authored `children` on the host render first. The repeated
  cells follow them.

### 4.2 Expansion stage and author scope

The host's author expands repeated rows into synthetic children, in that author's scope,
at the point where hand-written siblings would be processed:

- **Rows in a component definition** are materialized after the definition's
  author-scope `{{props}}` substitution. That happens before its namespace and
  reference pass and before placeholder splicing. The rows therefore get the
  definition's substitution and are namespaced under each instance like any authored
  child, and references between them and their authored siblings are rewritten
  together.
- **Rows in caller-owned content** (page content, or a fill a caller writes) are
  materialized during caller-side preparation, before the callee is pushed onto the
  component stack. The existing marker splicing then carries them opaquely, as for any
  prepared fill.
- **Each row** becomes `{ id: <host id>__<item id>, component: <cell>, props: <item without id> }`
  for an element cell, or the same with `use: <qualified cell>` for a component cell.
  - Component cells then expand normally. Their internals are namespaced under the row
    id, and their submit buttons follow their own form.
  - A sibling in the same author scope may reference a row by its public id, for
    example `formId: team__ada` or an overlay `trigger`. It is rewritten with the
    rest of that scope.
  - Item props cannot author element-level `interaction`. A row that needs one is a
    component cell.
- **Ids.** The separator is `__`. Ids are checked on the final page tree, so a composite
  id that collides with an authored id is `DUPLICATE_NODE_ID`, located at the item.
- **Provenance.** Every row carries a record: its author document and file, the host's
  authored path, the item id, the current index and the rendered id. Validation,
  lint, addressing, `wf inspect`, the admin and source stamps
  (`data-wf-source-path` `…repeat.items[i]`) all use it.
- **Budget.** Expansion charges every materialized node, including each component
  cell's full expansion, against a shared budget. The budget applies on the build,
  validation and browser paths. It is the existing 50,000-node expansion budget, now
  counting repeat multiplicity, so an acyclic fan-out of nested repeats stops before it
  allocates.
  - `REPEAT_BUDGET_EXCEEDED` reports the fan-out at the outermost `repeat`.
  - The page diagnostics (5,000 nodes, depth 100) still apply after resolution.
  - `assertComponentExpansion` accounts for repeat multiplicity.

### 4.3 Validation

Some checks run on the **authored tree**:
- the cell reference resolves (`UNKNOWN_REPEAT_CELL`, suggesting the nearest element or
  component);
- the host is eligible (`REPEAT_INVALID_HOST`);
- item ids are unique (`DUPLICATE_REPEAT_ITEM_ID`);
- the component cell counts as a usage and a dependency edge, so `UNUSED_COMPONENT` and
  cycle checks see it;
- the collection-binding conflict (`REPEAT_WITH_BINDING`).

These are doctor codes. Shape and the 200 limit are schema errors, so each defect is
reported once.

Other checks run on the **rendered tree**, with row provenance:
- duplicate ids, form references and overlay triggers;
- element prop contracts. Rules run against the synthetic element node, and their
  `…props.<key>` path maps to `…repeat.items[i].<key>`, so `UNKNOWN_PROP` underlines
  the item key.
- Component cells keep the existing policy for component inputs: an item key that is
  not a declared prop is not an unknown-primitive-prop error.

An expansion failure inside a row is reported with its repeat-specific code at the
item's source path, not as a generic `BROKEN_COMPONENT_REFERENCE`.

**Collection binding.** A `repeat` host whose ancestor has a collection `binding`, a
cell definition whose root has one, or a host with its own `binding` is
`REPEAT_WITH_BINDING`, an error. Ordinary single-value prop bindings stay allowed.

An item value containing `{{item.` gets lint info `REPEAT_ITEM_TOKEN`: items are plain
props, so such tokens are not interpreted. `items: []` gets info `EMPTY_REPEAT`.

### 4.4 Editing, addressing and selection

- **Addressing.** A row is addressable by its public id. An address resolves through
  row provenance to the authored item by its id, and the current index is computed at
  read and write time, so inserting, reordering or removing items never retargets an
  address. A stale id fails to resolve.
- **`wf inspect`** shows a row as a repeat item: host, cell, item id, current index,
  author file and rendered id.
- **`wf node update <row> --props …`** merges fields into the item, keeping `id`.
  Changing `id` is a separate, explicit rename.
- **`wf node remove <row>`** removes the item from the array.
- **Refused operations.** `wf node` operations that would turn a row into a different
  node (layout, children, `use`) are refused, with a message.
- **Static children.** `wf node add --inside <host>` still adds an authored static
  child.
- **Admin.** The YAML tree walker lists rows under their host, labelled from the item.
  A click or tree selection resolves by row identity.
  - Page-owned rows are edited in the page document.
  - A row inside a shared definition is edited in that definition's document.
  - Built-in rows are read-only.
  - Internal nodes of a component row select the row, following the nearest owner rule.
- **Tests.** Preview click, tree click and a persisted edit after a reorder must work for
  a page row, a component row's descendant and a component-owned repeat.

### 4.5 Docs, guidance and evidence

- **Schema and docs**, all in one change:
  - `engine/schema/schema.json`: the hand-written `Repeat` on `Node`;
  - `docs/cli/schema.md`: the node model;
  - `docs/cli/schema-systems.md`: grammar, expansion, ids, codes and the binding
    relationship;
  - `docs/cli/schema-canonical.yaml`, plus its canonical example;
  - `docs/cli/brief.md`: `wf node` and `wf inspect` on rows;
  - a short rendering section in `docs/cli/rendering-data.md`. `rendering.md` is at its
    cap; link from an existing line.
- **Agent guidance.** `wf llm` gets one compact section: when to use `repeat` (three or
  more similar siblings), the syntax, and one example. `wf llm --short` grows by at
  most four lines, and `docs/cli/agent-guide.md` is regenerated.
- **Tests and evidence.**
  - One visual fixture on an existing gallery page, in card and line modes.
  - Parity tests: repeated cells render byte-identically to the equivalent
    hand-written children.
  - Focused tests for author scope, form references in both directions, exact YAML
    ranges, write-back after a reorder, the budget, and every new code.

### 4.6 The iPad app

After the engine lands:
- The app's editing guide teaches `repeat`.
- The transactional edit operations can append, update by item id, insert before an
  existing item, and remove an item. A missing operation is added only when a real test
  needs it.

On the physical iPad, these requests must produce valid YAML on the first attempt, make
the intended row change, and preserve the other rows and their ids:
- "Add a team section with three people"
- "Add three pricing plans"
- "Add Linus before Grace"
- "Change Grace's role to Owner"
- "Remove Alan"

Each is compared with the same request answered as hand-written siblings, with
first-attempt validity, time and prompt size recorded.

## 5. Implementation Order

1. Engine tranche, covering everything in §4.1–§4.5, with a failing test first for each
   rule.
2. Integration on `claude/component-library`, with full suites on Maxis and the gallery
   on the Mac.
3. Mobile follow-up (§4.6).

## 6. Edge Cases

- **An item key the cell does not declare:** for an element cell, `UNKNOWN_PROP` at the
  item key. For a component cell, the existing component-input policy applies.
- **A component cell that contains its own `repeat`:** allowed. It expands per
  instance, and the shared budget bounds the fan-out.
- **Two instances of a component that owns a `repeat`:** rows are namespaced per
  instance, for example `card_a__team__ada` and `card_b__team__ada`. References inside
  each instance follow it.
- **A `repeat` in a page fill that is forwarded through another component:** the rows
  are the caller's, prepared before the callee, and carried opaquely.
- **A slot region whose fallback contains a `repeat`, overridden by page content:** the
  fallback rows are not rendered and not validated as rendered. This follows the
  existing reachability rules.
- **`selected` in an item:** an ordinary prop of the cell. List selection with
  `selection` and a primary key stays with `binding`.
- **Determinism:** ids, order and expansion depend only on the authored input.

## 7. Non-Goals

- No runtime data binding; `binding` stays the dataset mechanism, unchanged and not
  migrated.
- No inline cell templates, scalar item shorthand, per-item `slots` or `repeat` on `use:`
  nodes in v1.
- No sorting, filtering, paging or conditional items.

## 8. Review Findings

Codex (`gpt-6.2-sol`, high effort) reviewed `26da610`. The full text is in the
orchestrator's scratchpad.

| # | Sev. | Finding | Decision |
|---|---|---|---|
| 1 | blocker | Index-based ids retarget edits, selections and references after a reorder. | **Adopt**: a required item `id`; the public id is `host__item`; addresses resolve by id. |
| 2 | blocker | The expansion stage does not preserve slot authorship or scoped references. | **Adopt**: §4.2 stages; no `repeat` on `use:` hosts and no per-item slots in v1. |
| 3 | major | Resolution-time lookup skips import qualification and the `std` rules. | **Adopt**: classify once, qualify like `use:`, elements win, reject authored `builtin:`. |
| 4 | blocker | The expansion limit misses nested fan-out. | **Adopt**: a shared materialization budget on every path, plus `REPEAT_BUDGET_EXCEEDED`. |
| 5 | major | Authored checks and rendered checks need separate passes with exact locations. | **Adopt**: §4.3. |
| 6 | major | The CLI and admin need a stable target that writes back to the item. | **Adopt**: §4.4 row provenance and its operations. |
| 7 | major | Legal hosts are unspecified. | **Adopt**: §4.1 host contract and `REPEAT_INVALID_HOST`. |
| 8 | major | Collection binding can clone rows after validation. | **Adopt**: reject cloning combinations, keep single-value bindings, add `REPEAT_ITEM_TOKEN` lint, correct §2. |
| 9 | minor | Keep keyed maps only, and measure the real authoring task. | **Adopt**: keyed maps only; the §4.6 comparison with insertion and edits. |
| 10 | minor | The doc and verification checklist misses surfaces. | **Adopt**: §4.5. |

## 9. Implementation Decisions

The code and `docs/cli/` are authoritative.

- **Cell grammar.** `cell` takes the `ComponentRef` pattern of `use:`. That keeps it
  non-empty, and it refuses an authored `builtin:` at the schema. After registry
  rewriting, a module's `std` miss is `builtin:` too, so the doctor cannot tell an
  authored one apart.
- **Hosts.** `engine/renderer/child-hosts.js` lists the elements whose renderer lays
  out children (`useChildren`). `button` and `input` only append children after their
  own markup, so they are not hosts, as §4.1 says. A test checks the list against
  every renderer.
- **Duplicate item ids.** Only the first item with an id makes a row, so
  `DUPLICATE_REPEAT_ITEM_ID` is not reported again as `DUPLICATE_NODE_ID`.
- **Budget.** The 50,000 limit counts materialized nodes per page; regions and
  overlays share it. Each repeat is checked first against a static count of its
  fan-out. A page that passes the limit without a repeat is
  `MAX_NODES_PER_PAGE_EXCEEDED`. To count each node once, the resolver no longer
  resolves already resolved children a second time. That work doubled per level
  of nesting; output is unchanged, and the gallery renders byte-identically.
  `assertComponentExpansion` keeps its value count and adds the rows.
- **Provenance.** Validation resolves stamped copies of the page, its template and
  its definitions, the build's source stamps, so a row knows where its item is
  written. `__repeat` records the host, item and index.
- **Rename.** The explicit rename is `wf node rename <row> <item-id>`. `--props`
  with an `id` is refused and points there.
- **Admin.** The tree sees `components.yaml` only. Rows inside built-in or imported
  definitions are not listed and select their page instance, which keeps them
  read-only.

These follow the implementation review (Codex, `c9647ad`):

- **Injected markers.** Dropping the second pass also dropped a legacy effect: a
  component that expands to an injectable marker took its injection. The marker
  is now handled where expansion produces it, like a written one, so each injected
  node is still charged once. That also covers a produced marker directly in a
  region or overlay list, which the old second pass left unresolved. An injection
  that reaches its own marker again renders nothing there, where it used to
  overflow the stack.
- **Shared budget.** The hosts of one definition reserve their fan-out together
  before any row is made. Validation reports a budget failure as it happens and
  expands nothing after it. When another entry fails first, the per-entry retry
  keeps one budget for the page. A failure inside a row is reported at the
  outermost repeat. In-memory `validateProject` runs the build's page tree for
  the budget, so `wf validate`, the browser and the API refuse what the build
  refuses. The advice in the message now comes from the resolver, so the build
  prints it too.
- **What renders.** A filled or emptied slot fallback makes no rows and costs
  nothing, both at materialization and in the static count of an enclosing
  repeat. In a component without slots, instance `children` replace the root's
  rows with its children, and the root's rows are stamped with the definition.
- **Bindings across boundaries.** `REPEAT_WITH_BINDING` stays an authored check
  (`doctor/repeat-bindings.js`), now composition-aware:
  - a binding on or above an instance is followed into the definition, and each
    repeat it would clone is reported where the definition writes it;
  - content placed under a bound root (directly or through root `use:`) or
    under a bound placeholder ancestor is checked as bound;
  - a cell is bound when its root, or the root it delegates to, is bound.
  Built-in definitions own no repeat, so the walk does not enter them.
- **Row lint.** Element prop contracts (`lint/rules/element-contract.js`) run on
  the rows the doctor's rendered pages contain, with substituted values, mapped
  to the item and reported once per place and message. Rows in definitions no
  page renders are not contract-checked. The authored pass keeps `EMPTY_REPEAT`,
  `REPEAT_ITEM_TOKEN` and the frame rules on rows.
- **Row failures.** An expansion failure that passes through a row is
  `REPEAT_ROW_FAILED` at the outermost row's item. Unknown cells and the project's
  own cycles are still reported once, by their own checks.
- **Item tokens.** Below a row, the renderer prints an `{{item.…}}` token as
  written when no collection gives it an item, matching `REPEAT_ITEM_TOKEN`.
  Outside rows, and inside a collection in a row, tokens resolve as before.

These follow the fix verification (Codex, `7c14f6f`):

- **Bindings on what renders.** The bound walk into a definition takes the
  instance and applies the resolver's rules: without slots, instance `children`
  replace the root's children and rows, so only the root's own `use:` (with
  those children) and the fills it writes are walked; with slots, a filled
  fallback is skipped. The binding is the effective one: a `binding` key on an
  instance, or on a delegating root, replaces the root's below it, whatever its
  value. The check stays authored, so definitions no page renders are still
  checked.
- **A page around a failure.** The per-entry retry keeps the entries that
  expand, rebuilds the regions from them with each injection in place, and
  keeps the overlay entries that expand, so ids, interactions and row lint are
  still checked next to the failure. On such a page a missing form or trigger id
  may be in what failed, so `INVALID_FORM_REFERENCE` and
  `INVALID_OVERLAY_TRIGGER` are not reported there.
- **Build output.** When validation stops `wf build`, the error lists the
  blocking diagnostics as `wf validate` prints them, so a budget failure is
  named on the build path again.
