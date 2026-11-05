'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDocumentAgainstSchema } = require('../../engine/schema/validator');

test('invalid navigation actions report the supported choices for recovery', () => {
  const document = {documentType: 'page', specVersion: '1.1', id: 'home', page: {
    id: 'home', template: 'default', viewport: {device: 'web'}, slots: [{slotId: 'main', content: [
      {id: 'next', component: 'button', props: {label: 'Next'}, interaction: [{type: 'navigate', targetRoute: 'settings'}]}
    ]}]
  }};
  const errors = validateDocumentAgainstSchema(document, 'home.yaml');
  const error = errors.find(entry => entry.code === 'SCHEMA_ENUM' && entry.path.endsWith('.type'));
  assert.ok(error, JSON.stringify(errors));
  assert.match(error.message, /"navigation"/);
  assert.match(error.message, /"open_overlay"/);
  assert.ok(error.message.length < 500);
});
