'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderNode } = require('../../engine/renderer/primitives');
const { suffixNodeIds } = require('../../engine/renderer/render-utils');
const { renderPage } = require('../../engine/build');
const { leadingChild } = require('../../engine/schema/leading-child');
const { skinProject } = require('./fixtures/skin-project');

const burger = () => ({
  id: 'burger',
  component: 'button',
  props: { label: 'Menu', icon: 'bars', variant: 'ghost' },
  interaction: [{ type: 'open_overlay', targetOverlay: 'left_menu' }],
});
const cart = () => ({ id: 'cart', component: 'button', props: { label: 'Cart', variant: 'ghost' } });
const bar = (props, children) => renderNode({ id: 'top', component: 'app_bar', props, children }, {});

/** Where `text` is in `html`. It has to be there: a missing piece must not pass as "before". */
function place(html, text) {
  const at = html.indexOf(text);
  assert.notEqual(at, -1, `the markup has no ${text}`);
  return at;
}

test('an app bar draws the child it names as leading before the title', () => {
  const html = bar({ title: 'Happy Paws', leading: 'burger', actions: ['search'] }, [burger(), cart()]);
  assert.ok(place(html, 'id="burger"') < place(html, 'wf-appbar-title'), 'the named child comes before the title');
  assert.ok(place(html, 'wf-appbar-actions') < place(html, 'id="cart"'), 'the other children stay after the actions');
  assert.equal(html.includes('wf-appbar-leading'), false, 'no glyph is drawn in its place');
  assert.equal(html.split('id="burger"').length, 2, 'and it is drawn once');
  assert.match(html, /id="burger"[^>]*open_overlay/, 'with its interaction');
});

test('a leading that names no child is an icon, as before', () => {
  const html = bar({ title: 'Inbox', leading: 'arrow-left' }, [cart()]);
  assert.ok(place(html, 'wf-appbar-leading') < place(html, 'wf-appbar-title'), 'the glyph leads');
  assert.ok(place(html, 'wf-appbar-title') < place(html, 'id="cart"'), 'and the child follows the title');
});

test('an app bar with no leading keeps its children after the actions', () => {
  const html = bar({ title: 'Happy Paws', actions: ['search'] }, [burger()]);
  assert.ok(place(html, 'wf-appbar-actions') < place(html, 'id="burger"'));
  assert.equal(html, bar({ title: 'Happy Paws', actions: ['search'], leading: '' }, [burger()]), 'an empty leading changes nothing');
});

test('a child named like an icon is the child, not the icon', () => {
  const bars = { ...burger(), id: 'bars' };
  const html = bar({ title: 'Happy Paws', leading: 'bars' }, [bars]);
  assert.ok(place(html, 'id="bars"') < place(html, 'wf-appbar-title'));
  assert.equal(html.includes('wf-appbar-leading'), false);
});

test('a bar\'s other lists are drawn once beside a leading child', () => {
  const html = renderNode({ id: 'top', component: 'app_bar', props: { title: 'Happy Paws', leading: 'burger' }, children: [burger()], content: [cart()] }, {});
  assert.equal(html.split('id="cart"').length, 2);
  assert.equal(html.split('id="burger"').length, 2);
});

test('the bar keeps naming its child when a bound list renames its rows', () => {
  const node = { id: 'top', component: 'app_bar', props: { title: 'Happy Paws', leading: 'burger' }, children: [burger(), cart()] };
  suffixNodeIds(node, 0);
  assert.equal(node.props.leading, 'burger_0');
  assert.equal(leadingChild(node).id, 'burger_0');
  const html = renderNode(node, {});
  assert.ok(place(html, 'id="burger_0"') < place(html, 'wf-appbar-title'));
});

test('the bar keeps naming its child inside a reusable component', () => {
  const map = skinProject();
  const chrome = { title: 'Happy Paws', leading: 'burger' };
  map.components.components.chrome = { root: { id: 'chrome_root', component: 'app_bar', props: chrome, children: [burger(), cart()] } };
  map.components.components.shell = { root: { id: 'shell_root', component: 'stack', children: [{ id: 'inner', component: 'app_bar', props: chrome, children: [burger()] }] } };
  map.pages.get('home').page.slots[0].content = [{ id: 'top', use: 'chrome' }, { id: 'frame', use: 'shell' }];
  const rendered = renderPage(map, 'home');
  assert.equal(rendered.ok, true, JSON.stringify(rendered.errors ?? rendered.diagnostics));
  const html = rendered.html;
  // At the component's root, and in a bar nested inside one.
  for (const [barId, buttonId] of [['top', 'top__burger'], ['frame__inner', 'frame__burger']]) {
    const opened = place(html, `id="${barId}"`);
    const button = html.indexOf(`id="${buttonId}"`, opened);
    const title = html.indexOf('wf-appbar-title', opened);
    assert.ok(button > opened && title > button, `${buttonId} leads the bar ${barId}`);
  }
  // The page carries the style rule for the glyph, so it is the element that is looked for.
  assert.equal(html.includes('class="wf-appbar-leading"'), false, 'and neither bar falls back to a glyph');
});
