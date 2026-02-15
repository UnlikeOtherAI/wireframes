#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { run } = require(path.resolve(__dirname, '..', 'cli'));

const context = {
  cwd: process.cwd(),
};

run(process.argv.slice(2), context);
