'use strict';

// Browser engines for the render polish checks. Chromium always runs; WebKit,
// which the iPad's WKWebView uses, runs wherever its Playwright build is
// installed and is skipped (with the reason) elsewhere.

const fs = require('node:fs');
const playwright = require('playwright');

function installed(type) {
  try {
    return fs.existsSync(playwright[type].executablePath());
  } catch {
    return false;
  }
}

/** `[{ name, skip, launch }]` for chromium and webkit. */
function engines() {
  return ['chromium', 'webkit'].map((name) => ({
    name,
    skip: name === 'webkit' && !installed('webkit') ? 'Playwright WebKit is not installed on this host' : false,
    launch: () => playwright[name].launch({ headless: true }),
  }));
}

module.exports = { engines };
