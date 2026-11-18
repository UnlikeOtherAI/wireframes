'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderNode } = require('../../engine/renderer/primitives');

const burger = {
  id: 'burger',
  component: 'button',
  props: { label: 'Menu', icon: 'bars', variant: 'ghost' },
  interaction: [{ type: 'open_overlay', targetOverlay: 'left_menu' }],
};
const cart = { id: 'cart', component: 'button', props: { label: 'Cart', variant: 'ghost' } };
const bar = (props, children) => renderNode({ id: 'top', component: 'app_bar', props, children }, {});

test('an app bar draws the child it names as leading before the title', () => {
  const html = bar({ title: 'Happy Paws', leading: 'burger', actions: ['search'] }, [burger, cart]);
  const at = (text) => html.indexOf(text);
  assert.ok(at('id="burger"') > 0 && at('id="burger"') < at('wf-appbar-title'), 'the named child comes before the title');
  assert.ok(at('wf-appbar-actions') < at('id="cart"'), 'the other children stay after the actions');
  assert.equal(html.includes('wf-appbar-leading'), false, 'no glyph is drawn in its place');
  assert.equal(html.split('id="burger"').length, 2, 'and it is drawn once');
  assert.match(html, /id="burger"[^>]*open_overlay/, 'with its interaction');
});

test('a leading that names no child is an icon, as before', () => {
  const html = bar({ title: 'Inbox', leading: 'arrow-left' }, [cart]);
  assert.ok(html.indexOf('wf-appbar-leading') < html.indexOf('wf-appbar-title'), 'the glyph leads');
  assert.ok(html.indexOf('wf-appbar-title') < html.indexOf('id="cart"'), 'and the child follows the title');
});

test('an app bar with no leading keeps its children after the actions', () => {
  const html = bar({ title: 'Happy Paws', actions: ['search'] }, [burger]);
  assert.ok(html.indexOf('wf-appbar-actions') < html.indexOf('id="burger"'));
  assert.equal(html, bar({ title: 'Happy Paws', actions: ['search'], leading: '' }, [burger]), 'an empty leading changes nothing');
});
