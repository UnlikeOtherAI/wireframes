import { useMemo } from 'react'
import { parse as parseYaml } from 'yaml'
import type { ResolvedNode, SitemapNode } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function extractNodeTree(node: unknown, parentId: string, index: number): ResolvedNode | null {
  if (!isObject(node)) return null

  const id = typeof node.id === 'string' ? node.id : `${parentId}_${index}`
  const type = typeof node.type === 'string' ? node.type : ''
  const component = typeof node.component === 'string' ? node.component : undefined
  const layout = isObject(node.layout) && typeof node.layout.type === 'string'
    ? node.layout.type
    : typeof node.layout === 'string'
      ? node.layout
      : undefined

  const rawChildren = Array.isArray(node.children) ? node.children
    : Array.isArray(node.body) ? node.body
    : []

  const children: ResolvedNode[] = []
  for (let i = 0; i < rawChildren.length; i++) {
    const child = extractNodeTree(rawChildren[i], id, i)
    if (child) children.push(child)
  }

  return { id, type, component, layout, children }
}

export function useResolvedNodes(
  yamlFiles: Record<string, string>,
  activePage: string,
): ResolvedNode[] {
  return useMemo(() => {
    try {
      const pageFile = yamlFiles[`pages/${activePage}.yaml`]
      if (!pageFile) return []

      const parsed = parseYaml(pageFile)
      if (!isObject(parsed)) return []

      const page = isObject(parsed.page)
        ? parsed.page as Record<string, unknown>
        : parsed

      const bodyNodes = Array.isArray(page.body) ? page.body
        : Array.isArray(page.children) ? page.children
        : []

      const result: ResolvedNode[] = []
      for (let i = 0; i < bodyNodes.length; i++) {
        const node = extractNodeTree(bodyNodes[i], 'root', i)
        if (node) result.push(node)
      }
      return result
    } catch {
      return []
    }
  }, [yamlFiles, activePage])
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
