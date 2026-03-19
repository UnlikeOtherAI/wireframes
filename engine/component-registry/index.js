'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { loadDocumentFromFile } = require(path.resolve(__dirname, '..', 'schema'));
const { SUPPORTED_SPEC_VERSION } = require(path.resolve(__dirname, '..', 'schema', 'constants'));

const { PRIMITIVE_COMPONENTS } = require(path.resolve(__dirname, '..', 'schema', 'primitives'));

const COMPONENTS_FILE_NAME = 'components.yaml';
const IMPORT_ALIAS_REGEX = /^[a-z][a-z0-9_]*$/;

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function cloneDeep(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneDeep(entry));
  }

  if (!isObject(value)) {
    return value;
  }

  const clone = {};
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneDeep(item);
  }
  return clone;
}

function componentsFilePath(projectPath) {
  return path.join(projectPath, COMPONENTS_FILE_NAME);
}

function readImportMap(document) {
  if (!isObject(document?.imports)) {
    return {};
  }
  return document.imports;
}

function qualifyReference(namespacePrefix, reference) {
  return namespacePrefix ? `${namespacePrefix}.${reference}` : reference;
}

function remapComponentReference(reference, localComponentIds, importAliases, namespacePrefix) {
  if (typeof reference !== 'string') {
    return reference;
  }

  const normalized = reference.trim();
  if (!normalized) {
    return reference;
  }

  if (normalized.includes('.')) {
    const [alias] = normalized.split('.');
    if (importAliases.has(alias)) {
      return qualifyReference(namespacePrefix, normalized);
    }
    return normalized;
  }

  if (localComponentIds.has(normalized)) {
    return qualifyReference(namespacePrefix, normalized);
  }

  return normalized;
}

function rewriteComponentNode(node, context) {
  if (!isObject(node)) {
    return;
  }

  if (typeof node.use === 'string') {
    node.use = remapComponentReference(
      node.use,
      context.localComponentIds,
      context.importAliases,
      context.namespacePrefix,
    );
  }

  if (typeof node.component === 'string' && !PRIMITIVE_COMPONENTS.has(node.component)) {
    node.component = remapComponentReference(
      node.component,
      context.localComponentIds,
      context.importAliases,
      context.namespacePrefix,
    );
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      rewriteComponentNode(child, context);
    }
  }
}

function mergeComponentRegistry(target, source) {
  for (const [componentId, componentDoc] of Object.entries(source.components)) {
    const targetSource = target.sources[componentId];
    const incomingSource = source.sources[componentId];

    if (targetSource) {
      if (
        targetSource.sourcePath === incomingSource.sourcePath
        && targetSource.localId === incomingSource.localId
      ) {
        continue;
      }

      return {
        ok: false,
        error: `Duplicate component id "${componentId}" from ${incomingSource.sourcePath} conflicts with ${targetSource.sourcePath}.`,
      };
    }

    target.components[componentId] = componentDoc;
    target.sources[componentId] = incomingSource;
  }

  return { ok: true };
}

function createEmptyRegistry() {
  return {
    components: {},
    sources: {},
  };
}

function loadComponentsDocumentRegistry(filePath, namespacePrefix, stack = []) {
  const absolutePath = path.resolve(filePath);
  if (stack.includes(absolutePath)) {
    const cycle = [...stack, absolutePath].map((entry) => path.relative(process.cwd(), entry) || entry).join(' -> ');
    return {
      ok: false,
      error: `Circular component import detected: ${cycle}`,
    };
  }

  let loaded;
  try {
    loaded = loadDocumentFromFile(absolutePath, { supportedSpecVersion: SUPPORTED_SPEC_VERSION });
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  if (loaded.documentType !== 'components') {
    return {
      ok: false,
      error: `Imported file "${absolutePath}" must be a components document.`,
    };
  }

  const registry = createEmptyRegistry();
  const components = isObject(loaded.document?.components) ? loaded.document.components : {};
  const localComponentIds = new Set(Object.keys(components));
  const imports = readImportMap(loaded.document);
  const importAliases = new Set(Object.keys(imports));
  const context = {
    localComponentIds,
    importAliases,
    namespacePrefix,
  };

  for (const [componentId, componentDoc] of Object.entries(components)) {
    if (!isObject(componentDoc) || !isObject(componentDoc.root)) {
      continue;
    }

    const qualifiedId = qualifyReference(namespacePrefix, componentId);
    const cloned = cloneDeep(componentDoc);
    rewriteComponentNode(cloned.root, context);

    registry.components[qualifiedId] = cloned;
    registry.sources[qualifiedId] = {
      sourcePath: absolutePath,
      localId: componentId,
    };
  }

  for (const [alias, relativeImportPath] of Object.entries(imports)) {
    if (!IMPORT_ALIAS_REGEX.test(alias)) {
      return {
        ok: false,
        error: `Invalid import alias "${alias}" in ${absolutePath}.`,
      };
    }
    if (typeof relativeImportPath !== 'string' || !relativeImportPath.trim()) {
      return {
        ok: false,
        error: `Import "${alias}" in ${absolutePath} must be a relative file path.`,
      };
    }

    const resolvedImportPath = path.resolve(path.dirname(absolutePath), relativeImportPath.trim());
    if (!fs.existsSync(resolvedImportPath)) {
      return {
        ok: false,
        error: `Imported components file does not exist: ${resolvedImportPath}`,
      };
    }

    const importedRegistry = loadComponentsDocumentRegistry(
      resolvedImportPath,
      qualifyReference(namespacePrefix, alias),
      [...stack, absolutePath],
    );
    if (!importedRegistry.ok) {
      return importedRegistry;
    }

    const mergeResult = mergeComponentRegistry(registry, importedRegistry.registry);
    if (!mergeResult.ok) {
      return mergeResult;
    }
  }

  return {
    ok: true,
    registry,
  };
}

function loadProjectComponentRegistry(projectPath) {
  const filePath = componentsFilePath(projectPath);
  if (!fs.existsSync(filePath)) {
    return {
      ok: true,
      registry: createEmptyRegistry(),
    };
  }

  return loadComponentsDocumentRegistry(filePath, '');
}

function loadImportedComponentRegistry(documentPath, document) {
  const imports = readImportMap(document);
  const registry = createEmptyRegistry();

  for (const [alias, relativeImportPath] of Object.entries(imports)) {
    if (!IMPORT_ALIAS_REGEX.test(alias)) {
      return {
        ok: false,
        error: `Invalid import alias "${alias}" in ${documentPath}.`,
      };
    }
    if (typeof relativeImportPath !== 'string' || !relativeImportPath.trim()) {
      return {
        ok: false,
        error: `Import "${alias}" in ${documentPath} must be a relative file path.`,
      };
    }

    const resolvedImportPath = path.resolve(path.dirname(documentPath), relativeImportPath.trim());
    if (!fs.existsSync(resolvedImportPath)) {
      return {
        ok: false,
        error: `Imported components file does not exist: ${resolvedImportPath}`,
      };
    }

    const importedRegistry = loadComponentsDocumentRegistry(resolvedImportPath, alias, [path.resolve(documentPath)]);
    if (!importedRegistry.ok) {
      return importedRegistry;
    }

    const mergeResult = mergeComponentRegistry(registry, importedRegistry.registry);
    if (!mergeResult.ok) {
      return mergeResult;
    }
  }

  return {
    ok: true,
    registry,
  };
}

function loadComponentRegistryForDocuments(projectPath, documents = []) {
  const projectRegistry = loadProjectComponentRegistry(projectPath);
  if (!projectRegistry.ok) {
    return projectRegistry;
  }

  const combined = createEmptyRegistry();
  const mergeProjectResult = mergeComponentRegistry(combined, projectRegistry.registry);
  if (!mergeProjectResult.ok) {
    return mergeProjectResult;
  }

  for (const entry of documents) {
    const documentPath = typeof entry?.documentPath === 'string' ? entry.documentPath : '';
    const document = entry?.document;
    if (!documentPath || !isObject(document)) {
      continue;
    }

    const importedRegistry = loadImportedComponentRegistry(documentPath, document);
    if (!importedRegistry.ok) {
      return importedRegistry;
    }

    const mergeResult = mergeComponentRegistry(combined, importedRegistry.registry);
    if (!mergeResult.ok) {
      return mergeResult;
    }
  }

  return {
    ok: true,
    registry: combined,
  };
}

module.exports = {
  componentsFilePath,
  createEmptyRegistry,
  loadComponentRegistryForDocuments,
  loadImportedComponentRegistry,
  loadProjectComponentRegistry,
};
