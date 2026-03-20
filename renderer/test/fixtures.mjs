export const MANIFEST_YAML = `
documentType: manifest
specVersion: "1.1"
id: manifest
manifest:
  name: Test Project
  schemaVersion: "1.1"
`;

export const SITEMAP_BASIC = `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  routes:
    - id: home
      path: /
      page: home
`;

export const TEMPLATES_YAML = `
documentType: templates
specVersion: "1.1"
id: templates
templates:
  main:
    layout:
      type: stack
    regions:
      - id: header
        kind: persistent
        children:
          - component: heading
            id: site-title
            props:
              text: Test Site
              level: 1
      - id: body
        kind: slot
`;

export function sitemapWithAppState(appState) {
  const stateLines = Object.entries(appState)
    .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
    .join('\n');
  return `
documentType: sitemap
specVersion: "1.1"
id: sitemap
sitemap:
  appState:
${stateLines}
  routes:
    - id: home
      path: /
      page: home
    - id: settings
      path: /settings
      page: settings
`;
}

export function simplePage(pageId, content) {
  return `
documentType: page
specVersion: "1.1"
id: ${pageId}
page:
  template: main
  viewport:
    device: web
  slots:
    - slotId: body
      content:
        - component: text
          id: t1
          props:
            text: ${content}
`;
}
