'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const yaml = require('js-yaml');
const { DEFAULT_SPEC_VERSION, SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));
const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema', 'loader'));
const { validateDocument } = require(path.resolve(__dirname, '..', 'schema'));
const { componentsFilePath, loadProjectComponentRegistry } = require(path.resolve(__dirname, '..', 'component-registry'));
const { projectFileTarget } = require(path.resolve(__dirname, '..', 'component-registry', 'project-file'));
const { insertComponentDefinition } = require('./insert-definition');
const { STD_PREFIX, builtinComponentDefinition } = require(path.resolve(__dirname, '..', 'stdlib'));

const COMPONENT_ID_REGEX = /^[a-z][a-z0-9_]*$/;

function emptyComponentsDocument() {
  return { documentType: 'components', specVersion: DEFAULT_SPEC_VERSION, id: 'components', components: {} };
}

function displayPath(projectPath, filePath) {
  return path.relative(projectPath, filePath).split(path.sep).join('/') || filePath;
}

const FILE_HINT = 'Pass a components document inside the project, for example --file components/<name>.yaml.';

/** Where the copy may be written: inside the project, links followed. */
function writeTarget(projectPath, filePath, label) {
  const target = projectFileTarget(projectPath, filePath);
  if (target.inside) return { ok: true, realPath: target.realPath };
  const root = path.resolve(projectPath);
  return {
    ok: false,
    error: target.linked
      ? `${label} links to ${target.realPath}, outside the project (${root}). ${FILE_HINT}`
      : `${label} is outside the project (${root}). ${FILE_HINT}`,
  };
}

/** Replaces the file in one step, so a failed write never leaves half a document. */
function writeFileAtomic(filePath, text) {
  const temp = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  const mode = fs.existsSync(filePath) ? fs.statSync(filePath).mode : undefined;
  try {
    fs.writeFileSync(temp, text, { encoding: 'utf8', mode });
    fs.renameSync(temp, filePath);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

/** The id to `use:` a component written to `filePath` as `localId`, if the project registry reaches it. */
function usableId(projectPath, filePath, localId) {
  const loaded = loadProjectComponentRegistry(projectPath);
  if (!loaded.ok) return null;
  const target = path.resolve(filePath);
  const match = Object.entries(loaded.registry.sources)
    .find(([, source]) => path.resolve(source.sourcePath) === target && source.localId === localId);
  return match ? match[0] : null;
}

/**
 * Copies a built-in `std.<name>` pattern into a components document so it can
 * be edited like any local component. The target is the project's default
 * `components.yaml` (created when missing) or an existing, valid components
 * document inside the project. Refuses an id the document already has, adds the
 * definition to the existing text without rewriting it, and writes nothing
 * unless the result validates.
 */
function copyComponent({ projectPath, componentId, as, file }) {
  const id = typeof componentId === 'string' ? componentId.trim() : '';
  const definition = builtinComponentDefinition(id);
  if (!definition) {
    return { ok: false, error: `"${id}" is not a built-in std pattern. Run \`wf component list --std\` to see them.` };
  }

  const targetId = typeof as === 'string' && as.trim() !== '' ? as.trim() : id.slice(STD_PREFIX.length);
  if (!COMPONENT_ID_REGEX.test(targetId)) {
    return { ok: false, error: `Invalid component id "${targetId}". Use snake_case starting with a letter.` };
  }

  const filePath = file ? path.resolve(projectPath, file) : componentsFilePath(projectPath);
  const label = displayPath(projectPath, filePath);
  const target = writeTarget(projectPath, filePath, label);
  if (!target.ok) return target;

  let document;
  let source = null;
  if (fs.existsSync(target.realPath)) {
    try {
      const loaded = loadDocumentFromFile(target.realPath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
      if (loaded.documentType !== 'components') {
        return { ok: false, error: `${label} is a ${loaded.documentType} document, not a components document.` };
      }
      document = loaded.document;
      source = fs.readFileSync(target.realPath, 'utf8');
    } catch (error) {
      return { ok: false, error: `${label} is not a valid components document: ${error.message}` };
    }
  } else if (file) {
    return { ok: false, error: `${label} does not exist. --file takes an existing components document.` };
  } else {
    document = emptyComponentsDocument();
  }

  const components = document.components && typeof document.components === 'object' ? document.components : {};
  if (Object.hasOwn(components, targetId)) {
    return { ok: false, error: `Component "${targetId}" already exists in ${label}. Pick another id with --as <id>.` };
  }

  const copy = structuredClone(definition);
  copy.root.id = targetId;
  const next = { ...document, components: { ...components, [targetId]: copy } };
  try {
    validateDocument(next, label, SUPPORTED_SPEC_VERSION);
  } catch (error) {
    const details = Array.isArray(error.details?.errors)
      ? error.details.errors.map((entry) => `${entry.path || ''} ${entry.message}`.trim()).join('; ')
      : error.message;
    return { ok: false, error: `The copy would make ${label} invalid: ${details}` };
  }

  // An existing document keeps its text; only the new definition is added to it.
  const text = source == null ? `${yaml.dump(next)}\n` : insertComponentDefinition(source, targetId, copy);
  let written = null;
  try {
    written = text == null ? null : yaml.load(text);
  } catch {
    written = null;
  }
  if (!isDeepStrictEqual(written, next)) {
    return { ok: false, error: `Could not add "${targetId}" to ${label} without rewriting the rest of it. Add the copy to a block-style components document, or pass another --file.` };
  }

  writeFileAtomic(target.realPath, text);
  return {
    ok: true, componentId: targetId, source: id, filePath: label, created: source == null,
    useId: usableId(projectPath, filePath, targetId),
  };
}

module.exports = { copyComponent };
