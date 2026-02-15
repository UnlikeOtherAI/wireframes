'use strict';

const path = require('node:path');
const { inspectAddress } = require(path.resolve(__dirname, '..', '..', 'shared', 'introspection'));

const SUBCOMMAND_USAGE = 'Usage: wf inspect <wf://page|template|component/<id>#<path>>';

function printChildren(children = []) {
  if (children.length === 0) {
    console.log('Children: <none>');
    return;
  }

  console.log('Children:');
  for (const child of children) {
    console.log(`- ${child.id}`);
  }
}

function printLayoutSummary(summary) {
  console.log(`Layout summary: hasLayout=${summary.hasLayout}, hasChildren=${summary.hasChildren}, childrenCount=${summary.childrenCount}`);
  if (summary.layout) {
    console.log(`Layout: ${JSON.stringify(summary.layout)}`);
  }
}

function runInspect(args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const address = args[0];

  if (!address) {
    console.error('wf inspect requires <address>.');
    console.log(SUBCOMMAND_USAGE);
    process.exitCode = 2;
    return;
  }

  const result = inspectAddress({
    projectPath: cwd,
    address,
  });

  if (!result.ok) {
    console.error(`wf inspect failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Origin: ${result.origin}`);
  console.log(`Source: ${result.sourceRef}`);
  console.log(`Resolved path: ${result.resolvedAddress}`);
  console.log('Node definition:');
  console.log(JSON.stringify(result.node, null, 2));
  printChildren(result.children);
  printLayoutSummary(result.layoutSummary);
}

module.exports = {
  runInspect,
};
