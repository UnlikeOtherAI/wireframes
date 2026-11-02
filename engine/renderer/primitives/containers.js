'use strict';

// Containers render a head block (title/description/actions) plus the node's
// children. The shell owns the frame decision; these only lay things out.

function withHead(node, ctx, lib, options = {}) {
  const head = lib.titleBlock(node.props, ctx, options);
  return { inner: head, useChildren: true };
}

function renderSection(node, ctx, lib) {
  return withHead(node, ctx, lib, { titleClass: 'wf-section-title' });
}

function renderCard(node, ctx, lib) {
  const media = lib.str(node.props?.media);
  const banner = media
    ? `<div class="wf-card-media">${lib.renderImageElement(ctx.projectPath, { src: media, alt: node.props?.title || 'Media' }, ctx.imageOptions)}</div>`
    : '';
  const head = lib.titleBlock(node.props, ctx, { titleClass: 'wf-card-title' });
  return { inner: `${banner}${head}`, useChildren: true };
}

function renderStack(node, ctx, lib) {
  return { inner: '', useChildren: true };
}

function renderForm(node, ctx, lib) {
  const head = lib.titleBlock(node.props, ctx, { titleClass: 'wf-form-title' });
  const submit = lib.str(node.props?.submit);
  const footer = submit
    ? `<div class="wf-form-actions"><button class="wf-act wf-button-primary">${lib.escapeHtml(submit)}</button></div>`
    : '';
  return { inner: head, after: footer, useChildren: true, tag: 'form' };
}

function renderCarousel(node, ctx, lib) {
  const entries = lib.items(node.props?.items, 'title');
  const arrows = node.props?.arrows === false
    ? ''
    : '<button class="wf-carousel-arrow wf-carousel-prev">‹</button><button class="wf-carousel-arrow wf-carousel-next">›</button>';
  const dots = node.props?.dots === false
    ? ''
    : `<div class="wf-pagination wf-pagination-dots">${
      Array.from({ length: Math.max(3, entries.length) }, (_, i) => `<span class="wf-dot${i === 0 ? ' wf-dot-on' : ''}"></span>`).join('')
    }</div>`;

  if (entries.length > 0) {
    const slides = entries.map((item) => (
      `<div class="wf-slide">${lib.str(item.title) ? lib.bound(item.title, ctx) : lib.renderSkeleton(14)}</div>`
    )).join('');
    return { inner: `<div class="wf-carousel-track">${slides}</div>${arrows}${dots}`, after: '' };
  }
  return { inner: '', useChildren: true, after: `${arrows}${dots}` };
}

const ALERT_GLYPH = {
  info: 'circle-info',
  success: 'circle-check',
  warning: 'triangle-exclamation',
  error: 'circle-exclamation',
  neutral: 'circle-dot',
};

function renderAlert(node, ctx, lib) {
  const props = node.props || {};
  const variant = lib.str(props.variant) || 'info';
  const glyph = lib.icon(lib.str(props.icon) || ALERT_GLYPH[variant] || ALERT_GLYPH.info, { size: 'lg' });
  const title = lib.str(props.title);
  const text = lib.str(props.text);
  const body = `<div class="wf-alert-body">${
    title ? `<div class="wf-alert-title">${lib.bound(title, ctx)}</div>` : ''
  }${text ? `<div class="wf-alert-text">${lib.bound(text, ctx)}</div>` : (title ? '' : lib.renderSkeleton('70%'))}</div>`;
  const close = props.dismissible === true ? '<button class="wf-alert-close">×</button>' : '';
  return {
    inner: `<span class="wf-alert-glyph">${glyph}</span>${body}${close}`,
    className: `wf-alert-${lib.toSafeClass(variant)}${props.inline === true ? ' wf-alert-inline' : ''}`,
  };
}

module.exports = {
  containerRenderers: {
    section: renderSection,
    card: renderCard,
    stack: renderStack,
    row: renderStack,
    grid: renderStack,
    split: renderStack,
    form: renderForm,
    carousel: renderCarousel,
    alert: renderAlert,
  },
};
