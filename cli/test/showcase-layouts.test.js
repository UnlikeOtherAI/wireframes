'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runValidate } = require('../../engine/validate/cli-adapter');
const { resolvePageTargets } = require('../../engine/screenshots');
const { launchChromium } = require('../../engine/screenshots/playwright-launcher');
const { renderWireframeMarkup } = require('../../engine/screenshots/renderer');

const FIXTURE_PROJECT = path.join(__dirname, 'fixtures', 'showcase-project');

function createShowcaseProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'wireframe-showcase-'));
  const projectPath = path.join(base, 'project');
  fs.cpSync(FIXTURE_PROJECT, projectPath, { recursive: true });
  return projectPath;
}

function getRenderTarget(projectPath, pageId) {
  const result = resolvePageTargets(projectPath);
  assert.equal(result.ok, true);
  const target = result.targets.find((entry) => entry.pageId === pageId);
  assert.ok(target, `Expected render target for ${pageId}`);
  return target;
}

async function renderTargetInBrowser(target) {
  const playwright = require('playwright');
  const browser = await launchChromium(playwright, { headless: true });
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

test('showcase fixture validates cleanly', () => {
  const projectPath = createShowcaseProject();
  const result = runValidate({ projectPath });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test('Playwright verifies marketing homepage has aligned hero and feature columns', async () => {
  const projectPath = createShowcaseProject();
  const target = getRenderTarget(projectPath, 'marketing_home');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const heroCopy = document.getElementById('hero_copy');
      const heroPreview = document.getElementById('hero_preview');
      const stats = ['stat_card_one', 'stat_card_two', 'stat_card_three', 'stat_card_four']
        .map((id) => document.getElementById(id).getBoundingClientRect());
      const features = ['feature_one', 'feature_two', 'feature_three']
        .map((id) => document.getElementById(id).getBoundingClientRect());

      return {
        heroSameTop: Math.abs(heroCopy.getBoundingClientRect().top - heroPreview.getBoundingClientRect().top) < 1,
        heroSeparated: heroCopy.getBoundingClientRect().right < heroPreview.getBoundingClientRect().left,
        heroGap: heroPreview.getBoundingClientRect().left - heroCopy.getBoundingClientRect().right,
        statsSameRow: stats.every((rect) => Math.abs(rect.top - stats[0].top) < 1),
        statsNoOverlap: stats.every((rect, index) => index === 0 || stats[index - 1].right <= rect.left),
        featureSameRow: features.every((rect) => Math.abs(rect.top - features[0].top) < 1),
        featureNoOverlap: features.every((rect, index) => index === 0 || features[index - 1].right <= rect.left),
      };
    });

    assert.equal(metrics.heroSameTop, true);
    assert.equal(metrics.heroSeparated, true);
    assert.equal(metrics.heroGap >= 20, true);
    assert.equal(metrics.statsSameRow, true);
    assert.equal(metrics.statsNoOverlap, true);
    assert.equal(metrics.featureSameRow, true);
    assert.equal(metrics.featureNoOverlap, true);
  } finally {
    await page.close();
    await browser.close();
  }
});

test('Playwright verifies dashboard sidebar, KPI row, and mid-column layout are clean', async () => {
  const projectPath = createShowcaseProject();
  const target = getRenderTarget(projectPath, 'admin_dashboard');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const roots = Array.from(document.querySelectorAll('.wf-root'));
      const topRoot = roots[0]?.getBoundingClientRect();
      const bodyRow = document.querySelector('.wf-body-row')?.getBoundingClientRect();
      const sidebar = document.getElementById('dashboard_sidebar').getBoundingClientRect();
      const main = document.getElementById('dashboard_main_column').getBoundingClientRect();
      const kpis = ['kpi_a', 'kpi_b', 'kpi_c', 'kpi_d']
        .map((id) => document.getElementById(id).getBoundingClientRect());
      const pipeline = document.getElementById('pipeline_panel').getBoundingClientRect();
      const activity = document.getElementById('activity_panel').getBoundingClientRect();
      const table = document.getElementById('operating_table');
      const headerCells = Array.from(table.querySelectorAll('.wf-table-header .wf-table-cell'))
        .map((cell) => cell.getBoundingClientRect());
      const firstRowCells = Array.from(table.querySelectorAll('.wf-table-row')[0].querySelectorAll('.wf-table-cell'))
        .map((cell) => cell.getBoundingClientRect());
      const tableRows = Array.from(table.querySelectorAll('.wf-table-row'));
      const rowColors = tableRows.slice(0, 3).map((row) => window.getComputedStyle(row).backgroundColor);

      return {
        topGap: topRoot && bodyRow ? bodyRow.top - topRoot.bottom : 0,
        sidebarBeforeMain: sidebar.right < main.left,
        sidebarGap: main.left - sidebar.right,
        kpisSameRow: kpis.every((rect) => Math.abs(rect.top - kpis[0].top) < 1),
        kpisNoOverlap: kpis.every((rect, index) => index === 0 || kpis[index - 1].right <= rect.left),
        midRowSeparated: pipeline.right < activity.left,
        midRowGap: activity.left - pipeline.right,
        tableColumnsAligned: headerCells.every((rect, index) => {
          const bodyRect = firstRowCells[index];
          return bodyRect && Math.abs(rect.left - bodyRect.left) < 1 && Math.abs(rect.width - bodyRect.width) < 1;
        }),
        tableColumnsNoOverlap: headerCells.every((rect, index) => index === 0 || headerCells[index - 1].right <= rect.left),
        // Rows are separated by a rule rather than zebra fills: a wireframe
        // should show structure, not a finished table's banding.
        rowsSeparated: Array.from(document.querySelectorAll('.wf-table-body > .wf-table-row'))
          .slice(1)
          .every((row) => window.getComputedStyle(row).borderTopWidth !== '0px'),
      };
    });

    assert.equal(metrics.topGap >= 16, true);
    assert.equal(metrics.sidebarBeforeMain, true);
    assert.equal(metrics.sidebarGap >= 16, true);
    assert.equal(metrics.kpisSameRow, true);
    assert.equal(metrics.kpisNoOverlap, true);
    assert.equal(metrics.midRowSeparated, true);
    assert.equal(metrics.midRowGap >= 12, true);
    assert.equal(metrics.tableColumnsAligned, true);
    assert.equal(metrics.tableColumnsNoOverlap, true);
    assert.equal(metrics.rowsSeparated, true);
  } finally {
    await page.close();
    await browser.close();
  }
});

test('Playwright verifies app-shell menu opens as an anchored popup without shifting layout', async () => {
  const projectPath = createShowcaseProject();
  const target = getRenderTarget(projectPath, 'admin_dashboard');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const before = await page.evaluate(() => {
      const bodyRow = document.querySelector('.wf-body-row').getBoundingClientRect();
      return { bodyTop: bodyRow.top };
    });

    await page.click('#app_menu_button button');

    const opened = await page.evaluate(() => {
      const trigger = document.getElementById('app_menu_button').getBoundingClientRect();
      const menu = document.getElementById('app_header_menu');
      const menuRect = menu.getBoundingClientRect();
      const bodyRow = document.querySelector('.wf-body-row').getBoundingClientRect();
      return {
        visible: menu.classList.contains('wf-visible'),
        belowTrigger: menuRect.top >= trigger.bottom,
        anchoredToTrigger: menuRect.left <= trigger.left && menuRect.right >= trigger.left,
        insideViewport: menuRect.right <= window.innerWidth && menuRect.left >= 0,
        bodyTop: bodyRow.top,
        zIndex: window.getComputedStyle(menu).zIndex,
      };
    });

    await page.mouse.click(12, 12);

    const closed = await page.evaluate(() => {
      const menu = document.getElementById('app_header_menu');
      return { visible: menu.classList.contains('wf-visible') };
    });

    assert.equal(opened.visible, true);
    assert.equal(opened.belowTrigger, true);
    assert.equal(opened.anchoredToTrigger, true);
    assert.equal(opened.insideViewport, true);
    assert.equal(opened.bodyTop, before.bodyTop);
    assert.equal(Number(opened.zIndex) >= 100, true);
    assert.equal(closed.visible, false);
  } finally {
    await page.close();
    await browser.close();
  }
});

test('Playwright verifies line-mode workspace uses clean parent dividers without overlapping columns', async () => {
  const projectPath = createShowcaseProject();
  const target = getRenderTarget(projectPath, 'workspace_board');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const shell = document.getElementById('workspace_shell').getBoundingClientRect();
      const nav = document.getElementById('workspace_nav').getBoundingClientRect();
      const center = document.getElementById('workspace_center').getBoundingClientRect();
      const inspector = document.getElementById('workspace_inspector').getBoundingClientRect();
      const boardRow = document.getElementById('board_columns');
      const backlog = document.getElementById('board_backlog');
      const active = document.getElementById('board_active');
      const review = document.getElementById('board_review');
      const activeStyle = window.getComputedStyle(active);

      return {
        shellWidth: shell.width,
        navBeforeCenter: nav.right < center.left,
        centerBeforeInspector: center.right < inspector.left,
        outerNoOverlap: nav.right <= center.left && center.right <= inspector.left,
        dividerStyle: activeStyle.borderRightStyle,
        dividerWidth: activeStyle.borderRightWidth,
        childOutlineSuppressed: window.getComputedStyle(backlog).outlineStyle === 'none'
          && window.getComputedStyle(active).outlineStyle === 'none'
          && window.getComputedStyle(review).outlineStyle === 'none',
        backlogBeforeActive: backlog.getBoundingClientRect().right <= active.getBoundingClientRect().left,
        activeBeforeReview: active.getBoundingClientRect().right <= review.getBoundingClientRect().left,
        boardGap: window.getComputedStyle(boardRow).gap,
      };
    });

    assert.equal(metrics.shellWidth > 1000, true);
    assert.equal(metrics.navBeforeCenter, true);
    assert.equal(metrics.centerBeforeInspector, true);
    assert.equal(metrics.outerNoOverlap, true);
    assert.equal(metrics.dividerStyle, 'dashed');
    assert.equal(metrics.dividerWidth, '1px');
    assert.equal(metrics.childOutlineSuppressed, true);
    assert.equal(metrics.backlogBeforeActive, true);
    assert.equal(metrics.activeBeforeReview, true);
    assert.equal(metrics.boardGap, '0px');
  } finally {
    await page.close();
    await browser.close();
  }
});

test('Playwright verifies iPhone page uses a mobile-width layout with aligned cards and tabs', async () => {
  const projectPath = createShowcaseProject();
  const target = getRenderTarget(projectPath, 'iphone_home');
  const { browser, page } = await renderTargetInBrowser(target);

  try {
    const metrics = await page.evaluate(() => {
      const pageShell = document.querySelector('.wf-page').getBoundingClientRect();
      const statOne = document.getElementById('phone_stat_one').getBoundingClientRect();
      const statTwo = document.getElementById('phone_stat_two').getBoundingClientRect();
      const stops = ['phone_stop_one', 'phone_stop_two', 'phone_stop_three']
        .map((id) => document.getElementById(id).getBoundingClientRect());
      const tabs = ['primary_tabs__tab_home', 'primary_tabs__tab_plan', 'primary_tabs__tab_wallet', 'primary_tabs__tab_account']
        .map((id) => document.getElementById(id).getBoundingClientRect());

      return {
        shellWidth: Math.round(pageShell.width),
        statsSameRow: Math.abs(statOne.top - statTwo.top) < 1,
        statsSeparated: statOne.right < statTwo.left,
        stopStacked: stops[0].bottom <= stops[1].top && stops[1].bottom <= stops[2].top,
        tabsSameRow: tabs.every((rect) => Math.abs(rect.top - tabs[0].top) < 1),
        tabsNoOverlap: tabs.every((rect, index) => index === 0 || tabs[index - 1].right <= rect.left),
      };
    });

    assert.equal(metrics.shellWidth, 390);
    assert.equal(metrics.statsSameRow, true);
    assert.equal(metrics.statsSeparated, true);
    assert.equal(metrics.stopStacked, true);
    assert.equal(metrics.tabsSameRow, true);
    assert.equal(metrics.tabsNoOverlap, true);
  } finally {
    await page.close();
    await browser.close();
  }
});
