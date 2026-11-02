'use strict';

const { primitiveNames } = require('./primitive-registry');

const PRIMITIVE_COMPONENTS = new Set(primitiveNames());

module.exports = { PRIMITIVE_COMPONENTS };
