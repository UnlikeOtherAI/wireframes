'use strict';

// Built-in proportions. Authors override at exactly three levels:
//   1. manifest.sizing  — flat token -> px map, project wide
//   2. node/region size — local, wins over tokens
//   3. rendering.density — scales spacing only, never structural widths

const TOKENS = {
  'sidebar.width': { web: 256, tablet: 220, mobile: 280 },
  'sidebar.collapsedWidth': { web: 64, tablet: 64, mobile: 64 },
  'sidebar.minWidth': { web: 200, tablet: 180, mobile: 200 },
  'aside.width': { web: 320, tablet: 280, mobile: 280 },
  'header.height': { web: 56, tablet: 56, mobile: 56 },
  'tabbar.height': { web: 48, tablet: 48, mobile: 56 },
  'footer.minHeight': { web: 64, tablet: 64, mobile: 56 },
  'page.gutter': { web: 24, tablet: 20, mobile: 16 },
  'content.narrowWidth': { web: 720, tablet: 680, mobile: 0 },
  'card.padding': { web: 16, tablet: 16, mobile: 12 },
  'card.gap': { web: 16, tablet: 16, mobile: 12 },
  'grid.gap': { web: 16, tablet: 16, mobile: 12 },
  'control.height': { web: 36, tablet: 40, mobile: 44 },
  'control.minWidth': { web: 88, tablet: 88, mobile: 88 },
  'row.height': { web: 44, tablet: 44, mobile: 48 },
  'modal.width': { web: 560, tablet: 520, mobile: 0 },
  'drawer.width': { web: 360, tablet: 320, mobile: 0 },
  'sheet.maxHeight': { web: 0, tablet: 0, mobile: 70 },
  'chart.height': { web: 160, tablet: 160, mobile: 140 },
  'stat.minHeight': { web: 96, tablet: 96, mobile: 88 },
};

const SIZE_SCALES = {
  avatar: { xs: 20, sm: 28, md: 36, lg: 48, xl: 64 },
  icon: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 },
  control: { sm: 32, md: 36, lg: 44 },
  modal: { sm: 400, md: 560, lg: 800 },
};

// Role -> the token that sets the region's main axis size.
const ROLE_SIZING = {
  sidebar: { axis: 'width', token: 'sidebar.width', min: 'sidebar.minWidth' },
  nav: { axis: 'width', token: 'sidebar.width', min: 'sidebar.minWidth' },
  aside: { axis: 'width', token: 'aside.width' },
  header: { axis: 'height', token: 'header.height' },
  app_bar: { axis: 'height', token: 'header.height' },
  footer: { axis: 'minHeight', token: 'footer.minHeight' },
  tabbar: { axis: 'height', token: 'tabbar.height' },
};

const ROLES = [
  'header', 'app_bar', 'sidebar', 'nav', 'main', 'aside', 'footer',
  'toolbar', 'tabbar', 'form', 'dialog', 'sheet', 'drawer', 'content',
];

function deviceClass(viewport) {
  const device = typeof viewport === 'string' ? viewport : viewport?.device;
  if (device === 'mobile') return 'mobile';
  if (device === 'tablet') return 'tablet';
  return 'web';
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

/** Resolve one token to px. `manifestSizing` overrides the built-in value. */
function token(name, viewport, manifestSizing) {
  if (isObject(manifestSizing) && Number.isFinite(Number(manifestSizing[name]))) {
    return Number(manifestSizing[name]);
  }
  const entry = TOKENS[name];
  if (!entry) return null;
  const value = entry[deviceClass(viewport)];
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A named step on one of the size scales, e.g. scale('avatar', 'lg'). */
function scale(name, step, fallback = 'md') {
  const table = SIZE_SCALES[name];
  if (!table) return null;
  const value = table[step] ?? table[fallback];
  return Number.isFinite(value) ? value : null;
}

/**
 * Structural size for a roled region. Returns CSS declarations, or '' when the
 * author already set an explicit size on that axis.
 */
function regionSizingCss(role, size, viewport, manifestSizing) {
  const rule = ROLE_SIZING[typeof role === 'string' ? role.trim() : ''];
  if (!rule) return '';

  const explicit = isObject(size) ? size : {};
  const css = [];

  if (rule.axis === 'width') {
    if (explicit.width == null) {
      const width = token(rule.token, viewport, manifestSizing);
      if (width) css.push(`width:${width}px`);
    }
    if (explicit.minWidth == null && rule.min) {
      const min = token(rule.min, viewport, manifestSizing);
      if (min) css.push(`min-width:${min}px`);
    }
    css.push('flex:0 0 auto');
  } else if (rule.axis === 'height') {
    if (explicit.height == null && explicit.minHeight == null) {
      const height = token(rule.token, viewport, manifestSizing);
      if (height) css.push(`min-height:${height}px`);
    }
    css.push('flex:0 0 auto');
  } else if (rule.axis === 'minHeight') {
    if (explicit.minHeight == null) {
      const min = token(rule.token, viewport, manifestSizing);
      if (min) css.push(`min-height:${min}px`);
    }
    css.push('flex:0 0 auto');
  }

  return css.join(';');
}

/** The tokens a region actually used, for `wf why`. */
function regionSizingTokens(role, viewport, manifestSizing) {
  const rule = ROLE_SIZING[typeof role === 'string' ? role.trim() : ''];
  if (!rule) return [];
  const names = [rule.token, rule.min].filter(Boolean);
  return names
    .map((name) => ({ name, value: token(name, viewport, manifestSizing) }))
    .filter((entry) => entry.value != null);
}

function tokenNames() {
  return Object.keys(TOKENS);
}

module.exports = {
  TOKENS,
  SIZE_SCALES,
  ROLES,
  ROLE_SIZING,
  deviceClass,
  token,
  scale,
  regionSizingCss,
  regionSizingTokens,
  tokenNames,
};
