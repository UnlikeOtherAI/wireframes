'use strict';

const {
  layoutToCss,
  layoutItemCss,
  absoluteChildStyle,
  shouldRenderParentSeparators,
  toPx,
} = require('./layout');
const {
  surfaceElevationOverride,
} = require('./wireframe-styles');

function sectionBodyDividerClass(layout) {
  if (!shouldRenderParentSeparators(layout)) return '';
  const type = layout.type || 'stack';
  return type === 'row' ? ' wf-divide-x' : ' wf-divide-y';
}

/**
 * All primitive render functions.
 *
 * Each receives a context object `c` with the closured variables from renderNode:
 *   node, props, layout, size, gridItem, defaultGridColumns, options, childStyle,
 *   paneSide, stateBindings, selectionValue, paneData, bindingContext,
 *   navigationTarget, safeHeadingLevel, projectPath, parentLayoutType,
 *   isBorderless, nodeWireframeOverrides, wfNodeBorderStyle
 *
 * And shared functions via `f`:
 *   buildNodeClasses, buildNodeDataAttributes, joinAttrs, escapeAttr, escapeHtml,
 *   renderBoundText, renderChildren, resolveAttributeValue, navigationAttrs,
 *   renderImageElement, renderSectionTitle, renderSelectOptions, paneMetaToStyle,
 *   isObject
 */

function renderHeading(c, f) {
  const classes = f.buildNodeClasses(c.node, 'heading', c.safeHeadingLevel, c.paneSide);
  const headingText = f.renderBoundText(
    typeof c.props.text === 'string' ? c.props.text : 'Heading',
    c.bindingContext,
  );
  const headingContent = c.navigationTarget
    ? `<a${f.joinAttrs(null, 'wf-inline-link', null, f.navigationAttrs(c.navigationTarget))}>${headingText}</a>`
    : headingText;
  const body = `<h${c.safeHeadingLevel}>${headingContent}</h${c.safeHeadingLevel}>`;
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}>${body}${f.renderChildren(c.node, c.options)}</div>`;
}

function renderParagraph(c, f) {
  const classes = f.buildNodeClasses(c.node, 'paragraph', null, c.paneSide);
  const paragraphText = f.renderBoundText(typeof c.props.text === 'string' ? c.props.text : '', c.bindingContext);
  const paragraphContent = c.navigationTarget
    ? `<a${f.joinAttrs(null, 'wf-inline-link', null, f.navigationAttrs(c.navigationTarget))}>${paragraphText}</a>`
    : paragraphText;
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><p>${paragraphContent}</p>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderText(c, f) {
  const classes = f.buildNodeClasses(c.node, 'text', null, c.paneSide);
  const textContent = f.renderBoundText(typeof c.props.text === 'string' ? c.props.text : '', c.bindingContext);
  const textBody = c.navigationTarget
    ? `<a${f.joinAttrs(null, 'wf-inline-link', null, f.navigationAttrs(c.navigationTarget))}>${textContent}</a>`
    : textContent;
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<span${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}>${textBody}</span>${f.renderChildren(c.node, c.options)}`;
}

function renderImage(c, f) {
  const classes = f.buildNodeClasses(c.node, 'image', null, c.paneSide);
  const image = f.renderImageElement(c.projectPath, c.props, {
    ...c.bindingContext,
    assetUrlPrefix: c.options && typeof c.options.assetUrlPrefix === 'string' ? c.options.assetUrlPrefix : '',
  });
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}>${image}</div>`;
}

function renderIcon(c, f) {
  const classes = f.buildNodeClasses(c.node, 'icon', null, c.paneSide);
  const iconName = typeof c.props.name === 'string' ? c.props.name.trim() : 'circle-question';
  const iconStyle = typeof c.props.style === 'string' ? c.props.style.trim() : 'solid';
  const faPrefix = iconStyle === 'regular' ? 'fa-regular' : iconStyle === 'brands' ? 'fa-brands' : 'fa-solid';
  const sizeClass = typeof c.props.size === 'string' ? ` fa-${f.escapeAttr(c.props.size)}` : '';
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<span${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><i class="${faPrefix} fa-${f.escapeAttr(iconName)}${sizeClass}"></i></span>`;
}

function renderButton(c, f) {
  const classes = f.buildNodeClasses(c.node, 'button', null, c.paneSide);
  const hasIcon = typeof c.props.icon === 'string' && c.props.icon.trim() !== '';
  const rawLabel = typeof c.props.label === 'string' ? c.props.label : (hasIcon ? '' : 'Button');
  const buttonLabel = f.renderBoundText(rawLabel, c.bindingContext);
  const iconName = typeof c.props.icon === 'string' ? c.props.icon.trim() : '';
  const iconStyleProp = typeof c.props.iconStyle === 'string' ? c.props.iconStyle.trim() : 'solid';
  const iconPrefix = iconStyleProp === 'regular' ? 'fa-regular' : iconStyleProp === 'brands' ? 'fa-brands' : 'fa-solid';
  const iconSizeClass = typeof c.props.iconSize === 'string' ? ` fa-${f.escapeAttr(c.props.iconSize)}` : '';
  const iconHtml = iconName !== ''
    ? `<i class="${iconPrefix} fa-${f.escapeAttr(iconName)}${iconSizeClass}"></i> `
    : '';
  const renderedLabel = c.options.mode === 'line'
    ? `[ ${iconHtml}${buttonLabel} ]`
    : `${iconHtml}${buttonLabel}`;
  const buttonMarkup = c.navigationTarget
    ? `<a${f.joinAttrs(null, 'wf-button-link', null, f.navigationAttrs(c.navigationTarget))}>${renderedLabel}</a>`
    : `<button>${renderedLabel}</button>`;
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}>${buttonMarkup}${f.renderChildren(c.node, c.options)}</div>`;
}

function renderTabBar(c, f) {
  const classes = f.buildNodeClasses(c.node, 'tab_bar', null, c.paneSide);
  const tabLayout = Object.keys(c.layout).length > 0
    ? c.layout
    : { type: 'row', gap: 8, separatorPolicy: 'none', padding: 0, align: 'stretch' };
  const bodyChildren = f.renderChildren({
    ...c.node,
    layout: tabLayout,
  }, {
    ...c.options,
    parentLayoutType: tabLayout.type || 'row',
  });
  const bodyLayoutCss = layoutToCss(tabLayout, {}, { defaultGridColumns: c.defaultGridColumns, density: c.options.density });
  const bodyDividerClass = sectionBodyDividerClass(tabLayout);
  const bodyStyleAttr = bodyLayoutCss ? ` style="${f.escapeAttr(bodyLayoutCss)}"` : '';
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><div class="wf-tab-bar-body${bodyDividerClass}"${bodyStyleAttr}>${bodyChildren}</div></div>`;
}

function renderBottomTabBar(c, f) {
  const classes = f.buildNodeClasses(c.node, 'bottom_tab_bar', null, c.paneSide);
  const tabLayout = Object.keys(c.layout).length > 0
    ? c.layout
    : { type: 'row', gap: 4, separatorPolicy: 'none', padding: 0, align: 'stretch' };
  const bodyChildren = f.renderChildren({
    ...c.node,
    layout: tabLayout,
  }, {
    ...c.options,
    parentLayoutType: tabLayout.type || 'row',
  });
  const bodyLayoutCss = layoutToCss(tabLayout, {}, { defaultGridColumns: c.defaultGridColumns, density: c.options.density });
  const bodyDividerClass = sectionBodyDividerClass(tabLayout);
  const bodyStyleAttr = bodyLayoutCss ? ` style="${f.escapeAttr(bodyLayoutCss)}"` : '';
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><div class="wf-bottom-tab-bar-body${bodyDividerClass}"${bodyStyleAttr}>${bodyChildren}</div></div>`;
}

function renderInput(c, f) {
  const classes = f.buildNodeClasses(c.node, 'input', null, c.paneSide);
  const inputType = ['text', 'password', 'email', 'number', 'search'].includes(c.props.inputType) ? c.props.inputType : 'text';
  const placeholder = f.resolveAttributeValue(
    typeof c.props.placeholder === 'string' ? c.props.placeholder : '',
    c.bindingContext,
    c.stateBindings,
    'placeholder',
  );
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><input type="${inputType}" placeholder="${f.escapeAttr(placeholder)}" /></div>`;
}

function renderTextarea(c, f) {
  const classes = f.buildNodeClasses(c.node, 'textarea', null, c.paneSide);
  const rows = Number.isInteger(c.props.rows) && c.props.rows > 0 ? c.props.rows : 3;
  const placeholder = f.resolveAttributeValue(
    typeof c.props.placeholder === 'string' ? c.props.placeholder : '',
    c.bindingContext,
    c.stateBindings,
    'placeholder',
  );
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><textarea placeholder="${f.escapeAttr(placeholder)}" rows="${rows}"></textarea>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderSelect(c, f) {
  const classes = f.buildNodeClasses(c.node, 'select', null, c.paneSide);
  const placeholder = f.resolveAttributeValue(
    typeof c.props.placeholder === 'string' ? c.props.placeholder : 'Select',
    c.bindingContext,
    c.stateBindings,
    'placeholder',
  );
  const optionsMarkup = f.renderSelectOptions(Array.isArray(c.props.options) ? c.props.options : []);
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><select><option value="">${f.escapeHtml(placeholder)}</option>${optionsMarkup}</select>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderCheckbox(c, f) {
  const classes = f.buildNodeClasses(c.node, 'checkbox', null, c.paneSide);
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><label><input type="checkbox" /> ${
    f.renderBoundText(typeof c.props.label === 'string' ? c.props.label : 'Checkbox', c.bindingContext)
  }</label>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderRadio(c, f) {
  const classes = f.buildNodeClasses(c.node, 'radio', null, c.paneSide);
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><label><input type="radio" /> ${
    f.renderBoundText(typeof c.props.label === 'string' ? c.props.label : 'Option', c.bindingContext)
  }</label>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderToggle(c, f) {
  const classes = f.buildNodeClasses(c.node, 'toggle', null, c.paneSide);
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs}><label><span class="wf-toggle-track"><span class="wf-toggle-thumb"></span></span> ${
    f.renderBoundText(typeof c.props.label === 'string' ? c.props.label : 'Toggle', c.bindingContext)
  }</label>${f.renderChildren(c.node, c.options)}</div>`;
}

function renderSection(c, f) {
  const classes = f.buildNodeClasses(c.node, 'section', null, c.paneSide);
  const sectionLayoutType = f.isObject(c.node.layout) ? c.node.layout.type || 'stack' : 'stack';
  const children = f.renderChildren(c.node, {
    ...c.options,
    parentLayoutType: sectionLayoutType,
  });
  const sectionTitle = f.renderSectionTitle(
    {
      title: f.resolveAttributeValue(
        typeof c.props.title === 'string' ? c.props.title : 'Section',
        c.bindingContext,
        c.stateBindings,
        'title',
      ),
    },
    c.bindingContext,
  );
  const sectionOuterStyle = [
    layoutToCss({}, c.size, { defaultGridColumns: c.defaultGridColumns, density: c.options.density }),
    layoutItemCss(c.gridItem),
    absoluteChildStyle(c.node.position, c.parentLayoutType),
    f.paneMetaToStyle(c.paneData),
    surfaceElevationOverride(c.node.elevation, c.options.rendering),
    (c.isBorderless || c.options.mode) ? '' : c.wfNodeBorderStyle,
    c.nodeWireframeOverrides,
  ].filter(Boolean).join(';');
  const bodyLayoutCss = layoutToCss(c.layout, {}, { defaultGridColumns: c.defaultGridColumns, density: c.options.density });
  const bodyDividerClass = sectionBodyDividerClass(c.layout);
  const bodyClass = `wf-section-body${bodyDividerClass}`;
  const bodyStyleAttr = bodyLayoutCss ? ` style="${f.escapeAttr(bodyLayoutCss)}"` : '';
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, sectionOuterStyle)}${dataAttrs}>${sectionTitle}<div class="${bodyClass}"${bodyStyleAttr}>${children}</div></div>`;
}

function renderDivider(c, f) {
  const classes = f.buildNodeClasses(c.node, 'divider', null, c.paneSide);
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<hr${f.joinAttrs(c.node.id, classes, c.childStyle)}${dataAttrs} />`;
}

function renderSpacer(c, f) {
  const classes = f.buildNodeClasses(c.node, 'spacer', null, c.paneSide);
  const spacerSize = toPx(Number.isFinite(c.props.size) ? Number(c.props.size) : Number(c.props.size) || 16);
  const orientation = c.options.parentLayoutType === 'row' ? 'width' : 'height';
  const spacerStyle = spacerSize ? `${c.childStyle}${c.childStyle ? ';' : ''}${orientation}:${spacerSize}` : c.childStyle;
  const dataAttrs = f.buildNodeDataAttributes(c.node, c.stateBindings, c.selectionValue, c.paneData);
  return `<div${f.joinAttrs(c.node.id, classes, spacerStyle)}${dataAttrs}></div>`;
}

const PRIMITIVE_RENDERERS = {
  heading: renderHeading,
  paragraph: renderParagraph,
  text: renderText,
  image: renderImage,
  icon: renderIcon,
  button: renderButton,
  tab_bar: renderTabBar,
  bottom_tab_bar: renderBottomTabBar,
  input: renderInput,
  textarea: renderTextarea,
  select: renderSelect,
  checkbox: renderCheckbox,
  radio: renderRadio,
  toggle: renderToggle,
  section: renderSection,
  divider: renderDivider,
  spacer: renderSpacer,
};

module.exports = {
  PRIMITIVE_RENDERERS,
};
