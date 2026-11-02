'use strict';

// Every command, declared once. This drives `wf --help`, `wf help <command>`,
// `wf <command> --help`, and a test that fails if a command is dispatched but
// not listed here — so the help can never fall behind the CLI.

const GROUPS = [
  ['Project', ['init', 'info', 'doctor', 'stats']],
  ['Authoring', ['template', 'page', 'component', 'node', 'overlay', 'state', 'data']],
  ['Checking', ['validate', 'lint', 'why']],
  ['Reading', ['schema', 'llm', 'catalogue', 'tree', 'inspect', 'routes', 'where-used']],
  ['Output', ['build', 'serve', 'screenshots', 'export', 'pack', 'unpack']],
];

const COMMANDS = [
  {
    name: 'init',
    args: '<project-name>',
    summary: 'Scaffold a new wireframe project',
    usage: 'wf init <project-name>',
  },
  {
    name: 'info',
    summary: 'Show project metadata from manifest.yaml',
    usage: 'wf info',
  },
  {
    name: 'doctor',
    summary: 'Check project health and references',
    usage: 'wf doctor',
  },
  {
    name: 'stats',
    summary: 'Count pages, templates, components and datasets',
    usage: 'wf stats',
  },
  {
    name: 'template',
    args: '<add|remove|list>',
    summary: 'Manage templates',
    usage: 'wf template <add|remove|list> [id]',
  },
  {
    name: 'page',
    args: '<add|remove|list>',
    summary: 'Manage pages',
    usage: 'wf page <add|remove|list> [id]',
  },
  {
    name: 'component',
    args: '<add|remove|list>',
    summary: 'Manage reusable components',
    usage: 'wf component <add|remove|list> [id]',
  },
  {
    name: 'node',
    args: '<add|update|remove>',
    summary: 'Add, update and remove nodes',
    usage: 'wf node <add|update|remove> ...',
  },
  {
    name: 'overlay',
    args: '<add|remove|list>',
    summary: 'Manage overlays on pages and templates',
    usage: 'wf overlay <add|remove|list> <targetId> [overlayId] [options]',
  },
  {
    name: 'state',
    args: '<list>',
    summary: 'Inspect state keys in appState and pageState',
    usage: 'wf state <list> [--scope <app|page>] [--page <pageId>]',
  },
  {
    name: 'data',
    args: '<add|remove|import|list|…>',
    summary: 'Manage datasets and dataset items',
    usage: 'wf data <add|remove|import|list|validate|stats|keys|item> ...\n'
      + 'wf data item <add|update|remove|get|list> ...',
  },
  {
    name: 'validate',
    summary: 'Validate schema compliance and semantics',
    usage: 'wf validate [--json] [--strict]',
  },
  {
    name: 'lint',
    summary: 'Report the mistakes an author actually makes',
    usage: 'wf lint [--json] [--strict]',
  },
  {
    name: 'why',
    args: '<nodeId>',
    summary: 'Explain why a node did or did not get a box',
    usage: 'wf why <nodeId> [--page <pageId>] [--json]',
  },
  {
    name: 'schema',
    summary: 'Print the schema reference',
    usage: 'wf schema [--doc <type>]',
  },
  {
    name: 'llm',
    summary: 'Print the element reference, written for agents',
    usage: 'wf llm [--short] [--element <name>] [--family <name>]',
  },
  {
    name: 'catalogue',
    summary: 'Generate the element catalogue page',
    usage: 'wf catalogue [--out <dir>] [--mode card|line] [--platform web|ios|android]',
  },
  {
    name: 'tree',
    summary: 'Print resolved page, template and component trees',
    usage: 'wf tree [page|template|component|all] [targetId] [--depth <n>] [--filter <text>]',
  },
  {
    name: 'inspect',
    args: '<address>',
    summary: 'Inspect the resolved node at an address',
    usage: 'wf inspect <wf://page|template|component/<id>#<path>>',
  },
  {
    name: 'routes',
    summary: 'List route ids, paths, pages and templates',
    usage: 'wf routes',
  },
  {
    name: 'where-used',
    args: '<id>',
    summary: 'Find references for a component or dataset',
    usage: 'wf where-used <componentId|datasetId>',
  },
  {
    name: 'build',
    summary: 'Build a static wireframe website',
    usage: 'wf build [--output <path>] [--platform <all|web|mobile|tablet>] [--clean] [--base-path <path>]',
  },
  {
    name: 'serve',
    summary: 'Start a local preview server',
    usage: 'wf serve [--port <number>] [--platform <all|web|mobile|tablet>] [--open] [--no-reload]',
  },
  {
    name: 'screenshots',
    summary: 'Render PNGs with Playwright',
    usage: 'wf screenshots [--output <path>] [--page <pageId>] [--frame <frameId>]',
  },
  {
    name: 'export',
    summary: 'Package the project into a zip archive',
    usage: 'wf export [--output <path>]',
  },
  {
    name: 'pack',
    summary: 'Pack the project into a single .wf file',
    usage: 'wf pack [--out <file.wf>]',
  },
  {
    name: 'unpack',
    args: '<file.wf>',
    summary: 'Expand a .wf file back into a project folder',
    usage: 'wf unpack <file.wf> [--out <dir>]',
  },
];

const BY_NAME = new Map(COMMANDS.map((entry) => [entry.name, entry]));

function commandNames() {
  return COMMANDS.map((entry) => entry.name);
}

function getCommand(name) {
  return BY_NAME.get(name) || null;
}

/** `wf help <command>` and `wf <command> --help`. */
function usageFor(name) {
  const entry = getCommand(name);
  if (!entry) return null;
  return `${entry.summary}\n\nUsage:\n  ${entry.usage.split('\n').join('\n  ')}`;
}

/** `wf --help`: every command, grouped, one line each. */
function topLevelUsage() {
  const width = Math.max(...COMMANDS.map((entry) => `${entry.name} ${entry.args || ''}`.trim().length));
  const sections = GROUPS.map(([title, names]) => {
    const rows = names.map((name) => {
      const entry = getCommand(name);
      const left = `${entry.name} ${entry.args || ''}`.trim();
      return `  ${left.padEnd(width)}  ${entry.summary}`;
    });
    return `${title}:\n${rows.join('\n')}`;
  });

  return `wf <command> [arguments]\n\n${sections.join('\n\n')}\n\n`
    + 'Run `wf help <command>` or `wf <command> --help` for one command.\n'
    + 'Run `wf --version` for the version.';
}

module.exports = { COMMANDS, GROUPS, commandNames, getCommand, usageFor, topLevelUsage };
