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

  /** What one page's expansion may still materialize: `max` nodes, `used` so far. */
  export interface ExpansionBudget {
    max: number
    used: number
  }

  /** A row of a `repeat`, as the resolver makes it, with the host and item it comes from. */
  export interface RepeatRow extends Record<string, unknown> {
    id: string
    __repeat: { host: string; item: string; index: number }
  }

  export function createExpansionBudget(max?: number): ExpansionBudget

  /** How many nodes a host's rows expand to, nested components and rows included. */
  export function repeatNodeCount(
    node: unknown,
    definitions: Record<string, unknown>,
    budget: ExpansionBudget,
  ): number

  /** The rows a host renders, in item order; none unless the host can host rows. */
  export function repeatRows(host: unknown, hostId?: string): RepeatRow[]
}
