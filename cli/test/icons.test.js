'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const catalogue = require('../../engine/icons/catalogue');
const { iconsForRequest } = require('../../engine/icons/search');
const { validateIconReferences } = require('../../engine/icons/validate');
const cli = path.join(__dirname, '../bin/wf.js');
const search = (...args) => JSON.parse(execFileSync(process.execPath, [cli, 'icons', 'search', ...args, '--json'], { encoding: 'utf8' })).icons;

test('real CLI finds burger menu, search aliases and each Free style', () => {
  assert.equal(search('burger menu')[0].name, 'bars');
  assert.equal(search('search')[0].name, 'magnifying-glass');
  assert.equal(search('settings')[0].name, 'gear');
  assert.equal(search('navicon')[0].name, 'bars');
  assert.equal(search('github', '--style', 'brands')[0].name, 'github');
  assert.ok(search('envelope', '--style', 'regular')[0].styles.includes('regular'));
  assert.deepEqual(search('bars', '--style', 'regular'), []);
  assert.deepEqual(search('no_such_wf_icon_zzzz'), []);
});
test('real CLI enforces a bounded result size and invalid-option failures', () => {
  assert.equal(search('arrow', '--limit', '3').length, 3);
  for (const args of [['--limit', '5000'], ['--style', 'pro'], ['--unknown']]) {
    assert.equal(spawnSync(process.execPath, [cli, 'icons', 'search', 'arrow', ...args]).status, 1);
  }
});
test('request context returns relevant names without loading catalogue into prompt', () => {
  const context = iconsForRequest(catalogue, 'Add a burger menu and search to the top bar');
  assert.match(context, /\bbars \(solid\)/);
  assert.match(context, /magnifying-glass \(solid\)/);
  assert.equal(iconsForRequest(catalogue, 'Change the heading to Welcome back'), '');
  assert.ok(context.split('\n').length <= 8);
  assert.ok(context.length <= 1200);
  assert.doesNotMatch(context, /svgs|path|unicode|familyStylesByLicense/);
});
test('validates names and available Free styles without rejecting aliases', () => {
  const docs = [{ component: 'icon', props: { name: 'navicon' } },
    { component: 'button', props: { icon: 'github', iconStyle: 'brands' } },
    { component: 'icon', props: { name: 'bluetooth' } },
    { component: 'button', props: { icon: '{{ props.icon }}' } }];
  assert.deepEqual(validateIconReferences(docs, catalogue), []);
  assert.deepEqual(validateIconReferences([
    { component: 'icon', props: { name: 'not-a-real-wf-icon' } },
    { component: 'input', props: { icon: 'bars', iconStyle: 'regular' } },
  ], catalogue).map((d) => d.code), ['UNKNOWN_ICON', 'ICON_STYLE_UNAVAILABLE']);
});

test('unknown icon feedback gives bounded, usable Free names', () => {
  const result = validateIconReferences([{ component: 'button', props: { icon: 'settings' } }], catalogue);
  assert.equal(result[0].code, 'UNKNOWN_ICON');
  assert.match(result[0].message, /gear \(solid\)/);
  assert.ok(result[0].message.length < 400);
});
