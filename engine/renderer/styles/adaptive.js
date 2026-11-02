'use strict';

// Only added when a page is drawn smaller than the device it was designed for, and
// only when the caller asks. Authored inline sizes are what these rules undo, so
// they have to win over them.
const adaptiveStyles = [
  // One column, with the sidebar as a navigation bar across the top.
  '.wf-adapt-mobile .wf-body-row{flex-direction:column!important}',
  '.wf-adapt-mobile .wf-role-sidebar,.wf-adapt-mobile .wf-role-aside{width:auto!important;min-width:0!important;'
    + 'max-width:none!important;height:auto!important;flex:0 0 auto!important;position:static!important}',
  '.wf-adapt-mobile .wf-role-sidebar>.wf-root-body{flex-direction:row!important;flex-wrap:nowrap!important;'
    + 'align-items:center!important;overflow-x:auto;gap:12px!important}',
  '.wf-adapt-mobile .wf-role-sidebar .wf-nav{flex-direction:row!important;flex:0 0 auto}',
  '.wf-adapt-mobile .wf-role-sidebar .wf-nav-item{flex:0 0 auto;white-space:nowrap}',
  '.wf-adapt-mobile .wf-role-sidebar .wf-nav-label{flex:0 0 auto;overflow:visible}',
  '.wf-adapt-mobile .wf-role-main{width:auto!important;min-width:0!important;flex:1 1 auto!important}',
  '.wf-adapt-mobile .wf-grid,.wf-adapt-mobile .wf-form{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important}',
  // A row of panels stacks. A row of small things wraps and stays together.
  '.wf-adapt-mobile .wf-row{flex-wrap:wrap!important}',
  '.wf-adapt-mobile .wf-row>.wf-card,.wf-adapt-mobile .wf-row>.wf-section,.wf-adapt-mobile .wf-row>.wf-stack,'
    + '.wf-adapt-mobile .wf-row>.wf-table,.wf-adapt-mobile .wf-row>.wf-list,.wf-adapt-mobile .wf-row>.wf-chart'
    + '{flex:1 1 100%!important;min-width:0!important;width:auto!important}',
  '.wf-adapt-mobile .wf-stat{flex:1 1 140px!important;min-width:0!important}',
  '.wf-adapt-mobile .wf-split{flex-direction:column!important}',
  '.wf-adapt-mobile .wf-split>*{width:auto!important;flex:1 1 auto!important}',
  // A table keeps its columns and scrolls sideways rather than crushing them.
  '.wf-adapt-mobile .wf-table{overflow-x:auto!important}',
  '.wf-adapt-mobile .wf-table-grid{min-width:520px}',
  // A tablet keeps the page's structure. Only what would not fit gives way.
  '.wf-adapt-tablet .wf-grid{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))!important}',
  '.wf-adapt-tablet .wf-row{flex-wrap:wrap!important}',
].join('\n');

module.exports = { adaptiveStyles };
