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

function buildPageYaml(device, renderMode, content) {
  const orientation = device === 'mobile' || device === 'tablet' ? '\n    orientation: portrait' : '';
  const modeStr = renderMode ? `\n  renderMode: ${renderMode}` : '';
  return `
documentType: page
specVersion: "1.1"
id: test
page:
  template: shell
  viewport:
    device: ${device}${orientation}${modeStr}
  slots:
    - slotId: body
      content:
${content}
`;
}

function getPageHtml(pageYaml) {
  const result = renderProject({
    'manifest.yaml': MANIFEST_YAML,
    'sitemap.yaml': SITEMAP_YAML,
    'templates.yaml': TEMPLATES_YAML,
    'pages/test.yaml': pageYaml,
  });
  return result.pages.find((p) => p.pageId === 'test').html;
}

describe('Layout types', () => {
  it('stack layout produces flex-direction:column', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: stack
            gap: 8
          children:
            - component: text
              id: t1
              props:
                text: A
            - component: text
              id: t2
              props:
                text: B`));
    assert.ok(html.includes('flex-direction:column'), 'should have column direction');
    assert.ok(html.includes('gap:8px'), 'should have gap');
  });

  it('row layout produces flex-direction:row', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: row
            gap: 16
          children:
            - component: text
              id: t1
              props:
                text: Left
            - component: text
              id: t2
              props:
                text: Right`));
    assert.ok(html.includes('flex-direction:row'), 'should have row direction');
    assert.ok(html.includes('gap:16px'), 'should have gap');
  });

  it('grid layout produces CSS grid', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: grid
            columns: 3
            gap: 12
          children:
            - component: text
              id: t1
              props:
                text: Col 1
            - component: text
              id: t2
              props:
                text: Col 2
            - component: text
              id: t3
              props:
                text: Col 3`));
    assert.ok(html.includes('display:grid'), 'should have grid display');
    assert.ok(html.includes('grid-template-columns:repeat(3,1fr)'), 'should have 3 columns');
  });

  it('absolute layout uses position:relative', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: absolute
          children:
            - component: text
              id: t1
              props:
                text: Positioned
              position:
                top: 10
                left: 20`));
    assert.ok(html.includes('position:relative'), 'parent should have position:relative');
    assert.ok(html.includes('position:absolute'), 'child should have position:absolute');
  });

  it('layout padding applies correctly', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: stack
            padding: 16
          children:
            - component: text
              id: t1
              props:
                text: Padded`));
    assert.ok(html.includes('padding:16px'), 'should have padding');
  });

  it('layout justify and align apply correctly', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: row
            justify: center
            align: center
          children:
            - component: text
              id: t1
              props:
                text: Centered`));
    assert.ok(html.includes('justify-content:center'), 'should have justify-content');
    assert.ok(html.includes('align-items:center'), 'should have align-items');
  });
});

describe('Rendering modes', () => {
  it('card mode renders with wf-mode-card class', () => {
    const html = getPageHtml(buildPageYaml('web', 'card', `
        - component: text
          id: t1
          props:
            text: Card`));
    assert.ok(html.includes('wf-mode-card'), 'should have card mode class');
  });

  it('line mode renders with wf-mode-line class', () => {
    const html = getPageHtml(buildPageYaml('web', 'line', `
        - component: text
          id: t1
          props:
            text: Line`));
    assert.ok(html.includes('wf-mode-line'), 'should have line mode class');
  });

  it('line mode buttons use bracket notation', () => {
    const html = getPageHtml(buildPageYaml('web', 'line', `
        - component: button
          id: btn1
          props:
            label: Save`));
    assert.ok(html.includes('[ '), 'line mode buttons should have bracket prefix');
    assert.ok(html.includes(' ]'), 'line mode buttons should have bracket suffix');
  });

  it('card mode buttons do not use brackets', () => {
    const html = getPageHtml(buildPageYaml('web', 'card', `
        - component: button
          id: btn1
          props:
            label: Save`));
    assert.ok(!html.includes('[ Save ]'), 'card mode buttons should not have brackets');
    assert.ok(html.includes('Save'), 'should contain the label');
  });
});

describe('Viewport dimensions', () => {
  it('web viewport uses 1280px width', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: text
          id: t1
          props:
            text: Web`));
    assert.ok(html.includes('width:1280px'), 'should have 1280px width');
    assert.ok(html.includes('min-height:900px'), 'should have 900px min-height');
  });

  it('mobile portrait viewport uses 390px width', () => {
    const html = getPageHtml(buildPageYaml('mobile', null, `
        - component: text
          id: t1
          props:
            text: Mobile`));
    assert.ok(html.includes('width:390px'), 'should have 390px width');
    assert.ok(html.includes('min-height:844px'), 'should have 844px min-height');
  });

  it('tablet portrait viewport uses 820px width', () => {
    const html = getPageHtml(buildPageYaml('tablet', null, `
        - component: text
          id: t1
          props:
            text: Tablet`));
    assert.ok(html.includes('width:820px'), 'should have 820px width');
    assert.ok(html.includes('min-height:1180px'), 'should have 1180px min-height');
  });
});

describe('Wireframe styles', () => {
  it('applies wireframeStyle border and corner settings', () => {
    const pageYaml = `
documentType: page
specVersion: "1.1"
id: test
page:
  template: shell
  viewport:
    device: web
  wireframeStyle:
    border:
      style: dashed
      width: medium
    corner:
      style: rounded
      radius: 8
  slots:
    - slotId: body
      content:
        - component: section
          id: sec1
          props:
            title: Styled
`;
    const html = getPageHtml(pageYaml);
    assert.ok(html.includes('dashed'), 'should apply dashed border style');
    assert.ok(html.includes('2px'), 'should apply medium border width');
  });

  it('CSS includes mode-specific surface rules', () => {
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': TEMPLATES_YAML,
      'pages/test.yaml': buildPageYaml('web', 'card', `
        - component: text
          id: t1
          props:
            text: Test`),
    });
    assert.ok(result.css.includes('wf-mode-card'), 'CSS should have card mode rules');
    assert.ok(result.css.includes('wf-mode-line'), 'CSS should have line mode rules');
    assert.ok(result.css.includes('wf-surface'), 'CSS should have surface rules');
  });

  it('section gets wf-surface class', () => {
    const html = getPageHtml(buildPageYaml('web', 'card', `
        - component: section
          id: sec1
          props:
            title: Card Section`));
    assert.ok(html.includes('wf-surface'), 'section should have wf-surface class');
  });

  it('text does not get wf-surface class', () => {
    const html = getPageHtml(buildPageYaml('web', 'card', `
        - component: text
          id: t1
          props:
            text: Plain text`));
    const textMatch = html.match(/class="[^"]*wf-text[^"]*"/);
    assert.ok(textMatch, 'should find text node');
    assert.ok(!textMatch[0].includes('wf-surface'), 'text should NOT have wf-surface class');
  });
});

describe('Separator and double-border prevention', () => {
  it('applies wf-divide-y for stack with gap:0 and separators:between', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: stack
            gap: 0
            separators: between
          children:
            - component: text
              id: t1
              props:
                text: Top
            - component: text
              id: t2
              props:
                text: Bottom`));
    assert.ok(html.includes('wf-divide-y'), 'should have wf-divide-y class');
  });

  it('applies wf-divide-x for row with gap:0 and separators:between', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: sec1
          layout:
            type: row
            gap: 0
            separators: between
          children:
            - component: text
              id: t1
              props:
                text: Left
            - component: text
              id: t2
              props:
                text: Right`));
    assert.ok(html.includes('wf-divide-x'), 'should have wf-divide-x class');
  });
});

describe('Pane rendering', () => {
  it('renders pane with side and size', () => {
    const html = getPageHtml(buildPageYaml('web', null, `
        - component: section
          id: row1
          layout:
            type: row
          children:
            - component: section
              id: sidebar
              pane:
                side: left
                defaultSize: 240
                minSize: 180
                maxSize: 400
              props:
                title: Sidebar
            - component: section
              id: main
              pane:
                side: center
              props:
                title: Main`));
    assert.ok(html.includes('wf-pane-left'), 'should have pane-left class');
    assert.ok(html.includes('wf-pane-center'), 'should have pane-center class');
    assert.ok(html.includes('width:240px'), 'should have default size');
    assert.ok(html.includes('min-width:180px'), 'should have min size');
    assert.ok(html.includes('max-width:400px'), 'should have max size');
  });
});

describe('Sticky regions', () => {
  it('renders sticky header/footer with data-sticky attributes', () => {
    const stickyTemplate = `
documentType: templates
specVersion: "1.1"
id: templates
templates:
  sticky_shell:
    layout:
      type: stack
    regions:
      - id: header
        kind: persistent
        sticky: top
        children:
          - component: heading
            id: title
            props:
              text: Header
              level: 1
      - id: body
        kind: slot
      - id: footer
        kind: persistent
        sticky: bottom
        children:
          - component: text
            id: footer_text
            props:
              text: Footer
`;
    const pageYaml = `
documentType: page
specVersion: "1.1"
id: test
page:
  template: sticky_shell
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: text
          id: t1
          props:
            text: Body content
`;
    const result = renderProject({
      'manifest.yaml': MANIFEST_YAML,
      'sitemap.yaml': SITEMAP_YAML,
      'templates.yaml': stickyTemplate,
      'pages/test.yaml': pageYaml,
    });
    const page = result.pages.find((p) => p.pageId === 'test');
    assert.ok(page, 'should find page');
    assert.ok(page.html.includes('data-sticky="top"'), 'should have sticky top');
    assert.ok(page.html.includes('data-sticky="bottom"'), 'should have sticky bottom');
  });
});

