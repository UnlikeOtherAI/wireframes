'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCataloguePage } = require('@wireframes/engine/catalogue');
const { demoFor } = require('@wireframes/engine/catalogue/demos');
const { renderNode } = require('@wireframes/engine/renderer/primitives');
const { PRIMITIVES } = require('@wireframes/engine/schema/primitive-registry');
const { elementCheatSheet } = require('@wireframes/engine/schema/element-reference');

const COMMITTED = path.join(__dirname, '..', '..', 'docs', 'catalogue', 'index.html');
const AGENT_GUIDE = path.join(__dirname, '..', '..', 'docs', 'cli', 'agent-guide.md');

// The catalogue is generated and committed so the README can link to a page a
// reader opens without building anything. If the two drift, the page lies.
test('the committed catalogue matches what wf catalogue generates', () => {
  assert.equal(
    fs.readFileSync(COMMITTED, 'utf8'),
    buildCataloguePage({ mode: 'card', platform: 'web' }),
    'docs/catalogue is stale; run `node cli/bin/wf.js catalogue --out docs/catalogue`',
  );
});

test('every element has a demo that parses and renders', () => {
  for (const entry of PRIMITIVES) {
    const { source, node } = demoFor(entry);
    assert.ok(node, `${entry.name} has no renderable demo (example: ${source})`);
    assert.equal(node.component, entry.name, `${entry.name}'s example declares a different element`);
    const html = renderNode(node, {});
    assert.ok(html.includes(`wf-${entry.name}`), `${entry.name} rendered without its element class`);
  }
});

test('the catalogue shows every element, its props and its frame class', () => {
  const html = buildCataloguePage({});
  for (const entry of PRIMITIVES) {
    assert.ok(html.includes(`id="el-${entry.name}"`), `${entry.name} is missing from the catalogue`);
    for (const prop of Object.keys(entry.props || {})) {
      assert.ok(html.includes(`>${prop}</td>`), `${entry.name}.${prop} is missing from the props table`);
    }
  }
  // The four frame classes, so a reader can tell a card from a row.
  for (const note of ['always draws a box', 'never draws a box', 'the frame rules decide', 'draws one edge']) {
    assert.ok(html.includes(note), `the catalogue never says "${note}"`);
  }
});

test('a table reads positional rows as well as keyed ones', () => {
  const positional = renderNode({
    id: 'positional',
    component: 'table',
    props: { columns: ['Name', 'Status'], rows: [['Dashboard', 'Draft']] },
  }, {});
  assert.match(positional, /Dashboard/);
  assert.match(positional, /Draft/);

  const keyed = renderNode({
    id: 'keyed',
    component: 'table',
    props: { columns: [{ label: 'Name', key: 'name' }], rows: [{ name: 'Checkout' }] },
  }, {});
  assert.match(keyed, /Checkout/);
});

// agent-guide.md was hand-extended after being generated once, so regenerating
// it silently deleted three sections. Everything it says now lives in the
// generator, and this keeps it that way.
test('the committed agent guide matches wf llm --short', () => {
  assert.equal(
    fs.readFileSync(AGENT_GUIDE, 'utf8').trimEnd(),
    elementCheatSheet().trimEnd(),
    'docs/cli/agent-guide.md is stale; run `node cli/bin/wf.js llm --short > docs/cli/agent-guide.md`',
  );
});

const { buildRouteHref } = require('@wireframes/engine/routes');

// A build whose links are absolute only works when served from the configured
// root. A base starting with `.` keeps them relative, so the same build opens
// from the filesystem and from a subfolder.
test('a relative basePath produces relative route links', () => {
  assert.equal(buildRouteHref('billing', 'web', '/'), '/web/billing.html');
  assert.equal(buildRouteHref('billing', 'web', '/app'), '/app/web/billing.html');
  assert.equal(buildRouteHref('billing', 'web', '..'), '../web/billing.html');
  assert.equal(buildRouteHref('billing', 'web', '.'), './web/billing.html');
});

// A shared sidebar is rendered once per page and cannot know which page it is
// on, so the renderer marks the item pointing at the current route.
test('a nav marks the item for the page being rendered', () => {
  const nav = {
    id: 'menu',
    component: 'nav',
    props: {
      items: [
        { label: 'Overview', route: 'overview' },
        { label: 'Billing', route: 'billing' },
      ],
    },
  };

  const onBilling = renderNode(nav, { routeId: 'billing', routeTable: { billing: '/web/billing.html' } });
  assert.match(onBilling, /wf-nav-item wf-nav-on[^>]*>[^<]*<span class="wf-nav-label">Billing/);
  assert.equal((onBilling.match(/wf-nav-on/g) || []).length, 1, 'exactly one item is current');

  const elsewhere = renderNode(nav, { routeId: 'team' });
  assert.ok(!elsewhere.includes('wf-nav-on'), 'no item is marked when the route is not in the nav');
});
