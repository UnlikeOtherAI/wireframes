'use strict';

// Which components each document may use, for a project held in memory. It is the
// same registry and the same rules as a project on disk, with documents found by
// their path among the sources instead of read from files.

const { createComponentRegistryResolver } = require('../../component-registry/core');
const { normalizeVirtualImport, rootComponentsPath } = require('../../component-registry/virtual');
const { isObject } = require('./read');

function hasImports(entry) {
  return Boolean(entry) && isObject(entry.document.imports) && Object.keys(entry.document.imports).length > 0;
}

/**
 * @param {object[]} documents  the documents that parsed
 * @param {Function} report
 * @returns {{ componentMap: object, root: object | null, scope: Function }} `root` is the
 *   components document every page sees without importing it
 */
function createComponentScopes(documents, report) {
  const byPath = new Map(documents.filter((entry) => entry.path).map((entry) => [entry.path, entry]));
  const resolver = createComponentRegistryResolver({
    loadDocument(path) {
      const entry = byPath.get(path);
      if (!entry) throw new Error(`Imported components file does not exist: ${path}`);
      return { document: entry.document, documentType: entry.type };
    },
    resolveImportPath: normalizeVirtualImport,
  });
  // An import path that leaves the project throws; everything else comes back as a result.
  const attempt = (work) => {
    try {
      return work();
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const project = resolver.createEmptyRegistry();
  const rootPath = rootComponentsPath(documents.filter((entry) => entry.type === 'components' && entry.path).map((entry) => entry.path));
  const root = rootPath ? byPath.get(rootPath) : null;
  if (root) {
    const loaded = attempt(() => resolver.loadComponentsDocumentRegistry(rootPath, ''));
    if (loaded.ok) resolver.mergeComponentRegistry(project, loaded.registry);
    else report('error', 'COMPONENT_IMPORT_ERROR', `Unable to load project component registry: ${loaded.error}`, { entry: root, path: '$.imports', key: true });
  }

  /** The project's components plus what these documents import. */
  function scope(entries) {
    const importing = entries.filter(hasImports);
    // With nothing imported the project's own registry is the scope, and is not copied.
    if (importing.length === 0) return { ok: true, components: project.components };
    const combined = resolver.createEmptyRegistry();
    resolver.mergeComponentRegistry(combined, project);
    for (const entry of importing) {
      const imported = attempt(() => resolver.loadImportedComponentRegistry(entry.path, entry.document));
      const merged = imported.ok ? resolver.mergeComponentRegistry(combined, imported.registry) : imported;
      if (!merged.ok) return { ok: false, error: merged.error, entry };
    }
    return { ok: true, components: combined.components };
  }

  return { componentMap: project.components, root, scope };
}

module.exports = { createComponentScopes };
