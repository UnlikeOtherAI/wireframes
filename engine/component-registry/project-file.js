'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** The real path of `target`: links resolved in the deepest part that exists, the rest appended. */
function realPath(target) {
  const missing = [];
  let current = target;
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...missing);
    } catch (error) {
      const parent = path.dirname(current);
      if (error.code !== 'ENOENT' || parent === current) return path.join(current, ...missing);
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}

// `..` as a whole segment, not a name such as `..components`. Windows takes either separator.
const PARENT = path.sep === '\\' ? /^\.\.(?:[\\/]|$)/u : /^\.\.(?:\/|$)/u;

function contains(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !PARENT.test(relative) && !path.isAbsolute(relative);
}

/**
 * Where a write to `filePath` lands, and whether that stays inside the project.
 * `..`, absolute paths and symbolic links (of the file and of the folders above
 * it) are resolved first, so a link in the project that points outside it is
 * caught like a path that does.
 *
 * @returns {{ inside: true, realPath: string }
 *   | { inside: false, linked: boolean, realPath: string }}
 *   `linked` is true when the path itself is in the project and only a link
 *   takes it outside. `realPath` is where the bytes would be written.
 */
function projectFileTarget(projectPath, filePath) {
  const lexicalRoot = path.resolve(projectPath);
  const lexical = path.resolve(lexicalRoot, filePath);
  const resolved = realPath(lexical);
  if (contains(realPath(lexicalRoot), resolved)) return { inside: true, realPath: resolved };
  return { inside: false, linked: contains(lexicalRoot, lexical), realPath: resolved };
}

module.exports = { projectFileTarget };
