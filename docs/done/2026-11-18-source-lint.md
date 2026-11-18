# Source lint: diagnostics with positions

The reference for what shipped is [docs/cli/source-lint.md](../cli/source-lint.md). This is the
design, with the review that changed it.

## Problem Statement

An editor needs to underline the exact key or value that is wrong while a person types.
The engine could not do that:

- `engine/lint` and `engine/doctor` read a project from disk (`fs`, `path`), so they could not
  run in a browser or a phone web view, and they broke the rule that the engine works from memory.
- No diagnostic carried a location. Schema errors put a path inside the message text; every
  other rule named a page or a node in prose.
- A YAML syntax error stopped everything, including the documents that were fine.

The first consumer is the YAML editor in the private mobile app, which must reject
"not compatible" text immediately. The lint itself belongs here, in the open engine.

## Current Behavior

As it was before this change:

- `engine/doctor/index.js` `runDoctor({ projectPath })` loaded every file, then ran the schema,
  `validatePresentation`, `validateIconReferences`, the reference checks
  (`reference-checks.js`), the component graph (`component-graph.js`) and
  `runSemanticValidation` (`semantic-validator.js`). Loading and checking were one function.
- `engine/lint/index.js` `runLint` called `runDoctor`, then `collectLintTargets`, which re-read
  the YAML from disk and applied the naming rules and `rules/primitive-props.js`.
- `engine/validate/index.js` `validateProject(documentMap)` was the only in-memory entry. It runs
  the schema, missing templates, logo references, presentation and (optionally) icons. It is what
  the API and the mobile app call, so they miss the reference and semantic rules.
- Diagnostics were `{ code, message }`. `engine/schema/validator.js` knows a `path` for each
  schema error, and `validate/index.js` folds it into the message.

## Desired Behavior

- One pure entry, `lintSources(sources, options)`, takes YAML text and returns what `wf lint`
  finds, each finding with a range in the text it came from.
- A syntax error is reported where it is, and the other documents are still checked.
- `wf lint`, `wf validate`, `wf doctor` and `validateProject` print exactly what they printed
  before. The rules exist once: the disk commands and the text entry share them.

## Design

### Entry point

`engine/lint/source/index.js`, with no Node built-in anywhere beneath it:

```js
lintSources([{ name: 'pages/home.yaml', text }], { iconIndex })
// → { ok, documents, diagnostics }
```

- A **source** is one text: a file of a folder project, or a whole `.wf` stream. Its `name` is its
  path in the project, which component imports resolve against.
- `documents`: one entry per YAML document, `{ source, index, type, id, file, range }`.
- `diagnostics`: `{ severity, code, message, source, document, path, range }`, zero-based, `offset`
  in UTF-16 units, `end` exclusive. A finding about the whole project has no source and no range.
- `splitSource(text)` returns the document chunks alone. The mobile app needs it to cut a stored
  `.wf` into the files its editor shows, without re-serializing them.

### Positions

`positions.js` parses one document with js-yaml's `listener` option, which reports where each
`composeNode` call opens and closes. From those frames it builds a tree of ranges beside the
parsed value, so the value is js-yaml's own and no second YAML parser enters the engine.

The frames are parser calls, not YAML nodes, so the adapter normalizes them:

- A value is first tried as the key of a block mapping, which wraps it in a frame holding the
  same result. The inner frame is the node.
- A failed attempt to read another key leaves an empty frame, which is skipped.
- A mapping pairs a key frame with the next frame only when a `:` follows the key in the text,
  because a flow mapping may have keys with no value.
- A block sequence matches each item frame to its `-` in the text, because an empty `-` composes
  nothing and items may repeat a value.
- An empty value sits just after its colon. An alias is read from the text, because its frame
  runs on past any comment to the next token.
- A block collection ends at its last child, a flow one at its closing bracket.

YAML is read with js-yaml's core schema, as the apps that render `.wf` files read it.

### Where a rule points

Rules say where a finding is with an optional `at`:

| `at` | Used by | Resolved to |
| --- | --- | --- |
| `{ document, path, key? }` | Naming, primitive props, reference checks | The value at that path, or its key when `key` is set. |
| `{ document, node }` | Semantic rules, which walk a resolved tree where paths no longer exist | The node with that `id` in that document. Elsewhere only when one node has that id. |
| none | Whole-project findings | No source and no range. |

`at` is opt-in. A rule keeps it only on a result that sets `locations`, which `lintSources` does.
The disk commands and the API never set it, so what they print is unchanged. The per-document
checks (`validatePresentation`, `validateLogoReferences`) take a `locate` option for the same reason.

### One set of rules

- `engine/doctor/project-checks.js` holds what `runDoctor` did after loading. `runDoctor` keeps
  the file loading and calls it.
- `engine/lint/rules/documents.js` holds the walk that was in `collectLintTargets`.
- `semantic-validator.js` was 716 lines, over the limit. Its interaction, condition, pane,
  selection and overlay checks moved to `semantic-interactions.js`.
- Component imports use the registry core both callers already shared. `component-registry/virtual.js`
  holds the in-memory path rules, moved out of the browser renderer so there is one copy.

`lintSources` runs, in order: parse; container rules; per document the schema, presentation and
logos; icons; the project checks; the naming and element rules on documents the schema accepts.

## Implementation Order

1. `positions.js` and its tests.
2. Split `semantic-validator.js`; extract `project-checks.js` and `rules/documents.js`.
3. Thread `at` through the rules.
4. `lintSources`, its tests, and the comparison below.
5. Docs.

## Edge Cases

- **A syntax error in one document:** one `INVALID_YAML`. Findings that name something missing
  are held back until every document parses, because it may be in the broken one.
- **A document with no `documentType`:** the same, since it could be any document.
- **A document the schema refuses:** still counted as present, so its route is not an orphan.
- **A recursive alias** (`x: &a [*a]`): `RECURSIVE_ALIAS`, and the document is left out. The
  rules recurse and would overflow the stack.
- **`format: wf/1`:** read off the manifest before the schema sees it. Another value is
  `UNSUPPORTED_FORMAT`.
- **A path that no longer resolves:** the nearest ancestor that does.
- **A node folded in from a template or a shared component:** found by id only when unique.
- **CRLF and lone-CR text:** offsets count every unit; lines break where YAML breaks them.

## Non-Goals

- Completion. The schema and the primitive registry are data any editor can read.
- Error recovery inside one broken document. js-yaml reports one error and stops.
- Positions in `wf lint` terminal or `--json` output.
- Carrying source positions through the resolver, which exact ranges for folded-in nodes need.
- Caching between calls, until a device measurement says it is needed.

## Review Findings

Reviewed by Codex (`gpt-6.2-sol`) before the rules were moved, against `b3dfb81`.

| # | Finding | Decision |
| --- | --- | --- |
| 1 | Listener frames are parser calls; frame order alone cannot give paths or ranges. | **Adopted.** The adapter normalizes wrappers, probes, empty items, aliases and empty values, and tests pin the reviewer's cases. Explicit keys and flow pair entries fall back to the enclosing range, which is documented, not solved: wireframe YAML does not use them. |
| 2 | The YAML schema was not chosen. | **Adopted.** Core schema, documented with what differs from the disk loader. |
| 3 | Resolved node ids cannot locate the authored field and can point into the wrong file. | **Partly adopted.** Deferred checks now keep the referring node. A node is looked for outside its own document only when one node has the id; otherwise the finding sits on the page. Carrying provenance through the resolver is a non-goal here. |
| 4 | A disk-only import callback rejects valid browser projects. | **Adopted.** Imports resolve in memory through the shared registry core, by source name. |
| 5 | The extraction kept a transitive Node dependency. | **Adopted.** `reference-checks.js` requires statically, and a test walks every module under the entry for built-ins and computed requires. The mobile app's esbuild browser bundle is the end-to-end check. |
| 6 | Splitting on `^---` is only reliable for packed streams. | **Adopted in part.** `---` stays in the parser's input, `...` ends a document, directives stay with their document. Root block scalars containing `---` are out of scope and documented. The splitter stays because the mobile app consumes it. |
| 7 | Tests do not pin order, multiplicity or mixed errors. | **Adopted.** The base and the new engine were run over 14 projects, five real and nine deliberately broken (schema, syntax, references, imports, unused), through `doctor`, `lint`, `lint --strict`, `validate` and `validate --strict`. All output was identical. |
| 8 | Paths need a document identity and explicit key or value targets. | **Adopted.** Per-document checks carry the document itself, `at` has `key`, and pages are keyed by `page.id` as the doctor keys them. |
| 9 | An enumerable `at` changes API bodies and strict JSON. | **Adopted.** Locations are opt-in, and a test pins that `wf lint` findings carry none. `validateProject` is untouched. |
| 10 | A project-wide filter hides real errors and leaves false positives. | **Partly adopted.** Schema-invalid documents stay in the project, and an untyped document counts as unread. Gating each check on its own dependencies was rejected: it is a second dependency model to keep in step with the rules, and the filter only applies while something cannot be read. |
| 11 | Recursive aliases crash the validation walks. | **Adopted,** with a size limit. |
| 12 | Parsing is a small share of the cost. | **Partly adopted.** Icons are checked in one pass. Caching and a worker are deferred until the mobile editor is measured on a device; a full pass over 5,000 lines takes about 0.1 s in Node. |
| 13 | The API is wider than the first consumer needs. | **Partly adopted.** The one-source shorthand is gone and project findings have no range. `splitSource` and `documents[].file` stay: the mobile editor uses both. `fileNameFor` no longer gives two documents one name. |
