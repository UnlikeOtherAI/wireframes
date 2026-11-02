'use strict';

const path = require('node:path');
const { explainNode } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'introspection', 'why'));

const USAGE = 'Usage: wf why <nodeId> [--page <pageId>] [--json]';

function runWhy(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const positional = args.filter((arg) => !arg.startsWith('--'));
  const pageIndex = args.indexOf('--page');
  const pageId = pageIndex >= 0 ? args[pageIndex + 1] : undefined;
  const nodeId = positional.find((arg) => arg !== pageId);

  if (!nodeId) {
    console.error('wf why requires a node id.');
    console.log(USAGE);
    process.exitCode = 2;
    return;
  }

  const result = explainNode({ projectPath: cwd, pageId, nodeId });
  if (!result.ok) {
    console.error(`wf why failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  if (flags.has('--json')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${result.nodeId} — <${result.element}> on page "${result.pageId}"`);
  console.log(`Frame:  ${result.frame}${result.frame === 'surface' ? ' (draws a box)' : ' (no box)'}`);
  console.log(`Rule:   ${result.rule} — ${result.because}`);
  console.log(`Reason: ${result.reason}`);
  if (result.role) {
    console.log(`Role:   ${result.role}`);
  }
  if (Array.isArray(result.sizing) && result.sizing.length > 0) {
    console.log('Sizing:');
    for (const entry of result.sizing) {
      console.log(`  ${entry.name} = ${entry.value}px  (override with size, or manifest.sizing.${entry.name})`);
    }
  }
  console.log(`To change it: ${result.fix}`);
}

module.exports = { runWhy };
