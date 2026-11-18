'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');

const { createSlotsProject } = require('./fixtures/slots-project');

const WF = path.join(__dirname, '..', 'bin', 'wf.js');

function wf(projectPath, ...args) {
  return spawnSync(process.execPath, [WF, ...args], { cwd: projectPath, encoding: 'utf8' });
}

test('wf component show prints props, slots with their fallback, and the root outline', () => {
  const result = wf(createSlotsProject(), 'component', 'show', 'kit.panel');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, [
    'Component: kit.panel',
    'Source: components/kit.yaml (panel)',
    '',
    'Props:',
    '  title  default: "Details"  hint: Card heading',
    '',
    'Slots:',
    '  default  fallback: none',
    '  footer   fallback: close (component:button)',
    '',
    'Outline:',
    '  - panel (component:card)',
    '    - body (slot:default)',
    '    - footer (slot:footer)',
    '      - close (component:button)',
    '',
  ].join('\n'));
});

test('wf component show outlines nested instances and their named fills', () => {
  const result = wf(createSlotsProject(), 'component', 'show', 'kit.checkout');
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.split('\n');
  assert.ok(lines.includes('  heading  default: "Checkout"'));
  assert.ok(lines.includes('  actions  fallback: none'));
  assert.ok(lines.includes('    - pay_panel (use:kit.panel)'));
  assert.ok(lines.includes('      slots.footer:'));
  assert.ok(lines.includes('        - checkout_actions (slot:actions)'));
});

test('wf component show lists props used only as tokens, and components without slots', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.components.components = {
      tag: { root: { id: 'tag', component: 'badge', props: { text: '{{props.label}}' } } },
    };
  });
  const result = wf(projectPath, 'component', 'show', 'tag');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Source: components\.yaml \(tag\)\n/);
  assert.match(result.stdout, /Props:\n {2}label {2}default: none\n/);
  assert.match(result.stdout, /Slots:\n {2}\(none\)\n/);
});

test('wf component show fails clearly for a missing or unknown id', () => {
  const projectPath = createSlotsProject();
  const unknown = wf(projectPath, 'component', 'show', 'nope');
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Component "nope" does not exist\./);
  const missing = wf(projectPath, 'component', 'show');
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /requires a component id/);
});

test('plain wf component list output is unchanged: sorted local ids, one per line', () => {
  const projectPath = createSlotsProject((docs) => {
    docs.components.components = {
      zeta: { root: { id: 'zeta', component: 'text' } },
      alpha: { root: { id: 'alpha', component: 'text' } },
    };
  });
  const result = wf(projectPath, 'component', 'list');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'alpha\nzeta\n');
});
