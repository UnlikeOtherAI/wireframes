import { useMemo } from 'react'
import { parse as parseYaml } from 'yaml'
import type { ResolvedNode, SitemapNode, WorkspaceTree } from './types'
import { resolveWorkspaceTree } from './resolveWorkspaceNodes'
import { useRenderer } from './rendererModule'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The active page's node tree. It is resolved with the engine's own row and
 * budget rules, so it waits for the renderer bundle the preview loads too.
 */
export function useWorkspaceTree(
  yamlFiles: Record<string, string>,
  activePage: string,
): WorkspaceTree {
  const renderer = useRenderer()
  return useMemo<WorkspaceTree>(() => {
    if (renderer === undefined) return { nodes: [], notice: { kind: 'loading' } }
    if (renderer === null) return { nodes: [], notice: { kind: 'unavailable' } }
    return resolveWorkspaceTree(yamlFiles, activePage, renderer)
  }, [renderer, yamlFiles, activePage])
}

export function useResolvedNodes(
  yamlFiles: Record<string, string>,
  activePage: string,
): ResolvedNode[] {
  return useWorkspaceTree(yamlFiles, activePage).nodes
}

/**
 * Rendered node id to the address a click on it selects. A node a component
 * renders selects its nearest owner: its page-authored instance, or the repeat
 * row it renders inside. A row of a definition's repeat selects itself in the
 * definition.
 */
export function buildNodeIdToAddressMap(nodes: ResolvedNode[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(node: ResolvedNode) {
    map.set(node.renderedId ?? node.id, node.address)
    for (const child of node.children) walk(child)
  }
  for (const node of nodes) walk(node)
  return map
}

export function useSitemapNodes(
  yamlFiles: Record<string, string>,
): SitemapNode[] {
  return useMemo(() => {
    try {
      const sitemapFile = yamlFiles['sitemap.yaml']
      if (!sitemapFile) return []

      const parsed = parseYaml(sitemapFile)
      if (!isObject(parsed)) return []

      const sitemap = isObject(parsed.sitemap)
        ? parsed.sitemap as Record<string, unknown>
        : parsed

      const routes = Array.isArray(sitemap.routes)
        ? sitemap.routes as Array<Record<string, unknown>>
        : []

      const nodes: SitemapNode[] = []
      for (const route of routes) {
        if (!isObject(route)) continue
        const id = typeof route.id === 'string' ? route.id : ''
        const page = typeof route.page === 'string' ? route.page : id
        const path = typeof route.path === 'string' ? route.path : '/'
        if (!id) continue

        const targets: string[] = []
        extractNavigationTargets(route, targets)

        nodes.push({ id, page, path, targets })
      }

      return nodes
    } catch {
      return []
    }
  }, [yamlFiles])
}

function extractNavigationTargets(obj: unknown, targets: string[]): void {
  if (!isObject(obj)) return
  if (typeof obj.navigate === 'string' && obj.navigate.trim()) {
    targets.push(obj.navigate.trim())
  }
  if (typeof obj.target === 'string' && obj.target.trim()) {
    targets.push(obj.target.trim())
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val)) {
      for (const item of val) extractNavigationTargets(item, targets)
    } else if (isObject(val)) {
      extractNavigationTargets(val, targets)
    }
  }
}
