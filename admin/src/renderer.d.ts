declare module '@wireframes/renderer' {
  export interface DocumentMap {
    manifest: Record<string, unknown> | null
    sitemap: Record<string, unknown> | null
    templates: Record<string, unknown> | null
    components: Record<string, unknown> | null
    pages: Map<string, Record<string, unknown>>
    datasets: Map<string, Record<string, unknown>>
  }

  export interface RenderedProject {
    pages: Map<string, string>
    css: string
    js: string
    routeTable: Record<string, string>
  }

  export interface ParsedProject {
    documentMap: DocumentMap
    pageIds: string[]
    routeIds: string[]
  }

  export interface RenderOptions {
    platform?: string
    basePath?: string
    mode?: 'line' | 'card'
    preview?: boolean
  }

  export function renderProject(
    yamlFiles: Record<string, string>,
    options?: RenderOptions,
  ): RenderedProject

  export function renderPage(
    yamlFiles: Record<string, string>,
    pageId: string,
    options?: RenderOptions,
  ): string

  export function parseProject(
    yamlFiles: Record<string, string>,
  ): ParsedProject
}
