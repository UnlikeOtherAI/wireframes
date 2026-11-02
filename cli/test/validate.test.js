'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const yaml = require('js-yaml');
const test = require('node:test');
const assert = require('node:assert/strict');

const { initProject } = require('../../engine/init');
const { runValidate } = require('../../engine/validate/cli-adapter');
const { addPage } = require('../../engine/page');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-validate-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

test('validate command surfaces schema path errors', () => {
  const projectPath = createTempProject('Validate Test');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.wireframeStyle.border = {};
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((entry) => entry.code === 'SCHEMA_REQUIRED' && entry.message.includes('wireframeStyle.border.style')),
  );
});

test('validate accepts renderMode alias with density-only rendering block', () => {
  const projectPath = createTempProject('Validate Render Mode Alias');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.renderMode = 'card';
  pageDoc.page.rendering = {
    density: 'compact',
  };
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validate allows reusable components to navigate by stable route id', () => {
  const projectPath = createTempProject('Validate Component Navigation');
  const componentsPath = path.join(projectPath, 'components.yaml');
  const componentsDoc = yaml.load(fs.readFileSync(componentsPath, 'utf8'));

  componentsDoc.components.mobile_tabs = {
    root: {
      id: 'mobile_tabs',
      component: 'tab_bar',
      children: [
        {
          id: 'home_tab',
          component: 'button',
          props: { label: 'Home' },
          interaction: [{ type: 'navigation', targetRoute: 'home' }],
        },
      ],
    },
  };
  fs.writeFileSync(componentsPath, `${yaml.dump(componentsDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validate rejects table nodes without columns', () => {
  const projectPath = createTempProject('Validate Table Columns');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.slots[0].content = [
    {
      id: 'broken_table',
      component: 'table',
      props: {},
    },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((entry) => entry.code === 'TABLE_MISSING_COLUMNS'));
});

test('validate accepts imported component documents from arbitrary paths', () => {
  const projectPath = createTempProject('Validate Imported Components');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.imports = {
    nav: '../shared/navigation.yaml',
  };
  pageDoc.page.slots[0].content = [
    {
      id: 'main_nav',
      use: 'nav.primary_menu',
      props: {
        activeItem: 'Settings',
      },
    },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  fs.mkdirSync(path.join(projectPath, 'shared'), { recursive: true });
  fs.writeFileSync(path.join(projectPath, 'components.yaml'), `${yaml.dump({
    documentType: 'components',
    specVersion: '1.1',
    id: 'components',
    components: {},
  })}\n`, 'utf8');
  fs.writeFileSync(path.join(projectPath, 'shared', 'navigation.yaml'), `${yaml.dump({
    documentType: 'components',
    specVersion: '1.1',
    id: 'navigation',
    imports: {
      common: './shared_bits.yaml',
    },
    components: {
      primary_menu: {
        root: {
          id: 'primary_menu',
          component: 'section',
          children: [
            {
              id: 'settings_link',
              use: 'common.menu_link',
              props: {
                label: '{{props.activeItem}}',
                active: true,
              },
            },
          ],
        },
      },
    },
  })}\n`, 'utf8');
  fs.writeFileSync(path.join(projectPath, 'shared', 'shared_bits.yaml'), `${yaml.dump({
    documentType: 'components',
    specVersion: '1.1',
    id: 'shared_bits',
    components: {
      menu_link: {
        root: {
          id: 'menu_link',
          component: 'button',
          props: {
            label: '{{props.label}}',
          },
          visibility: {
            condition: {
              type: 'compare',
              left: '{{props.active}}',
              op: 'eq',
              right: true,
            },
          },
        },
      },
    },
  })}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('page add defaults orientation for mobile to portrait', () => {
  const projectPath = createTempProject('Orientation Default Mobile');
  const result = addPage({
    projectPath,
    pageId: 'mobile_page',
    path: '/mobile',
    templateId: 'public_template',
    device: 'mobile',
  });

  assert.equal(result.ok, true);
  const pageDoc = yaml.load(fs.readFileSync(
    path.join(projectPath, 'pages', 'mobile_page.yaml'), 'utf8'
  ));
  assert.equal(pageDoc.page.viewport.orientation, 'portrait');
});

test('page add defaults orientation for tablet to landscape', () => {
  const projectPath = createTempProject('Orientation Default Tablet');
  const result = addPage({
    projectPath,
    pageId: 'tablet_page',
    path: '/tablet',
    templateId: 'public_template',
    device: 'tablet',
  });

  assert.equal(result.ok, true);
  const pageDoc = yaml.load(fs.readFileSync(
    path.join(projectPath, 'pages', 'tablet_page.yaml'), 'utf8'
  ));
  assert.equal(pageDoc.page.viewport.orientation, 'landscape');
});

test('validate accepts table columns with label but no key (auto-derives key)', () => {
  const projectPath = createTempProject('Validate Table Label Only');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  pageDoc.page.slots[0].content = [
    {
      id: 'label_table',
      component: 'table',
      props: {
        columns: [
          { label: 'Full Name' },
          { label: 'Email Address' },
          { key: 'status', label: 'Status' },
        ],
        rows: [
          { full_name: 'Alice', email_address: 'a@b.com', status: 'Active' },
        ],
      },
    },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('validate suggests a real element for a name that is not one', () => {
  const projectPath = createTempProject('Validate Component Alias');
  const pagePath = path.join(projectPath, 'pages', 'home.yaml');
  const pageDoc = yaml.load(fs.readFileSync(pagePath, 'utf8'));

  // `card` is a real element now, so the nudge is reserved for names that are not.
  pageDoc.page.slots[0].content = [
    { id: 'my_panel', component: 'panel', props: { title: 'Panel Title' } },
  ];
  fs.writeFileSync(pagePath, `${yaml.dump(pageDoc)}\n`, 'utf8');

  const result = runValidate({ projectPath });

  assert.ok(
    result.warnings.some((w) => w.code === 'COMPONENT_ALIAS' && w.message.includes('panel') && w.message.includes('card')),
    'should point "panel" at "card"',
  );
});

test('groupIssues groups repeated errors by code', () => {
  const { groupIssues } = require('../../engine/validate/format');

  const errors = [];
  for (let i = 0; i < 10; i++) {
    errors.push({
      code: 'INTERACTION_MISSING_REQUIRED_FIELD',
      message: `Interaction type "navigation" on node "nav_${i}" is missing required field "targetRoute".`,
    });
  }

  const grouped = groupIssues(errors);

  assert.equal(grouped.length, 1);
  assert.ok(grouped[0].message.includes('10'));
  assert.equal(grouped[0].code, 'INTERACTION_MISSING_REQUIRED_FIELD');
  assert.ok(grouped[0].examples.length <= 3);
});

test('groupIssues preserves unique errors ungrouped', () => {
  const { groupIssues } = require('../../engine/validate/format');

  const errors = [
    { code: 'TABLE_MISSING_COLUMNS', message: 'Table node "t1" must define columns.' },
    { code: 'DUPLICATE_NODE_ID', message: 'Page "home" has duplicate node id "btn".' },
  ];

  const grouped = groupIssues(errors);

  assert.equal(grouped.length, 2);
});
