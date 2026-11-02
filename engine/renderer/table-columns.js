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
        return { key, label: key, width: '', index, kind: 'text', align: '', sortable: false };
      }

      if (!isObject(entry)) {
        return null;
      }

      let key = typeof entry.key === 'string' && entry.key.trim() !== '' ? entry.key.trim() : '';
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
        kind: typeof entry.kind === 'string' ? entry.kind.trim() : 'text',
        align: typeof entry.align === 'string' ? entry.align.trim() : '',
        sortable: entry.sortable === true,
        actions: Array.isArray(entry.actions) ? entry.actions : null,
      };
    })
    .filter(Boolean);
}

function tableGridTemplate(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }
  return columns.map((column) => column.width || 'minmax(0,1fr)').join(' ');
}

module.exports = {
  deriveKeyFromLabel,
  normalizeTableColumns,
  tableGridTemplate,
};
