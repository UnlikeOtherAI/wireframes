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
