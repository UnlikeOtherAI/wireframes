'use strict';

/** `locate` adds each finding's `path` beside its message. */
function validatePresentation(documents, { locate = false } = {}) {
  const errors = [], warnings = [];
  const found = (code, path, text) => (locate ? { code, message: path + ': ' + text, path } : { code, message: path + ': ' + text });
  const visit = (value, path, siblings = [], parent = null) => {
    if (!value || typeof value !== 'object') return;
    if (value instanceof Map) { for (const [key, item] of value) visit(item, path + '.' + key); return; }
    if (Array.isArray(value)) { value.forEach((item, i) => visit(item, path + '[' + i + ']', value, parent)); return; }
    const props = value.props || {};
    if (value.component === 'input' && props.icon) {
      const position = props.iconPosition || 'start';
      if ((props.prefix && position !== 'end') || (props.suffix && position !== 'start')) {
        errors.push(found('ICON_AFFIX_CONFLICT', path, 'icon and authored affix occupy the same side. Use the opposite side or remove the affix.'));
      }
    }
    if (value.sticky === 'top' && siblings.length && siblings[siblings.length - 1] === value) {
      warnings.push(found('STICKY_NO_FOLLOWING_CONTENT', path, 'a sticky top bar needs following content in the same containing region.'));
    }
    if (value.sticky && value.sticky !== 'none' && ['carousel', 'table', 'kanban'].includes(parent?.component)) {
      warnings.push(found('STICKY_CONTAINING_SCROLL', path, 'sticky positioning is confined to the parent ' + parent.component + ' scroll area.'));
    }
    for (const [key, child] of Object.entries(value)) visit(child, path + '.' + key, [], value.component ? value : parent);
  };
  visit(documents, 'project');
  return { errors, warnings };
}

module.exports = { validatePresentation };
