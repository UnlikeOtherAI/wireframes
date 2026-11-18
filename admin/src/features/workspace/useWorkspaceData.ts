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

// Who wrote a node in the tree. Page nodes are edited in the page document; a
// fill sits inside its component's content in the tree but is still written on
// its instance. Component-internal nodes are edited in the component document,
// so selecting one selects the closest page-authored instance.
type Authorship =
  | { kind: 'page'; authorParent?: object }
  | { kind: 'internal'; owner: object; renderedId: string }

const AUTHOR = Symbol('wfAuthor')

type Authored = Record<string, unknown> & { [AUTHOR]?: Authorship }

/** A tree node that renders inside a component instance it was not written on. */
type TreeNode = ResolvedNode & { owner?: string; renderedId?: string }

interface Extraction {
  authorPaths: Map<object, string[]>
  addresses: Map<object, string>
}

// Mirrors the engine resolver's scopes: definition content is namespaced under
// the rendered instance id, and an instance's fills replace its placeholders.
interface Scope {
  owner: object | null
  namespace: string | null
  fills: Map<string, unknown[]> | null
}

const PAGE_SCOPE: Scope = { owner: null, namespace: null, fills: null }

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

  const authorship = (node as Authored)[AUTHOR]
  const authorParent = authorship?.kind === 'page' ? authorship.authorParent : undefined
  const basePath = authorParent ? extraction.authorPaths.get(authorParent) ?? pathParts : pathParts
  const currentPath = [...basePath, id]
  const address = buildAddress(docType, docId, currentPath)
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

const isPlaceholder = (node: Record<string, unknown>) => Object.prototype.hasOwnProperty.call(node, 'slot')

/** Whether a definition root declares slots anywhere below it. */
function hasPlaceholders(root: Record<string, unknown>): boolean {
  const visit = (node: unknown): boolean => {
    if (!isObject(node)) return false
    if (isPlaceholder(node)) return true
    const lists = [node.children, ...(node.use != null && isObject(node.slots) ? Object.values(node.slots) : [])]
    return lists.some((list) => Array.isArray(list) && list.some(visit))
  }
  const lists = [root.children, ...(root.use != null && isObject(root.slots) ? Object.values(root.slots) : [])]
  return lists.some((list) => Array.isArray(list) && list.some(visit))
}

function authorIn(node: Record<string, unknown>, scope: Scope): Authored {
  const copy: Authored = { ...node }
  const id = typeof node.id === 'string' ? node.id : ''
  copy[AUTHOR] = scope.owner && scope.namespace
    ? { kind: 'internal', owner: scope.owner, renderedId: `${scope.namespace}__${id}` }
    : { kind: 'page' }
  return copy
}

/** An instance's fills, resolved in the scope that wrote them. Children fill `default`. */
function resolveFills(
  node: Record<string, unknown>,
  instance: Authored,
  componentDefs: Record<string, unknown>,
  componentStack: Set<string>,
  scope: Scope,
): Map<string, unknown[]> {
  const authored: Array<[string, unknown[]]> = []
  if (Array.isArray(node.children)) authored.push(['default', node.children])
  if (isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      if (Array.isArray(fill) && !(name === 'default' && Array.isArray(node.children))) authored.push([name, fill])
    }
  }
  const fills = new Map<string, unknown[]>()
  for (const [name, fill] of authored) {
    const entries = resolveComponents(fill, componentDefs, componentStack, scope)
    for (const entry of entries) {
      // A page fill is written on its instance, wherever it renders. Forwarded
      // page content already names the page instance it was written on.
      const authorship = (entry as Authored)[AUTHOR]
      if (authorship?.kind === 'page' && !authorship.authorParent) {
        (entry as Authored)[AUTHOR] = { kind: 'page', authorParent: instance }
      }
    }
    fills.set(name, entries)
  }
  return fills
}

function resolveComponents(
  nodes: unknown[],
  componentDefs: Record<string, unknown>,
  componentStack: Set<string>,
  scope: Scope = PAGE_SCOPE,
): unknown[] {
  const resolved: unknown[] = []
  for (const node of nodes) {
    if (!isObject(node)) continue

    if (scope.fills && isPlaceholder(node)) {
      const fill = scope.fills.get(typeof node.slot === 'string' ? node.slot : '')
      if (fill) resolved.push(...fill)
      else if (Array.isArray(node.children)) resolved.push(...resolveComponents(node.children, componentDefs, componentStack, scope))
      continue
    }

    const useRef = typeof node.use === 'string' ? node.use.trim() : ''
    const compRef = typeof node.component === 'string' ? node.component.trim() : ''
    const lookupKey = useRef || compRef
    const merged = authorIn(node, scope)

    if (lookupKey && isObject(componentDefs[lookupKey]) && !componentStack.has(lookupKey)) {
      const def = componentDefs[lookupKey] as Record<string, unknown>
      const root = isObject(def.root) ? def.root : def
      for (const key of Object.keys(merged)) delete merged[key]
      Object.assign(merged, root)
      if (typeof node.id === 'string') merged.id = node.id
      if (isObject(node.props) && isObject(root.props)) {
        merged.props = { ...(root.props as Record<string, unknown>), ...(node.props as Record<string, unknown>) }
      }
      const fills = hasPlaceholders(root) ? resolveFills(node, merged, componentDefs, componentStack, scope) : null
      const authorship = merged[AUTHOR]
      const renderedId = authorship?.kind === 'internal' ? authorship.renderedId : String(merged.id ?? '')
      const newStack = new Set(componentStack)
      newStack.add(lookupKey)
      merged.children = resolveComponents(
        Array.isArray(root.children) ? root.children as unknown[] : [],
        componentDefs,
        newStack,
        { owner: scope.owner ?? merged, namespace: renderedId, fills },
      )
      resolved.push(merged)
    } else {
      const childArr = Array.isArray(node.children) ? node.children
        : Array.isArray(node.body) ? node.body
        : null
      // An instance whose definition this tree cannot see (imported, or a
      // built-in std pattern) still lists what its author wrote on it: the
      // default fill and every named fill, addressed under the instance.
      const namedFills = useRef && isObject(node.slots)
        ? Object.values(node.slots).filter((fill): fill is unknown[] => Array.isArray(fill)).flat()
        : []
      if (childArr || namedFills.length > 0) {
        merged.children = resolveComponents([...(childArr ?? []), ...namedFills], componentDefs, componentStack, scope)
      }
      resolved.push(merged)
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
 * nodes render with namespaced ids and select their page-authored instance.
 */
export function buildNodeIdToAddressMap(nodes: ResolvedNode[]): Map<string, string> {
  const map = new Map<string, string>()
  function walk(node: TreeNode) {
    if (node.renderedId && node.owner) map.set(node.renderedId, node.owner)
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
