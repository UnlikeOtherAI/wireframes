'use strict';

const { resolveAppearance } = require('./resolve');
const { escapeHtml } = require('../renderer/render-utils');
const { wireframeRootStyle } = require('../renderer/wireframe-styles');

const BOXES = new Set(['wf-control', 'wf-otp-box', 'wf-color', 'wf-numstepper', 'wf-badge-body',
  'wf-avatar-chip', 'wf-avatar-img', 'wf-image-placeholder', 'wf-check-mark', 'wf-radio-mark',
  'wf-toggle-track', 'wf-progress-track', 'wf-bar', 'wf-skeleton-avatar', 'wf-tag', 'wf-picker-window']);
const ROUNDABLE = new Set(['wf-control', 'wf-otp-box', 'wf-color', 'wf-numstepper',
  'wf-badge-body', 'wf-image-placeholder', 'wf-progress-track', 'wf-tag']);
const ACCENT_FILL = new Set(['wf-check-on', 'wf-toggle-on', 'wf-range-fill', 'wf-progress-fill', 'wf-dot-on']);
const ACCENT_TEXT = new Set(['wf-segment-on', 'wf-tab-on', 'wf-nav-on', 'wf-menu-on',
  'wf-pagenum-on', 'wf-step-on', 'wf-step-done', 'wf-picker-on', 'wf-star-on']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const has = (classes, candidates) => [...candidates].some((name) => classes.has(name));
const focusable = (tag) => ['input', 'select', 'textarea', 'button', 'a'].includes(tag);

function cornerCss(appearance) {
  const corner = appearance?.corner;
  if (!corner) return '';
  if (corner.style === 'pill') return 'border-radius:9999px!important';
  if (corner.style === 'sharp') return 'border-radius:0!important';
  if (Number.isFinite(corner.radius)) return `border-radius:${corner.radius}px!important`;
  return '';
}

function borderCss(appearance, invalid = false) {
  const border = appearance?.border;
  if (!border || invalid) return '';
  return [
    border.style ? `border-style:${border.style}` : '',
    border.width ? `border-width:${border.width === 'medium' ? 2 : 1}px` : '',
  ].filter(Boolean).join(';');
}

function colorCss(colors, { text = false, box = false, edge = false } = {}) {
  return [
    text && colors?.text ? `color:${colors.text}` : '',
    box && colors?.background ? `background-color:${colors.background}` : '',
    (box || edge) && colors?.border ? `border-color:${colors.border}` : '',
  ].filter(Boolean).join(';');
}

/** Every named-skin node resets inherited shape variables to its own effective values. */
function skinShellStyle(node, appearance, frame, options) {
  if (!appearance) return '';
  const surface = frame === 'surface';
  const ownBox = surface || node.component === 'segmented';
  return [
    wireframeRootStyle(appearance, {}, options.rendering),
    // A wrapper with no colour of its own must not inherit a parent's role colour.
    `color:${appearance.colors?.text || 'var(--wf-ink-2)'}`,
    colorCss(appearance.colors, { box: surface, edge: frame === 'edge' }),
    !surface && appearance.shellBackground ? 'background-color:' + appearance.shellBackground : '',
    ownBox || appearance.shellBackground ? cornerCss(appearance) : '',
    ownBox && node.component !== 'alert' ? borderCss(appearance) : '',
    surface && appearance.colors?.border ? 'outline-color:' + appearance.colors.border : '',
  ].filter(Boolean).join(';');
}

function appendStyle(tag, css) {
  if (!css) return tag;
  css = escapeHtml(css);
  if (/\sstyle="/.test(tag)) return tag.replace(/\sstyle="([^"]*)"/, (_, old) => ` style="${old};${css}"`);
  return tag.replace(/\s*\/?\>$/, (end) => ` style="${css}"${end}`);
}

function actionAppearance(classes, options) {
  const variant = [...classes].find((name) => /^wf-button-(primary|secondary|ghost|danger|link)$/.test(name))?.slice(10) || 'secondary';
  return resolveAppearance({ component: 'button', props: { variant } }, options);
}

/**
 * Only decorates the engine-generated markup of one primitive, before child
 * nodes are appended. No authored HTML or arbitrary selectors enter this pass.
 * The stack keeps composite action labels/icons under their button appearance.
 */
function paintMarkup(markup, node, appearance, options) {
  if (!appearance || !markup) return markup;
  const stack = [];
  const component = node.component;
  return markup.replace(/<\/?([a-z][a-z0-9:-]*)\b[^>]*>/gi, (opening, rawTag) => {
    const tag = rawTag.toLowerCase();
    if (opening.startsWith('</')) {
      while (stack.length) if (stack.pop().tag === tag) break;
      return opening;
    }
    const classes = new Set((opening.match(/\sclass="([^"]*)"/)?.[1] || '').split(/\s+/));
    const parent = stack[stack.length - 1];
    const choiceButton = /\sdata-wf-choice-value=/.test(opening);
    const choice = choiceButton || parent?.choice;
    const action = classes.has('wf-act') ? actionAppearance(classes, options) : parent?.action;
    const current = action || appearance;
    const colors = current.colors || {};
    const invalid = Boolean(node.props?.error);
    const plain = component === 'input' && node.props?.variant === 'plain';
    const isAction = classes.has('wf-act');
    const button = isAction || (component === 'button' && (tag === 'button' || classes.has('wf-button-link')));
    const box = button || has(classes, BOXES) || tag === 'textarea' || (component === 'image' && tag === 'img');
    const edge = classes.has('wf-rule');
    const isError = classes.has('wf-field-error') || classes.has('wf-menu-danger') || parent?.error;
    const navVariant = component === 'nav' && ['rail', 'sidebar'].includes(node.props?.variant);
    const navSelected = navVariant && (classes.has('wf-nav-on') || parent?.navSelected);
    const accented = !choice && !navSelected && (has(classes, ACCENT_TEXT) || parent?.accented);
    const css = [];
    if (!isError) css.push(colorCss(colors, {
      text: !choice && !['svg', 'path', 'circle', 'polyline', 'line'].includes(tag),
      box: (box && !plain) || classes.has('wf-image-caption'),
      edge,
    }));
    if (choiceButton) css.push('--wf-choice-ink:' + (colors.text || 'var(--wf-ink-3)') + ';--wf-choice-accent:' + (colors.accent || colors.text || 'var(--wf-ink)'));
    if (box && !plain) {
      css.push(borderCss(current, invalid));
      if (button || tag === 'textarea' || has(classes, ROUNDABLE)) css.push(cornerCss(current));
    }
    if (edge && colors.border) css.push(`background-color:${colors.border}`);
    const selectionBox = navSelected && (node.props.variant === 'rail' ? classes.has('wf-ico') : classes.has('wf-nav-on'));
    const selectionFill = colors.accent || colors.background;
    if (selectionBox && selectionFill && !isError) {
      css.push(`background-color:${selectionFill};color:${colors.text || '#ffffff'}`);
      if (!colors.accent) css.push('box-shadow:inset 0 0 0 1px currentColor');
    }
    if (colors.accent && !isError) {
      if (has(classes, ACCENT_FILL) || (classes.has('wf-check-mark') && parent?.checked)) {
        css.push(`background-color:${colors.accent};border-color:${colors.accent}`);
      }
      if (classes.has('wf-radio-mark')) css.push(`--wf-ink:${colors.accent}`);
      if (accented) css.push(`color:${colors.accent}`);
      if (classes.has('wf-pagenum-on')) css.push('background-color:' + (colors.background || '#ffffff'));
      if (classes.has('wf-step-marker') && accented) css.push('background-color:' + colors.accent + ';color:#ffffff;border-color:' + colors.accent);
      if (classes.has('wf-ring-value')) css.push(`stroke:${colors.accent}`);
      if (classes.has('wf-spinner')) css.push(`border-top-color:${colors.accent}`);
      if (focusable(tag)) {
        css.push(`--wf-skin-focus:${colors.accent}`);
        opening = opening.replace(/\s*\/?\>$/, (end) => ` data-wf-skin-focus${end}`);
      }
    }
    // The destructive action defaults are the same outlined treatment as standalone buttons.
    if (isAction && current.role === 'button.danger') {
      css.push(`background-color:${colors.background || '#ffffff'};color:${colors.text || 'var(--wf-danger)'};border:1px solid ${colors.border || 'var(--wf-danger)'}`);
    }
    if (isAction) opening = opening.replace(/\s*\/?\>$/, (end) => ` data-wf-skin-role="${escapeHtml(current.role)}"${end}`);
    if (!VOID.has(tag) && !opening.endsWith('/>')) {
      stack.push({ tag, action, choice, error: isError, accented, navSelected, checked: classes.has('wf-choice-on') || parent?.checked });
    }
    return appendStyle(opening, css.filter(Boolean).join(';'));
  });
}

const skinPaintStyles = '[data-wf-skin-focus]:focus-visible{outline:2px solid var(--wf-skin-focus);outline-offset:2px}';

module.exports = { skinShellStyle, paintMarkup, cornerCss, borderCss, skinPaintStyles };
