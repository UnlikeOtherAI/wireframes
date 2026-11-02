# The `.wf` file format

A whole wireframe project in one text file.

## Why a single file

A project is a folder of YAML documents. That is right for a repository and
wrong for everything else: emailing a wireframe, dropping one into a chat,
storing one in a database row, or handing one to a browser that has no server
behind it. `.wf` is the same documents in one file.

## What it is

A multi-document YAML stream. Documents are separated by `---`, the manifest
comes first and carries `format: wf/1`.

```yaml
format: wf/1
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  projectId: acme_dashboard
  name: Acme Dashboard
---
documentType: config
id: wfrc
config:
  cli:
    build:
      outputDir: ./wireframes/build
---
documentType: sitemap
...
```

Order is `manifest`, `config`, `sitemap`, `templates`, `components`, `page`,
`dataset`, `asset`, and within a type documents sort by id. Packing the same
project twice produces byte-identical output.

### Why not zip

A zip would need a reader in the browser bundle, would not diff, and could not
be read in a terminal or pasted into a message. The projects that exist are
tens of kilobytes of text. A zip container (`.wfz`) is the obvious answer if
asset-heavy projects ever arrive; nothing here blocks it.

### `.wfrc.yaml`

CLI configuration is not project content, but a packed project that loses it
will not build. It travels as `documentType: config` and unpacks back to
`.wfrc.yaml`.

### The extension

`.wf` is not owned by any major program and has no IANA media type. The parser
sniffs `format: wf/1` rather than trusting the extension, so a file named
anything else still reads. `.wfx` is the fallback if a conflict ever appears.

## Commands

```bash
wf pack --out acme.wf      # the current project into one file
wf unpack acme.wf --out ./acme   # back into a folder
```

Both are lossless. Packing the renderer gallery, unpacking it and building both
copies produces identical output trees.

## In the browser

```js
import { parseWf, createWireframe } from '@wireframes/renderer';

const project = parseWf(await file.text());
const wf = createWireframe(document.getElementById('host'), project, {
  icons: 'fontawesome',
  onNavigate: (routeId) => console.log('went to', routeId),
});

wf.setPage('dashboard');
wf.setMode('line');
wf.setPlatform('ios');
wf.explain('sidebar');   // { frame: 'surface', rule: 5, reason: 'region:sidebar' }
```

Everything runs on the client. The page renders into a sandboxed iframe so its
stylesheet and runtime cannot reach the host application; navigation comes back
as a `wf:navigate` message and the host swaps the page in memory. There is no
server round trip, and nothing is uploaded.

The bundle ships as ESM (`bundle/wireframe-renderer.min.js`) and as a script-tag
build exposing `window.Wireframes`
(`bundle/wireframe-renderer.iife.js`). The build fails if the bundle exceeds its
size budget.

## Implementation

| File | Role |
|---|---|
| `engine/wf-format/index.js` | pure: ordering, packing, unpacking, format sniffing |
| `engine/wf-format/fs.js` | the disk half: reads a folder, writes a folder |
| `renderer/src/wf.ts` | `parseWf` / `serializeWf` for the browser |
| `renderer/src/mount.ts` | `createWireframe`, the live mount |
