'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const schema = require('@wireframes/engine/schema/schema.json');
const { PRIMITIVES, ALIASES, primitiveNames } = require('@wireframes/engine/schema/primitive-registry');
const { ROLES, tokenNames } = require('@wireframes/engine/renderer/sizing-tokens');
const { PRIMITIVE_COMPONENTS } = require('@wireframes/engine/schema/primitives');

const repoRoot = path.resolve(__dirname, '..', '..');

// schema.json is what the validator reads and what every consumer follows, but
// it is generated from the registry. Editing one without the other would let
// the contract and the renderer disagree silently, so the generator runs in
// --check mode here.
test('schema.json is in sync with the primitive registry', () => {
  execFileSync('node', [path.join(repoRoot, 'scripts', 'sync-schema-primitives.js'), '--check'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
});

test('every element has a props definition and a dispatch entry', () => {
  const defs = schema.$defs;
  for (const entry of PRIMITIVES) {
    const def = defs[`PrimitiveProps_${entry.name}`];
    assert.ok(def, `schema.json has no PrimitiveProps_${entry.name}`);
    for (const prop of Object.keys(entry.props || {})) {
      assert.ok(def.properties?.[prop], `PrimitiveProps_${entry.name} is missing "${prop}"`);
    }
    assert.ok(PRIMITIVE_COMPONENTS.has(entry.name), `${entry.name} is not in PRIMITIVE_COMPONENTS`);
  }
  assert.deepEqual(
    [...defs.PrimitiveComponent.enum].sort(),
    [...primitiveNames()].sort(),
    'the component enum and the registry disagree',
  );
});

test('every alias points at a real element', () => {
  for (const [alias, target] of ALIASES) {
    assert.ok(primitiveNames().includes(target), `alias "${alias}" points at "${target}", which is not an element`);
    assert.ok(!primitiveNames().includes(alias), `alias "${alias}" shadows a real element`);
  }
});

test('roles and sizing tokens are declared in the schema', () => {
  assert.deepEqual([...schema.$defs.Role.enum].sort(), [...ROLES].sort());
  assert.deepEqual(
    Object.keys(schema.$defs.SizingTokens.properties).sort(),
    [...tokenNames()].sort(),
  );
});
