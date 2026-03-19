'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_SPEC_VERSION } = require('./constants');

const schemaPath = path.resolve(__dirname, 'schema.json');

function parseSchema() {
  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw);
}

function normalizeList(values) {
  return Array.from(new Set((values || []).filter((value) => typeof value === 'string' && value.trim() !== ''))).map(
    (value) => value.trim(),
  );
}

function loadAllowedValues() {
  const schema = parseSchema();
  const conditionDefs = Array.isArray(schema?.$defs?.Condition?.oneOf) ? schema.$defs.Condition.oneOf : [];

  return {
    interactionTypes: normalizeList(schema?.$defs?.Interaction?.properties?.type?.enum),
    gestureTypes: normalizeList(schema?.$defs?.Interaction?.properties?.gestureType?.enum),
    overlayTypes: normalizeList(schema?.$defs?.Overlay?.properties?.type?.enum),
    layoutPrimitives: normalizeList(schema?.$defs?.PrimitiveComponent?.enum),
    conditionTypes: normalizeList(
      conditionDefs
        .map((condition) => condition?.properties?.type?.const)
        .filter((value) => typeof value === 'string'),
    ),
  };
}

function getSchemaReference() {
  return {
    supportedSchemaVersion: SUPPORTED_SPEC_VERSION,
    ...loadAllowedValues(),
  };
}

module.exports = { getSchemaReference };
