'use strict';

// One element vocabulary, three chrome skins. A platform never changes which
// elements exist or what they mean — only the chrome a native user expects:
// control heights, corner radii, where a title sits, which affordances appear.
//
//   web      browser chrome, the default for device: web
//   ios      iOS chrome, the default for device: mobile/tablet
//   android  Material chrome

const PLATFORMS = new Set(['web', 'ios', 'android']);

function normalizePlatform(platform, device) {
  const value = typeof platform === 'string' ? platform.trim().toLowerCase() : '';
  if (PLATFORMS.has(value)) return value;
  return device === 'mobile' || device === 'tablet' ? 'ios' : 'web';
}

function isNative(platform) {
  return platform === 'ios' || platform === 'android';
}

// Chrome differences that are real, not decoration. Everything else is shared.
const CHROME = {
  web: {
    titleAlign: 'start',
    backGlyph: 'arrow-left',
    tabLabels: true,
    statusBar: false,
    homeIndicator: false,
  },
  ios: {
    titleAlign: 'center',
    backGlyph: 'chevron-left',
    tabLabels: true,
    statusBar: true,
    homeIndicator: true,
  },
  android: {
    titleAlign: 'start',
    backGlyph: 'arrow-left',
    tabLabels: true,
    statusBar: true,
    homeIndicator: false,
  },
};

function chrome(platform) {
  return CHROME[platform] || CHROME.web;
}

/** Status bar and home indicator, drawn only for a native platform. */
function statusBarMarkup(platform) {
  if (!chrome(platform).statusBar) return '';
  const right = platform === 'ios'
    ? '<span class="wf-status-right"><span class="wf-status-glyph"></span><span class="wf-status-glyph"></span><span class="wf-status-battery"></span></span>'
    : '<span class="wf-status-right"><span class="wf-status-glyph"></span><span class="wf-status-battery"></span></span>';
  return `<div class="wf-status-bar" aria-hidden="true"><span class="wf-status-time">9:41</span>${right}</div>`;
}

function homeIndicatorMarkup(platform) {
  return chrome(platform).homeIndicator
    ? '<div class="wf-home-indicator" aria-hidden="true"><span></span></div>'
    : '';
}

module.exports = {
  PLATFORMS,
  normalizePlatform,
  isNative,
  chrome,
  statusBarMarkup,
  homeIndicatorMarkup,
};
