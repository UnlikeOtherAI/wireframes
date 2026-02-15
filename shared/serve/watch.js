'use strict';

const fs = require('node:fs');
const path = require('node:path');

const IGNORE_DIRS = new Set(['.git', '.steroids', 'node_modules']);
const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function collectWatchDirectories(rootDir, currentDir = rootDir, collected = []) {
  if (!fs.existsSync(currentDir) || !fs.statSync(currentDir).isDirectory()) return collected;

  const base = path.resolve(currentDir);
  const name = path.basename(base);
  if (IGNORE_DIRS.has(name)) return collected;

  collected.push(base);
  const entries = fs.readdirSync(base, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    collectWatchDirectories(rootDir, path.join(base, entry.name), collected);
  }

  return collected;
}

function shouldWatch(projectPath, absolutePath) {
  if (!absolutePath || !absolutePath.startsWith(`${projectPath}${path.sep}`)) return false;
  const relative = path.relative(projectPath, absolutePath);
  const base = path.basename(relative);

  if (IGNORE_FILES.has(base)) return false;
  if (relative === 'manifest.yaml'
    || relative === 'sitemap.yaml'
    || relative === 'templates.yaml'
    || relative === 'components.yaml'
    || relative === '.wfrc.yaml'
    || relative.startsWith(`pages${path.sep}`)
    || relative.startsWith(`data${path.sep}`)
    || relative.startsWith(`assets${path.sep}`)
  ) {
    return true;
  }

  const extension = path.extname(relative).toLowerCase();
  return extension === '.yaml' || extension === '.yml';
}

function startWatchers(projectPath, onChange) {
  const watchDirs = collectWatchDirectories(projectPath, projectPath, []);
  const watchers = [];

  for (const watchDir of watchDirs) {
    try {
      const watcher = fs.watch(watchDir, { persistent: true }, (eventType, filename) => {
        if (!filename) return;
        const absolute = path.join(watchDir, filename);
        if (!shouldWatch(projectPath, absolute)) return;
        onChange(path.relative(projectPath, absolute), eventType);
      });
      watchers.push(watcher);
    } catch {
      // Ignore directories that cannot be watched on this platform.
    }
  }

  return () => {
    for (const watcher of watchers) watcher.close();
  };
}

module.exports = {
  startWatchers,
};
