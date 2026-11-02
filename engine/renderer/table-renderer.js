'use strict';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function deriveKeyFromLabel(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function normalizeTableColumns(props) {
  if (!Array.isArray(props?.columns)) {
    return [];
  }

  return props.columns
    .map((entry, index) => {
      if (typeof entry === 'string' && entry.trim() !== '') {
        const key = entry.trim();
        return {
          key,
          label: key,
          width: '',
          index,
        };
      }

      if (!isObject(entry)) {
        return null;
      }

      let key = typeof entry.key === 'string' && entry.key.trim() !== ''
        ? entry.key.trim()
        : '';

      if (!key && typeof entry.label === 'string' && entry.label.trim() !== '') {
        key = deriveKeyFromLabel(entry.label);
      }

      if (!key) {
        return null;
      }

      const label = typeof entry.label === 'string' && entry.label.trim() !== ''
        ? entry.label.trim()
        : key;
      const width = typeof entry.width === 'number' && Number.isFinite(entry.width)
        ? `${entry.width}px`
        : typeof entry.width === 'string' && entry.width.trim() !== ''
          ? entry.width.trim()
          : '';

      return {
        key,
        label,
        width,
        index,
      };
    })
    .filter(Boolean);
}

function tableGridTemplate(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }

  return columns
    .map((column) => column.width || 'minmax(0,1fr)')
    .join(' ');
}

/**
 * Render a table primitive node.
 *
 * @param {object} node - The table node.
 * @param {object} props - Node props.
 * @param {string} childStyle - Pre-computed child style string.
 * @param {object} options - Render options.
 * @param {object} ctx - Shared rendering utilities from primitives.js:
 *   { buildNodeClasses, renderBoundText, escapeHtml, escapeAttr, joinAttrs,
 *     getPathValue, resolveCollectionItems, buildNodeDataAttributes }
 * @param {object} extra - Additional context:
 *   { bindingContext, paneSide, stateBindings, selectionValue, paneData }
 */
function renderTable(node, props, childStyle, options, ctx, extra) {
  const classes = ctx.buildNodeClasses(node, 'table', null, extra.paneSide, extra.isSurface);
  const columns = normalizeTableColumns(props);
  const rows = resolveTableRows(node, props, options, ctx);
  const itemVar = typeof node?.binding?.itemVar === 'string' && node.binding.itemVar.trim() !== ''
    ? node.binding.itemVar.trim()
    : 'item';
  const template = tableGridTemplate(columns);
  const gridStyleAttr = template ? ` style="${ctx.escapeAttr(`grid-template-columns:${template}`)}"` : '';
  const dataAttrs = ctx.buildNodeDataAttributes(node, extra.stateBindings, extra.selectionValue, extra.paneData);

  const headerMarkup = columns.length > 0
    ? columns.map((column) => (
      `<div class="wf-table-cell wf-table-header-cell" data-wf-table-column="${column.index}">${
        ctx.renderBoundText(column.label, extra.bindingContext)
      }</div>`
    )).join('')
    : '<div class="wf-table-cell wf-table-header-cell">Table</div>';

  const bodyMarkup = rows.length > 0
    ? rows.map((row, rowIndex) => {
      const rowContext = isObject(row) ? row : {};
      const rowBindingContext = {
        ...extra.bindingContext,
        item: rowContext,
        itemVar,
      };

      return `<div class="wf-table-row wf-table-grid" data-wf-table-row="${rowIndex}"${gridStyleAttr}>${
        columns.map((column) => (
          `<div class="wf-table-cell" data-wf-table-column="${column.index}">${
            renderTableValue(ctx.getPathValue(rowContext, column.key), rowBindingContext, ctx)
          }</div>`
        )).join('')
      }</div>`;
    }).join('')
    : `<div class="wf-table-row wf-table-row-empty"${gridStyleAttr}><div class="wf-table-cell">${
      ctx.escapeHtml(typeof props.emptyText === 'string' && props.emptyText.trim() !== '' ? props.emptyText : 'No rows')
    }</div></div>`;

  return `<div${ctx.joinAttrs(node.id, classes, childStyle)}${dataAttrs}><div class="wf-table-header wf-table-grid"${gridStyleAttr}>${headerMarkup}</div><div class="wf-table-body">${bodyMarkup}</div></div>`;
}

function resolveTableRows(node, props, options, ctx) {
  const collection = ctx.resolveCollectionItems(node.binding, options);
  if (Array.isArray(collection.items) && collection.items.length > 0) {
    return collection.items;
  }

  return Array.isArray(props?.rows) ? props.rows : [];
}

function renderTableValue(value, bindingContext, ctx) {
  if (typeof value === 'string') {
    return ctx.renderBoundText(value, bindingContext);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return ctx.escapeHtml(String(value));
  }
  return '';
}

module.exports = {
  deriveKeyFromLabel,
  normalizeTableColumns,
  tableGridTemplate,
  renderTable,
};
