'use strict';

// Returns inner HTML for a node, or { tag, inner, className, style, noChildren }.

function renderHeading(node, ctx, lib) {
  const level = Math.max(1, Math.min(6, lib.num(node.props?.level, 3)));
  const text = lib.textProp(node.props);
  const body = text == null ? lib.renderSkeleton(12) : lib.bound(text, ctx);
  return {
    inner: `<h${level}>${ctx.link(body)}</h${level}>`,
    className: `wf-heading-${level}`,
  };
}

function renderParagraph(node, ctx, lib) {
  const text = lib.textProp(node.props);
  if (text != null) {
    return { inner: `<p>${ctx.link(lib.bound(text, ctx))}</p>` };
  }
  const count = Math.max(1, Math.min(8, lib.num(node.props?.lines, 2)));
  const widths = ['100%', '92%', '96%', '70%'];
  const bars = Array.from({ length: count }, (_, i) => lib.renderSkeleton(
    i === count - 1 ? '60%' : widths[i % widths.length],
  )).join('<br />');
  return { inner: `<p>${bars}</p>` };
}

function renderText(node, ctx, lib) {
  const variant = lib.str(node.props?.variant) || 'body';
  const text = lib.textProp(node.props);
  const body = text == null ? lib.renderSkeleton(8) : lib.bound(text, ctx);
  return { tag: 'span', inner: ctx.link(body), className: `wf-text-${lib.toSafeClass(variant)}` };
}

function renderCode(node, ctx, lib) {
  const text = lib.textProp(node.props);
  const body = text == null ? lib.renderSkeleton(24) : lib.escapeHtml(text);
  if (node.props?.inline === true) {
    return { tag: 'span', inner: `<code>${body}</code>`, className: 'wf-code-inline' };
  }
  const language = lib.str(node.props?.language);
  const tag = language ? `<span class="wf-code-lang">${lib.escapeHtml(language)}</span>` : '';
  return { inner: `${tag}<pre><code>${body}</code></pre>` };
}

const BADGE_TONES = new Set(['info', 'success', 'warning', 'danger']);

function renderBadge(node, ctx, lib) {
  const variant = lib.str(node.props?.variant) || 'neutral';
  // variant is the shape; tone is the status it reports.
  const tone = lib.str(node.props?.tone);
  const text = lib.textProp(node.props);
  const dot = variant === 'dot' ? '<span class="wf-dot-mark"></span>' : '';
  const glyph = lib.iconSpan(node.props?.icon);
  const body = text == null ? lib.renderSkeleton(5) : lib.bound(text, ctx);
  return {
    tag: 'span',
    inner: `<span class="wf-badge-body">${dot}${glyph}${body}</span>`,
    className: `wf-badge-${lib.toSafeClass(variant)}${BADGE_TONES.has(tone) ? ` wf-tone-${tone}` : ''}`,
  };
}

function avatarChip(name, size, shape, lib) {
  const px = lib.scale('avatar', size) || 36;
  const text = lib.initials(name) || '?';
  const radius = shape === 'square' ? '4px' : '50%';
  return `<span class="wf-avatar-chip" style="width:${px}px;height:${px}px;border-radius:${radius};font-size:${Math.round(px * 0.38)}px">${lib.escapeHtml(text)}</span>`;
}

function renderAvatar(node, ctx, lib) {
  const size = lib.str(node.props?.size) || 'md';
  const shape = lib.str(node.props?.shape) || 'circle';
  const group = Array.isArray(node.props?.group) ? node.props.group : null;

  if (group && group.length > 0) {
    const chips = group.slice(0, 5).map((name) => avatarChip(name, size, shape, lib)).join('');
    const overflow = lib.num(node.props?.overflow, group.length - 5);
    const more = overflow > 0
      ? `<span class="wf-avatar-more">+${lib.escapeHtml(String(overflow))}</span>`
      : '';
    return { tag: 'span', inner: `${chips}${more}`, className: 'wf-avatar-group' };
  }

  const src = lib.str(node.props?.src);
  if (src) {
    const px = lib.scale('avatar', size) || 36;
    const radius = shape === 'square' ? '4px' : '50%';
    const img = lib.renderImageElement(ctx.projectPath, { src, alt: node.props?.name || 'Avatar' }, ctx.imageOptions);
    return {
      tag: 'span',
      inner: `<span class="wf-avatar-img" style="width:${px}px;height:${px}px;border-radius:${radius}">${img}</span>`,
    };
  }

  return { tag: 'span', inner: avatarChip(node.props?.name, size, shape, lib) };
}

function renderIcon(node, ctx, lib) {
  const name = lib.str(node.props?.name) || 'circle-question';
  return {
    tag: 'span',
    inner: `<span role="img" aria-label="${lib.escapeAttr(node.accessibility?.label || name.replace(/-/g, ' '))}">${lib.icon(name, { style: node.props?.style, size: node.props?.size })}</span>`,
  };
}

const MEDIA_GLYPH = {
  video: 'play',
  map: 'location-dot',
  embed: 'code',
  logo: 'shapes',
  image: 'image',
};

function renderImage(node, ctx, lib) {
  const src = lib.str(node.props?.src);
  const kind = lib.str(node.props?.kind) || 'image';
  const ratio = lib.str(node.props?.ratio);
  const ratioStyle = /^\d+\s*:\s*\d+$/.test(ratio)
    ? `aspect-ratio:${ratio.replace(/\s+/g, '').replace(':', ' / ')}`
    : '';

  if (src) {
    const img = lib.renderImageElement(ctx.projectPath, node.props, ctx.imageOptions);
    return { inner: img, style: ratioStyle, className: `wf-image-${lib.toSafeClass(kind)}` };
  }

  const alt = lib.str(node.props?.alt);
  const glyph = lib.icon(MEDIA_GLYPH[kind] || 'image', { size: 'xl' });
  const caption = alt ? `<span class="wf-image-caption">${lib.bound(alt, ctx)}</span>` : '';
  return {
    inner: `<div class="wf-image-placeholder" role="img" aria-label="${lib.escapeAttr(alt || kind)}" title="${lib.escapeAttr(alt || kind)}"${ratioStyle ? ` style="${ratioStyle}"` : ''}>${glyph}${caption}</div>`,
    className: `wf-image-${lib.toSafeClass(kind)}`,
  };
}

function renderRating(node, ctx, lib) {
  const max = Math.max(1, Math.min(10, lib.num(node.props?.max, 5)));
  const value = Math.max(0, Math.min(max, lib.num(node.props?.value, 0)));
  const stars = Array.from({ length: max }, (_, i) => (
    `<span class="wf-star${i < Math.round(value) ? ' wf-star-on' : ''}">${i < Math.round(value) ? '★' : '☆'}</span>`
  )).join('');
  const count = node.props?.count != null
    ? `<span class="wf-rating-count">(${lib.escapeHtml(String(node.props.count))})</span>`
    : '';
  return { tag: 'span', inner: `${stars}${count}` };
}

const TREND_GLYPH = { up: '↑', down: '↓', flat: '→' };

function renderStat(node, ctx, lib) {
  const label = lib.str(node.props?.label);
  const value = node.props?.value;
  const glyph = lib.iconSpan(node.props?.icon, { size: 'lg' });
  const head = `<div class="wf-stat-head">${glyph}<span class="wf-stat-label">${
    label ? lib.bound(label, ctx) : lib.renderSkeleton(9)
  }</span></div>`;
  const figure = value == null || value === ''
    ? lib.renderSkeleton(6)
    : lib.bound(String(value), ctx);
  const trend = lib.str(node.props?.trend);
  const delta = lib.str(node.props?.delta);
  const deltaMarkup = delta
    ? `<span class="wf-stat-delta wf-trend-${lib.toSafeClass(trend || 'flat')}">${
      TREND_GLYPH[trend] || ''
    } ${lib.escapeHtml(delta)}</span>`
    : '';
  const spark = node.props?.sparkline === true
    ? `<svg class="wf-stat-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><polyline points="${
      Array.from({ length: 12 }, (_, i) => `${(i / 11) * 100},${24 - lib.seeded(node.id || 'stat', i) * 20 - 2}`).join(' ')
    }" /></svg>`
    : '';
  return {
    inner: `${head}<div class="wf-stat-value">${figure}${deltaMarkup}</div>${spark}`,
  };
}

function renderProgress(node, ctx, lib) {
  const kind = lib.str(node.props?.kind) || 'bar';
  const label = lib.str(node.props?.label);
  const indeterminate = node.props?.indeterminate === true;
  const value = Math.max(0, Math.min(100, lib.num(node.props?.value, indeterminate ? 35 : 0)));
  const caption = label ? `<span class="wf-progress-label">${lib.bound(label, ctx)}</span>` : '';

  if (kind === 'spinner') {
    return { tag: 'span', inner: `<span class="wf-spinner" aria-hidden="true"></span>${caption}` };
  }
  if (kind === 'circle') {
    const dash = Math.round((value / 100) * 100);
    return {
      inner: `<svg class="wf-progress-ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="wf-ring-track" cx="20" cy="20" r="16" /><circle class="wf-ring-value" cx="20" cy="20" r="16" stroke-dasharray="${dash} 100" /></svg>${caption}`,
    };
  }
  const fill = `<span class="wf-progress-fill${indeterminate ? ' wf-progress-indeterminate' : ''}" style="width:${value}%"></span>`;
  return { inner: `${caption}<span class="wf-progress-track">${fill}</span>` };
}

function renderSkeletonBlock(node, ctx, lib) {
  const count = Math.max(1, Math.min(12, lib.num(node.props?.lines, 3)));
  const width = node.props?.width;
  const bars = Array.from({ length: count }, (_, i) => (
    `<span class="wf-skeleton-row">${lib.renderSkeleton(i === count - 1 ? '55%' : (width || '100%'))}</span>`
  )).join('');
  const avatar = node.props?.avatar === true
    ? '<span class="wf-skeleton-avatar"></span>'
    : '';
  return { inner: `${avatar}<span class="wf-skeleton-lines">${bars}</span>` };
}

function renderDivider(node, ctx, lib) {
  const label = lib.textProp(node.props, 'label', 'text');
  const vertical = lib.str(node.props?.orientation) === 'vertical';
  if (!label) {
    return { inner: '<span class="wf-rule"></span>', className: vertical ? 'wf-divider-vertical' : '' };
  }
  return {
    inner: `<span class="wf-rule"></span><span class="wf-divider-label">${lib.bound(label, ctx)}</span><span class="wf-rule"></span>`,
    className: 'wf-divider-labelled',
  };
}

function renderSpacer(node, ctx, lib) {
  const raw = node.props?.size;
  const percentage = typeof raw === 'string' && /^\d+(\.\d+)?%$/.test(raw.trim());
  if (percentage && ['row', 'stack'].includes(ctx.parentLayoutType)) {
    return { inner: '', style: 'flex:1 1 auto' };
  }
  const size = lib.num(raw, 16);
  const axis = ctx.parentLayoutType === 'row' ? 'width' : 'height';
  return { inner: '', style: `${axis}:${size}px;flex:0 0 auto` };
}

const EMPTY_PRESET = {
  empty: { icon: 'inbox', title: 'Nothing here yet' },
  error: { icon: 'triangle-exclamation', title: 'Something went wrong' },
  404: { icon: 'compass', title: 'Page not found' },
  offline: { icon: 'plug-circle-xmark', title: 'You are offline' },
};

function renderEmptyState(node, ctx, lib) {
  const variant = lib.str(node.props?.variant) || 'empty';
  const preset = EMPTY_PRESET[variant] || EMPTY_PRESET.empty;
  const glyph = lib.icon(lib.str(node.props?.icon) || preset.icon, { size: 'xl' });
  const title = lib.str(node.props?.title) || preset.title;
  const text = lib.str(node.props?.text);
  const action = lib.str(node.props?.action);
  const body = text ? `<p class="wf-empty-text">${lib.bound(text, ctx)}</p>` : '';
  const button = action
    ? `<button class="wf-act wf-button-primary">${lib.escapeHtml(action)}</button>`
    : '';
  return {
    inner: `<span class="wf-empty-glyph">${glyph}</span><div class="wf-empty-title">${lib.bound(title, ctx)}</div>${body}${button}`,
    className: `wf-empty-${lib.toSafeClass(String(variant))}`,
  };
}

module.exports = {
  textRenderers: {
    heading: renderHeading,
    paragraph: renderParagraph,
    text: renderText,
    code: renderCode,
    badge: renderBadge,
    avatar: renderAvatar,
    icon: renderIcon,
    image: renderImage,
    rating: renderRating,
    stat: renderStat,
    progress: renderProgress,
    skeleton: renderSkeletonBlock,
    divider: renderDivider,
    spacer: renderSpacer,
    empty_state: renderEmptyState,
  },
};
