'use strict';
const MAX_PAGE_INSET = 4096;
function validPageInset(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_PAGE_INSET;
}
function pageInsetStyle(value) {
  return validPageInset(value) ? 'padding:' + value.toFixed(6).replace(/\.?0+$/, '') .replace(/^$/, '0') + 'px;' : '';
}
module.exports = { MAX_PAGE_INSET, validPageInset, pageInsetStyle };
