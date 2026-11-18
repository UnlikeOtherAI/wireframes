'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildCataloguePage } = require('../../engine/catalogue');
const { builtinComponentIds } = require('../../engine/stdlib');

for (const mode of ['card', 'line']) {
  test(`the catalogue draws every std pattern through the resolver in ${mode} mode`, () => {
    const page = buildCataloguePage({ mode });
    assert.match(page, /<h2 class="cat-family" id="family-patterns">Patterns<\/h2>/);
    for (const id of builtinComponentIds()) {
      const name = id.slice('std.'.length);
      const start = page.indexOf(`id="pattern-std-${name}"`);
      assert.ok(start > 0, `${id} has an entry`);
      const entry = page.slice(start, page.indexOf('</article>', start));
      assert.match(entry, new RegExp(`id="${name}"`), `${id} renders its expanded root`);
      assert.match(entry, new RegExp(`id="${name}__`), `${id} renders namespaced internals, so the resolver ran`);
      assert.match(entry, /<th>Default<\/th>/);
      assert.match(entry, /Slots: <code>/);
      assert.doesNotMatch(entry, /\{\{/, `${id} has no unresolved token`);
      assert.ok(page.includes(`<a href="#pattern-std-${name}">${id}</a>`), `${id} is in the sidebar`);
    }
  });
}
