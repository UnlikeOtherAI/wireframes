'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { COMMANDS, GROUPS, commandNames, usageFor, topLevelUsage } = require('../commands/registry');

const DISPATCHER = path.join(__dirname, '..', 'commands', 'index.js');

/** Every `command === '<name>'` branch in the dispatcher. */
function dispatchedCommands() {
  const source = fs.readFileSync(DISPATCHER, 'utf8');
  const names = new Set();
  for (const match of source.matchAll(/command === '([a-z][a-z-]*)'/g)) {
    names.add(match[1]);
  }
  names.delete('help');
  return names;
}

// The help used to be a hand-maintained string next to the dispatcher, which is
// how it drifts. Both now come from the registry, and this proves it.
test('every command the CLI dispatches is documented, and vice versa', () => {
  const dispatched = dispatchedCommands();
  const documented = new Set(commandNames());

  for (const name of dispatched) {
    assert.ok(documented.has(name), `wf ${name} is dispatched but missing from the command registry`);
  }
  for (const name of documented) {
    assert.ok(dispatched.has(name), `wf ${name} is documented but never dispatched`);
  }
});

test('every command appears in exactly one help group', () => {
  const grouped = GROUPS.flatMap(([, names]) => names);
  assert.equal(grouped.length, new Set(grouped).size, 'a command is listed in two groups');
  assert.deepEqual(
    [...grouped].sort(),
    [...commandNames()].sort(),
    'the groups and the command list disagree',
  );
});

test('every command has a summary and a usage line that names it', () => {
  for (const entry of COMMANDS) {
    assert.ok(entry.summary && entry.summary.length > 8, `wf ${entry.name} has no real summary`);
    assert.ok(!entry.summary.endsWith('.'), `wf ${entry.name}'s summary should not end in a full stop`);
    for (const line of entry.usage.split('\n')) {
      assert.ok(
        line.startsWith(`wf ${entry.name}`),
        `wf ${entry.name} has a usage line for something else: ${line}`,
      );
    }
  }
});

test('the top-level help lists every command', () => {
  const usage = topLevelUsage();
  for (const name of commandNames()) {
    assert.ok(usage.includes(`  ${name}`), `wf ${name} is missing from the top-level help`);
  }
  assert.match(usage, /wf help <command>/);
  assert.match(usage, /wf --version/);
});

test('wf help <command> prints that command and nothing else', () => {
  const detail = usageFor('build');
  assert.match(detail, /Build a static wireframe website/);
  assert.match(detail, /--base-path <path>/);
  assert.ok(!detail.includes('wf serve'), 'one command\'s help leaked another\'s');
  assert.equal(usageFor('nope'), null);
});

// `wf init --help` used to scaffold a project into a folder called `--help`,
// and `wf pack --help` used to write a .wf file. Help must never do work.
test('asking any command for help does nothing but print', () => {
  const { run } = require('../commands');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-help-'));
  const before = fs.readdirSync(cwd);
  const logged = [];
  const log = console.log;
  const error = console.error;
  console.log = (line) => logged.push(String(line));
  console.error = () => {};

  try {
    for (const name of commandNames()) {
      logged.length = 0;
      process.exitCode = 0;
      run([name, '--help'], { cwd });
      assert.ok(logged.join('\n').includes(`wf ${name}`), `wf ${name} --help printed no usage`);
      assert.equal(process.exitCode, 0, `wf ${name} --help exited non-zero`);
      assert.deepEqual(fs.readdirSync(cwd), before, `wf ${name} --help touched the filesystem`);
    }
  } finally {
    console.log = log;
    console.error = error;
    process.exitCode = 0;
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

// AGENTS.md requires brief.md to track CLI behaviour. A command that ships
// without a line in the spec is the drift this catches.
test('the CLI spec documents every command', () => {
  const brief = fs.readFileSync(
    path.join(__dirname, '..', '..', 'docs', 'cli', 'brief.md'),
    'utf8',
  );
  for (const name of commandNames()) {
    assert.match(brief, new RegExp(`wf ${name}\\b`), `docs/cli/brief.md never mentions wf ${name}`);
  }
});
