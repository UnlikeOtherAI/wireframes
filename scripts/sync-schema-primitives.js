'use strict';

// Regenerates the primitive section of engine/schema/schema.json from
// engine/schema/primitive-registry. schema.json stays the file the validator
// reads and the contract everything else follows; this keeps it from drifting
// away from the registry by hand. cli/test/schema-registry-drift.test.js fails
// if someone edits one without the other.
//
//   node scripts/sync-schema-primitives.js [--check]

const fs = require('node:fs');
const path = require('node:path');

const { PRIMITIVES, ALIASES } = require('../engine/schema/primitive-registry');
const { ROLES, tokenNames } = require('../engine/renderer/sizing-tokens');

const schemaPath = path.join(__dirname, '..', 'engine', 'schema', 'schema.json');

function propSchema(name, spec) {
  const out = {};
  if (Array.isArray(spec.enum)) {
    out.type = 'string';
    out.enum = spec.enum;
  } else if (spec.type === 'number') {
    out.type = 'number';
  } else if (spec.type === 'boolean') {
    out.type = 'boolean';
  } else if (spec.type === 'array') {
    out.type = 'array';
  } else if (Array.isArray(spec.type)) {
    out.type = spec.type;
  } else {
    out.type = 'string';
  }
  if (spec.aliasOf) {
    out.description = `Accepted alias for ${spec.aliasOf}; ${spec.aliasOf} wins when both are set.`;
  }
  return out;
}

function build(schema) {
  const defs = schema.$defs;

  // Drop the previous generation so removed primitives do not linger.
  for (const key of Object.keys(defs)) {
    if (key.startsWith('PrimitiveProps_')) delete defs[key];
  }

  const names = PRIMITIVES.map((entry) => entry.name).sort();
  defs.PrimitiveComponent = { type: 'string', enum: names };
  defs.PrimitiveAlias = { type: 'string', enum: Array.from(ALIASES.keys()).sort() };
  defs.Role = { type: 'string', enum: [...ROLES].sort() };
  defs.SizingTokens = {
    type: 'object',
    additionalProperties: false,
    description: 'Project-wide overrides for built-in proportions, token name to pixels.',
    properties: Object.fromEntries(tokenNames().sort().map((token) => [token, { type: 'number', minimum: 0 }])),
  };

  for (const entry of PRIMITIVES) {
    const properties = {};
    for (const [prop, spec] of Object.entries(entry.props || {})) {
      properties[prop] = propSchema(prop, spec);
    }
    defs[`PrimitiveProps_${entry.name}`] = {
      type: 'object',
      description: entry.summary,
      properties,
      ...(Array.isArray(entry.required) && entry.required.length > 0 ? { required: entry.required } : {}),
    };
  }

  // One `if component is X then props match PrimitiveProps_X` branch per primitive.
  const keep = (schema.$defs.Node.allOf || []).filter((branch) => !(
    branch.if && branch.if.properties && branch.if.properties.component
    && typeof branch.if.properties.component.const === 'string'
  ));
  const branches = PRIMITIVES.map((entry) => ({
    if: { properties: { component: { const: entry.name } }, required: ['component'] },
    then: { properties: { props: { $ref: `#/$defs/PrimitiveProps_${entry.name}` } } },
  }));
  schema.$defs.Node.allOf = [...keep, ...branches];

  return schema;
}

function main() {
  const original = fs.readFileSync(schemaPath, 'utf8');
  const next = `${JSON.stringify(build(JSON.parse(original)), null, 2)}\n`;

  if (process.argv.includes('--check')) {
    if (next !== original) {
      process.stderr.write('schema.json is out of sync with the primitive registry. Run: node scripts/sync-schema-primitives.js\n');
      process.exitCode = 1;
    }
    return;
  }

  fs.writeFileSync(schemaPath, next);
  process.stdout.write(`Synced ${PRIMITIVES.length} primitives into engine/schema/schema.json\n`);
}

main();
