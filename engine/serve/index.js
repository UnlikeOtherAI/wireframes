'use strict';

const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const { startWatchers } = require('./watch');
const { loadWfrcConfig, resolveTargets, DEFAULT_PORT } = require('./snapshot');
const { createServeRequestHandler, broadcastReload } = require('./handler');
const { buildWireframeStyles } = require(path.resolve(__dirname, '..', 'renderer', 'styles'));
const { buildInteractionRuntimeFromWindowContext } = require(path.resolve(__dirname, '..', 'renderer', 'interactions'));

const VALID_PLATFORMS = new Set(['all', 'web', 'mobile', 'tablet']);
const VALID_HOST = '127.0.0.1';

function buildSharedAssets() {
  return {
    'wireframe.css': buildWireframeStyles(),
    'interactions.js': buildInteractionRuntimeFromWindowContext(),
  };
}

function openBrowser(url) {
  const command = process.platform === 'darwin'
    ? 'open'
    : process.platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = process.platform === 'win32'
    ? ['/c', 'start', '', `"${url}"`]
    : [url];

  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

function parseTime() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function normalizePort(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringErrors(parseError, errors) {
  if (!parseError && (!errors || errors.length === 0)) return null;
  return [
    ...(parseError ? [{ code: 'WFRC_PARSE', message: parseError }] : []),
    ...(Array.isArray(errors) ? errors : []),
  ];
}

function applySnapshot(state, projectPath, platform, config) {
  const result = resolveTargets(projectPath, platform, config.strictValidation, config.failOnWarnings);
  state.reloadVersion += 1;
  state.sharedAssets = buildSharedAssets();
  if (!result.ok) {
    state.snapshot = null;
    state.validationErrors = toStringErrors(config.parseError, result.errors || []);
    state.warnings = result.warnings || [];
    broadcastReload(state);
    return false;
  }

  state.snapshot = {
    masterIndexHtml: result.masterIndexHtml,
    platformTargets: result.platformTargets,
  };
  state.validationErrors = toStringErrors(config.parseError, []);
  state.warnings = result.warnings || [];
  broadcastReload(state);
  return true;
}

function runServe({
  projectPath = process.cwd(),
  port = null,
  platform = 'all',
  open = null,
  hotReload = null,
} = {}) {
  return new Promise((resolve) => {
    const selectedPlatform = typeof platform === 'string' ? platform.trim().toLowerCase() : '';
    if (!VALID_PLATFORMS.has(selectedPlatform)) {
      resolve({ ok: false, error: `Invalid platform "${platform}".` });
      return;
    }

    const absoluteProjectPath = path.resolve(projectPath);
    const config = loadWfrcConfig(absoluteProjectPath);
    const servePort = normalizePort(port) || normalizePort(config.serve.port) || DEFAULT_PORT;
    const shouldOpen = open === null ? config.serve.open : Boolean(open);
    const shouldReload = hotReload === null ? config.serve.hotReload : Boolean(hotReload);

    const state = {
      projectPath: absoluteProjectPath,
      assetsPath: path.join(absoluteProjectPath, 'assets'),
      reloadClients: new Set(),
      reloadVersion: 0,
      snapshot: null,
      validationErrors: config.parseError ? [{ code: 'WFRC_PARSE', message: config.parseError }] : null,
      warnings: [],
      hotReload: shouldReload,
    };

    let rebuildTimer = null;
    let stopWatch = () => {};
    const server = http.createServer(createServeRequestHandler(state));

    function maybeLogWarnings() {
      if (!Array.isArray(state.warnings) || state.warnings.length === 0) return;
      console.log('Serve warnings:');
      for (const warning of state.warnings) {
        console.log(`  - [${warning.code || 'WARNING'}] ${warning.message}`);
      }
    }

    function rebuild(relativePath) {
      const target = normalizeText(relativePath) || 'project';
      const started = Date.now();
      console.log(`[${parseTime()}] ${target} changed — rebuilding`);

      const success = applySnapshot(state, absoluteProjectPath, selectedPlatform, config);
      if (!success) {
        console.log(`[${parseTime()}] ✖ ${target} rebuild failed: ${(state.validationErrors || [])[0]?.message || 'Unknown validation error'}`);
        return;
      }

      const elapsed = Date.now() - started;
      console.log(`[${parseTime()}] ✔ ${target} rebuilt (${elapsed}ms)`);
    }

    function scheduleRebuild(relativePath) {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(() => {
        rebuildTimer = null;
        rebuild(relativePath);
      }, 120);
    }

    const initialRebuild = applySnapshot(state, absoluteProjectPath, selectedPlatform, config);
    if (!initialRebuild) {
      console.log('Validation errors detected. Serving overlay in the browser.');
      for (const detail of state.validationErrors || []) {
        console.log(`[${parseTime()}] Validation: ${detail.message}`);
      }
    }
    maybeLogWarnings();

    stopWatch = startWatchers(absoluteProjectPath, (relativePath, eventType) => {
      if (eventType === 'rename' || eventType === 'change') {
        scheduleRebuild(relativePath);
      }
    });

    server.on('error', (error) => {
      stopWatch();
      resolve({ ok: false, error: error.message });
    });

    const shutdown = () => {
      clearTimeout(rebuildTimer);
      stopWatch();
      state.reloadClients.forEach((client) => {
        try {
          client.end();
        } catch {
          // no-op
        }
      });
      state.reloadClients.clear();
    };

    server.listen(servePort, VALID_HOST, () => {
      const actualPort = (server.address() && typeof server.address() === 'object' && server.address().port) || servePort;
      console.log(`wf serve started on http://localhost:${actualPort}`);
      for (const platformName of ['web', 'mobile', 'tablet']) {
        const count = (state.snapshot?.platformTargets || []).find((entry) => entry.platform === platformName)?.count || 0;
        console.log(`  ${platformName.padEnd(7)} ${String(count).padStart(4)} pages`);
      }
      console.log('Watching for changes...');
      if (shouldOpen) openBrowser(`http://localhost:${actualPort}`);

      resolve({
        ok: true,
        server,
        projectPath: absoluteProjectPath,
        port: actualPort,
        platform: selectedPlatform,
        close() {
          shutdown();
          server.close();
        },
        url: `http://localhost:${actualPort}`,
      });
    });
  });
}

module.exports = { runServe };
