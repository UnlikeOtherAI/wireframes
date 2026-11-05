'use strict';

const { LOGO_SLOTS, logoForSkin, logoDimension } = require('../../design-system/logos');

function renderLogo(node, ctx, lib) {
  const slot = node.props?.slot;
  if (!LOGO_SLOTS.includes(slot)) return null;
  const logo = logoForSkin(ctx.skin, slot);
  const width = logoDimension(node.props?.width, 160);
  const height = logoDimension(node.props?.height, 64);
  const label = typeof node.props?.alt === 'string' && node.props.alt.trim()
    ? node.props.alt : logo?.name || slot.replace('logo_', 'Logo ');
  const attribute = 'data-wf-logo-slot="' + lib.escapeAttr(slot) + '"';
  const inner = logo
    ? '<img ' + attribute + ' src="' + lib.escapeAttr(logo.src) + '" alt="' + lib.escapeAttr(label) + '" style="display:block;width:100%;height:100%;object-fit:contain" />'
    : '<div ' + attribute + ' class="wf-image-placeholder" role="img" aria-label="' + lib.escapeAttr(label) + '" title="' + lib.escapeAttr(label) + '" style="width:100%;height:100%;min-height:0;padding:4px"><span class="wf-image-caption">' + lib.escapeHtml(label) + '</span></div>';
  return { inner, className: 'wf-image-logo wf-company-logo',
    style: 'width:' + width + 'px;height:' + height + 'px;max-width:100%;flex:none;align-self:flex-start;overflow:hidden' };
}

module.exports = { renderLogo };
