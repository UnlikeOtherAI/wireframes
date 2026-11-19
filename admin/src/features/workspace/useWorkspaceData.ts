import { useMemo } from 'react'
import { parse as parseYaml } from 'yaml'
import type { ResolvedNode, SitemapNode } from './types'
import { authorshipOf, buildAddress, resolveComponents } from './resolveWorkspaceNodes'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** A tree node that renders inside a component instance it was not written on, or a repeat row. */
type TreeNode = ResolvedNode & { owner?: string; renderedId?: string }

interface Extraction {
  authorPaths: Map<object, string[]>
  addresses: Map<object, string>
}

function extractNodeTree(
  node: unknown,
  parentId: string,
  index: number,
  docType: string,
  docId: string,
  pathParts: string[],
  extraction: Extraction,
): TreeNode | null {
  if (!isObject(node)) return null

  const id = typeof node.id === 'string' ? node.id : `${parentId}_${index}`
  const type = typeof node.type === 'string' ? node.type : ''
  const component = typeof node.component === 'string' ? node.component : undefined
  const layout = isObject(node.layout) && typeof node.layout.type === 'string'
    ? node.layout.type
    : typeof node.layout === 'string'
      ? node.layout
      : undefined

  const authorship = authorshipOf(node)
  const authorParent = authorship?.kind === 'page' ? authorship.authorParent : undefined
  const basePath = authorParent ? extraction.authorPaths.get(authorParent) ?? pathParts : pathParts
  const currentPath = [...basePath, id]
  // A row of a definition's repeat is edited in that definition.
  const address = authorship?.kind === 'definition' ? authorship.address : buildAddress(docType, docId, currentPath)
  extraction.authorPaths.set(node, currentPath)
  extraction.addresses.set(node, address)

  const rawChildren = Array.isArray(node.children) ? node.children
    : Array.isArray(node.body) ? node.body
    : []

  const children: ResolvedNode[] = []
  for (let i = 0; i < rawChildren.length; i++) {
    const child = extractNodeTree(rawChildren[i], id, i, docType, docId, currentPath, extraction)
    if (child) children.push(child)
  }

  const result: TreeNode = { id, address, type, component, layout, children }
  if (authorship?.kind === 'internal') {
    result.owner = extraction.addresses.get(authorship.owner)
    result.renderedId = authorship.renderedId
  }
  if (authorship?.kind === 'definition') result.renderedId = authorship.renderedId
  if (authorship && 'item' in authorship && authorship.item) result.repeatItem = authorship.item
  return result
}

function extractComponentDefs(parsed: unknown): Record<string, unknown> {
  if (!isObject(parsed)) return {}
  const comps = isObject(parsed.components) ? parsed.components : parsed
  const result: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(comps)) {
    if (key === 'documentType' || key === 'specVersion' || key === 'id' || key === 'imports') continue
    if (isObject(val)) result[key] = val
  }
  return result
}

function resolveTemplateRegions(
  template: Record<string, unknown>,
  page: Record<string, unknown>,
  componentDefs: Record<string, unknown>,
): unknown[] {
  const regions = Array.isArray(template.regions) ? template.regions : []
  const slotMap = new Map<string, unknown[]>()
  const injectableMap = new Map<string, unknown[]>()

  if (Array.isArray(page.slots)) {
    for (const slot of page.slots) {
      if (!isObject(slot) || typeof slot.slotId !== 'string') continue
      const slotChildren = Array.isArray(slot.content) ? slot.content
        : Array.isArray(slot.body) ? slot.body
        : null
      if (slotChildren) slotMap.set(slot.slotId, slotChildren)
    }
  }
  if (Array.isArray(page.injectables)) {
    for (const inj of page.injectables) {
      if (!isObject(inj) || typeof inj.injectableId !== 'string') continue
      const injChildren = Array.isArray(inj.content) ? inj.content
        : Array.isArray(inj.body) ? inj.body
        : null
      if (injChildren) injectableMap.set(inj.injectableId, injChildren)
    }
  }

  const result: unknown[] = []
  for (const region of regions) {
    if (!isObject(region)) continue
    const kind = typeof region.kind === 'string' ? region.kind : 'slot'
    const regionId = typeof region.id === 'string' ? region.id : ''

    if (kind === 'slot') {
      const slotContent = slotMap.get(regionId)
      if (slotContent && slotContent.length > 0) {
        const resolved = resolveComponents(slotContent, componentDefs, new Set())
        result.push({ id: regionId, type: 'region', layout: region.layout, children: resolved })
      }
    } else {
      const children = Array.isArray(region.children) ? region.children : []
      const resolvedChildren: unknown[] = []
      for (const child of children) {
        if (isObject(child) && child.injectable === true && typeof child.id === 'string') {
          const injContent = injectableMap.get(child.id)
          if (injContent && injContent.length > 0) {
            const resolved = resolveComponents(injContent, componentDefs, new Set())
            resolvedChildren.push({ ...child, children: resolved })
          } else {
            resolvedChildren.push(child)
          }
        } else {
          resolvedChildren.push(child)
        }
      }
      const resolved = resolveComponents(resolvedChildren as unknown[], componentDefs, new Set())
      result.push({ id: regionId, type: 'region', layout: region.layout, children: resolved })
    }
  }
  return result
}

function getRawBody(page: Record<string, unknown>, componentDefs: Record<string, unknown>): unknown[] {
  const raw = Array.isArray(page.body) ? page.body
    : Array.isArray(page.children) ? page.children
    : []
  return resolveComponents(raw as unknown[], componentDefs, new Set())
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

      const componentDefs: Record<string, unknown> = {}
      const componentsFile = yamlFiles['components.yaml']
      if (componentsFile) {
        const compParsed = parseYaml(componentsFile)
        Object.assign(componentDefs, extractComponentDefs(compParsed))
      }

      const templateId = typeof page.template === 'string' ? page.template : ''
      const templatesFile = yamlFiles['templates.yaml']
      let bodyNodes: unknown[]

      if (templateId && templatesFile) {
        const templatesParsed = parseYaml(templatesFile)
        if (isObject(templatesParsed)) {
          Object.assign(componentDefs, extractComponentDefs(templatesParsed))
          const templates = isObject(templatesParsed.templates)
            ? templatesParsed.templates
            : templatesParsed
          const template = isObject((templates as Record<string, unknown>)[templateId])
            ? (templates as Record<string, unknown>)[templateId] as Record<string, unknown>
            : null
          if (template) {
            bodyNodes = resolveTemplateRegions(template, page, componentDefs)
          } else {
            bodyNodes = getRawBody(page, componentDefs)
          }
        } else {
          bodyNodes = getRawBody(page, componentDefs)
        }
      } else {
        bodyNodes = getRawBody(page, componentDefs)
      }

      // An overlay is a root of the page document, so its content is addressed under it.
      if (Array.isArray(page.overlays)) {
        for (const overlay of page.overlays) {
          if (!isObject(overlay)) continue
          const content = Array.isArray(overlay.content) ? overlay.content : []
          bodyNodes.push({ ...overlay, children: resolveComponents(content, componentDefs, new Set()) })
        }
      }

      const extraction: Extraction = { authorPaths: new Map(), addresses: new Map() }
      const result: ResolvedNode[] = []
      for (let i = 0; i < bodyNodes.length; i++) {
        const node = extractNodeTree(bodyNodes[i], 'root', i, 'page', activePage, [], extraction)
        if (node) result.push(node)
      }
      return result
    } catch {
      return []
    }
  }, [yamlFiles, activePage])
}

/**
 * Rendered node id to the address a click on it selects. Component-internal
 * nodes render with namespaced ids and select their page-authored instance or
 * their repeat row; a definition's own row selects itself in the definition.
 */
export function buildNodeIdToAddressMap(nodes: ResolvedNode[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(node: TreeNode) {
    if (node.renderedId) map.set(node.renderedId, node.owner ?? node.address)
    else map.set(node.id, node.address)
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
