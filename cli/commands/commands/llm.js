'use strict';

const path = require('node:path');
const enginePath = path.resolve(__dirname, '..', '..', '..', 'engine', 'schema');
const { generateLlmReference, elementCheatSheet } = require(path.join(enginePath, 'llm-reference'));
const { getPrimitive, primitivesByFamily, FAMILY_ORDER } = require(path.join(enginePath, 'primitive-registry'));

function printElement(entry) {
  console.log(`${entry.name} — ${entry.summary}`);
  console.log(`frame: ${entry.frame}  family: ${entry.family}`);
  console.log('props:');
  for (const [name, spec] of Object.entries(entry.props || {})) {
    const type = Array.isArray(spec.enum) ? spec.enum.join(' | ') : (Array.isArray(spec.type) ? spec.type.join(' | ') : spec.type);
    const notes = [spec.primary ? 'primary' : '', spec.aliasOf ? `alias of ${spec.aliasOf}` : ''].filter(Boolean).join(', ');
    console.log(`  ${name}: ${type}${notes ? `  (${notes})` : ''}`);
  }
  console.log(`example: ${entry.example}`);
}

function runLlm(args = []) {
  const elementIndex = args.indexOf('--element');
  if (elementIndex >= 0) {
    const name = args[elementIndex + 1];
    const entry = getPrimitive(name);
    if (!entry) {
      console.error(`Unknown element "${name}".`);
      process.exitCode = 1;
      return;
    }
    printElement(entry);
    return;
  }

  const familyIndex = args.indexOf('--family');
  if (familyIndex >= 0) {
    const family = args[familyIndex + 1];
    if (!FAMILY_ORDER.includes(family)) {
      console.error(`Unknown family "${family}". One of: ${FAMILY_ORDER.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    for (const entry of primitivesByFamily(family)) {
      printElement(entry);
      console.log('');
    }
    return;
  }

  console.log(args.includes('--short') ? elementCheatSheet() : generateLlmReference());
}

module.exports = { runLlm };
