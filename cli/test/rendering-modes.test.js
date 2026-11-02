'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const { initProject } = require('../../engine/init');
const { resolvePageTargets } = require('../../engine/screenshots');
const { renderWireframeMarkup, buildWireframeStyles } = require('../../engine/screenshots/renderer');

function writeYaml(filePath, value) {
  fs.writeFileSync(filePath, `${yaml.dump(value)}\n`, 'utf8');
}

function resetProjectFiles(projectPath) {
  for (const relativePath of ['pages', 'data']) {
    fs.rmSync(path.join(projectPath, relativePath), { recursive: true, force: true });
    fs.mkdirSync(path.join(projectPath, relativePath), { recursive: true });
  }
}

function createRenderingFixtureProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-rendering-'));
  const projectPath = path.join(base, 'project');
  initProject({
    projectName: 'Rendering Modes Fixture',
    projectPath,
  });
  resetProjectFiles(projectPath);

  writeYaml(path.join(projectPath, 'sitemap.yaml'), {
    documentType: 'sitemap',
    specVersion: '1.1',
    id: 'sitemap',
    defaultTemplate: 'public_template',
    routes: [
      { id: 'card_dashboard', path: '/dashboard', page: 'card_dashboard', template: 'public_template' },
      { id: 'line_workspace', path: '/workspace', page: 'line_workspace', template: 'public_template' },
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
    components: {},
  });

  writeYaml(path.join(projectPath, 'pages', 'card_dashboard.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'card_dashboard',
    page: {
      id: 'card_dashboard',
      template: 'public_template',
      viewport: { device: 'web' },
      wireframeStyle: {
        border: { style: 'solid', width: 'thin' },
        corner: { style: 'rounded', radius: 12 },
      },
      rendering: {
        mode: 'card',
        density: 'comfortable',
      },
      slots: [
        {
          slotId: 'main',
          content: [
            {
              id: 'kpi_grid',
              component: 'section',
              props: { title: 'KPIs' },
              layout: { type: 'grid', columns: 12, gap: 24, padding: 16 },
              children: [
                {
                  id: 'revenue_card',
                  component: 'section',
                  gridItem: { span: 6 },
                  children: [
                    {
                      id: 'revenue_title',
                      component: 'heading',
                      props: { level: 3, text: 'Revenue' },
                    },
                  ],
                },
                {
                  id: 'orders_card',
                  component: 'section',
                  gridItem: { span: 6 },
                  children: [
                    {
                      id: 'orders_title',
                      component: 'heading',
                      props: { level: 3, text: 'Orders' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  writeYaml(path.join(projectPath, 'pages', 'line_workspace.yaml'), {
    documentType: 'page',
    specVersion: '1.1',
    id: 'line_workspace',
    page: {
      id: 'line_workspace',
      template: 'public_template',
      viewport: { device: 'web' },
      wireframeStyle: {
        border: { style: 'dashed', width: 'medium' },
        corner: { style: 'rounded', radius: 12 },
      },
      rendering: {
        mode: 'line',
        density: 'compact',
      },
      slots: [
        {
          slotId: 'main',
          content: [
            {
              id: 'panel_row',
              component: 'section',
              props: { title: 'Workspace' },
              layout: {
                type: 'row',
                gap: 0,
                padding: 20,
                separators: 'between',
                separatorStyle: 'dashed',
              },
              children: [
                {
                  id: 'left_panel',
                  component: 'section',
                  children: [
                    {
                      id: 'filters_button',
                      component: 'button',
                      props: { label: 'Filters' },
                    },
                  ],
                },
                {
                  id: 'right_panel',
                  component: 'section',
                  children: [
                    {
                      id: 'notes_text',
                      component: 'paragraph',
                      props: { text: 'Notes' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  });

  return projectPath;
}

function getRenderTarget(projectPath, pageId) {
  const result = resolvePageTargets(projectPath);
  assert.equal(result.ok, true);
  const target = result.targets.find((entry) => entry.pageId === pageId);
  assert.ok(target);
  return target;
}

async function renderTargetInBrowser(target) {
  const playwright = require('playwright');
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: target.viewport.width,
      height: target.viewport.height,
    },
  });

  try {
    const content = renderWireframeMarkup({
      roots: target.roots,
      pageViewport: target.viewport,
      pageRouteId: target.pageRouteId,
      routeTable: target.routeTable,
      appStateDefaults: target.appStateDefaults,
      pageStateDefaults: target.pageStateDefaults,
      pageStyle: target.wireframeStyle,
      rendering: target.rendering || {},
      defaultGridColumns: target.defaultGridColumns,
      projectPath: target.projectPath,
      dataSources: target.dataSources,
    });

    await page.setContent(content, { waitUntil: 'networkidle' });
    return { browser, page };
  } catch (error) {
    await page.close();
    await browser.close();
    throw error;
  }
}

test('buildWireframeStyles consumes rendering tokens for borders and separators', () => {
  const css = buildWireframeStyles();

  // Frames are keyed on the renderer's decision, never on class adjacency.
  assert.match(css, /\.wf-mode-line \[data-wf-frame="surface"\]/);
  assert.match(css, /\.wf-mode-card \[data-wf-frame="surface"\]/);
  assert.ok(css.includes('var(--wf-border-width,1px)'), 'border width token is still honoured');
  assert.ok(css.includes('var(--wf-surface-radius'), 'surface radius token is still honoured');
  assert.match(css, /\[data-wf-edge="after"\]/);
  assert.ok(!css.includes('.wf-divide-x>'), 'adjacency-based dividers are gone');
});

test('renderWireframeMarkup maps line mode radius to blueprint scale', () => {
  const html = renderWireframeMarkup({
    roots: [
      {
        id: 'main',
        layout: { type: 'stack' },
        children: [
          {
            id: 'sample',
            component: 'section',
          },
        ],
      },
    ],
    pageViewport: { width: 1280, height: 900, device: 'web' },
    pageStyle: {
      border: { style: 'dashed', width: 'medium' },
      corner: { style: 'rounded', radius: 12 },
    },
    rendering: { mode: 'line' },
  });

  assert.equal(html.includes('--wf-border-width:2px'), true);
  assert.equal(html.includes('--wf-border-style:dashed'), true);
  assert.equal(html.includes('--wf-surface-radius:4px'), true);
});

test('Playwright verifies card mode grid columns are aligned and separated by gutters', async () => {
  const projectPath = createRenderingFixtureProject();
  const target = getRenderTarget(projectPath, 'card_dashboard');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const grid = document.querySelector('#kpi_grid .wf-node-children');
      const revenue = document.getElementById('revenue_card');
      const orders = document.getElementById('orders_card');
      const gridStyle = window.getComputedStyle(grid);
      const revenueRect = revenue.getBoundingClientRect();
      const ordersRect = orders.getBoundingClientRect();

      return {
        display: gridStyle.display,
        gap: gridStyle.gap,
        revenueWidth: revenueRect.width,
        ordersWidth: ordersRect.width,
        sameTop: Math.abs(revenueRect.top - ordersRect.top) < 1,
        horizontalOrder: revenueRect.right < ordersRect.left,
        visibleGap: ordersRect.left - revenueRect.right,
        overlap: Math.max(0, revenueRect.right - ordersRect.left),
      };
    });

    assert.equal(metrics.display, 'grid');
    assert.equal(metrics.gap, '24px');
    assert.equal(metrics.sameTop, true);
    assert.equal(metrics.horizontalOrder, true);
    assert.equal(Math.abs(metrics.revenueWidth - metrics.ordersWidth) < 1, true);
    assert.equal(metrics.visibleGap >= 20, true);
    assert.equal(metrics.overlap, 0);
  } finally {
    await page.close();
    await browser.close();
  }
});

test('Playwright verifies compact line mode uses a single dashed divider without overlap', async () => {
  const projectPath = createRenderingFixtureProject();
  const target = getRenderTarget(projectPath, 'line_workspace');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const row = document.querySelector('#panel_row .wf-node-children');
      const left = document.getElementById('left_panel');
      const right = document.getElementById('right_panel');
      const rowStyle = window.getComputedStyle(row);
      const leftStyle = window.getComputedStyle(left);
      const rightStyle = window.getComputedStyle(right);
      const rowRect = row.getBoundingClientRect();
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();

      return {
        gap: rowStyle.gap,
        paddingLeft: rowStyle.paddingLeft,
        dividerStyle: leftStyle.borderRightStyle,
        dividerWidth: leftStyle.borderRightWidth,
        leftOutlineStyle: leftStyle.outlineStyle,
        rightOutlineStyle: rightStyle.outlineStyle,
        sameTop: Math.abs(leftRect.top - rightRect.top) < 1,
        overlap: Math.max(0, leftRect.right - rightRect.left),
        dividerInsideRow: rightRect.left >= rowRect.left && rightRect.left <= rowRect.right,
        buttonLabel: document.querySelector('#filters_button button')?.textContent || '',
      };
    });

    assert.equal(metrics.gap, '0px');
    assert.equal(metrics.paddingLeft, '13px');
    assert.equal(metrics.dividerStyle, 'dashed');
    assert.equal(metrics.dividerWidth, '1px');
    assert.equal(metrics.leftOutlineStyle, 'none');
    assert.equal(metrics.rightOutlineStyle, 'none');
    assert.equal(metrics.sameTop, true);
    assert.equal(metrics.overlap, 0);
    assert.equal(metrics.dividerInsideRow, true);
    assert.equal(metrics.buttonLabel, 'Filters');
  } finally {
    await page.close();
    await browser.close();
  }
});
