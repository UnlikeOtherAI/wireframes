'use strict';

function validateIconReferences(documents, index) {
  const names = new Map();
  for (const icon of index) {
    for (const name of [icon.name, ...icon.aliases]) names.set(name, icon);
  }
  const diagnostics = [];
  const check = (name, style, path) => {
    if (typeof name !== 'string' || !name.trim()) return;
    const icon = names.get(name.trim());
    if (!icon) diagnostics.push({ code: 'UNKNOWN_ICON', message: path + ': unknown Font Awesome Free icon "' + name + '". Use wf icons search.', path });
    else if (!icon.styles.includes(style || 'solid')) diagnostics.push({
      code: 'ICON_STYLE_UNAVAILABLE',
      message: path + ': "' + name + '" supports ' + icon.styles.join(', ') + ', not ' + (style || 'solid') + '.',
      path,
    });
  };
  const visit = (value, path) => {
    if (!value || typeof value !== 'object') return;
    if (value instanceof Map) { for (const [key, item] of value) visit(item, path + '.' + key); return; }
    if (Array.isArray(value)) { value.forEach((item, i) => visit(item, path + '[' + i + ']')); return; }
    if (value.component === 'icon') check(value.props?.name, value.props?.style, path + '.props.name');
    if (typeof value.icon === 'string') check(value.icon, value.iconStyle, path + '.icon');
    for (const [key, child] of Object.entries(value)) visit(child, path + '.' + key);
  };
  visit(documents, 'project');
  return diagnostics;
}

module.exports = { validateIconReferences };
