'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { initProject } = require('../../engine/init');
const { runBuild } = require('../../engine/build/fs-writer');

function createTempProject(projectName) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-build-'));
  const projectPath = path.join(base, 'project');
  return initProject({
    projectName,
    projectPath,
  }).projectPath && projectPath;
}

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function writeBuildFixture(projectPath) {
  writeYaml(path.join(projectPath, '.wfrc.yaml'), {
    cli: {
      strictValidation: false,
      failOnWarnings: false,
      build: {
        outputDir: './wireframes/build',
        clean: true,
        basePath: '/',
      },
    },
  });

  writeYaml(path.join(projectPath, 'sitemap.yaml'), {
    documentType: 'sitemap',
    specVersion: '1.1',
    id: 'sitemap',
    defaultTemplate: 'public_template',
    routes: [
      {
        id: 'home',
        path: '/',
        page: 'home',
        template: 'public_template',
      },
      {
        id: 'mobile',
        path: '/mobile',
        page: 'mobile',
        template: 'public_template',
      },
    ],
  });

  writeYaml(path.join(projectPath, 'templates.yaml'), {
    documentType: 'templates',
    specVersion: '1.1',
    id: 'templates',
    templates: {
      public_template: {
        layout: { type: 'stack' },
        regions: [
          {
            id: 'page_header',
            kind: 'persistent',
            children: [
              {
                id: 'header_box',
                use: 'wireframe_box',
              },
            ],
          },
          {
            id: 'main',
            kind: 'slot',
          },
        ],
      },
    },
  });

  writeYaml(path.join(projectPath, 'components.yaml'), {
    documentType: 'components',
    specVersion: '1.1',
    id: 'components',
    components: {
      wireframe_box: {
        root: {
          id: 'wireframe_box',
          injectable: true,
        },
      },
    },
  });

  writeYaml(path.join(projectPath, 'pages', 'home.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'home',
    page: {
      id: 'home',
      template: 'public_template',
      viewport: { device: 'web' },
      wireframeStyle: {
        border: { style: 'solid', width: 'thin' },
        corner: { style: 'rounded', radius: 8 },
      },
      slots: [
        {
          slotId: 'main',
          content: [
            { id: 'home_content', use: 'wireframe_box' },
          ],
        },
      ],
    },
  });

  writeYaml(path.join(projectPath, 'pages', 'mobile.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'mobile',
    page: {
      id: 'mobile',
      template: 'public_template',
      viewport: { device: 'mobile', orientation: 'portrait' },
      wireframeStyle: {
        border: { style: 'solid', width: 'thin' },
        corner: { style: 'rounded', radius: 8 },
      },
      slots: [
        {
          slotId: 'main',
          content: [
            { id: 'mobile_content', use: 'wireframe_box' },
          ],
        },
      ],
    },
  });
}

test('runBuild generates shared web/mobile outputs and per-page runtime links', () => {
  const projectPath = createTempProject('Build Basic');
  const assetsPath = path.join(projectPath, 'assets');
  fs.writeFileSync(path.join(assetsPath, 'logo.png'), 'logo-content');
  writeBuildFixture(projectPath);

  const result = runBuild({
    projectPath,
    output: 'build',
    platform: 'all',
    clean: true,
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'web', 'index.html')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'web', 'home.html')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'mobile', 'mobile_mobile.html')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'web', '_shared', 'wireframe.css')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'web', '_shared', 'interactions.js')), true);

  const webHomeHtml = fs.readFileSync(path.join(projectPath, 'build', 'web', 'home.html'), 'utf8');
  assert.equal(webHomeHtml.includes('./_shared/interactions.js'), true);
  assert.equal(webHomeHtml.includes('window.WF_RUNTIME_CONTEXT'), true);
  assert.equal(webHomeHtml.includes('"/mobile/mobile_mobile.html"'), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'assets', 'logo.png')), true);
});

test('runBuild applies platform output filenames and base path prefix', () => {
  const projectPath = createTempProject('Build Base Path');
  const assetsPath = path.join(projectPath, 'assets');
  fs.writeFileSync(path.join(assetsPath, 'logo.png'), 'logo-content');
  writeBuildFixture(projectPath);

  const result = runBuild({
    projectPath,
    output: 'build',
    platform: 'mobile',
    clean: true,
    basePath: '/demo/',
  });

  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'mobile', 'mobile_mobile.html')), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'web')), false);

  const mobileHtml = fs.readFileSync(path.join(projectPath, 'build', 'mobile', 'mobile_mobile.html'), 'utf8');
  assert.equal(mobileHtml.includes('"/demo/mobile/mobile_mobile.html"'), true);
  assert.equal(fs.existsSync(path.join(projectPath, 'build', 'assets', 'logo.png')), true);
});

test('runBuild resolves imported component files with aliased smart-object props', () => {
  const projectPath = createTempProject('Build Imported Components');
  const assetsPath = path.join(projectPath, 'assets');
  fs.writeFileSync(path.join(assetsPath, 'logo.png'), 'logo-content');
  writeBuildFixture(projectPath);

  const templatesPath = path.join(projectPath, 'templates.yaml');
  const templatesDoc = yaml.load(fs.readFileSync(templatesPath, 'utf8'));
  templatesDoc.imports = {
    nav: './modules/navigation.yaml',
  };
  templatesDoc.templates.public_template.regions[0].children = [
    {
      id: 'header_nav',
      use: 'nav.primary_menu',
      props: {
        activeItem: 'Projects',
      },
    },
  ];
  fs.writeFileSync(templatesPath, `${yaml.dump(templatesDoc)}\n`, 'utf8');

  fs.mkdirSync(path.join(projectPath, 'modules'), { recursive: true });
  writeYaml(path.join(projectPath, 'modules', 'navigation.yaml'), {
    documentType: 'components',
    specVersion: '1.1',
    id: 'navigation',
    imports: {
      common: './shared.yaml',
    },
    components: {
      primary_menu: {
        root: {
          id: 'primary_menu',
          component: 'section',
          surface: false,
          layout: {
            type: 'row',
            gap: 8,
          },
          children: [
            {
              id: 'projects_link',
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
  });
  writeYaml(path.join(projectPath, 'modules', 'shared.yaml'), {
    documentType: 'components',
    specVersion: '1.1',
    id: 'shared',
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
  });

  const result = runBuild({
    projectPath,
    output: 'build',
    platform: 'web',
    clean: true,
  });

  assert.equal(result.ok, true);

  const webHomeHtml = fs.readFileSync(path.join(projectPath, 'build', 'web', 'home.html'), 'utf8');
  assert.equal(webHomeHtml.includes('Projects'), true);
  assert.equal(webHomeHtml.includes('&quot;left&quot;:true'), true);
});
