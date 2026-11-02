'use strict';

const fs = require('node:fs');

const FALLBACK_EXECUTABLES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

function shouldFallback(error) {
  const message = error && error.message ? error.message : '';
  return message.includes('Executable doesn') || message.includes('download new browsers');
}

async function launchChromium(playwright, options = {}) {
  try {
    return await playwright.chromium.launch(options);
  } catch (error) {
    if (!shouldFallback(error)) {
      throw error;
    }
    for (const executablePath of FALLBACK_EXECUTABLES) {
      if (fs.existsSync(executablePath)) {
        return playwright.chromium.launch({ ...options, executablePath });
      }
    }
    throw error;
  }
}

module.exports = { launchChromium };
