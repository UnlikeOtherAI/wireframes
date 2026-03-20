import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderProject } from '../bundle/wireframe-renderer.min.js';

const MANIFEST_YAML = `
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  name: Test
  schemaVersion: "1.1"
`;

const SITEMAP_YAML = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  routes:
    - id: test
      path: /
      page: test
`;

const TEMPLATES_YAML = `
documentType: templates
specVersion: "1.1"
id: templates
templates:
  shell:
    layout:
      type: stack
    regions:
      - id: body
        kind: slot
`;

function buildPage(content) {
  return `
documentType: page
specVersion: "1.1"
id: test
page:
  template: shell
  viewport:
    device: web
  slots:
    - slotId: body
      content:
${content}
`;
}

function renderContent(content) {
  const result = renderProject({
    'manifest.yaml': MANIFEST_YAML,
    'sitemap.yaml': SITEMAP_YAML,
    'templates.yaml': TEMPLATES_YAML,
    'pages/test.yaml': buildPage(content),
  });
  return result.pages.get('test');
}

describe('Text primitives', () => {
  it('renders heading with correct level', () => {
    const html = renderContent(`
        - component: heading
          id: h1
          props:
            text: Title
            level: 1`);
    assert.ok(html.includes('<h1>'), 'should render h1 tag');
    assert.ok(html.includes('Title'), 'should contain heading text');
    assert.ok(html.includes('wf-heading'), 'should have heading class');
  });

  it('renders paragraph', () => {
    const html = renderContent(`
        - component: paragraph
          id: p1
          props:
            text: Hello paragraph`);
    assert.ok(html.includes('<p>'), 'should render p tag');
    assert.ok(html.includes('Hello paragraph'), 'should contain text');
    assert.ok(html.includes('wf-paragraph'), 'should have paragraph class');
  });

  it('renders text span', () => {
    const html = renderContent(`
        - component: text
          id: t1
          props:
            text: Inline text`);
    assert.ok(html.includes('Inline text'), 'should contain text');
    assert.ok(html.includes('wf-text'), 'should have text class');
  });
});

describe('Image primitive', () => {
  it('renders image placeholder when src is missing', () => {
    const html = renderContent(`
        - component: image
          id: img1
          props:
            alt: Photo`);
    assert.ok(html.includes('wf-image'), 'should have image class');
    assert.ok(html.includes('Photo') || html.includes('Image'), 'should show alt or placeholder');
  });
});

describe('Icon primitive', () => {
  it('renders icon with Font Awesome class', () => {
    const html = renderContent(`
        - component: icon
          id: icon1
          props:
            name: home
            style: solid`);
    assert.ok(html.includes('fa-solid'), 'should have fa-solid class');
    assert.ok(html.includes('fa-home'), 'should have fa-home class');
    assert.ok(html.includes('wf-icon'), 'should have icon class');
  });
});

describe('Button primitive', () => {
  it('renders button with label', () => {
    const html = renderContent(`
        - component: button
          id: btn1
          props:
            label: Save`);
    assert.ok(html.includes('Save'), 'should contain label');
    assert.ok(html.includes('wf-button'), 'should have button class');
  });

  it('renders button with icon', () => {
    const html = renderContent(`
        - component: button
          id: btn2
          props:
            label: Settings
            icon: gear`);
    assert.ok(html.includes('fa-gear'), 'should contain icon class');
    assert.ok(html.includes('Settings'), 'should contain label');
  });
});

describe('Form primitives', () => {
  it('renders input with type and placeholder', () => {
    const html = renderContent(`
        - component: input
          id: inp1
          props:
            inputType: email
            placeholder: Email`);
    assert.ok(html.includes('type="email"'), 'should have email type');
    assert.ok(html.includes('placeholder="Email"'), 'should have placeholder');
    assert.ok(html.includes('wf-input'), 'should have input class');
  });

  it('renders textarea', () => {
    const html = renderContent(`
        - component: textarea
          id: ta1
          props:
            placeholder: Type here
            rows: 5`);
    assert.ok(html.includes('<textarea'), 'should render textarea');
    assert.ok(html.includes('rows="5"'), 'should have rows');
    assert.ok(html.includes('wf-textarea'), 'should have textarea class');
  });

  it('renders select with options', () => {
    const html = renderContent(`
        - component: select
          id: sel1
          props:
            placeholder: Choose
            options:
              - label: Option A
                value: a
              - label: Option B
                value: b`);
    assert.ok(html.includes('<select>'), 'should render select');
    assert.ok(html.includes('Option A'), 'should have options');
    assert.ok(html.includes('wf-select'), 'should have select class');
  });

  it('renders checkbox', () => {
    const html = renderContent(`
        - component: checkbox
          id: cb1
          props:
            label: Agree`);
    assert.ok(html.includes('type="checkbox"'), 'should render checkbox');
    assert.ok(html.includes('Agree'), 'should have label');
    assert.ok(html.includes('wf-checkbox'), 'should have checkbox class');
  });

  it('renders radio', () => {
    const html = renderContent(`
        - component: radio
          id: rd1
          props:
            label: Choice A`);
    assert.ok(html.includes('type="radio"'), 'should render radio');
    assert.ok(html.includes('Choice A'), 'should have label');
    assert.ok(html.includes('wf-radio'), 'should have radio class');
  });

  it('renders toggle', () => {
    const html = renderContent(`
        - component: toggle
          id: tg1
          props:
            label: Dark mode`);
    assert.ok(html.includes('wf-toggle'), 'should have toggle class');
    assert.ok(html.includes('wf-toggle-track'), 'should have track');
    assert.ok(html.includes('wf-toggle-thumb'), 'should have thumb');
    assert.ok(html.includes('Dark mode'), 'should have label');
  });
});

describe('Structural primitives', () => {
  it('renders section with title', () => {
    const html = renderContent(`
        - component: section
          id: sec1
          props:
            title: Settings
          children:
            - component: text
              id: t1
              props:
                text: Content`);
    assert.ok(html.includes('wf-section'), 'should have section class');
    assert.ok(html.includes('wf-section-title'), 'should have title');
    assert.ok(html.includes('Settings'), 'should contain title text');
    assert.ok(html.includes('Content'), 'should contain child');
  });

  it('renders divider', () => {
    const html = renderContent(`
        - component: divider
          id: div1`);
    assert.ok(html.includes('<hr'), 'should render hr');
    assert.ok(html.includes('wf-divider'), 'should have divider class');
  });

  it('renders spacer', () => {
    const html = renderContent(`
        - component: spacer
          id: sp1
          props:
            size: 24`);
    assert.ok(html.includes('wf-spacer'), 'should have spacer class');
    assert.ok(html.includes('24px'), 'should have size');
  });

  it('renders chart placeholder', () => {
    const html = renderContent(`
        - component: chart
          id: ch1
          props:
            label: Revenue
            chartType: bar`);
    assert.ok(html.includes('wf-chart'), 'should have chart class');
    assert.ok(html.includes('Revenue'), 'should have title');
    assert.ok(html.includes('<svg'), 'should have SVG element');
  });

  it('renders table with columns and rows', () => {
    const html = renderContent(`
        - component: table
          id: tbl1
          props:
            columns:
              - label: Name
                key: name
              - label: Age
                key: age
            rows:
              - name: Alice
                age: "30"
              - name: Bob
                age: "25"`);
    assert.ok(html.includes('wf-table'), 'should have table class');
    assert.ok(html.includes('Name'), 'should have column header');
    assert.ok(html.includes('Alice'), 'should have row data');
  });
});

describe('Tab bars', () => {
  it('renders tab_bar', () => {
    const html = renderContent(`
        - component: tab_bar
          id: tabs1
          children:
            - component: button
              id: tab1
              props:
                label: Tab 1
            - component: button
              id: tab2
              props:
                label: Tab 2`);
    assert.ok(html.includes('wf-tab-bar'), 'should have tab-bar class');
    assert.ok(html.includes('Tab 1'), 'should contain tab buttons');
  });

  it('renders bottom_tab_bar', () => {
    const html = renderContent(`
        - component: bottom_tab_bar
          id: btabs1
          children:
            - component: button
              id: bt1
              props:
                label: Home
                icon: house
            - component: button
              id: bt2
              props:
                label: Profile
                icon: user`);
    assert.ok(html.includes('wf-bottom-tab-bar'), 'should have bottom-tab-bar class');
    assert.ok(html.includes('Home'), 'should contain tab buttons');
    assert.ok(html.includes('fa-house'), 'should contain icon');
  });
});
