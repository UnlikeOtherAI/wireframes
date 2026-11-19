'use strict';

const { fieldState, fieldLabel, fieldHelp, describedBy } = require('./controls-field');
const { buttonRenderers } = require('./controls-buttons');
const { inputRenderers } = require('./controls-inputs');
const { choiceRenderers } = require('./controls-choices');

/** Chips in a field. Read-only draws the chips alone, without remove marks or the text box. */
function renderTagsInput(node, ctx, lib) {
  const props = node.props || {};
  const state = fieldState(props, lib);
  const remove = state.readonly ? '' : '<span class="wf-tag-x">×</span>';
  const tags = lib.items(props.tags).map((tag) => (
    `<span class="wf-tag">${lib.escapeHtml(lib.str(tag.label))}${remove}</span>`
  )).join('');
  const placeholder = lib.str(props.placeholder);
  const input = `<input type="text" placeholder="${lib.escapeAttr(placeholder)}"${
    lib.stateAttrs(state, { owner: lib.STATE_OWNERS.field })}${describedBy(props, lib, node)} />`;
  return {
    inner: `${fieldLabel(props, ctx, lib)}<span class="wf-control wf-tags">${tags}${input}</span>${fieldHelp(props, ctx, lib, node)}`,
    className: `wf-field${state.invalid ? ' wf-field-invalid' : ''}`,
  };
}

function uploadFiles(props, lib) {
  return lib.items(props.files, 'name').map((file) => (
    `<span class="wf-upload-file">${lib.icon('file')}<span>${lib.escapeHtml(lib.str(file.name) || lib.str(file.label))}</span></span>`
  )).join('');
}

/**
 * The field form of upload: `fieldLabel` above, the dropzone (or button) in
 * its own box carrying the state, help below. Read-only drops the action.
 */
function renderUploadField(node, ctx, lib, files) {
  const props = node.props || {};
  const label = lib.str(props.label) || 'Drop files here';
  const hint = lib.str(props.hint);
  const state = fieldState(props, lib);
  const heading = fieldLabel({ label: props.fieldLabel, required: props.required, readonly: props.readonly, disabled: props.disabled }, ctx, lib);
  const help = fieldHelp(props, ctx, lib, node);
  const button = props.variant === 'button';
  let body;
  if (state.readonly) {
    body = files ? `<div class="wf-upload-files">${files}</div>` : '<div class="wf-upload-hint">No files</div>';
  } else if (button) {
    body = `<button class="wf-act wf-button-secondary"${lib.stateAttrs({ disabled: state.disabled }, { owner: lib.STATE_OWNERS.button })}${
      describedBy(props, lib, node)}>${lib.icon('arrow-up-from-bracket')} ${lib.escapeHtml(label)}</button>${files}`;
  } else {
    body = `<span class="wf-upload-glyph">${lib.icon('cloud-arrow-up', { size: 'xl' })}</span><div class="wf-upload-label">${lib.bound(label, ctx)}</div>${
      hint ? `<div class="wf-upload-hint">${lib.bound(hint, ctx)}</div>` : ''
    }${files ? `<div class="wf-upload-files">${files}</div>` : ''}`;
  }
  const zone = button && !state.readonly ? 'wf-upload-row' : 'wf-upload-zone';
  return {
    inner: `${heading}<div class="${zone}"${lib.stateAttrs(state)}>${body}</div>${help}`,
    className: `wf-upload-field${state.invalid ? ' wf-field-invalid' : ''}`,
  };
}

function renderUpload(node, ctx, lib) {
  const props = node.props || {};
  const label = lib.str(props.label) || 'Drop files here';
  const hint = lib.str(props.hint);
  const files = uploadFiles(props, lib);
  const state = fieldState(props, lib);
  if (lib.str(props.fieldLabel) || lib.str(props.help) || Object.values(state).includes(true)) {
    return renderUploadField(node, ctx, lib, files);
  }

  if (props.variant === 'button') {
    return {
      inner: `<button class="wf-act wf-button-secondary">${lib.icon('arrow-up-from-bracket')} ${lib.escapeHtml(label)}</button>${files}`,
      className: 'wf-upload-button',
    };
  }
  return {
    inner: `<span class="wf-upload-glyph">${lib.icon('cloud-arrow-up', { size: 'xl' })}</span><div class="wf-upload-label">${lib.bound(label, ctx)}</div>${
      hint ? `<div class="wf-upload-hint">${lib.bound(hint, ctx)}</div>` : ''
    }${files ? `<div class="wf-upload-files">${files}</div>` : ''}`,
  };
}

const EDITOR_TOOLS = ['bold', 'italic', 'list-ul', 'link', 'image', 'code'];

/** Rich-text placeholder. Read-only draws the body without the toolbar. */
function renderEditor(node, ctx, lib) {
  const props = node.props || {};
  const state = fieldState(props, lib);
  const rows = Math.max(2, Math.min(24, lib.num(props.rows, 6)));
  const toolbar = props.toolbar === false || state.readonly
    ? ''
    : `<div class="wf-editor-toolbar">${EDITOR_TOOLS.map((tool) => `<span class="wf-editor-tool">${lib.icon(tool, { size: 'sm' })}</span>`).join('')}</div>`;
  const lines = Array.from({ length: Math.min(rows, 5) }, (_, i) => (
    `<span class="wf-skeleton-row">${lib.renderSkeleton(i === 4 ? '45%' : '100%')}</span>`
  )).join('');
  return {
    inner: `${fieldLabel(props, ctx, lib)}${toolbar}<div class="wf-editor-body"${lib.stateAttrs(state)} style="min-height:${rows * 22}px">${lines}</div>${fieldHelp(props, ctx, lib)}`,
    ...(state.invalid ? { className: 'wf-field-invalid' } : {}),
  };
}

module.exports = {
  controlRenderers: {
    ...buttonRenderers,
    ...inputRenderers,
    ...choiceRenderers,
    tags_input: renderTagsInput,
    upload: renderUpload,
    editor: renderEditor,
  },
};
