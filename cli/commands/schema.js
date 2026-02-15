'use strict';

const path = require('node:path');
const { getSchemaReference } = require(path.resolve(__dirname, '..', '..', 'shared', 'schema', 'reference'));

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

function runSchema() {
  try {
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
