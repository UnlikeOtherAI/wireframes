'use strict';

/**
 * The child an app bar names as its leading control.
 *
 * `app_bar.props.leading` is an icon name, or the id of one of the bar's children. A named
 * child is drawn before the title in place of a glyph: a glyph cannot be pressed, and a menu
 * or back button has to be. A child's id wins over an icon of the same name.
 */
function leadingChild(node) {
  if (!node || node.component !== 'app_bar' || !node.props || !Array.isArray(node.children)) return null;
  const name = node.props.leading;
  if (typeof name !== 'string' || name === '') return null;
  return node.children.find((child) => child && child.id === name) || null;
}

/**
 * Keeps a bar naming the same child when ids are rewritten, as they are inside a reusable
 * component and in each row of a bound list. Call it before the children are renamed;
 * `rename` gives a child's new id from its old one.
 */
function renameLeading(node, rename) {
  const child = leadingChild(node);
  if (child) node.props.leading = rename(child.id);
}

module.exports = { leadingChild, renameLeading };
