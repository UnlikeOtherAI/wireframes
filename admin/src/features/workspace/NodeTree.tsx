import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResolvedNode, TreeNotice } from './types'

/** A selection is the address it edits and the rendered node it was made on. */
type NodeSelect = (address: string, renderedId: string) => void

interface NodeTreeProps {
  nodes: ResolvedNode[]
  onNodeSelect?: NodeSelect
  selectedNode?: string | null
  /** Why the page lists no nodes, when it has some. */
  notice?: TreeNotice | null
}

export function NodeTree({ nodes, onNodeSelect, selectedNode, notice }: NodeTreeProps) {
  const { t } = useTranslation()

  if (nodes.length === 0) {
    return (
      <div
        data-testid="workspace-node-tree"
        role={notice ? 'status' : undefined}
        style={{
          padding: '12px',
          color: notice?.kind === 'too-large' ? '#991b1b' : '#666',
          fontSize: '13px',
        }}
      >
        {noticeText(notice ?? null, t)}
      </div>
    )
  }

  return (
    <div
      data-testid="workspace-node-tree"
      role="tree"
      aria-label={t('workspace.nodeTree')}
      style={{ overflow: 'auto', fontSize: '13px' }}
    >
      {nodes.map((node) => (
        <NodeTreeItem
          key={node.renderedId ?? node.address}
          node={node}
          depth={0}
          onNodeSelect={onNodeSelect}
          selectedNode={selectedNode}
        />
      ))}
    </div>
  )
}

interface NodeTreeItemProps {
  node: ResolvedNode
  depth: number
  onNodeSelect?: NodeSelect
  selectedNode?: string | null
}

function NodeTreeItem({ node, depth, onNodeSelect, selectedNode }: NodeTreeItemProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  // A node a component renders selects its owner, which shows as selected instead.
  const isSelected = !node.internal && selectedNode === node.address

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handleSelect = useCallback(() => {
    onNodeSelect?.(node.address, node.renderedId ?? node.id)
  }, [onNodeSelect, node.address, node.renderedId, node.id])

  const label = [buildNodeLabel(node), node.repeatItem ? t('workspace.repeatItem', { item: node.repeatItem }) : '']
    .filter(Boolean).join(' ')

  return (
    <div role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <div
        data-testid={`node-tree-item-${node.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: `${8 + depth * 16}px`,
          paddingRight: '8px',
          minHeight: '28px',
          cursor: 'pointer',
          background: isSelected ? '#e3f2fd' : 'transparent',
          borderLeft: isSelected ? '2px solid #1976d2' : '2px solid transparent',
        }}
      >
        {hasChildren ? (
          <button
            onClick={handleToggle}
            aria-label={expanded ? t('workspace.collapse') : t('workspace.expand')}
            style={{
              width: '16px',
              height: '16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: 0,
              fontSize: '10px',
              color: '#666',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {expanded ? '\u25BC' : '\u25B6'}
          </button>
        ) : (
          <span style={{ width: '16px', flexShrink: 0 }} />
        )}
        <button
          onClick={handleSelect}
          style={{
            flex: 1,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            padding: '2px 4px',
            fontSize: '12px',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minHeight: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ color: '#1976d2', fontWeight: 500 }}>{node.id}</span>
          <span style={{ color: '#888', fontSize: '11px' }}>{label}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <div role="group">
          {node.children.map((child) => (
            <NodeTreeItem
              key={child.renderedId ?? child.address}
              node={child}
              depth={depth + 1}
              onNodeSelect={onNodeSelect}
              selectedNode={selectedNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function noticeText(notice: TreeNotice | null, t: (key: string, options?: Record<string, unknown>) => string): string {
  switch (notice?.kind) {
    case 'loading':
      return t('common.loading')
    case 'unavailable':
      return t('workspace.rendererUnavailable')
    case 'too-large':
      return notice.host
        ? t('workspace.treeTooLargeRepeat', { host: notice.host, max: notice.max })
        : t('workspace.treeTooLarge', { max: notice.max })
    default:
      return t('workspace.noNodes')
  }
}

function buildNodeLabel(node: ResolvedNode): string {
  const parts: string[] = []
  if (node.component) parts.push(node.component)
  if (node.type && node.type !== node.component) parts.push(node.type)
  if (node.layout) parts.push(`[${node.layout}]`)
  return parts.join(' ')
}
