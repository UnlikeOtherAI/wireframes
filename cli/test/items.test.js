'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const lib = require('@wireframes/engine/renderer/render-lib');
const { normalizeItems, resolveSelection, itemProfiles } = require('@wireframes/engine/renderer/items');

const { str } = lib;

// What each consumer read from an entry before the shared model, copied from
// the renderers at 64b4567 (table.js listRow, data-structures.js, navigation.js,
// containers.js renderCarousel, controls.js, render-attrs.js
// renderSelectOptions). Each oracle pairs that legacy read with the same read
// through the canonical keys, so a legacy-only entry must give equal results.
const ORACLES = {
  list: {
    before: (v) => lib.items(v, 'title').map((item) => ({
      label: str(item.title) || str(item.label),
      description: str(item.text),
      meta: str(item.meta),
      icon: str(item.icon),
      avatar: item.avatar,
      badge: item.badge,
      selected: item.selected,
      side: str(item.side),
      actions: item.actions,
    })),
    after: (v) => normalizeItems(v, itemProfiles.list).map((item) => ({
      label: str(item.label),
      description: str(item.description),
      meta: str(item.meta),
      icon: str(item.icon),
      avatar: item.avatar,
      badge: item.badge,
      selected: item.selected,
      side: str(item.side),
      actions: item.actions,
    })),
  },
  carousel: {
    before: (v) => lib.items(v, 'title').map((item) => str(item.title)),
    after: (v) => normalizeItems(v, itemProfiles.list).map((item) => str(item.label)),
  },
  accordion: {
    before: (v) => lib.items(v, 'title').map((item) => ({
      label: str(item.title), description: str(item.text), open: item.open === true,
    })),
    after: (v) => normalizeItems(v, itemProfiles.accordion).map((item) => ({
      label: str(item.label), description: str(item.description), open: item.expanded === true,
    })),
  },
  tree: {
    before: function read(v) {
      return lib.items(v).map((item) => ({
        label: str(item.label) || str(item.title),
        icon: item.icon,
        open: item.open !== false,
        children: read(item.children),
      }));
    },
    after: function read(v, normalized = normalizeItems(v, itemProfiles.tree)) {
      return normalized.map((item) => ({
        label: str(item.label),
        icon: item.icon,
        open: item.expanded !== false,
        children: read(null, item.items || []),
      }));
    },
  },
  nav: {
    before: (v) => {
      const row = (item) => ({
        label: str(item.label),
        icon: item.icon,
        iconStyle: item.iconStyle,
        badge: item.badge,
        route: item.route,
        active: item.active === true,
        children: Array.isArray(item.children) && item.children.length > 0 ? lib.items(item.children).map(row) : [],
      });
      return lib.items(v).map((entry) => (
        entry.group != null || entry.heading != null ? { heading: str(entry.group || entry.heading) } : row(entry)
      ));
    },
    after: (v) => {
      const row = (item) => ({
        label: str(item.label),
        icon: item.icon,
        iconStyle: item.iconStyle,
        badge: item.badge,
        route: item.route,
        active: item.selected === true,
        children: (item.items || []).map(row),
      });
      return normalizeItems(v, itemProfiles.nav).map((item) => (
        item.type === 'heading' ? { heading: str(item.label) } : row(item)
      ));
    },
  },
  menu: {
    before: (v) => lib.items(v).map((entry) => (entry.divider === true ? 'separator' : {
      label: str(entry.label), icon: entry.icon, shortcut: str(entry.shortcut), route: entry.route, danger: entry.danger === true,
    })),
    after: (v) => normalizeItems(v, itemProfiles.menu).map((item) => (item.type === 'separator' ? 'separator' : {
      label: str(item.label), icon: item.icon, shortcut: str(item.shortcut), route: item.route, danger: item.tone === 'danger',
    })),
  },
  action_sheet: {
    before: (v) => lib.items(v).map((item) => ({
      label: str(item.label), icon: item.icon, iconStyle: item.iconStyle, danger: item.danger === true,
    })),
    after: (v) => normalizeItems(v, itemProfiles.menu).map((item) => ({
      label: str(item.label), icon: item.icon, iconStyle: item.iconStyle, danger: item.tone === 'danger',
    })),
  },
  tabs: {
    before: (v) => lib.items(v).map((tab) => ({
      label: str(tab.label), icon: tab.icon, active: tab.active === true, badge: tab.badge, route: tab.route,
    })),
    after: (v) => normalizeItems(v, itemProfiles.tabs).map((tab) => ({
      label: str(tab.label), icon: tab.icon, active: tab.selected === true, badge: tab.badge, route: tab.route,
    })),
  },
  breadcrumb: {
    before: (v) => lib.items(v).map((crumb) => ({ label: str(crumb.label), route: crumb.route })),
    after: (v) => normalizeItems(v, itemProfiles.basic).map((crumb) => ({ label: str(crumb.label), route: crumb.route })),
  },
  choice: {
    before: (v) => lib.items(v).map((option) => ({
      label: str(option.label), description: option.description, icon: option.icon,
    })),
    after: (v) => normalizeItems(v, itemProfiles.choice).map((option) => ({
      label: str(option.label), description: option.description, icon: option.icon,
    })),
  },
  select: {
    before: (v) => (Array.isArray(v) ? v : []).map((entry) => {
      if (entry == null) return null;
      if (['string', 'number', 'boolean'].includes(typeof entry)) return { label: String(entry), value: String(entry) };
      if (lib.isObject(entry)) {
        return { label: String(entry.label || entry.value || '').trim(), value: String(entry.value ?? entry.label ?? '').trim() };
      }
      return null;
    }).filter(Boolean),
    after: (v) => normalizeItems(v, itemProfiles.select).map((entry) => ({
      label: String(entry.label || entry.value || '').trim(), value: String(entry.value ?? entry.label ?? '').trim(),
    })),
  },
};

// Legacy-only entries: the keys each consumer read before, including the
// awkward ones (blank, non-string, null, wrong-typed scalars).
const SHARED = [null, undefined, true, false, 0, 7, '', 'Plain', ['nested'], () => 'fn'];
const CORPUS = {
  list: [...SHARED, { title: 'T', text: 'Body', meta: '2m', badge: 3, selected: true },
    { title: '', label: 'L' }, { title: '  ', label: '' }, { title: 5, label: 'L' }, { label: 'Only label' },
    { title: 'T', label: 'L' }, { title: 'T', selected: false, actions: ['star'], side: 'end' }, { avatar: 'Ada Lovelace' },
    { text: '' }, { selected: null }, { icon: 'folder', title: 'Docs' }],
  carousel: [...SHARED, { title: 'Slide' }, { title: '' }, { title: 4 }, {}],
  accordion: [...SHARED, { title: 'Q', text: 'A', open: true }, { title: 'Q', open: false }, { title: 'Q', open: 'yes' },
    { title: '', text: '' }, { text: 'Body only' }, {}],
  tree: [...SHARED, { label: 'src', children: [{ label: 'a.js' }, { title: 'b.js', open: false }, 'c.js'] },
    { label: '', title: 'From title' }, { title: 'T' }, { label: 'closed', open: false, children: ['x'] },
    { label: 'odd', open: 'no' }, { label: 5, title: 'T' }, { title: 5 }, { label: null, title: 'T' },
    { label: 'deep', children: [{ label: 'mid', children: [{ label: 'leaf', icon: 'file' }] }] }],
  nav: [...SHARED, { group: 'Main' }, { heading: 'Settings' }, { group: '', heading: 'H' }, { group: 0 }, { heading: null, label: 'L' },
    { group: 'G', label: 'ignored', route: 'home' }, { label: 'Home', route: 'home', active: true, icon: 'house', badge: 2 },
    { label: '', title: 'Kept blank' }, { title: 'From title' }, { label: 'Parent', children: [{ label: 'Kid', active: true }, 'Leaf', { group: 'not a heading' }] },
    { label: 'Empty kids', children: [] }, { label: 'Odd', active: 'yes', iconStyle: 'regular' }],
  menu: [...SHARED, { divider: true }, { divider: true, label: 'hidden' }, { divider: 'yes', label: 'Item' }, { label: 'Delete', danger: true },
    { label: 'Safe', danger: 'yes' }, { title: 'From title', shortcut: '⌘K' }, { label: '', title: 'blank kept' }, { label: 'Go', route: 'home' }],
  action_sheet: [...SHARED, { label: 'Share', icon: 'share', iconStyle: 'regular' }, { label: 'Delete', danger: true }, { title: 'T' }, {}],
  tabs: [...SHARED, { label: 'One', active: true }, { label: 'Two', active: false, badge: 4 }, { label: 'Three', active: 'yes' },
    { title: 'Titled' }, { label: '', title: 'blank kept' }, { label: 'Routed', route: 'home', icon: 'house' }],
  breadcrumb: [...SHARED, { label: 'Home', route: 'home' }, { title: 'Titled' }, { label: '' }, { label: 3 }],
  choice: [...SHARED, { label: 'Pro', description: 'Best' }, { title: 'Titled' }, { label: '', title: 'blank kept' }, { label: 'Icon', icon: 'star' }],
  select: [...SHARED, { label: 'L', value: 'v' }, { value: 'only value' }, { label: 'only label' }, { label: '', value: '' }, {},
    { label: 0, value: 0 }, { title: 'ignored' }, { label: ' padded ' }],
};

for (const [consumer, oracle] of Object.entries(ORACLES)) {
  test(`${consumer}: legacy-only entries give exactly today's effective fields`, () => {
    const corpus = CORPUS[consumer];
    assert.deepEqual(oracle.after(corpus), oracle.before(corpus));
    for (const entry of corpus.filter((e) => lib.isObject(e))) {
      assert.deepEqual(oracle.after([entry]), oracle.before([entry]), JSON.stringify(entry));
    }
  });
}

test('the canonical profile reads only canonical keys', () => {
  const [item] = normalizeItems([{
    label: 'L', description: 'D', value: 'v', icon: 'star', iconStyle: 'regular', avatar: 'A', badge: 1, meta: 'm',
    shortcut: '⌘S', route: 'home', tone: 'danger', selected: true, current: false, checked: 'mixed', disabled: true,
    expanded: false, title: 'legacy', active: true, open: true, divider: true, danger: true,
  }]);
  assert.deepEqual(item, {
    type: 'item', label: 'L', description: 'D', value: 'v', icon: 'star', iconStyle: 'regular', avatar: 'A', badge: 1, meta: 'm',
    shortcut: '⌘S', route: 'home', tone: 'danger', selected: true, current: false, checked: 'mixed', disabled: true,
    expanded: false, title: 'legacy', active: true, open: true, divider: true, danger: true,
  });
  assert.deepEqual(normalizeItems([{ title: 'only title' }]), [{ type: 'item', title: 'only title' }]);
});

test('canonical keys work in every profile', () => {
  const entry = { label: 'L', description: 'D', selected: true, expanded: false, tone: 'warning', items: [{ label: 'kid' }] };
  for (const [name, rules] of Object.entries(itemProfiles)) {
    const [item] = normalizeItems([entry], rules);
    assert.equal(item.label, 'L', name);
    assert.equal(item.description, 'D', name);
    assert.equal(item.selected, true, name);
    assert.equal(item.expanded, false, name);
    assert.equal(item.tone, 'warning', name);
    assert.deepEqual(item.items, [{ type: 'item', label: 'kid' }], name);
  }
  assert.deepEqual(normalizeItems([{ type: 'separator' }, { type: 'heading', label: 'H' }], itemProfiles.tabs).map((i) => i.type), ['separator', 'heading']);
});

test('when legacy and canonical keys conflict, the precedence each consumer had wins', () => {
  const pick = (rules, entry) => normalizeItems([entry], rules)[0];
  // list: a nonblank title beats label, text beats description.
  assert.equal(pick(itemProfiles.list, { title: 'T', label: 'L' }).label, 'T');
  assert.equal(pick(itemProfiles.list, { title: ' ', label: 'L' }).label, 'L');
  assert.equal(pick(itemProfiles.list, { text: 'X', description: 'D' }).description, 'X');
  assert.equal(pick(itemProfiles.list, { text: '', description: 'D' }).description, 'D');
  // tree: a nonblank label beats title.
  assert.equal(pick(itemProfiles.tree, { label: 'L', title: 'T' }).label, 'L');
  assert.equal(pick(itemProfiles.tree, { label: '', title: 'T' }).label, 'T');
  // basic, nav, tabs, menu, choice: an explicit label is kept even when blank.
  for (const rules of [itemProfiles.basic, itemProfiles.nav, itemProfiles.tabs, itemProfiles.menu, itemProfiles.choice]) {
    assert.equal(pick(rules, { label: '', title: 'T' }).label, '', rules.name);
    assert.equal(pick(rules, { title: 'T' }).label, 'T', rules.name);
  }
  // select reads no title at all.
  assert.equal(pick(itemProfiles.select, { title: 'T' }).label, undefined);
  // State renames: the legacy key wins whenever it is set.
  assert.equal(pick(itemProfiles.tabs, { active: false, selected: true }).selected, false);
  assert.equal(pick(itemProfiles.tabs, { selected: true }).selected, true);
  assert.equal(pick(itemProfiles.accordion, { open: true, expanded: false }).expanded, true);
  assert.equal(pick(itemProfiles.tree, { children: ['a'], items: ['b'] }).items[0].label, 'a');
  // Markers: divider and danger only count when true.
  assert.equal(pick(itemProfiles.menu, { divider: true, type: 'heading' }).type, 'separator');
  assert.equal(pick(itemProfiles.menu, { divider: false, type: 'heading' }).type, 'heading');
  assert.equal(pick(itemProfiles.menu, { danger: true, tone: 'info' }).tone, 'danger');
  assert.equal(pick(itemProfiles.menu, { danger: false, tone: 'info' }).tone, 'info');
  // nav headers: group/heading beat label and type.
  assert.deepEqual(pick(itemProfiles.nav, { group: 'G', label: 'L', type: 'item' }), { type: 'heading', label: 'G' });
});

test('legacy keys are consumed and unknown keys pass through', () => {
  assert.deepEqual(normalizeItems([{ title: 'T', text: 'X', side: 'end', actions: ['a'] }], itemProfiles.list), [
    { type: 'item', label: 'T', description: 'X', side: 'end', actions: ['a'] },
  ]);
  assert.deepEqual(normalizeItems([{ divider: true }], itemProfiles.menu), [{ type: 'separator' }]);
  assert.deepEqual(normalizeItems([{ label: 'Go', variant: 'primary', route: 'home' }], itemProfiles.basic), [
    { type: 'item', label: 'Go', variant: 'primary', route: 'home' },
  ]);
  assert.deepEqual(normalizeItems([{ type: 'link', label: 'x' }]), [{ type: 'item', label: 'x' }]);
});

test('blank labels stay blank and absent labels stay absent', () => {
  assert.deepEqual(normalizeItems([{ label: '' }, { label: '   ' }, {}], itemProfiles.nav), [
    { type: 'item', label: '' }, { type: 'item', label: '   ' }, { type: 'item' },
  ]);
  assert.deepEqual(normalizeItems([{ group: '' }], itemProfiles.nav), [{ type: 'heading' }]);
  assert.deepEqual(normalizeItems([{ label: '  padded  ' }]), [{ type: 'item', label: '  padded  ' }]);
});

test('nested headings, groups and children', () => {
  const nav = normalizeItems([
    { group: 'Main' },
    { label: 'Parent', children: [{ heading: 'Not here' }, { type: 'heading', label: 'Canonical heading' }, 'Leaf'] },
    { type: 'group', label: 'Team', items: [{ label: 'Ada', active: true }, { type: 'separator' }] },
  ], itemProfiles.nav);
  assert.deepEqual(nav, [
    { type: 'heading', label: 'Main' },
    { type: 'item', label: 'Parent', items: [
      // Nested nav children never read group/heading, as before.
      { type: 'item', heading: 'Not here' },
      { type: 'heading', label: 'Canonical heading' },
      { type: 'item', label: 'Leaf' },
    ] },
    { type: 'group', label: 'Team', items: [{ type: 'item', label: 'Ada', selected: true }, { type: 'separator' }] },
  ]);
  const tree = normalizeItems([{ label: 'a', open: false, children: [{ title: 'b', children: [{ label: 'c', open: true }] }] }], itemProfiles.tree);
  assert.deepEqual(tree, [{ type: 'item', label: 'a', expanded: false, items: [
    { type: 'item', label: 'b', items: [{ type: 'item', label: 'c', expanded: true }] },
  ] }]);
  assert.deepEqual(normalizeItems([{ label: 'x', items: 'not a list' }]), [{ type: 'item', label: 'x', items: [] }]);
  assert.deepEqual(normalizeItems([{ label: 'x', children: [{ label: 'kept raw' }] }]), [
    { type: 'item', label: 'x', children: [{ label: 'kept raw' }] },
  ]);
});

test('separators: canonical everywhere, divider only in menu', () => {
  assert.deepEqual(normalizeItems([{ type: 'separator' }]), [{ type: 'separator' }]);
  assert.deepEqual(normalizeItems([{ divider: true }]), [{ type: 'item', divider: true }]);
  assert.deepEqual(normalizeItems([{ divider: true }], itemProfiles.nav), [{ type: 'item', divider: true }]);
  assert.deepEqual(normalizeItems(['A', { divider: true }, 'B'], itemProfiles.menu).map((i) => i.type), ['item', 'separator', 'item']);
});

test('absent booleans are never defaulted; false stays false', () => {
  const states = ['selected', 'current', 'checked', 'disabled', 'expanded'];
  for (const rules of Object.values(itemProfiles)) {
    const [absent] = normalizeItems([{ label: 'x' }], rules);
    for (const key of states) assert.equal(Object.hasOwn(absent, key), false, `${rules.name}.${key}`);
    const [off] = normalizeItems([Object.fromEntries(states.map((key) => [key, false]))], rules);
    for (const key of states) assert.equal(off[key], false, `${rules.name}.${key}`);
  }
  assert.equal(Object.hasOwn(normalizeItems([{ label: 'x' }], itemProfiles.tree)[0], 'expanded'), false);
  assert.equal(normalizeItems([{ open: false }], itemProfiles.tree)[0].expanded, false);
  assert.equal(Object.hasOwn(normalizeItems([{ label: 'x' }], itemProfiles.accordion)[0], 'expanded'), false);
  assert.equal(Object.hasOwn(normalizeItems([{ label: 'x' }], itemProfiles.nav)[0], 'selected'), false);
  assert.equal(Object.hasOwn(normalizeItems([{ label: 'x' }], itemProfiles.menu)[0], 'tone'), false);
});

test('scalars: strings and numbers become items; choice profiles also set value', () => {
  const input = ['A', 2, 0, '', true, false, null, undefined, ['x'], { label: 'obj' }];
  assert.deepEqual(normalizeItems(input), [
    { type: 'item', label: 'A' }, { type: 'item', label: '2' }, { type: 'item', label: '0' }, { type: 'item', label: '' },
    { type: 'item', label: 'obj' },
  ]);
  assert.deepEqual(normalizeItems(['A', 2, true], itemProfiles.choice), [
    { type: 'item', label: 'A', value: 'A' }, { type: 'item', label: '2', value: '2' },
  ]);
  assert.deepEqual(normalizeItems(['A', true, false], itemProfiles.select), [
    { type: 'item', label: 'A', value: 'A' }, { type: 'item', label: 'true', value: 'true' }, { type: 'item', label: 'false', value: 'false' },
  ]);
  assert.deepEqual(normalizeItems('not an array'), []);
  assert.deepEqual(normalizeItems(undefined, itemProfiles.list), []);
});

test('normalizeItems is pure and deterministic', () => {
  const deepFreeze = (value) => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  const input = deepFreeze([{ group: 'G' }, { title: 'T', active: true, children: [{ open: false, text: 'x' }] }, 'S']);
  const snapshot = JSON.stringify(input);
  for (const rules of Object.values(itemProfiles)) {
    const first = normalizeItems(input, rules);
    assert.deepEqual(normalizeItems(input, rules), first);
    assert.notEqual(first[1], input[1]);
  }
  assert.equal(JSON.stringify(input), snapshot);
});

test('lib.items keeps its exact behaviour', () => {
  const titled = { title: 'T', x: 1 };
  const labelled = { label: '', title: 'T' };
  const input = [null, 'A', 3, true, ['x'], titled, labelled, { title: 5 }, { label: undefined, title: 'U' }];
  const out = lib.items(input);
  assert.deepEqual(out, [{ label: 'A' }, { label: '3' }, { title: 'T', x: 1, label: 'T' }, labelled, { title: 5 }, { label: 'U', title: 'U' }]);
  assert.equal(out[3], labelled, 'objects that need no label are returned as-is');
  assert.deepEqual(lib.items(['A', titled], 'title'), [{ title: 'A' }, titled]);
  assert.equal(lib.items(['A', titled], 'title')[1], titled);
  assert.deepEqual(lib.items(['report.pdf'], 'name'), [{ name: 'report.pdf' }]);
  assert.deepEqual(lib.items('nope'), []);
});

test('render-lib re-exports the shared helpers', () => {
  assert.equal(typeof lib.normalizeItems, 'function');
  assert.equal(typeof lib.resolveSelection, 'function');
  assert.equal(lib.itemProfiles, itemProfiles);
  assert.deepEqual(Object.keys(itemProfiles).sort(), ['accordion', 'basic', 'canonical', 'choice', 'list', 'menu', 'nav', 'select', 'tabs', 'tree']);
});

const choices = (...entries) => normalizeItems(entries, itemProfiles.choice);
const flags = (result) => result.selected.map((on) => (on ? 1 : 0)).join('');

test('selection: an explicit selected: true wins over the element value', () => {
  const result = resolveSelection(choices('A', { label: 'B', selected: true }, 'C'), { value: 'C' });
  assert.deepEqual(result, { selected: [false, true, false], source: 'item', ambiguous: false });
  // Explicit flags are honoured as authored, even several in single choice.
  assert.equal(flags(resolveSelection(choices({ label: 'A', selected: true }, { label: 'B', selected: true }))), '11');
});

test('selection: an explicit selected: false beats a matching value', () => {
  assert.deepEqual(
    resolveSelection(choices({ label: 'A', selected: false }, 'B'), { value: 'A' }),
    { selected: [false, false], source: null, ambiguous: false },
  );
  assert.equal(flags(resolveSelection(choices({ label: 'A', selected: false }, 'A'), { value: 'A' })), '01');
});

test('selection: identity is value, else label, compared as trimmed strings', () => {
  const options = choices({ label: 'Monthly', value: 'm' }, { label: 'Yearly' }, 3);
  assert.equal(flags(resolveSelection(options, { value: 'm' })), '100');
  assert.equal(flags(resolveSelection(options, { value: 'Monthly' })), '000');
  assert.equal(flags(resolveSelection(options, { value: ' Yearly ' })), '010');
  assert.equal(flags(resolveSelection(options, { value: 3 })), '001');
  assert.equal(flags(resolveSelection(choices({ label: 'A', value: '' }), { value: 'A' })), '1');
  // A blank identity never matches, and neither does a blank value.
  assert.equal(flags(resolveSelection(choices(''), { value: '' })), '0');
  assert.equal(resolveSelection(choices('A'), {}).source, null);
  assert.equal(resolveSelection(choices('A'), { value: null }).source, null);
});

test('selection: multiple values select every match', () => {
  const options = choices('A', 'B', 'C', 'B');
  assert.deepEqual(resolveSelection(options, { value: ['A', 'B'], multiple: true }), {
    selected: [true, true, false, true], source: 'value', ambiguous: false,
  });
  assert.equal(flags(resolveSelection(options, { value: 'C', multiple: true })), '0010');
});

test('selection: single choice keeps the first match and reports ambiguity', () => {
  assert.deepEqual(resolveSelection(choices('A', 'B', 'A'), { value: 'A' }), {
    selected: [true, false, false], source: 'value', ambiguous: true,
  });
  assert.equal(resolveSelection(choices('A', 'B'), { value: 'A' }).ambiguous, false);
  assert.equal(resolveSelection(choices('A', 'B'), { value: ['A', 'B'] }).ambiguous, true);
  assert.equal(resolveSelection(choices('A', { label: 'A', value: 'other' }), { value: 'A' }).ambiguous, false);
});

test('selection: separators, headings and groups are never selected', () => {
  const entries = normalizeItems([{ type: 'heading', label: 'A' }, { type: 'separator', selected: true }, { type: 'group', label: 'A' }, 'A']);
  assert.deepEqual(resolveSelection(entries, { value: 'A' }), { selected: [false, false, false, true], source: 'value', ambiguous: false });
  assert.deepEqual(resolveSelection('nope', { value: 'A' }), { selected: [], source: null, ambiguous: false });
});
