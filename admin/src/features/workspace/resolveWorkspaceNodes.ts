import { parse as parseYaml } from 'yaml'
import type { ExpansionBudget } from '@wireframes/renderer'
import type { RendererModule } from './rendererModule'
import type { ResolvedNode, WorkspaceTree } from './types'

// The admin's node tree, resolved the way the engine resolver scopes content.
// Every node is resolved in the scope of the document that writes it: page
// content in the page, template regions in the template, injected content in
// the page's injection, definition content in the definition, namespaced under
// its instance. An instance's fills are resolved where they are written and
// replace its placeholders; without placeholders, its children replace the
// root's children and rows. A `repeat` host lists its rows after its children,
// made by the engine itself, so a cell is classified as the engine classifies
// it and the page's expansion is charged against the engine's own budget. A
// marker, written or a component's root, lists what the page injects for the
// id it renders with.

type Doc = Record<string, unknown>
type Engine = Pick<RendererModule, 'createExpansionBudget' | 'repeatNodeCount' | 'repeatRows'>

function isObject(value: unknown): value is Doc {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

/** The document nodes are written in, and the path there of what they are written under. */
interface Author {
  docType: 'page' | 'template' | 'component'
  docId: string
  path: string[]
}

interface Scope {
  author: Author
  /** In a definition: the nearest node the tree selects, which the definition's content selects. */
  owner: ResolvedNode | null
  /** In a definition: its instance's rendered id, which prefixes the rendered ids of its content. */
  namespace: string | null
  /** In a definition with placeholders: the caller's fills, resolved where they are written. */
  fills: Map<string, ResolvedNode[]> | null
}

/** What resolving one page shares. */
interface Walk {
  engine: Engine
  pageId: string
  definitions: Doc
  injections: Map<string, unknown[]>
  /** The injections being listed: one that reaches its own marker again lists nothing there. */
  active: Set<string>
  budget: ExpansionBudget
}

/** The page expands past the budget; `host` is the repeat that would pass it. */
class TooLarge extends Error {
  host: string | null
  max: number

  constructor(host: string | null, max: number) {
    super(`Expanded wireframe is too large: a page may expand to at most ${max} nodes.`)
    this.host = host
    this.max = max
  }
}

const addressOf = (author: Author, id: string) =>
  `wf://${author.docType}/${author.docId}#${[...author.path, id].join('.')}`

const scopeAt = (docType: Author['docType'], docId: string, path: string[]): Scope =>
  ({ author: { docType, docId, path }, owner: null, namespace: null, fills: null })

/** The scope of what the node `id` writes below itself. */
function below(scope: Scope, id: unknown): Scope {
  if (typeof id !== 'string') return scope
  return { ...scope, author: { ...scope.author, path: [...scope.author.path, id] } }
}

const isPlaceholder = (node: Doc) => Object.prototype.hasOwnProperty.call(node, 'slot')
const slotName = (node: Doc) => (typeof node.slot === 'string' ? node.slot : '')

function layoutOf(node: Doc): string | undefined {
  if (isObject(node.layout) && typeof node.layout.type === 'string') return node.layout.type
  return typeof node.layout === 'string' ? node.layout : undefined
}

/** The node lists below a node, as the engine walks them: its children and a use: node's fills. */
function childLists(node: Doc): unknown[][] {
  const lists: unknown[][] = Array.isArray(node.children) ? [node.children] : []
  if (node.use != null && isObject(node.slots)) {
    for (const fill of Object.values(node.slots)) if (Array.isArray(fill)) lists.push(fill)
  }
  return lists
}

function hasPlaceholders(root: Doc): boolean {
  return childLists(root).some((list) => list.some((node) => isObject(node) && (isPlaceholder(node) || hasPlaceholders(node))))
}

/** An instance's fills by slot name. Children fill `default`. */
function fillLists(node: Doc): Array<[string, unknown[]]> {
  const lists: Array<[string, unknown[]]> = Array.isArray(node.children) ? [['default', node.children]] : []
  if (isObject(node.slots)) {
    for (const [name, fill] of Object.entries(node.slots)) {
      if (Array.isArray(fill) && !(name === 'default' && Array.isArray(node.children))) lists.push([name, fill])
    }
  }
  return lists
}

function charge(walk: Walk) {
  walk.budget.used += 1
  if (walk.budget.used > walk.budget.max) throw new TooLarge(null, walk.budget.max)
}

/**
 * Refuses a host whose rows would pass the budget before any of them is listed,
 * as the resolver does. `reserved` is what rows made beside it will expand to.
 * Returns what its rows expand to.
 */
function checkRows(host: Doc, hostId: string, walk: Walk, reserved = 0): number {
  if (walk.engine.repeatRows(host, hostId).length === 0) return 0
  const need = walk.engine.repeatNodeCount(host, walk.definitions, walk.budget)
  if (walk.budget.used + reserved + need > walk.budget.max) throw new TooLarge(hostId, walk.budget.max)
  return need
}

/**
 * The resolver materializes the rows of what an instance renders when the
 * instance expands, so every host there is checked then, and the hosts reserve
 * their fan-out together. A filled placeholder's fallback does not render, so
 * its hosts are not checked.
 */
function checkDefinitionRows(root: Doc, rootId: string, fills: Map<string, ResolvedNode[]> | null, walk: Walk) {
  let reserved = 0
  const visit = (node: unknown, hostId: unknown) => {
    if (!isObject(node) || (isPlaceholder(node) && fills?.has(slotName(node)))) return
    if (typeof hostId === 'string') reserved += checkRows(node, hostId, walk, reserved)
    for (const list of childLists(node)) for (const child of list) visit(child, isObject(child) ? child.id : undefined)
  }
  visit(root, rootId)
}

/** A node as the tree lists it, before its children. */
function entry(node: Doc, scope: Scope, fallbackId: string): ResolvedNode {
  const id = typeof node.id === 'string' ? node.id : fallbackId
  const item = isObject(node.__repeat) && typeof node.__repeat.item === 'string' ? node.__repeat.item : undefined
  // A definition's content is edited in the definition, so it selects its owner. Its rows are its own.
  const internal = scope.author.docType === 'component' && !item
  const result: ResolvedNode = {
    id,
    address: internal && scope.owner ? scope.owner.address : addressOf(scope.author, id),
    renderedId: scope.namespace ? `${scope.namespace}__${id}` : id,
    type: typeof node.type === 'string' ? node.type : '',
    children: [],
  }
  if (internal) result.internal = true
  if (typeof node.component === 'string') result.component = node.component
  const layout = layoutOf(node)
  if (layout) result.layout = layout
  if (item) result.repeatItem = item
  return result
}

function resolveList(nodes: unknown[], scope: Scope, walk: Walk, stack: Set<string>, parentId: string): ResolvedNode[] {
  return nodes.flatMap((node, index) => resolveNode(node, scope, walk, stack, `${parentId}_${index}`))
}

function resolveNode(node: unknown, scope: Scope, walk: Walk, stack: Set<string>, fallbackId: string): ResolvedNode[] {
  if (!isObject(node)) return []

  if (scope.fills && isPlaceholder(node)) {
    const fill = scope.fills.get(slotName(node))
    if (fill) return fill
    return Array.isArray(node.children) ? resolveList(node.children, below(scope, node.id), walk, stack, fallbackId) : []
  }
  if (node.injectable === true && typeof node.id === 'string') {
    // A marker is not charged: it renders as its injection.
    const marker = entry(node, scope, node.id)
    marker.children = injected(marker.renderedId ?? marker.id, walk, stack)
    return [marker]
  }

  charge(walk)
  const self = entry(node, scope, fallbackId)
  const use = typeof node.use === 'string' ? node.use.trim() : ''
  if (use && isObject(walk.definitions[use]) && !stack.has(use)) {
    expandInstance(self, node, use, scope, walk, stack)
    return [self]
  }

  // A use: node whose definition the tree cannot see (imported, or a built-in
  // std pattern) still lists the fills its author wrote on it.
  const lists = use ? fillLists(node).map(([, fill]) => fill)
    : [Array.isArray(node.children) ? node.children : Array.isArray(node.body) ? node.body : []]
  const rows = typeof node.id === 'string' ? walk.engine.repeatRows(node, node.id) : []
  // Caller content is checked as it is reached; what an instance namespaces was checked when it expanded.
  if (rows.length > 0 && scope.namespace === null) checkRows(node, self.id, walk)
  const inner = below(scope, node.id)
  self.children = [
    ...lists.flatMap((list) => resolveList(list, inner, walk, stack, self.id)),
    ...rows.flatMap((row) => resolveNode(row, inner, walk, stack, row.id)),
  ]
  return [self]
}

function expandInstance(self: ResolvedNode, node: Doc, use: string, scope: Scope, walk: Walk, stack: Set<string>) {
  const definition = walk.definitions[use] as Doc
  const root = isObject(definition.root) ? definition.root : definition
  const rootId = typeof root.id === 'string' ? root.id : 'root'
  // The instance renders as its definition's root.
  self.type = typeof root.type === 'string' ? root.type : ''
  if (typeof root.component === 'string') self.component = root.component
  const layout = layoutOf(root)
  if (layout) self.layout = layout

  const fills = hasPlaceholders(root) ? new Map(fillLists(node).map(([name, fill]) =>
    [name, resolveList(fill, below(scope, node.id), walk, stack, self.id)] as const)) : null
  const namespace = self.renderedId ?? self.id
  const nested = new Set(stack).add(use)
  // Without placeholders, the instance's children replace the root's children and its rows.
  const replacement = !fills && Array.isArray(node.children) ? node.children : null
  if (replacement) {
    const rendered: Doc = { ...root, children: replacement }
    delete rendered.repeat
    checkDefinitionRows(rendered, rootId, null, walk)
    // They are written where the instance is, and render namespaced under it, as its content does.
    const written = below(scope, node.id)
    const replacing = { ...written, namespace: scope.namespace ? `${namespace}__${scope.namespace}` : namespace }
    self.children = resolveList(replacement, replacing, walk, nested, self.id)
  } else {
    const inner: Scope = {
      author: { docType: 'component', docId: use, path: [rootId] },
      // The definition's content selects this instance (a page node or a row), or,
      // when the instance is itself a definition's content, that content's owner.
      owner: self.internal ? scope.owner : self,
      namespace,
      fills,
    }
    checkDefinitionRows(root, rootId, fills, walk)
    self.children = [
      ...resolveList(Array.isArray(root.children) ? root.children : [], inner, walk, nested, rootId),
      ...walk.engine.repeatRows(root, rootId).flatMap((row) => resolveNode(row, inner, walk, nested, row.id)),
    ]
  }
  // A definition whose root is a marker expands to one, which renders as what
  // the page injects for the instance's id. What it rendered is charged, as the
  // resolver charges it, but not listed.
  if (root.injectable === true) self.children = injected(namespace, walk, stack)
}

/**
 * What the page injects into a marker that renders as `id`, written in the
 * page's injection wherever the marker sits. An injection that reaches its own
 * marker again renders nothing there, so it lists nothing there.
 */
function injected(id: string, walk: Walk, stack: Set<string>): ResolvedNode[] {
  const content = walk.injections.get(id)
  if (!content || content.length === 0 || walk.active.has(id)) return []
  walk.active.add(id)
  const nodes = resolveList(content, scopeAt('page', walk.pageId, [id]), walk, stack, id)
  walk.active.delete(id)
  return nodes
}

function container(id: string, address: string, layout: string | undefined, type: string, children: ResolvedNode[]): ResolvedNode {
  return { id, address, renderedId: id, type, ...(layout ? { layout } : {}), children }
}

/** Content arrays by id: a page's slot fills or its injections. */
function contentMap(list: unknown, idField: string): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>()
  for (const entry of Array.isArray(list) ? list : []) {
    if (!isObject(entry) || typeof entry[idField] !== 'string') continue
    map.set(entry[idField] as string, Array.isArray(entry.content) ? entry.content : Array.isArray(entry.body) ? entry.body : [])
  }
  return map
}

function definitionsIn(parsed: unknown): Doc {
  if (!isObject(parsed)) return {}
  const comps = isObject(parsed.components) ? parsed.components : parsed
  const result: Doc = {}
  for (const [key, val] of Object.entries(comps)) {
    if (key === 'documentType' || key === 'specVersion' || key === 'id' || key === 'imports') continue
    if (isObject(val)) result[key] = val
  }
  return result
}

/**
 * A template's regions. A slot region lists the page's content for it, or,
 * when the page has none, the template's fallback; any other region lists
 * what the template writes in it.
 */
function resolveRegions(template: Doc, templateId: string, page: Doc, walk: Walk): ResolvedNode[] {
  const slots = contentMap(page.slots, 'slotId')
  const result: ResolvedNode[] = []
  for (const region of Array.isArray(template.regions) ? template.regions : []) {
    if (!isObject(region)) continue
    const kind = typeof region.kind === 'string' ? region.kind : 'slot'
    const id = typeof region.id === 'string' ? region.id : ''
    const content = kind === 'slot' ? slots.get(id) : undefined
    if (content) {
      if (content.length === 0) continue
      const children = resolveList(content, scopeAt('page', walk.pageId, [id]), walk, new Set(), id)
      result.push(container(id, `wf://page/${walk.pageId}#${id}`, layoutOf(region), 'region', children))
    } else if (kind !== 'slot' || Array.isArray(region.children)) {
      const authored = Array.isArray(region.children) ? region.children : []
      const children = resolveList(authored, scopeAt('template', templateId, [id]), walk, new Set(), id)
      result.push(container(id, `wf://template/${templateId}#${id}`, layoutOf(region), 'region', children))
    }
  }
  return result
}

function resolvePage(yamlFiles: Record<string, string>, pageId: string, engine: Engine): ResolvedNode[] {
  const pageFile = yamlFiles[`pages/${pageId}.yaml`]
  if (!pageFile) return []
  const parsed = parseYaml(pageFile)
  if (!isObject(parsed)) return []
  const page = isObject(parsed.page) ? parsed.page : parsed

  const definitions: Doc = {}
  if (yamlFiles['components.yaml']) Object.assign(definitions, definitionsIn(parseYaml(yamlFiles['components.yaml'])))

  const templateId = typeof page.template === 'string' ? page.template : ''
  let template: Doc | null = null
  if (templateId && yamlFiles['templates.yaml']) {
    const templatesParsed = parseYaml(yamlFiles['templates.yaml'])
    if (isObject(templatesParsed)) {
      Object.assign(definitions, definitionsIn(templatesParsed))
      const templates = isObject(templatesParsed.templates) ? templatesParsed.templates : templatesParsed
      template = isObject(templates[templateId]) ? templates[templateId] as Doc : null
    }
  }

  // The regions and every overlay share one budget, as they do in the resolver.
  const walk: Walk = { engine, pageId, definitions, injections: contentMap(page.injectables, 'injectableId'), active: new Set(), budget: engine.createExpansionBudget() }
  const body = Array.isArray(page.body) ? page.body : Array.isArray(page.children) ? page.children : []
  const nodes = template ? resolveRegions(template, templateId, page, walk) : resolveList(body, scopeAt('page', pageId, []), walk, new Set(), 'root')

  // An overlay is a root of the page document, so its content is addressed under it.
  const overlays = Array.isArray(page.overlays) ? page.overlays : []
  const first = nodes.length
  overlays.forEach((overlay, index) => {
    if (!isObject(overlay)) return
    const id = typeof overlay.id === 'string' ? overlay.id : `root_${first + index}`
    const content = Array.isArray(overlay.content) ? overlay.content : []
    const children = resolveList(content, scopeAt('page', pageId, [id]), walk, new Set(), id)
    nodes.push(container(id, `wf://page/${pageId}#${id}`, layoutOf(overlay), typeof overlay.type === 'string' ? overlay.type : '', children))
  })
  return nodes
}

/**
 * The page's node tree. A page that would expand past the engine's budget is
 * not listed: the tree says so instead.
 */
export function resolveWorkspaceTree(yamlFiles: Record<string, string>, pageId: string, engine: Engine): WorkspaceTree {
  try {
    return { nodes: resolvePage(yamlFiles, pageId, engine), notice: null }
  } catch (error) {
    if (error instanceof TooLarge) return { nodes: [], notice: { kind: 'too-large', max: error.max, host: error.host } }
    return { nodes: [], notice: null }
  }
}
