import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResolvedNode } from './types'

interface NodeTreeProps {
  nodes: ResolvedNode[]
  onNodeSelect?: (address: string) => void
  selectedNode?: string | null
}

export function NodeTree({ nodes, onNodeSelect, selectedNode }: NodeTreeProps) {
  const { t } = useTranslation()

  if (nodes.length === 0) {
    return (
      <div
        data-testid="workspace-node-tree"
        style={{
          padding: '12px',
          color: '#888',
          fontSize: '13px',
        }}
      >
        {t('workspace.noNodes')}
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
          key={node.id}
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
  onNodeSelect?: (address: string) => void
  selectedNode?: string | null
}

function NodeTreeItem({ node, depth, onNodeSelect, selectedNode }: NodeTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedNode === node.id

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  const handleSelect = useCallback(() => {
    onNodeSelect?.(node.id)
  }, [onNodeSelect, node.id])

  const label = buildNodeLabel(node)

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
            aria-label={expanded ? 'Collapse' : 'Expand'}
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
              key={child.id}
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

function buildNodeLabel(node: ResolvedNode): string {
  const parts: string[] = []
  if (node.component) parts.push(node.component)
  if (node.type && node.type !== node.component) parts.push(node.type)
  if (node.layout) parts.push(`[${node.layout}]`)
  return parts.join(' ')
}
