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

function resolveType(propDef, schema, depth) {
  if (!propDef) return 'unknown';
  if (propDef.$ref) {
    const name = propDef.$ref.replace('#/$defs/', '');
    const resolved = schema.$defs?.[name];
    if (resolved && depth < 3) {
      return formatDef(resolved, schema, depth + 1);
    }
    return name;
  }
  if (propDef.const) return JSON.stringify(propDef.const);
  if (propDef.enum) return propDef.enum.join(' | ');
  if (propDef.oneOf) {
    return propDef.oneOf.map((o) => {
      if (o.$ref) return o.$ref.replace('#/$defs/', '');
      if (o.type) return o.type;
      return '?';
    }).join(' | ');
  }
  if (propDef.anyOf) {
    return propDef.anyOf.map((o) => {
      if (o.$ref) return o.$ref.replace('#/$defs/', '');
      if (o.type) return o.type;
      return '?';
    }).join(' | ');
  }
  if (propDef.type === 'object' && propDef.properties && depth < 4) {
    return formatDef(propDef, schema, depth + 1);
  }
  if (propDef.type === 'array' && propDef.items) {
    if (propDef.items.$ref) {
      return `array of ${propDef.items.$ref.replace('#/$defs/', '')}`;
    }
    if (propDef.items.properties && depth < 4) {
      return `array of:\n${formatDef(propDef.items, schema, depth + 1)}`;
    }
    return `array of ${propDef.items.type || 'object'}`;
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
