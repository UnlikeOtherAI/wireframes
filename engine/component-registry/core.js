'use strict';

const { PRIMITIVE_COMPONENTS } = require('../schema/primitives');
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
    components: Object.create(null),
    sources: Object.create(null),
  };
}


function createComponentRegistryResolver({
  loadDocument,
  resolveImportPath,
  canonicalPath = (value) => value,
  formatPath = (value) => value,
}) {
  function loadComponentsDocumentRegistry(filePath, namespacePrefix, stack = []) {
    const absolutePath = canonicalPath(filePath);
    if (stack.includes(absolutePath)) {
      const cycle = [...stack, absolutePath].map((entry) => formatPath(entry)).join(' -> ');
      return {
        ok: false,
        error: `Circular component import detected: ${cycle}`,
      };
    }

    let loaded;
    try {
      loaded = loadDocument(absolutePath);
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

      const resolvedImportPath = resolveImportPath(absolutePath, relativeImportPath.trim());

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

      const resolvedImportPath = resolveImportPath(documentPath, relativeImportPath.trim());

      const importedRegistry = loadComponentsDocumentRegistry(resolvedImportPath, alias, [canonicalPath(documentPath)]);
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
  return { createEmptyRegistry, mergeComponentRegistry, loadComponentsDocumentRegistry, loadImportedComponentRegistry };
}

module.exports = { createComponentRegistryResolver };
