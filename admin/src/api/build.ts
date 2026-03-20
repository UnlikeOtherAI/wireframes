import { apiFetch } from './client'

export interface BuildResult {
  pages: Array<{
    pageId: string
    platform: string
    html: string
  }>
  css: string
  js: string
  routeTable: Record<string, string>
  indexHtml: string
  platformIndexes: Record<string, string>
}

export function buildProject(projectId: string, platform = 'all'): Promise<BuildResult> {
  const query = new URLSearchParams({ platform })
  return apiFetch<BuildResult>(
    `/projects/${encodeURIComponent(projectId)}/build?${query.toString()}`,
    { method: 'POST' },
  )
}
