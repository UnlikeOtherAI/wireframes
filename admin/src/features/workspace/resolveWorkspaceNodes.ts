// The admin's node tree, resolved the way the engine resolver scopes content:
// definition content is namespaced under the rendered instance id, an
// instance's fills replace its placeholders, and a `repeat` host lists one row
// per keyed item after its children. Each node records who wrote it, so a
// selection edits the document the node is written in.

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

export function buildAddress(docType: string, docId: string, pathParts: string[]): string {
  return `wf://${docType}/${docId}#${pathParts.join('.')}`
}

// Who wrote a node in the tree. Page nodes are edited in the page document; a
// fill sits inside its component's content in the tree but is still written on
// its instance. Component-internal nodes are edited in the component document,
// so selecting one selects the closest page-authored instance, or the repeat
// row it renders inside. A row of a repeat written in a definition is edited in
// that definition's document; `item` marks a row and names its item.
export type Authorship =
  | { kind: 'page'; authorParent?: object; item?: string }
  | { kind: 'internal'; owner: object; renderedId: string }
  | { kind: 'definition'; address: string; renderedId: string; item: string }

const AUTHOR = Symbol('wfAuthor')
// A row before it is resolved: its item, and its definition address when it is written in one.
const ROW = Symbol('wfRepeatRow')

type Authored = Record<string, unknown> & { [AUTHOR]?: Authorship; [ROW]?: { item: string; address?: string } }

export function authorshipOf(node: unknown): Authorship | undefined {
  return isObject(node) ? (node as Authored)[AUTHOR] : undefined
}

// `definition` is the definition being resolved and the path, in it, of the
// node whose children are being resolved: the address of what it writes.
interface Scope {
  owner: object | null
  namespace: string | null
  fills: Map<string, unknown[]> | null
  definition: { id: string; path: string[] } | null
}

const PAGE_SCOPE: Scope = { owner: null, namespace: null, fills: null, definition: null }

/** The scope of what `id`'s node writes below itself. */
function below(scope: Scope, id: unknown): Scope {
  if (!scope.definition || typeof id !== 'string') return scope
  return { ...scope, definition: { ...scope.definition, path: [...scope.definition.path, id] } }
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
  const row = (node as Authored)[ROW]
  const renderedId = scope.namespace ? `${scope.namespace}__${id}` : id
  if (row?.address) copy[AUTHOR] = { kind: 'definition', address: row.address, renderedId, item: row.item }
  else if (scope.owner && scope.namespace) copy[AUTHOR] = { kind: 'internal', owner: scope.owner, renderedId }
  else copy[AUTHOR] = row ? { kind: 'page', item: row.item } : { kind: 'page' }
  return copy
}

/**
 * A host's rows, as the engine writes them: `<host>__<item>` with the cell as
 * its component and the item's other keys as props, one per keyed item. `scope`
 * is the host's own scope, so a definition row is addressed in its definition.
 */
function repeatRows(host: Record<string, unknown>, hostId: string, scope: Scope): Authored[] {
  if (host.use != null || host.injectable === true || isPlaceholder(host) || typeof host.component !== 'string') return []
  const repeat = isObject(host.repeat) ? host.repeat : null
  if (!repeat || typeof repeat.cell !== 'string' || !Array.isArray(repeat.items)) return []
  const seen = new Set<string>()
  const rows: Authored[] = []
  for (const item of repeat.items) {
    if (!isObject(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    seen.add(item.id)
    const { id: itemId, ...props } = item
    const id = `${hostId}__${itemId}`
    const row: Authored = { id, component: repeat.cell, ...(Object.keys(props).length > 0 ? { props } : {}) }
    row[ROW] = scope.definition
      ? { item: itemId as string, address: buildAddress('component', scope.definition.id, [...scope.definition.path, id]) }
      : { item: itemId as string }
    rows.push(row)
  }
  return rows
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
        (entry as Authored)[AUTHOR] = { ...authorship, authorParent: instance }
      }
    }
    fills.set(name, entries)
  }
  return fills
}

export function resolveComponents(
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
      else if (Array.isArray(node.children)) resolved.push(...resolveComponents(node.children, componentDefs, componentStack, below(scope, node.id)))
      continue
    }

    const useRef = typeof node.use === 'string' ? node.use.trim() : ''
    const compRef = typeof node.component === 'string' ? node.component.trim() : ''
    const lookupKey = useRef || compRef
    const merged = authorIn(node, scope)

    if (lookupKey && isObject(componentDefs[lookupKey]) && !componentStack.has(lookupKey)) {
      const def = componentDefs[lookupKey] as Record<string, unknown>
      const root = isObject(def.root) ? def.root : def
      const rootId = typeof root.id === 'string' ? root.id : 'root'
      for (const key of Object.keys(merged)) delete merged[key]
      Object.assign(merged, root)
      delete merged.repeat
      if (typeof node.id === 'string') merged.id = node.id
      if (isObject(node.props) && isObject(root.props)) {
        merged.props = { ...(root.props as Record<string, unknown>), ...(node.props as Record<string, unknown>) }
      }
      const fills = hasPlaceholders(root) ? resolveFills(node, merged, componentDefs, componentStack, below(scope, node.id)) : null
      const authorship = merged[AUTHOR]
      const renderedId = authorship && authorship.kind !== 'page' ? authorship.renderedId : String(merged.id ?? '')
      const newStack = new Set(componentStack)
      newStack.add(lookupKey)
      // A row's internals select the row; any other instance's select the page instance.
      const rootScope: Scope = {
        owner: authorship && 'item' in authorship && authorship.item ? merged : scope.owner ?? merged,
        namespace: renderedId,
        fills,
        definition: { id: lookupKey, path: [rootId] },
      }
      merged.children = [
        ...resolveComponents(Array.isArray(root.children) ? root.children as unknown[] : [], componentDefs, newStack, rootScope),
        ...resolveComponents(repeatRows(root, rootId, rootScope), componentDefs, newStack, rootScope),
      ]
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
      const hostScope = below(scope, node.id)
      const rows = typeof node.id === 'string' ? repeatRows(node, node.id, hostScope) : []
      if (childArr || namedFills.length > 0 || rows.length > 0) {
        merged.children = [
          ...resolveComponents([...(childArr ?? []), ...namedFills], componentDefs, componentStack, hostScope),
          ...resolveComponents(rows, componentDefs, componentStack, hostScope),
        ]
      }
      resolved.push(merged)
    }
  }
  return resolved
}
