'use strict';

const path = require('node:path');
const { listRoutes } = require(path.resolve(__dirname, '..', '..', '..', 'engine', 'introspection'));

function runRoutes(_args, context = {}) {
  const cwd = context.cwd || process.cwd();
  const result = listRoutes(cwd);

  if (!result.ok) {
    console.error(`wf routes failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }

  for (const route of result.routes) {
    console.log(`${route.id} ${route.path} -> page ${route.page} / template ${route.template}`);
  }
}

module.exports = {
  runRoutes,
};
