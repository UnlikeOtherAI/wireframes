import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SitemapNode } from './types'

interface SitemapViewProps {
  nodes: SitemapNode[]
  activePage: string
  onPageChange: (pageId: string) => void
}

const NODE_WIDTH = 140
const NODE_HEIGHT = 48
const H_GAP = 40
const V_GAP = 60

interface LayoutNode {
  node: SitemapNode
  x: number
  y: number
}

interface Edge {
  from: LayoutNode
  to: LayoutNode
}

function layoutNodes(nodes: SitemapNode[]): { layoutNodes: LayoutNode[]; edges: Edge[] } {
  if (nodes.length === 0) return { layoutNodes: [], edges: [] }

  const nodeMap = new Map<string, SitemapNode>()
  for (const n of nodes) nodeMap.set(n.id, n)

  // Find targets that reference other sitemap nodes
  const incoming = new Set<string>()
  for (const n of nodes) {
    for (const target of n.targets) {
      if (nodeMap.has(target)) incoming.add(target)
    }
  }

  // Root nodes = those with no incoming edges
  const roots = nodes.filter((n) => !incoming.has(n.id))
  if (roots.length === 0) roots.push(nodes[0])

  // BFS to assign rows
  const visited = new Set<string>()
  const rows: SitemapNode[][] = []
  let queue = [...roots]
  for (const r of queue) visited.add(r.id)

  while (queue.length > 0) {
    rows.push(queue)
    const next: SitemapNode[] = []
    for (const n of queue) {
      for (const target of n.targets) {
        const child = nodeMap.get(target)
        if (child && !visited.has(target)) {
          visited.add(target)
          next.push(child)
        }
      }
    }
    queue = next
  }

  // Any unvisited nodes go in the last row
  const remaining = nodes.filter((n) => !visited.has(n.id))
  if (remaining.length > 0) rows.push(remaining)

  const laid: LayoutNode[] = []
  const laidMap = new Map<string, LayoutNode>()

  for (let row = 0; row < rows.length; row++) {
    const cols = rows[row]
    const totalWidth = cols.length * NODE_WIDTH + (cols.length - 1) * H_GAP
    const startX = -totalWidth / 2 + NODE_WIDTH / 2

    for (let col = 0; col < cols.length; col++) {
      const ln: LayoutNode = {
        node: cols[col],
        x: startX + col * (NODE_WIDTH + H_GAP),
        y: row * (NODE_HEIGHT + V_GAP),
      }
      laid.push(ln)
      laidMap.set(cols[col].id, ln)
    }
  }

  const edges: Edge[] = []
  for (const ln of laid) {
    for (const target of ln.node.targets) {
      const toLn = laidMap.get(target)
      if (toLn) edges.push({ from: ln, to: toLn })
    }
  }

  return { layoutNodes: laid, edges }
}

export function SitemapView({ nodes, activePage, onPageChange }: SitemapViewProps) {
  const { t } = useTranslation()
  const { layoutNodes: laid, edges } = useMemo(() => layoutNodes(nodes), [nodes])

  if (nodes.length === 0) {
    return (
      <div
        data-testid="workspace-sitemap-view"
        style={{
          padding: '16px',
          color: '#888',
          fontSize: '13px',
          textAlign: 'center',
        }}
      >
        {t('workspace.noRoutes')}
      </div>
    )
  }

  // Compute SVG viewport
  const minX = Math.min(...laid.map((ln) => ln.x)) - NODE_WIDTH / 2 - 20
  const maxX = Math.max(...laid.map((ln) => ln.x)) + NODE_WIDTH / 2 + 20
  const maxY = Math.max(...laid.map((ln) => ln.y)) + NODE_HEIGHT + 20
  const viewWidth = maxX - minX
  const viewHeight = maxY + 20

  return (
    <div
      data-testid="workspace-sitemap-view"
      style={{ overflow: 'auto', flex: 1, padding: '16px' }}
    >
      <svg
        width={viewWidth}
        height={viewHeight}
        viewBox={`${minX} -20 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label={t('workspace.sitemapDiagram')}
        style={{ display: 'block', margin: '0 auto' }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const fromCx = edge.from.x
          const fromCy = edge.from.y + NODE_HEIGHT
          const toCx = edge.to.x
          const toCy = edge.to.y
          return (
            <line
              key={`e-${i}`}
              x1={fromCx}
              y1={fromCy}
              x2={toCx}
              y2={toCy}
              stroke="#bbb"
              strokeWidth={1.5}
              markerEnd="url(#arrowhead)"
            />
          )
        })}

        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#bbb" />
          </marker>
        </defs>

        {/* Nodes */}
        {laid.map((ln) => {
          const isActive = ln.node.page === activePage || ln.node.id === activePage
          return (
            <g
              key={ln.node.id}
              data-testid={`sitemap-node-${ln.node.id}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onPageChange(ln.node.page)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPageChange(ln.node.page)
                }
              }}
            >
              <rect
                x={ln.x - NODE_WIDTH / 2}
                y={ln.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
                fill={isActive ? '#e3f2fd' : '#fff'}
                stroke={isActive ? '#1976d2' : '#ccc'}
                strokeWidth={isActive ? 2 : 1}
              />
              <text
                x={ln.x}
                y={ln.y + NODE_HEIGHT / 2 - 4}
                textAnchor="middle"
                fontSize={12}
                fontWeight={isActive ? 600 : 400}
                fill="#333"
              >
                {truncateText(ln.node.page, 16)}
              </text>
              <text
                x={ln.x}
                y={ln.y + NODE_HEIGHT / 2 + 10}
                textAnchor="middle"
                fontSize={10}
                fill="#888"
              >
                {truncateText(ln.node.path, 18)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}
