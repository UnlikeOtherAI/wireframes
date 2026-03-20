import { useMemo } from 'react'
import { parse as parseYaml } from 'yaml'
import type { ResolvedNode, SitemapNode } from './types'

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function buildAddress(docType: string, docId: string, pathParts: string[]): string {
  const fragment = pathParts.join('.')
  return `wf://${docType}/${docId}#${fragment}`
}

function extractNodeTree(
  node: unknown,
  parentId: string,
  index: number,
  docType: string,
  docId: string,
  pathParts: string[],
): ResolvedNode | null {
  if (!isObject(node)) return null

  const id = typeof node.id === 'string' ? node.id : `${parentId}_${index}`
  const type = typeof node.type === 'string' ? node.type : ''
  const component = typeof node.component === 'string' ? node.component : undefined
  const layout = isObject(node.layout) && typeof node.layout.type === 'string'
    ? node.layout.type
    : typeof node.layout === 'string'
      ? node.layout
      : undefined

  const currentPath = [...pathParts, id]
  const address = buildAddress(docType, docId, currentPath)

  const rawChildren = Array.isArray(node.children) ? node.children
    : Array.isArray(node.body) ? node.body
    : []

  const children: ResolvedNode[] = []
  for (let i = 0; i < rawChildren.length; i++) {
    const child = extractNodeTree(rawChildren[i], id, i, docType, docId, currentPath)
    if (child) children.push(child)
  }

  return { id, address, type, component, layout, children }
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

function resolveComponents(
  nodes: unknown[],
  componentDefs: Record<string, unknown>,
  componentStack: Set<string>,
): unknown[] {
  const resolved: unknown[] = []
  for (const node of nodes) {
    if (!isObject(node)) continue

    const useRef = typeof node.use === 'string' ? node.use.trim() : ''
    const compRef = typeof node.component === 'string' ? node.component.trim() : ''
    const lookupKey = useRef || compRef

    if (lookupKey && isObject(componentDefs[lookupKey]) && !componentStack.has(lookupKey)) {
      const def = componentDefs[lookupKey] as Record<string, unknown>
      const root = isObject(def.root) ? def.root : def
      const merged: Record<string, unknown> = { ...root }
      if (typeof node.id === 'string') merged.id = node.id
      if (isObject(node.props) && isObject(root.props)) {
        merged.props = { ...(root.props as Record<string, unknown>), ...(node.props as Record<string, unknown>) }
      }
      const newStack = new Set(componentStack)
      newStack.add(lookupKey)
      const inner = resolveComponents(
        Array.isArray(merged.children) ? merged.children as unknown[] : [],
        componentDefs,
        newStack,
      )
      merged.children = inner
      resolved.push(merged)
    } else {
      const clone: Record<string, unknown> = { ...node }
      const childArr = Array.isArray(node.children) ? node.children
        : Array.isArray(node.body) ? node.body
        : null
      if (childArr) {
        clone.children = resolveComponents(childArr as unknown[], componentDefs, componentStack)
      }
      resolved.push(clone)
    }
  }
  return resolved
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

      if (Array.isArray(page.overlays)) {
        for (const overlay of page.overlays) {
          if (isObject(overlay)) bodyNodes.push(overlay)
        }
      }

      const result: ResolvedNode[] = []
      for (let i = 0; i < bodyNodes.length; i++) {
        const node = extractNodeTree(bodyNodes[i], 'root', i, 'page', activePage, [])
        if (node) result.push(node)
      }
      return result
    } catch {
      return []
    }
  }, [yamlFiles, activePage])
}

export function buildNodeIdToAddressMap(nodes: ResolvedNode[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(node: ResolvedNode) {
    map.set(node.id, node.address)
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
