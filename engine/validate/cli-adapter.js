'use strict';

const { runDoctor } = require('../doctor');

function promoteWarningsToErrors(result) {
  for (const warning of result.warnings) {
    result.errors.push({
      code: `STRICT_${warning.code ?? 'WARNING'}`,
      message: `[strict] ${warning.message}`,
    });
  }
  result.warnings = [];
}

function runValidate({ projectPath, strict = false } = {}) {
  const result = runDoctor({
    projectPath: projectPath || process.cwd(),
  });

  if (strict && result.warnings.length > 0) {
    promoteWarningsToErrors(result);
    result.ok = result.errors.length === 0 && result.warnings.length === 0;
  }

  return {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    projectPath: result.projectPath,
  };
}

module.exports = {
  runValidate,
  promoteWarningsToErrors,
};
