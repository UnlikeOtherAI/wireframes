'use strict';

// Props every form control shares (schema-systems.md §15.5). A control
// descriptor spreads them and then adds or overrides its own:
//
//   props: { ...FIELD_PROPS, label: { type: 'string', primary: true }, value: … }
//
// `label` is not primary here, because some controls (segmented) keep another
// prop as their shorthand. The spread position sets the props' order in
// schema.json and `wf llm`.

const FIELD_PROPS = Object.freeze({
  label: Object.freeze({ type: 'string' }),
  help: Object.freeze({ type: 'string' }),
  error: Object.freeze({ type: 'string' }),
  required: Object.freeze({ type: 'boolean' }),
  disabled: Object.freeze({ type: 'boolean' }),
  readonly: Object.freeze({ type: 'boolean' }),
});

module.exports = { FIELD_PROPS };
