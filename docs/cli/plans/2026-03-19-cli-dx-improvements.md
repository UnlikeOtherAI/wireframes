# CLI DX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 DX issues reported by agents using the wireframe CLI, plus add a new `wf llm` command that dumps complete schema instructions for LLM consumption.

**Architecture:** All logic lives in `/shared/` (zero CLI deps). CLI commands in `/cli/commands/` are thin wrappers. New shared modules: `shared/schema/llm-reference.js` (LLM reference generator), `shared/schema/doc-printer.js` (structured doc printer). Modifications to: `shared/page/index.js` (orientation defaults), `shared/renderer/primitives.js` (table key auto-derive), `shared/doctor/semantic-validator.js` (component aliases, error grouping).

**Tech Stack:** Node.js, js-yaml, node:test for tests

---

### Task 1: Orientation defaults for mobile/tablet

When `wf page add` is called with `--device mobile` or `--device tablet` and no `--orientation`, auto-fill sensible defaults instead of erroring.

**Files:**
- Modify: `shared/page/index.js:65-74` (buildViewport) and `shared/page/index.js:224-229` (validation block)
- Test: `test/validate.test.js`

**Step 1: Write the failing test**

Add to `test/validate.test.js`:

```js
test('page add defaults orientation for mobile to portrait', () => {
  const projectPath = createTempProject('Orientation Default Mobile');
  const result = addPage({
    projectPath,
    pageId: 'mobile_page',
    path: '/mobile',
    templateId: 'main_template',
    device: 'mobile',
    // orientation intentionally omitted
  });

  assert.equal(result.ok, true);
  const pageDoc = yaml.load(fs.readFileSync(
    path.join(projectPath, 'pages', 'mobile_page.yaml'), 'utf8'
  ));
  assert.equal(pageDoc.page.viewport.orientation, 'portrait');
});

test('page add defaults orientation for tablet to landscape', () => {
  const projectPath = createTempProject('Orientation Default Tablet');
  const result = addPage({
    projectPath,
    pageId: 'tablet_page',
    path: '/tablet',
    templateId: 'main_template',
    device: 'tablet',
    // orientation intentionally omitted
  });

  assert.equal(result.ok, true);
  const pageDoc = yaml.load(fs.readFileSync(
    path.join(projectPath, 'pages', 'tablet_page.yaml'), 'utf8'
  ));
  assert.equal(pageDoc.page.viewport.orientation, 'landscape');
});
```

Note: `addPage` must be imported — add `const { addPage } = require('../shared/page');` at the top of the test file.

**Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.js`
Expected: Both new tests FAIL because `addPage` currently returns `{ ok: false, error: 'Orientation is required...' }`.

**Step 3: Write minimal implementation**

In `shared/page/index.js`, change the `buildViewport` function (lines 65-74):

```js
function buildViewport(device, orientation) {
  if (device === 'web') {
    return { device: 'web' };
  }

  const defaultOrientation = device === 'mobile' ? 'portrait' : 'landscape';
  return {
    device,
    orientation: orientation || defaultOrientation,
  };
}
```

And change the validation block (lines 224-229) — instead of hard-failing when orientation is missing, apply the default:

```js
const resolvedOrientation = (normalizedDevice === 'mobile' || normalizedDevice === 'tablet')
  ? (isValidOrientation(normalizedOrientation)
      ? normalizedOrientation
      : (normalizedDevice === 'mobile' ? 'portrait' : 'landscape'))
  : normalizedOrientation;
```

Remove the early-return error block that rejects missing orientation. Pass `resolvedOrientation` to `buildViewport` instead of `normalizedOrientation`.

**Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/page/index.js test/validate.test.js
git commit -m "feat: auto-default orientation for mobile (portrait) and tablet (landscape)"
```

---

### Task 2: Table columns — auto-derive `key` from `label`

When a table column has `label` but no `key`, derive `key` automatically. Also improve the validation error message.

**Files:**
- Modify: `shared/renderer/primitives.js:612-657` (normalizeTableColumns)
- Modify: `shared/doctor/semantic-validator.js:329-342` (validateTableNode)
- Test: `test/validate.test.js`

**Step 1: Write the failing tests**

Add to `test/validate.test.js`:

```js
test('validate accepts table columns with label but no key (auto-derives key)', () => {
  const projectPath = createTempProject('Validate Table Label Only');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.slots[0].content = [
    {
      id: 'label_table',
      component: 'table',
      props: {
        columns: [
          { label: 'Full Name' },
          { label: 'Email Address' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { full_name: 'Alice', email_address: 'a@b.com', status: 'Active' },
        ],
      },
    },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.js`
Expected: FAIL — `TABLE_INVALID_COLUMN` because columns without `key` are rejected.

**Step 3: Write minimal implementation**

In `shared/renderer/primitives.js`, update `normalizeTableColumns` — when `key` is missing but `label` exists, derive key:

```js
function deriveKeyFromLabel(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeTableColumns(props) {
  if (!Array.isArray(props?.columns)) {
    return [];
  }

  return props.columns
    .map((entry, index) => {
      if (typeof entry === 'string' && entry.trim() !== '') {
        const key = entry.trim();
        return { key, label: key, width: '', index };
      }

      if (!isObject(entry)) {
        return null;
      }

      let key = typeof entry.key === 'string' && entry.key.trim() !== ''
        ? entry.key.trim()
        : '';

      // Auto-derive key from label when key is missing
      if (!key && typeof entry.label === 'string' && entry.label.trim() !== '') {
        key = deriveKeyFromLabel(entry.label);
      }

      if (!key) {
        return null;
      }

      const label = typeof entry.label === 'string' && entry.label.trim() !== ''
        ? entry.label.trim()
        : key;
      const width = typeof entry.width === 'number' && Number.isFinite(entry.width)
        ? `${entry.width}px`
        : typeof entry.width === 'string' && entry.width.trim() !== ''
          ? entry.width.trim()
          : '';

      return { key, label, width, index };
    })
    .filter(Boolean);
}
```

In `shared/doctor/semantic-validator.js`, update `validateTableNode` to also auto-derive keys and improve the error message:

```js
function deriveKeyFromLabel(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function validateTableNode(node, context) {
  if (node?.component !== 'table') {
    return;
  }

  const props = isObject(node.props) ? node.props : {};
  const columns = Array.isArray(props.columns) ? props.columns : [];
  if (columns.length === 0) {
    addDiagnostic(
      context.result,
      'TABLE_MISSING_COLUMNS',
      `Table node "${node.id}" in page "${context.pageId}" must define at least one column.`,
    );
    return;
  }

  const invalidColumn = columns.find((column) => {
    if (typeof column === 'string') {
      return column.trim() === '';
    }
    if (!isObject(column)) {
      return true;
    }
    const hasKey = typeof column.key === 'string' && column.key.trim() !== '';
    const hasLabel = typeof column.label === 'string' && column.label.trim() !== '';
    return !hasKey && !hasLabel;
  });

  if (invalidColumn !== undefined) {
    addDiagnostic(
      context.result,
      'TABLE_INVALID_COLUMN',
      `Table node "${node.id}" in page "${context.pageId}" has a column without a valid key or label. Provide at least one — key will auto-derive from label if omitted.`,
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/renderer/primitives.js shared/doctor/semantic-validator.js test/validate.test.js
git commit -m "feat: auto-derive table column key from label when key is omitted"
```

---

### Task 3: Component alias suggestions

When validation encounters an unknown primitive component like `card`, suggest the closest match (`section`).

**Files:**
- Modify: `shared/doctor/semantic-validator.js` (add alias map + check in validateNode)
- Test: `test/validate.test.js`

**Step 1: Write the failing test**

Add to `test/validate.test.js`:

```js
test('validate warns when using component alias like card', () => {
  const projectPath = createTempProject('Validate Component Alias');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.slots[0].content = [
    {
      id: 'my_card',
      component: 'card',
      props: { title: 'Card Title' },
    },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.ok(
    result.warnings.some((w) =>
      w.code === 'COMPONENT_ALIAS' && w.message.includes('card') && w.message.includes('section')
    ),
    'Should warn that "card" should be "section"'
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.js`
Expected: FAIL — no `COMPONENT_ALIAS` warning exists yet.

**Step 3: Write minimal implementation**

Add to `shared/doctor/semantic-validator.js`, near the top after `INTERACTION_REQUIRED_FIELDS`:

```js
const COMPONENT_ALIASES = {
  card: 'section',
  container: 'section',
  box: 'section',
  label: 'text',
  textfield: 'input',
  separator: 'divider',
  hr: 'divider',
};
```

Add a helper:

```js
function addWarning(result, code, message) {
  if (!result.warnings) {
    result.warnings = [];
  }
  result.warnings.push({ code, message });
}
```

In the `validateNode` function, after the `nodeId` extraction and before the interaction checks, add:

```js
if (typeof node.component === 'string' && COMPONENT_ALIASES[node.component]) {
  addWarning(
    context.result,
    'COMPONENT_ALIAS',
    `Node "${nodeId}" uses component "${node.component}" — did you mean "${COMPONENT_ALIASES[node.component]}"?`,
  );
}
```

Note: The semantic validator's `result` object needs a `warnings` array. Check how it's initialized — likely in `shared/validate/index.js` or wherever `result` is created. Make sure `result.warnings` is initialized as `[]`. If it already is, no change needed. If not, add `warnings: []` to the result initialization.

**Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/doctor/semantic-validator.js test/validate.test.js
git commit -m "feat: warn on component aliases (card→section, container→section, etc.)"
```

---

### Task 4: Validation error grouping

When many errors share the same code and pattern, group and collapse them instead of dumping 40 identical lines.

**Files:**
- Modify: `cli/commands/validate.js:6-21` (formatIssues)
- Test: `test/validate.test.js`

**Step 1: Write the failing test**

This tests the formatting function directly. Add to `test/validate.test.js`:

```js
test('formatIssues groups repeated errors by code', () => {
  // We test the grouping logic by calling the shared formatter
  const { groupIssues } = require('../shared/validate/format');

  const errors = [];
  for (let i = 0; i < 10; i++) {
    errors.push({
      code: 'INTERACTION_MISSING_REQUIRED_FIELD',
      message: `Interaction type "navigation" on node "nav_${i}" is missing required field "targetRoute".`,
    });
  }

  const grouped = groupIssues(errors);

  assert.equal(grouped.length, 1);
  assert.ok(grouped[0].message.includes('10'));
  assert.equal(grouped[0].code, 'INTERACTION_MISSING_REQUIRED_FIELD');
  assert.ok(grouped[0].examples.length <= 3);
});

test('formatIssues preserves unique errors ungrouped', () => {
  const { groupIssues } = require('../shared/validate/format');

  const errors = [
    { code: 'TABLE_MISSING_COLUMNS', message: 'Table node "t1" must define columns.' },
    { code: 'DUPLICATE_NODE_ID', message: 'Page "home" has duplicate node id "btn".' },
  ];

  const grouped = groupIssues(errors);

  assert.equal(grouped.length, 2);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.js`
Expected: FAIL — `shared/validate/format.js` does not exist.

**Step 3: Write minimal implementation**

Create `shared/validate/format.js`:

```js
'use strict';

const GROUP_THRESHOLD = 3;

function groupIssues(issues) {
  const buckets = new Map();

  for (const issue of issues) {
    const code = issue.code || 'UNKNOWN';
    if (!buckets.has(code)) {
      buckets.set(code, []);
    }
    buckets.get(code).push(issue);
  }

  const result = [];
  for (const [code, items] of buckets) {
    if (items.length <= GROUP_THRESHOLD) {
      result.push(...items);
    } else {
      result.push({
        code,
        message: `${items.length} issues with code ${code}`,
        examples: items.slice(0, 3),
        totalCount: items.length,
      });
    }
  }

  return result;
}

function formatGroupedIssues(issues, label) {
  const grouped = groupIssues(issues);
  const lines = [];

  for (const issue of grouped) {
    if (issue.examples) {
      lines.push(`  - [${issue.code}] ${issue.message}`);
      for (const example of issue.examples) {
        lines.push(`      ${example.message}`);
      }
      const remaining = issue.totalCount - issue.examples.length;
      if (remaining > 0) {
        lines.push(`      (and ${remaining} more)`);
      }
    } else {
      lines.push(`  - [${issue.code}] ${issue.message}`);
    }
  }

  if (lines.length > 0) {
    return `wf validate found ${label}:\n${lines.join('\n')}`;
  }
  return '';
}

module.exports = { groupIssues, formatGroupedIssues };
```

Update `cli/commands/validate.js` to use the new formatter:

```js
'use strict';

const path = require('node:path');
const { runValidate } = require(path.resolve(__dirname, '..', '..', 'shared', 'validate'));
const { formatGroupedIssues } = require(path.resolve(__dirname, '..', '..', 'shared', 'validate', 'format'));

function formatIssues(result) {
  const errorOutput = formatGroupedIssues(result.errors, 'issues');
  if (errorOutput) {
    console.log(errorOutput);
  }
  const warningOutput = formatGroupedIssues(result.warnings, 'warnings');
  if (warningOutput) {
    console.log(warningOutput);
  }
}

function runValidateCommand(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const outputJson = args.includes('--json');
  const strict = args.includes('--strict');

  const result = runValidate({ projectPath: cwd, strict });

  if (outputJson) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  formatIssues(result);

  if (result.ok) {
    console.log('wf validate found no blocking errors.');
    return;
  }

  process.exitCode = 1;
}

module.exports = { runValidateCommand };
```

**Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/validate/format.js cli/commands/validate.js test/validate.test.js
git commit -m "feat: group repeated validation errors by code instead of bulk-dumping"
```

---

### Task 5: `wf schema --doc <type>` — structured schema printer

Add `--doc <type>` flag to `wf schema` that prints the full YAML structure for a document type with required/optional annotations.

**Files:**
- Create: `shared/schema/doc-printer.js`
- Modify: `cli/commands/schema.js` (accept `--doc` flag)
- Test: `test/validate.test.js` (or a new `test/schema-doc.test.js`)

**Step 1: Write the failing test**

Create `test/schema-doc.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { printSchemaDoc } = require('../shared/schema/doc-printer');

test('printSchemaDoc returns page structure', () => {
  const output = printSchemaDoc('page');
  assert.ok(output.includes('documentType'), 'Should include documentType');
  assert.ok(output.includes('specVersion'), 'Should include specVersion');
  assert.ok(output.includes('viewport'), 'Should include viewport');
  assert.ok(output.includes('slots'), 'Should include slots');
  assert.ok(output.includes('REQUIRED'), 'Should annotate required fields');
});

test('printSchemaDoc returns node structure', () => {
  const output = printSchemaDoc('node');
  assert.ok(output.includes('component'), 'Should include component');
  assert.ok(output.includes('interaction'), 'Should include interaction');
  assert.ok(output.includes('children'), 'Should include children');
});

test('printSchemaDoc returns manifest structure', () => {
  const output = printSchemaDoc('manifest');
  assert.ok(output.includes('projectId'), 'Should include projectId');
  assert.ok(output.includes('schemaVersion'), 'Should include schemaVersion');
});

test('printSchemaDoc returns null for unknown type', () => {
  const output = printSchemaDoc('nonexistent');
  assert.equal(output, null);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/schema-doc.test.js`
Expected: FAIL — module does not exist.

**Step 3: Write minimal implementation**

Create `shared/schema/doc-printer.js`:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.resolve(__dirname, '..', '..', 'schema.json');

function loadSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

const DOC_TYPE_MAP = {
  manifest: 'ManifestDocument',
  sitemap: 'SitemapDocument',
  templates: 'TemplatesDocument',
  components: 'ComponentsDocument',
  page: 'PageDocument',
  dataset: 'DatasetDocument',
  node: 'Node',
  interaction: 'Interaction',
  overlay: 'Overlay',
  layout: 'Layout',
  viewport: 'Viewport',
  condition: 'Condition',
};

function resolveRef(ref, schema) {
  if (!ref || !ref.startsWith('#/$defs/')) return null;
  const name = ref.replace('#/$defs/', '');
  return schema.$defs?.[name] || null;
}

function resolveType(propDef, schema, depth) {
  if (!propDef) return 'unknown';
  if (propDef.$ref) {
    const resolved = resolveRef(propDef.$ref, schema);
    if (resolved && depth < 3) {
      return formatDef(resolved, schema, depth + 1);
    }
    return propDef.$ref.replace('#/$defs/', '');
  }
  if (propDef.const) return JSON.stringify(propDef.const);
  if (propDef.enum) return propDef.enum.join(' | ');
  if (propDef.oneOf) {
    const types = propDef.oneOf.map((o) => {
      if (o.$ref) return o.$ref.replace('#/$defs/', '');
      if (o.type) return o.type;
      return '?';
    });
    return types.join(' | ');
  }
  if (propDef.anyOf) {
    const types = propDef.anyOf.map((o) => {
      if (o.$ref) return o.$ref.replace('#/$defs/', '');
      if (o.type) return o.type;
      return '?';
    });
    return types.join(' | ');
  }
  if (propDef.type === 'array' && propDef.items) {
    const itemType = propDef.items.$ref
      ? propDef.items.$ref.replace('#/$defs/', '')
      : propDef.items.type || 'object';
    return `array of ${itemType}`;
  }
  if (propDef.type) return propDef.type;
  return 'any';
}

function formatDef(def, schema, depth = 0) {
  if (!def || !def.properties) return resolveType(def, schema, depth);

  const indent = '  '.repeat(depth);
  const required = new Set(def.required || []);
  const lines = [];

  for (const [key, propDef] of Object.entries(def.properties)) {
    const req = required.has(key) ? ' # REQUIRED' : '';
    const desc = propDef.description ? ` — ${propDef.description}` : '';
    const type = resolveType(propDef, schema, depth);

    if (typeof type === 'string' && !type.includes('\n')) {
      lines.push(`${indent}${key}: <${type}>${req}${desc}`);
    } else {
      lines.push(`${indent}${key}:${req}${desc}`);
      lines.push(type.split('\n').map((l) => `${indent}  ${l}`).join('\n'));
    }
  }

  return lines.join('\n');
}

function printSchemaDoc(typeName) {
  const schema = loadSchema();
  const defName = DOC_TYPE_MAP[typeName];
  if (!defName) return null;

  const def = schema.$defs?.[defName];
  if (!def) return null;

  const output = formatDef(def, schema, 0);
  return `# ${defName} structure\n\n${output}`;
}

function listDocTypes() {
  return Object.keys(DOC_TYPE_MAP);
}

module.exports = { printSchemaDoc, listDocTypes };
```

Update `cli/commands/schema.js` to accept `--doc`:

```js
'use strict';

const path = require('node:path');
const { getSchemaReference } = require(path.resolve(__dirname, '..', '..', 'shared', 'schema', 'reference'));
const { printSchemaDoc, listDocTypes } = require(path.resolve(__dirname, '..', '..', 'shared', 'schema', 'doc-printer'));

const LABELS = {
  interactionTypes: 'Allowed interaction types',
  gestureTypes: 'Allowed gesture types',
  overlayTypes: 'Allowed overlay types',
  layoutPrimitives: 'Allowed layout primitives',
  conditionTypes: 'Allowed condition types',
};

function formatListLine(label, values) {
  const items = values.map((value) => value).join('\n  - ');
  return `${label}:\n  - ${items}`;
}

function runSchema(args = []) {
  try {
    const docIndex = args.indexOf('--doc');
    if (docIndex !== -1) {
      const typeName = args[docIndex + 1];
      if (!typeName) {
        console.log(`Usage: wf schema --doc <type>\n\nAvailable types: ${listDocTypes().join(', ')}`);
        return;
      }
      const output = printSchemaDoc(typeName);
      if (!output) {
        console.error(`Unknown schema type "${typeName}". Available: ${listDocTypes().join(', ')}`);
        process.exitCode = 1;
        return;
      }
      console.log(output);
      return;
    }

    const schema = getSchemaReference();

    console.log(`Supported schema version: ${schema.supportedSchemaVersion}`);
    console.log(formatListLine(LABELS.interactionTypes, schema.interactionTypes));
    console.log(formatListLine(LABELS.gestureTypes, schema.gestureTypes));
    console.log(formatListLine(LABELS.overlayTypes, schema.overlayTypes));
    console.log(formatListLine(LABELS.layoutPrimitives, schema.layoutPrimitives));
    console.log(formatListLine(LABELS.conditionTypes, schema.conditionTypes));
  } catch (error) {
    console.error(`wf schema failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  runSchema,
};
```

**Step 4: Run test to verify it passes**

Run: `node --test test/schema-doc.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/schema/doc-printer.js cli/commands/schema.js test/schema-doc.test.js
git commit -m "feat: add wf schema --doc <type> for full structure printing"
```

---

### Task 6: `wf llm` command — full LLM-facing schema reference

A new command that dumps complete, LLM-optimized instructions for how to use the wireframe CLI.

**Files:**
- Create: `shared/schema/llm-reference.js`
- Create: `cli/commands/llm.js`
- Modify: `cli/index.js` (register command)
- Test: `test/schema-doc.test.js`

**Step 1: Write the failing test**

Add to `test/schema-doc.test.js`:

```js
const { generateLlmReference } = require('../shared/schema/llm-reference');

test('generateLlmReference produces comprehensive output', () => {
  const output = generateLlmReference();
  // Must cover all critical gotcha areas
  assert.ok(output.includes('interaction'), 'Should mention interaction field');
  assert.ok(output.includes('targetRoute'), 'Should mention targetRoute');
  assert.ok(output.includes('targetOverlay'), 'Should mention targetOverlay');
  assert.ok(output.includes('slots'), 'Should explain slot nesting');
  assert.ok(output.includes('component'), 'Should list component types');
  assert.ok(output.includes('section'), 'Should mention section');
  assert.ok(output.includes('card'), 'Should warn about card alias');
  assert.ok(output.includes('orientation'), 'Should mention orientation defaults');
  assert.ok(output.includes('columns'), 'Should explain table columns');
  assert.ok(output.includes('key'), 'Should mention column key');
  assert.ok(output.includes('wf page add'), 'Should show CLI commands');
  assert.ok(output.length > 2000, 'Should be comprehensive');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test test/schema-doc.test.js`
Expected: FAIL — module does not exist.

**Step 3: Write minimal implementation**

Create `shared/schema/llm-reference.js`. This is a curated reference document generated from schema.json plus hardcoded gotchas. The function reads schema.json to extract enum lists (keeping it in sync) and wraps them in a comprehensive LLM-optimized guide.

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require('./constants');

const schemaPath = path.resolve(__dirname, '..', '..', 'schema.json');

function loadSchema() {
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

function extractEnumValues(schema, defPath) {
  const parts = defPath.split('.');
  let current = schema.$defs;
  for (const part of parts) {
    current = current?.[part];
  }
  return Array.isArray(current) ? current : [];
}

function generateLlmReference() {
  const schema = loadSchema();
  const primitives = extractEnumValues(schema, 'PrimitiveComponent.enum');
  const interactionTypes = extractEnumValues(schema, 'Interaction.properties.type.enum');
  const overlayTypes = extractEnumValues(schema, 'Overlay.properties.type.enum');
  const gestureTypes = extractEnumValues(schema, 'Interaction.properties.gestureType.enum');
  const layoutTypes = extractEnumValues(schema, 'Layout.properties.type.enum');
  const devices = extractEnumValues(schema, 'Viewport.properties.device.enum');

  return `# Wireframe CLI — LLM Reference
# Generated from schema.json v${SUPPORTED_SPEC_VERSION}
# Feed this to an LLM before asking it to create wireframe YAML files.

## Quick Start

1. Initialize: wf init my_project && cd my_project
2. Add a page: wf page add dashboard --path /dashboard --template main_template --device web
3. Add nodes: wf node add dashboard --parent main_content --id user_table --component table --props '{"columns":[{"key":"name","label":"Name"}]}'
4. Validate: wf validate
5. Build: wf build
6. Preview: wf serve

## CRITICAL RULES — Read These First

### Field Name Gotchas
- The field is "interaction" (array), NOT "interactions" — this is the #1 mistake.
- Navigation uses "targetRoute" (camelCase), NOT "target".
- Overlay interactions use "targetOverlay", NOT "overlay" or "target".
- Node identity uses "component" for primitives, "use" for custom components — never both.
- Table columns require "key" field (or "label" from which key auto-derives).

### Common Component Mistakes
- There is NO "card" component. Use "section" instead.
- There is NO "container" component. Use "section" instead.
- There is NO "label" component. Use "text" instead.
- There is NO "textfield" component. Use "input" instead.
- There is NO "separator" component. Use "divider" instead.

## Document Types

Every YAML file needs: documentType, specVersion: "${SUPPORTED_SPEC_VERSION}", id

Types: manifest, sitemap, templates, components, page, dataset

## Project Structure

\`\`\`
manifest.yaml          — project metadata
sitemap.yaml           — routes + appState
templates.yaml         — page shells (persistent regions + slots)
components.yaml        — reusable node trees
pages/<page_id>.yaml   — individual page content
data/<dataset_id>.yaml — mock data for tables/lists
\`\`\`

## Page YAML Structure

\`\`\`yaml
documentType: page
specVersion: "${SUPPORTED_SPEC_VERSION}"
id: my_page
page:
  id: my_page
  template: main_template      # must exist in templates.yaml
  viewport:
    device: web                # mobile | tablet | web
    # orientation: portrait    # auto-defaults: mobile=portrait, tablet=landscape, web=omitted
  wireframeStyle:
    border:
      style: solid             # solid | dashed
  slots:                       # array of slot fills
    - slotId: main_content     # must match a slot in the template
      content:                 # array of Node objects
        - id: heading_1
          component: heading
          props:
            label: "Dashboard"
        - id: user_table
          component: table
          props:
            columns:
              - { key: name, label: "Name" }
              - { key: email, label: "Email" }
              - { label: "Status" }       # key auto-derives to "status"
            rows:
              - { name: Alice, email: a@b.com, status: Active }
  # Optional fields:
  # renderMode: line | card
  # rendering: { mode: line|card, density: comfortable|compact }
  # pageState: { key: value }
  # dataSources: [{ id: ds_id, dataset: dataset_id }]
  # overlays: [{ id: ..., type: ..., content: [...] }]
\`\`\`

## Node Structure

Every node MUST have "id" and exactly one of: "component", "use", or "injectable".

\`\`\`yaml
id: my_node                      # REQUIRED — snake_case
component: section               # primitive component type
# OR
use: my_custom_component         # reference to components.yaml
props:                           # component-specific properties
  label: "My Label"
  title: "My Title"
layout:                          # how children are arranged
  type: stack                    # ${layoutTypes.join(' | ')}
  gap: 16
  padding: 12
size:
  width: 300                     # number (px) or string (e.g. "50%")
  height: 200
  minWidth: 100
  maxWidth: 500
children:                        # nested Node array
  - id: child_1
    component: text
    props: { label: "Hello" }
interaction:                     # array of interactions (NOT "interactions")
  - type: navigation
    targetRoute: dashboard       # route id from sitemap.yaml
visibility:
  condition:
    type: state_equals
    scope: page                  # page | app
    key: show_details
    equals: true
\`\`\`

## Primitive Components

${primitives.map((p) => `- ${p}`).join('\n')}

### Component Props Quick Reference

- heading: { label, level: 1-6 }
- paragraph: { label }
- text: { label }
- image: { src, alt, width, height }
- button: { label, variant: primary|secondary|ghost }
- input: { label, placeholder, type: text|email|password|number }
- textarea: { label, placeholder }
- select: { label, placeholder, options: [{ value, label }] }
- checkbox: { label }
- toggle: { label }
- section: { title }
- table: { columns: [{ key, label, width? }], rows: [{ ...values }], emptyText? }
- tab_bar: (use children with button nodes)
- divider: (no props)
- spacer: (no props, use size.height)

## Interactions

Field name is "interaction" (array), not "interactions".

${interactionTypes.map((t) => `- ${t}`).join('\n')}

### Interaction Required Fields

- navigation: { type, targetRoute }         — targetRoute is a route id
- open_overlay: { type, targetOverlay }      — overlay id
- close_overlay: { type, targetOverlay }     — overlay id
- toggle: { type, scope, stateKey }          — scope: page|app
- set_state: { type, scope, stateKey, value }
- submit: { type, formId }                   — formId must match a node id
- action: { type, actionId }
- gesture: { type, gestureType }             — ${gestureTypes.join(' | ')}

## Overlays

Types: ${overlayTypes.join(', ')}

\`\`\`yaml
overlays:
  - id: confirm_dialog
    type: modal
    content:
      - id: confirm_text
        component: paragraph
        props: { label: "Are you sure?" }
      - id: confirm_btn
        component: button
        props: { label: "Confirm" }
        interaction:
          - type: close_overlay
            targetOverlay: confirm_dialog
\`\`\`

dropdown/popover/menu/tooltip require "trigger" (node id) and "placement" (top|bottom|left|right|center).

## Templates

Templates define the page shell. Pages inject content into "slot" regions only.

\`\`\`yaml
templates:
  main_template:
    layout: { type: stack }
    regions:
      - id: top_nav
        kind: persistent        # pages cannot override this
        component: section
        children: [...]
      - id: main_content
        kind: slot              # pages inject content here
\`\`\`

## Viewport

- web: { device: "web" } — no orientation needed
- mobile: { device: "mobile", orientation: "portrait" } — defaults to portrait if omitted
- tablet: { device: "tablet", orientation: "landscape" } — defaults to landscape if omitted

Devices: ${devices.join(', ')}

## Table Columns

Each column needs at minimum a "key" or a "label":
- { key: "name", label: "Full Name" } — explicit key and label
- { key: "email" } — label defaults to key
- { label: "Phone Number" } — key auto-derives to "phone_number"
- "status" — string shorthand, both key and label are "status"

## State

Two scopes: appState (in sitemap.yaml, persists across pages) and pageState (in page, resets on nav).
State keys must be declared before being referenced.

## CLI Commands Reference

wf init <name>                     — scaffold project
wf page add <id> --path <p> --template <t> --device <d> [--orientation <o>]
wf page remove <id>
wf page list
wf node add <pageId> --parent <parentId> --id <nodeId> --component <type> [--props '<json>']
wf component add <id> --root '<yaml>'
wf overlay add <pageId> --id <overlayId> --type <type> --content '<yaml>'
wf validate [--strict] [--json]
wf lint
wf doctor
wf build [--out <dir>]
wf serve [--port <n>]
wf schema                          — print allowed types
wf schema --doc <type>             — print full structure (page, node, manifest, etc.)
wf tree <pageId>                   — print resolved node tree
wf inspect <pageId> <nodeId>       — inspect a node
wf routes                          — list all routes
wf data add <id> --primaryKey <k>
wf data item add <datasetId> --item '<json>'
wf export [--out <file>]
wf screenshots [--page <id>]
`;
}

module.exports = { generateLlmReference };
```

Create `cli/commands/llm.js`:

```js
'use strict';

const path = require('node:path');
const { generateLlmReference } = require(path.resolve(__dirname, '..', '..', 'shared', 'schema', 'llm-reference'));

function runLlm() {
  console.log(generateLlmReference());
}

module.exports = { runLlm };
```

Update `cli/index.js` — add the import and command handler:

Import (after line 23):
```js
const { runLlm } = require('./commands/llm');
```

USAGE string — add after the `schema` line:
```
  llm                   Print full LLM-optimized schema reference
```

Command handler — add after the `schema` handler block (after line 58):
```js
if (command === 'llm') {
  runLlm(commandArgs, { cwd });
  return;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test test/schema-doc.test.js`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add shared/schema/llm-reference.js cli/commands/llm.js cli/index.js test/schema-doc.test.js
git commit -m "feat: add wf llm command for LLM-optimized schema reference"
```

---

### Task 7: Wire up all changes and run full test suite

**Step 1: Run the full test suite**

Run: `node --test test/*.test.js`
Expected: All tests PASS.

**Step 2: Run wf validate on the sample project (if one exists)**

Run: `node cli/index.js validate` (from a test project)
Verify error grouping works.

**Step 3: Run wf schema --doc page**

Run: `node cli/index.js schema --doc page`
Verify structured output.

**Step 4: Run wf llm**

Run: `node cli/index.js llm`
Verify comprehensive output.

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final test suite and integration fixes for CLI DX improvements"
```

---

## Summary of Changes

| # | Issue | Fix | Files |
|---|-------|-----|-------|
| 1 | orientation required for mobile/tablet | Auto-default portrait/landscape | shared/page/index.js |
| 2 | table key required alongside label | Auto-derive key from label | shared/renderer/primitives.js, shared/doctor/semantic-validator.js |
| 3 | component: card doesn't exist | Alias map with suggestions | shared/doctor/semantic-validator.js |
| 4 | validation errors bulk-dumped | Group by code, collapse repeats | shared/validate/format.js, cli/commands/validate.js |
| 5 | wf schema shows no structure | --doc flag for full structure | shared/schema/doc-printer.js, cli/commands/schema.js |
| 6 | no LLM-facing reference | wf llm command | shared/schema/llm-reference.js, cli/commands/llm.js, cli/index.js |
| 7 | field naming non-obvious | Covered by wf llm + aliases | (all above) |
