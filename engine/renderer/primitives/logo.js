'use strict';

const { LOGO_SLOTS, logoForSkin, logoDimension } = require('../../design-system/logos');

function renderLogo(node, ctx, lib) {
  const slot = node.props?.slot;
  if (!LOGO_SLOTS.includes(slot)) return null;
  const logo = logoForSkin(ctx.skin, slot);
  const authoredWidth = logoDimension(node.props?.width, 0);
  const width = authoredWidth || 160;
  const height = logoDimension(node.props?.height, 64);
  const label = typeof node.props?.alt === 'string' && node.props.alt.trim()
    ? node.props.alt : logo?.name || slot.replace('logo_', 'Logo ');
  const attribute = 'data-wf-logo-slot="' + lib.escapeAttr(slot)
    + '" data-wf-logo-width="' + width + '" data-wf-logo-height="' + height + '"';
  // Without a width, a missing slot's placeholder fits its name on one line,
  // from the default width up to min(100%, 24rem), and only wraps, growing
  // taller, beyond that. An authored width keeps one box for every skin.
  const fit = !logo && !authoredWidth;
  // The floor sits on the placeholder as a length: a percentage floor counts as
  // zero while a row sizes itself to its content, and the row would then
  // squeeze its other children by the difference.
  const placeholder = fit ? 'flex:1 1 auto;min-width:' + width + 'px;min-height:0;padding:4px' : 'width:100%;height:100%;min-height:0;padding:4px';
  const inner = logo
    ? '<img ' + attribute + ' src="' + lib.escapeAttr(logo.src) + '" alt="' + lib.escapeAttr(label) + '" style="display:block;width:100%;height:100%;object-fit:contain" />'
    : '<div ' + attribute + ' class="wf-image-placeholder" role="img" aria-label="' + lib.escapeAttr(label) + '" title="' + lib.escapeAttr(label) + '" style="' + placeholder + '"><span class="wf-image-caption">' + lib.escapeHtml(label) + '</span></div>';
  const style = fit
    ? 'display:flex;width:max-content;max-width:min(100%,24rem);min-height:' + height + 'px;flex:none;align-self:flex-start;overflow:hidden'
    : 'width:' + width + 'px;height:' + height + 'px;max-width:100%;flex:none;align-self:flex-start;overflow:hidden';
  return { inner, className: 'wf-image-logo wf-company-logo', style };
}

module.exports = { renderLogo };
