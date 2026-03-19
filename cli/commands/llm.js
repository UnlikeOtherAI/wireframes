'use strict';

const path = require('node:path');
const { generateLlmReference } = require(path.resolve(__dirname, '..', '..', 'shared', 'schema', 'llm-reference'));

function runLlm() {
  console.log(generateLlmReference());
}

module.exports = { runLlm };
