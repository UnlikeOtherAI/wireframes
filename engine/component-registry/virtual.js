'use strict';

// Component imports for a project held in memory, where a document is known by its
// path inside the project and nothing is read from disk. The browser renderer and
// the source linter both resolve imports with these.

/** Import paths are relative to their source document and stay inside the virtual project. */
function normalizeVirtualImport(source, imported) {
  if (!imported || imported.startsWith('/') || /[\\\u0000:?#]/u.test(imported)) {
    throw new Error(`Component import must be a relative project path: ${imported}`);
  }
  const parts = source.split('/').slice(0, -1);
  for (const part of imported.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') {
      if (!parts.length) throw new Error(`Component import escapes the project: ${imported}`);
      parts.pop();
    } else parts.push(part);
  }
  return parts.join('/');
}

/**
 * The components document every page sees without importing it: `components.yaml`,
 * or the only one outside `components/`, or the only one there is.
 * @param {string[]} paths  the paths of the project's components documents
 */
function rootComponentsPath(paths) {
  if (paths.includes('components.yaml')) return 'components.yaml';
  const outside = paths.filter((path) => !/^components\//iu.test(path));
  if (outside.length === 1) return outside[0];
  return paths.length === 1 ? paths[0] : null;
}

module.exports = { normalizeVirtualImport, rootComponentsPath };
