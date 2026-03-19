'use strict';

/**
 * Render a chart primitive node.
 *
 * @param {object} node - The chart node.
 * @param {object} props - Node props.
 * @param {string} childStyle - Pre-computed child style string.
 * @param {object} options - Render options.
 * @param {object} ctx - Shared rendering utilities from primitives.js:
 *   { buildNodeClasses, renderBoundText, joinAttrs, renderChildren, buildNodeDataAttributes }
 * @param {object} extra - Additional context:
 *   { bindingContext, paneSide, stateBindings, selectionValue, paneData }
 */
function renderChart(node, props, childStyle, options, ctx, extra) {
  const classes = ctx.buildNodeClasses(node, 'chart', null, extra.paneSide);
  const chartType = typeof props.chartType === 'string' ? props.chartType : 'bar';
  const title = ctx.renderBoundText(typeof props.label === 'string' ? props.label : 'Chart', extra.bindingContext);
  const dataAttrs = ctx.buildNodeDataAttributes(node, extra.stateBindings, extra.selectionValue, extra.paneData);

  let svg = '';
  if (chartType === 'line') {
    svg = [
      '<svg viewBox="0 0 200 120" class="wf-chart-svg">',
      '<line x1="20" y1="100" x2="180" y2="100" stroke="#9ca3af" stroke-width="1"/>',
      '<line x1="20" y1="10" x2="20" y2="100" stroke="#9ca3af" stroke-width="1"/>',
      '<polyline points="30,80 60,50 90,65 120,30 150,45 170,20" fill="none" stroke="#666" stroke-width="2"/>',
      '</svg>',
    ].join('');
  } else if (chartType === 'bar' || chartType === 'vertical') {
    svg = [
      '<svg viewBox="0 0 200 120" class="wf-chart-svg">',
      '<line x1="20" y1="100" x2="180" y2="100" stroke="#9ca3af" stroke-width="1"/>',
      '<line x1="20" y1="10" x2="20" y2="100" stroke="#9ca3af" stroke-width="1"/>',
      '<rect x="30" y="40" width="20" height="60" fill="#9ca3af"/>',
      '<rect x="60" y="55" width="20" height="45" fill="#666"/>',
      '<rect x="90" y="25" width="20" height="75" fill="#9ca3af"/>',
      '<rect x="120" y="60" width="20" height="40" fill="#666"/>',
      '<rect x="150" y="35" width="20" height="65" fill="#9ca3af"/>',
      '</svg>',
    ].join('');
  } else if (chartType === 'horizontal') {
    svg = [
      '<svg viewBox="0 0 200 120" class="wf-chart-svg">',
      '<line x1="40" y1="10" x2="40" y2="110" stroke="#9ca3af" stroke-width="1"/>',
      '<rect x="40" y="15" width="120" height="14" fill="#9ca3af"/>',
      '<rect x="40" y="35" width="80" height="14" fill="#666"/>',
      '<rect x="40" y="55" width="140" height="14" fill="#9ca3af"/>',
      '<rect x="40" y="75" width="60" height="14" fill="#666"/>',
      '<rect x="40" y="95" width="100" height="14" fill="#9ca3af"/>',
      '</svg>',
    ].join('');
  } else if (chartType === 'gauge') {
    svg = [
      '<svg viewBox="0 0 200 120" class="wf-chart-svg">',
      '<path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="#e5e7eb" stroke-width="12" stroke-linecap="round"/>',
      '<path d="M 30 100 A 70 70 0 0 1 130 32" fill="none" stroke="#666" stroke-width="12" stroke-linecap="round"/>',
      '<text x="100" y="95" text-anchor="middle" fill="#666" font-size="18">72%</text>',
      '</svg>',
    ].join('');
  } else if (chartType === 'donut') {
    svg = [
      '<svg viewBox="0 0 200 140" class="wf-chart-svg">',
      '<circle cx="100" cy="70" r="50" fill="none" stroke="#e5e7eb" stroke-width="20"/>',
      '<circle cx="100" cy="70" r="50" fill="none" stroke="#666" stroke-width="20" stroke-dasharray="200 115" stroke-dashoffset="0" transform="rotate(-90 100 70)"/>',
      '<circle cx="100" cy="70" r="50" fill="none" stroke="#9ca3af" stroke-width="20" stroke-dasharray="80 235" stroke-dashoffset="-200" transform="rotate(-90 100 70)"/>',
      '</svg>',
    ].join('');
  } else {
    svg = [
      '<svg viewBox="0 0 200 120" class="wf-chart-svg">',
      '<rect x="20" y="20" width="160" height="80" fill="none" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4"/>',
      '<text x="100" y="65" text-anchor="middle" fill="#9ca3af" font-size="12">[chart]</text>',
      '</svg>',
    ].join('');
  }

  return `<div${ctx.joinAttrs(node.id, classes, childStyle)}${dataAttrs}><div class="wf-chart-title">${title}</div>${svg}${ctx.renderChildren(node, options)}</div>`;
}

module.exports = {
  renderChart,
};
