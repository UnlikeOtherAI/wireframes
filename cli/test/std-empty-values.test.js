'use strict';

// `when` leaves out nodes whose value is empty, and the std patterns use it so
// an empty tagline, link group, label or slot is simply not drawn.

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveTemplatePage } = require('../../engine/resolver');
const { renderPage } = require('../../engine/build');
const { validateProject } = require('../../engine/validate');
const { polishProject } = require('./fixtures/polish-project');
const { CAFE_FOOTER, CAFE_HEADER, CAFE_HERO, BOOKING_FORM } = require('./fixtures/cafe-footer');

function resolvedIds(content, components = {}) {
  const resolved = resolveTemplatePage({ template: { regions: [{ id: 'main', kind: 'slot' }] }, page: { slots: [{ slotId: 'main', content }] }, components });
  assert.equal(resolved.ok, true, resolved.error);
  const ids = new Map();
  const visit = (node) => { ids.set(node.id, node); for (const child of node.children || []) visit(child); };
  resolved.roots[0].children.forEach(visit);
  return ids;
}
const render = (content, options = {}) => {
  const result = renderPage(polishProject(content, options), 'home', { deviceChrome: false });
  assert.equal(result.ok, true, result.error);
  return result.html;
};
const frameOf = (html, id) => (html.match(new RegExp(`id="${id}"[^>]*data-wf-frame="(\\w+)"`)) || [])[1];

test('when keeps a node only when its value has content, and never reaches the output', () => {
  const card = { root: { id: 'card', component: 'card', children: [
    { id: 'line', component: 'text', when: '{{props.line}}', props: { text: '{{props.line}}' } },
    { id: 'list', component: 'list', when: '{{props.rows}}', props: { items: '{{props.rows}}' } },
    { id: 'flag', component: 'badge', when: '{{props.flag}}', props: { text: 'On' } },
  ] }, propDefaults: { line: 'Default line', rows: ['A'], flag: true } };
  const cases = [
    [{}, ['line', 'list', 'flag']],
    [{ line: '', rows: [], flag: false }, []],
    [{ line: '   ', rows: null }, ['flag']],
    [{ line: 0, rows: [{ title: 'B' }] }, ['line', 'list', 'flag']],
  ];
  for (const [props, kept] of cases) {
    const ids = resolvedIds([{ id: 'c', use: 'card', props }], { card });
    assert.deepEqual(['line', 'list', 'flag'].filter((id) => ids.has(`c__${id}`)), kept, JSON.stringify(props));
    for (const node of ids.values()) assert.equal(Object.hasOwn(node, 'when'), false, 'when is resolved away');
  }
  // On a page node it reads its literal value.
  assert.equal(resolvedIds([{ id: 'gone', component: 'text', when: '' }, { id: 'kept', component: 'text', when: 'yes' }]).has('gone'), false);
});

test('a project whose component uses when validates with no errors', () => {
  const map = polishProject([{ id: 'n', use: 'note', props: { text: '' } }, { id: 'shown', component: 'text', when: 'yes', props: { text: 'Hi' } }]);
  map.components.components.note = { root: { id: 'note', component: 'stack', children: [
    { id: 'line', component: 'text', when: '{{props.text}}', props: { text: '{{props.text}}' } },
  ] } };
  const result = validateProject(map);
  assert.deepEqual(result.errors.map((error) => error.code), []);
});

test('the iPad footer draws the brand and copyright across the full width, and nothing empty', () => {
  const ids = resolvedIds([BOOKING_FORM, CAFE_FOOTER]);
  for (const part of ['tagline', 'product', 'company', 'resources', 'social_row']) {
    assert.equal(ids.has(`footer__${part}`), false, `${part} is left out`);
  }
  assert.ok(ids.has('footer__logo') && ids.has('footer__copyright') && ids.has('footer__rule'));

  const html = render([BOOKING_FORM, CAFE_FOOTER]);
  assert.equal(frameOf(html, 'footer'), 'surface', 'at the top of the page the footer is one full-width panel');
  const footer = html.slice(html.indexOf('id="footer"'));
  assert.doesNotMatch(footer, /class="wf-bar"/, 'no skeleton bar for the blank tagline');
  assert.match(footer, /The Cozy Corner Cafe/);
  assert.match(footer, /© The Cozy Corner Cafe\. All rights reserved\./);
  assert.match(footer, /width:160px;height:40px/, 'the logo box fits a brand on one line');
});

test('a footer in a framed footer region adds no second frame', () => {
  const regions = [
    { id: 'main', kind: 'slot', role: 'main', layout: { type: 'stack', gap: 16, padding: 16 } },
    { id: 'foot', kind: 'persistent', role: 'footer', children: [CAFE_FOOTER] },
  ];
  const html = render([BOOKING_FORM], { regions });
  assert.equal(frameOf(html, 'footer'), 'group');
});

test('the header and hero leave out empty menus, labels and copy', () => {
  const header = resolvedIds([CAFE_HEADER]);
  for (const part of ['menu', 'sign_in', 'cta', 'action_row']) assert.equal(header.has(`header__${part}`), false, part);
  assert.ok(header.has('header__logo'));
  const hero = resolvedIds([CAFE_HERO]);
  for (const part of ['eyebrow', 'text', 'primary', 'secondary']) assert.equal(hero.has(`hero__${part}`), false, part);
  assert.ok(hero.has('hero__title') && hero.has('hero__media_image'));
  assert.doesNotMatch(render([CAFE_HEADER, CAFE_HERO]), /class="wf-bar"/, 'no skeleton for an empty value');
});

test('defaults still draw every part, and the header menu is part of the header bar', () => {
  const footer = resolvedIds([{ id: 'footer', use: 'std.site_footer' }]);
  for (const part of ['tagline', 'product', 'company', 'resources', 'copyright', 'social_row']) assert.ok(footer.has(`footer__${part}`), part);
  const html = render([{ id: 'header', use: 'std.site_header' }, { id: 'hero', use: 'std.hero' }]);
  for (const part of ['menu', 'sign_in', 'cta']) assert.match(html, new RegExp(`id="header__${part}"`));
  for (const part of ['eyebrow', 'text', 'primary', 'secondary']) assert.match(html, new RegExp(`id="hero__${part}"`));
  assert.equal(frameOf(html, 'header__menu'), 'group', 'the header menu draws no top-nav bar inside the header');
});
