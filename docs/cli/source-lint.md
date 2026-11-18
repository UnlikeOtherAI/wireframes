# Source lint

`engine/lint/source` checks a project given as YAML text and says where each finding is, so an
editor can underline the key or value that is wrong while a person types. It applies the rules
`wf lint` applies and needs no file system: it bundles for a browser or a phone web view.

```js
const { lintSources } = require('wireframes/engine/lint/source');

const result = lintSources([
  { name: 'manifest.yaml', text },
  { name: 'pages/home.yaml', text },
]);
```

Import `engine/lint/source` itself. `engine/lint` and the engine's root `index.js` load the disk
commands.

## Input

`lintSources(sources, options)`

- **`sources`**: the project's documents as text, `{ name, text }` each. Either one source per
  file of a folder project, or one source holding a whole `.wf` stream. A source may hold several
  YAML documents separated by `---`. The folder config, `.wfrc.yaml`, is not a document: leave it out.
- **`name`**: the document's path inside the project, such as `pages/home.yaml`. Component
  imports resolve against it, as they do on disk. A document of a stream is known by the file
  `wf unpack` would write it to.
- **`options.iconIndex`**: the icon index (`engine/icons/catalogue` on Node, the compact index in a
  browser bundle). Without it, icon names are not checked.

## Output

```js
{
  ok: false,
  documents: [
    { source: 'pages/home.yaml', index: 0, type: 'page', id: 'home', file: 'pages/home.yaml', range },
  ],
  diagnostics: [
    {
      severity: 'error',                 // 'error' | 'warning' | 'info'
      code: 'SCHEMA_ENUM',
      message: 'Schema validation error at $.page.slots[0].content[2].props.variant: …',
      source: 'pages/home.yaml',         // the source's name
      document: 'page:home',             // the document map's label
      path: '$.page.slots[0].content[2].props.variant',
      range: { start: { line: 33, column: 21, offset: 812 }, end: { line: 33, column: 27, offset: 818 } },
    },
  ],
}
```

- `ok` is true when no finding is an `error`. Warnings and info never make it false.
- `line`, `column` and `offset` are zero-based. `offset` and `column` count UTF-16 units of that
  source's text. `end` is exclusive.
- A range is never empty and never spans lines. A block of YAML is underlined on its first line.
- A finding about the whole project, such as `MISSING_MANIFEST`, has `source: null` and
  `range: null`. Show it in a list, not in a buffer.
- `documents` lists every YAML document in order, with the `file` it unpacks to. An editor can
  build its file list from it. `type` and `id` are null for a document that could not be read.
- `diagnostics` are sorted by source, then by position.

`splitSource(text)` returns the document chunks of one text, `{ start, end, text }` each, for a
caller that needs to cut a stream into files without linting it.

## What is checked

| Stage | Findings |
| --- | --- |
| Syntax, per document | `INVALID_YAML` at js-yaml's mark, once per document. A duplicated key is one of these. |
| Container | `INVALID_DOCUMENT`, `UNSUPPORTED_FORMAT`, `MISSING_MANIFEST`, `DUPLICATE_DOCUMENT`, `DUPLICATE_PAGE_ID`, `DUPLICATE_DATASET_ID`, `RECURSIVE_ALIAS`, `DOCUMENT_TOO_LARGE` |
| Schema, per document | Every `schema.json` error, plus the document type, version and id checks |
| Presentation, logos, icons | `ICON_AFFIX_CONFLICT`, sticky warnings, `LOGO_SLOT`, `LOGO_SIZE`, `UNKNOWN_ICON`, `ICON_STYLE_UNAVAILABLE` |
| References | Everything `wf doctor` reports about templates, slots, injectables, components, datasets, routes, overlays, state keys and forms, plus unused and circular components, component slots (`UNKNOWN_COMPONENT_SLOT`, `SLOTS_WITHOUT_USE` and the rest) and `STD_ALIAS_SHADOWED` |
| Naming and elements | Everything `wf lint` adds: id format, unknown props and prop values, missing text or labels, section intent, `AMBIGUOUS_VALUE`, `HELP_PROP_ALIAS` |

The rules are the ones the disk commands run, not copies: `engine/doctor/project-checks.js` and
`engine/lint/rules/documents.js` are shared by both. Every rule walks the named fills of a component
instance (`slots:`) as well as its `children`, and a `use:` of a built-in `std.*` pattern resolves
as it does on disk, without the pattern counting as one of the project's components. Naming and element rules run on each document
the schema accepts, where `wf lint` skips them for the whole project once anything is an error.

YAML is read with js-yaml's core schema, as the apps that render `.wf` files read it. The disk
loader uses js-yaml's default schema, which also turns an unquoted `2026-11-18` into a date and
merges `<<`. On text without those, both report the same findings.

## While a document is broken

Text in an editor is often invalid for a moment. The linter is built for that:

- Each document is parsed alone. A syntax error in one does not hide findings in the others.
- When any document cannot be read, or does not say what it is, findings that name something
  missing are held back: an unknown route, template, component, dataset, slot, overlay or state
  key, and unused components and datasets. What they name may be in the document that is broken.
  They return once every document parses.
- A document the schema refuses still counts as present, so a wrong key in a page does not turn
  its route into an orphan.

A project that lints clean here has passed what `wf lint` checks. It has not been rendered: check
that separately before saving.

## Where a finding points

- A wrong value: the value. An unknown key or prop: the key.
- A node inside a component instance's fill: under `slots.<name>[i]` of that instance, in the
  document that wrote the fill, whether a page or a component.
- A slot finding: the fill (`slots.aside`), the `slots` or `slot` key, the repeated placeholder's
  name, or the instance's `id` for a slot left empty. `STD_ALIAS_SHADOWED`: the `std` import key.
- A missing required property: the mapping that lacks it, on its first line.
- A rule about a node (an interaction, a duplicate id): the node's `id`. A repeated id is
  underlined where it was repeated.
- A node inside a shared component or a template, reported for a page that uses it: its `id` in
  the components or templates document, when one node there has that id. Otherwise the top of the
  page. A finding from a component's own walk is looked for in that component's definition first. The rules that find these walk a page with its template and components folded in, and the
  engine does not yet carry where each folded-in node was written.
- An alias: a finding inside an aliased value points at the alias, not into the anchored value.

## Limits

- One syntax error per broken document: js-yaml stops at the first.
- Ranges come from js-yaml's parse events. Explicit keys (`? key`) and flow pair entries
  (`[a: 1]`) fall back to the enclosing mapping or sequence.
- A stream is cut at `---` and `...` lines. That reads everything `wf pack` writes; it is not a
  general YAML stream reader.
- Nothing is cached between calls. On a 5,000-line, 19-document project a full pass takes about
  0.1 s in Node on a desktop.
