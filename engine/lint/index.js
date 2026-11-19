'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { runDoctor } = require('../doctor');
const { lintDocuments, RESERVED_KEYWORDS } = require('./rules/documents');

function isYamlFile(fileName) {
  return fileName.endsWith('.yaml') || fileName.endsWith('.yml');
}

function loadYamlSafe(filePath, result) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    return yaml.load(content);
  } catch (error) {
    result.errors.push({ code: 'INVALID_YAML', message: `Invalid YAML in ${filePath}: ${error.message}` });
    return null;
  }
}

function loadYamlDirectory(directory, result) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(isYamlFile).sort()
    .map((fileName) => loadYamlSafe(path.join(directory, fileName), result))
    .filter(Boolean);
}

/** Reads the project from disk and applies the lint rules to it. */
function collectLintTargets(projectPath, result, renderedPages) {
  const root = path.resolve(projectPath);
  lintDocuments(result, {
    renderedPages,
    manifest: loadYamlSafe(path.join(root, 'manifest.yaml'), result),
    sitemap: loadYamlSafe(path.join(root, 'sitemap.yaml'), result),
    templates: loadYamlSafe(path.join(root, 'templates.yaml'), result),
    components: loadYamlSafe(path.join(root, 'components.yaml'), result),
    datasets: loadYamlDirectory(path.join(root, 'data'), result),
    pages: loadYamlDirectory(path.join(root, 'pages'), result),
  });
}

function promoteWarningsToErrors(result) {
  for (const warning of result.warnings) {
    result.errors.push({
      code: `STRICT_${warning.code ?? 'WARNING'}`,
      message: `[strict] ${warning.message}`,
    });
  }
  result.warnings = [];
}

function runLint({ projectPath, strict = false } = {}) {
  const renderedPages = [];
  const result = runDoctor({ projectPath, onRenderedPage: (page) => renderedPages.push(page) });

  if (result.errors.length === 0) {
    collectLintTargets(projectPath, result, renderedPages);
  }

  if (strict && result.warnings.length > 0) {
    promoteWarningsToErrors(result);
  }

  result.ok = result.errors.length === 0;
  return result;
}

module.exports = {
  runLint,
  promoteWarningsToErrors,
  RESERVED_KEYWORDS,
};
