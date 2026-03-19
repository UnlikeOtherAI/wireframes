'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const RELOAD_SCRIPT = `<script id="wf-hot-reload-script">
(function () {
  var source = new EventSource('/__wf/reload');
  source.addEventListener('reload', function () {
    window.location.reload();
  }, false);
})();
</script>`;

function toText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parsePath(pathname) {
  try {
    return decodeURIComponent(pathname || '/');
  } catch {
    return pathname || '/';
  }
}

function sendResponse(res, method, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body || '');
}

function buildValidationOverlay(errors) {
  const items = (errors || []).map((error) => `[${error.code || 'ERROR'}] ${error.message || 'Unknown validation error'}`);
  const rows = items.length > 0
    ? items.map((item) => `<li>${toText(item)}</li>`).join('\n')
    : '<li>Unknown validation error.</li>';

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Wireframe Validation Error</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #f8f8f8;
      }
      .wf-serve-error {
        margin: 20px;
        padding: 12px;
        border: 4px solid #b00000;
        background: #fff2f2;
      }
      .wf-serve-error h1 {
        margin-top: 0;
        color: #b00000;
      }
    </style>
  </head>
  <body>
    <div class="wf-serve-error">
      <h1>Wireframe Validation Error</h1>
      <ul>
        ${rows}
      </ul>
    </div>
  </body>
</html>`;
}

function injectReload(html) {
  if (html.includes('id="wf-hot-reload-script"')) return html;
  const marker = '</body>';
  const index = html.lastIndexOf(marker);
  if (index === -1) return html;
  return `${html.slice(0, index)}${RELOAD_SCRIPT}\n${html.slice(index)}`;
}

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function serveAssets(req, res, state, requestPath) {
  const rest = requestPath.replace(/^\/+/, '').replace(/^assets\//, '');
  const assetPath = path.resolve(path.join(state.assetsPath, rest));
  if (!assetPath.startsWith(`${state.assetsPath}${path.sep}`) && assetPath !== state.assetsPath) {
    return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Forbidden');
  }
  if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
    return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Asset not found');
  }
  const data = fs.readFileSync(assetPath);
  return sendResponse(res, req.method, 200, {
    'content-type': getContentType(assetPath),
    'cache-control': 'no-cache',
  }, data);
}

function serveReload(req, res, state) {
  if (!state.hotReload) {
    return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Reload stream disabled.');
  }
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ version: state.reloadVersion })}\n\n`);
  state.reloadClients.add(res);
  req.on('close', () => {
    state.reloadClients.delete(res);
  });
}

function serveIndex(res, method, body) {
  return sendResponse(res, method, 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }, body);
}

function resolveFontAwesomePath() {
  try {
    return path.dirname(require.resolve('@fortawesome/fontawesome-free/package.json'));
  } catch {
    return null;
  }
}

function createServeRequestHandler(state, sharedAssets) {
  const faPackageDir = resolveFontAwesomePath();

  return function requestHandler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendResponse(res, req.method, 405, { 'content-type': 'text/plain; charset=utf-8' }, 'Method not allowed.');
    }

    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const requestPath = parsePath(requestUrl.pathname);
    if (requestPath === '/__wf/reload') return serveReload(req, res, state);
    if (requestPath === '/favicon.ico') return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');

    if (requestPath.startsWith('/assets/')) return serveAssets(req, res, state, requestPath);

    const faMatch = requestPath.match(/^\/(web|mobile|tablet)\/_shared\/fa\/(.+)$/);
    if (faMatch && faPackageDir) {
      const faRelative = faMatch[2];
      const faFilePath = path.resolve(path.join(faPackageDir, faRelative));
      if (!faFilePath.startsWith(faPackageDir + path.sep)) {
        return sendResponse(res, req.method, 403, { 'content-type': 'text/plain; charset=utf-8' }, 'Forbidden');
      }
      if (fs.existsSync(faFilePath) && fs.statSync(faFilePath).isFile()) {
        const data = fs.readFileSync(faFilePath);
        return sendResponse(res, req.method, 200, {
          'content-type': getContentType(faFilePath),
          'cache-control': 'no-cache',
        }, data);
      }
      return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Font asset not found');
    }

    const sharedMatch = requestPath.match(/^\/(web|mobile|tablet)\/_shared\/(wireframe\.css|interactions\.js)$/);
    if (sharedMatch) {
      const name = sharedMatch[2];
      const body = sharedAssets[name];
      if (body === undefined) {
        return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Shared asset not found');
      }
      return sendResponse(res, req.method, 200, {
        'content-type': name.endsWith('.js') ? MIME_TYPES['.js'] : MIME_TYPES['.css'],
        'cache-control': 'no-cache',
      }, body);
    }

    const isMaster = requestPath === '/' || requestPath === '/index.html';
    const platformMatch = requestPath.match(/^\/(web|mobile|tablet)(\/.*)?$/);
    const hasErrors = Array.isArray(state.validationErrors) && state.validationErrors.length > 0;

    if (hasErrors && (isMaster || platformMatch)) {
      return serveIndex(res, req.method, buildValidationOverlay(state.validationErrors));
    }

    if (isMaster) {
      const body = state.snapshot?.masterIndexHtml || '';
      return body
        ? serveIndex(res, req.method, body)
        : sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
    }

    if (!platformMatch) {
      return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Not found');
    }

    const platform = platformMatch[1];
    const platformPath = platformMatch[2] || '/';
    const platformData = (state.snapshot?.platformTargets || []).find((entry) => entry.platform === platform);
    if (!platformData) {
      return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Platform not found');
    }

    const normalizedPath = platformPath === '/' ? '/index.html' : platformPath;
    if (normalizedPath === '/index.html') {
      const body = state.hotReload ? injectReload(platformData.indexHtml || '') : (platformData.indexHtml || '');
      return body
        ? serveIndex(res, req.method, body)
        : sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Platform index not found');
    }

    const page = platformData.pages.find((entry) => `/${entry.fileName}` === normalizedPath);
    if (!page) {
      return sendResponse(res, req.method, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Page not found');
    }

    const body = state.hotReload ? injectReload(page.html) : page.html;
    return serveIndex(res, req.method, body);
  };
}

function broadcastReload(state) {
  if (!state.hotReload) return;
  for (const client of state.reloadClients) {
    try {
      client.write(`event: reload\ndata: ${JSON.stringify({ version: state.reloadVersion })}\n\n`);
    } catch {
      state.reloadClients.delete(client);
    }
  }
}

module.exports = {
  createServeRequestHandler,
  broadcastReload,
  RELOAD_SCRIPT,
};
