const SPEC_VERSION = '1.1'

export function buildStarterDocument(documentType: string, documentId: string): string {
  switch (documentType) {
    case 'manifest':
      return [
        'documentType: manifest',
        `specVersion: "${SPEC_VERSION}"`,
        'id: manifest',
        'manifest:',
        `  projectId: "${documentId}"`,
        `  name: "${documentId}"`,
        `  schemaVersion: "${SPEC_VERSION}"`,
        '',
      ].join('\n')
    case 'sitemap':
      return [
        'documentType: sitemap',
        `specVersion: "${SPEC_VERSION}"`,
        'id: sitemap',
        'defaultTemplate: app_template',
        'routes: []',
        '',
      ].join('\n')
    case 'templates':
      return [
        'documentType: templates',
        `specVersion: "${SPEC_VERSION}"`,
        'id: templates',
        'templates:',
        '  app_template:',
        '    layout:',
        '      type: stack',
        '    regions:',
        '      - id: main_content',
        '        kind: slot',
        '',
      ].join('\n')
    case 'components':
      return [
        'documentType: components',
        `specVersion: "${SPEC_VERSION}"`,
        'id: components',
        'components: {}',
        '',
      ].join('\n')
    case 'dataset':
      return [
        'documentType: dataset',
        `specVersion: "${SPEC_VERSION}"`,
        `id: ${documentId}`,
        'dataset:',
        `  id: ${documentId}`,
        '  primaryKey: id',
        '  fields:',
        '    - id',
        '  items: []',
        '',
      ].join('\n')
    case 'page':
    default:
      return [
        'documentType: page',
        `specVersion: "${SPEC_VERSION}"`,
        `id: ${documentId}`,
        'page:',
        `  id: ${documentId}`,
        '  template: app_template',
        '  viewport:',
        '    device: web',
        '  wireframeStyle:',
        '    border:',
        '      style: solid',
        '  slots:',
        '    - slotId: main_content',
        '      content:',
        `        - id: ${documentId}_heading`,
        '          component: heading',
        '          props:',
        `            label: "${documentId}"`,
        '            level: 1',
        `        - id: ${documentId}_body`,
        '          component: paragraph',
        '          props:',
        '            label: "Add content to this page."',
        '',
      ].join('\n')
  }
}
